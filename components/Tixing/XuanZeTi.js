import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb, FaCog } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存 ---
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (typeof window === 'undefined') return Promise.resolve();
    if (this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { resolve(); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    if (typeof window === 'undefined') return null;
    await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const res = req.result;
        resolve((res && res.size > 0) ? res : null);
      };
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (typeof window === 'undefined') return;
    await this.init();
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(blob, key);
    });
  }
};

// --- 2. 音频控制器 (支持动态设置) ---
const audioController = {
  currentAudio: null,
  playlist: [],
  activeBlobUrls: [],
  latestRequestId: 0,
  _pendingFetches: [],

  stop() {
    if (typeof window === 'undefined') return;
    this.latestRequestId++;
    this._pendingFetches.forEach(ctrl => { try { ctrl.abort(); } catch (e) {} });
    this._pendingFetches = [];
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    this.playlist = [];
    if (this.activeBlobUrls.length > 0) {
      this.activeBlobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (e) {} });
      this.activeBlobUrls = [];
    }
  },

  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh';
  },

  async fetchAudioBlob(text, lang, preferredVoice) {
    if (typeof window === 'undefined') return null;
    
    let voice = 'zh-CN-XiaoyouMultilingualNeural'; 
    if (lang === 'my') voice = 'my-MM-NilarNeural'; 
    if (lang === 'zh' && preferredVoice) voice = preferredVoice; 

    const cacheKey = `tts-${voice}-${text}-0`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=0`;
    const controller = new AbortController();
    this._pendingFetches.push(controller);
    try {
      const res = await fetch(apiUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`TTS Fetch failed`);
      const blob = await res.blob();
      if (blob.size === 0) return null;
      await idb.set(cacheKey, blob);
      return blob;
    } catch (e) {
        return null;
    } finally {
      this._pendingFetches = this._pendingFetches.filter(c => c !== controller);
    }
  },

  async playMixed(text, onStart, onEnd, settings = {}) {
    if (typeof window === 'undefined') return;
    this.stop();
    if (!text) { if (onEnd) onEnd(); return; }
    const reqId = ++this.latestRequestId;
    if (onStart) onStart();

    const { voice = 'zh-CN-XiaoyouMultilingualNeural', speed = 1.0 } = settings;

    const segments = [];
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const segmentText = match[0].trim();
      if (segmentText && /[\u4e00-\u9fa5a-zA-Z0-9\u1000-\u109F]/.test(segmentText)) {
        segments.push({ text: segmentText, lang: this.detectLanguage(segmentText) });
      }
    }

    if (segments.length === 0) { if (onEnd) onEnd(); return; }

    try {
      const blobs = await Promise.all(segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang, voice)));
      if (reqId !== this.latestRequestId) return;

      const validBlobs = [];
      const validSegments = [];
      blobs.forEach((b, i) => { if (b) { validBlobs.push(b); validSegments.push(segments[i]); } });

      if (validBlobs.length === 0) { if (onEnd) onEnd(); return; }

      const audioObjects = validBlobs.map((blob, index) => {
        const url = URL.createObjectURL(blob);
        this.activeBlobUrls.push(url);
        const audio = new Audio(url);
        const isZh = validSegments[index].lang === 'zh';
        audio.playbackRate = isZh ? speed : 1.0; 
        return audio;
      });

      this.playlist = audioObjects;

      const playNext = (index) => {
        if (reqId !== this.latestRequestId) return;
        if (index >= audioObjects.length) {
          this.currentAudio = null;
          if (onEnd) onEnd();
          return;
        }
        const audio = audioObjects[index];
        this.currentAudio = audio;
        audio.onended = () => playNext(index + 1);
        audio.onerror = () => playNext(index + 1);
        audio.play().catch(() => {
            this.stop();
            if (onEnd) onEnd();
        });
      };
      playNext(0);
    } catch (e) {
      if (onEnd) onEnd();
    }
  }
};


// --- 3. 样式定义 ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');

  :root {
    --primary-color: #6366f1;
    --primary-light: #818cf8;
    --primary-dark: #4f46e5;
    --success-color: #10b981;
    --error-color: #ef4444;
    --bg-color: #f1f5f9;
    --text-main: #1e293b;
    --text-sub: #64748b;
    --white: #ffffff;
  }

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    background-color: var(--bg-color);
    overflow: hidden;
  }

  /* 滚动区域 */
  .xzt-scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 0 180px 0;
    display: flex; flex-direction: column; align-items: center;
    scrollbar-width: none;
  }
  .xzt-scroll-area::-webkit-scrollbar { display: none; }

  /* 顶部设置栏 */
  .top-bar {
    width: 100%;
    max-width: 600px;
    display: flex; justify-content: flex-end;
    padding: 16px 20px;
    z-index: 10;
  }
  .settings-btn {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    display: flex; align-items: center; justify-content: center;
    color: var(--text-sub);
    cursor: pointer;
    transition: transform 0.2s;
  }
  .settings-btn:active { transform: scale(0.95); }

  /* --- 场景区域 (人物 + 气泡) --- */
  .scene-wrapper {
    width: 100%; max-width: 600px;
    padding: 10px 20px 0 20px; 
    display: flex;
    align-items: flex-end;
    justify-content: center; 
    margin-bottom: 24px;
    position: relative;
    gap: 20px; /* 人物与气泡的空隙 */
  }

  /* 人物图片 - mix-blend-mode 修复白底 */
  .teacher-img {
    height: 160px; /* 尺寸 */
    width: auto;
    object-fit: contain;
    z-index: 2;
    mix-blend-mode: multiply; 
    filter: contrast(1.05);
    flex-shrink: 0;
  }

  /* 气泡容器 */
  .bubble-container {
    flex: 1;
    max-width: 280px;
    width: fit-content;
    background: var(--white);
    border-radius: 18px;
    padding: 14px 18px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.06);
    position: relative;
    z-index: 1;
    margin-bottom: 35px;
    border: 1px solid rgba(255,255,255,0.8);
  }

  /* 气泡尾巴 */
  .bubble-tail {
    position: absolute;
    bottom: 20px;
    left: -12px;
    width: 0; 
    height: 0; 
    border-top: 10px solid transparent;
    border-bottom: 10px solid transparent; 
    border-right: 20px solid var(--white);
    filter: drop-shadow(-2px 0 1px rgba(0,0,0,0.03));
  }

  .bubble-content { display: flex; flex-direction: column; }
  
  .rich-text-container {
    display: flex; flex-wrap: wrap;
    align-items: flex-end;
    gap: 3px; line-height: 1.4;
    margin-bottom: 8px;
  }
  
  /* 气泡内文字更小 */
  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; }
  .pinyin-top { font-size: 0.75rem; color: var(--text-sub); margin-bottom: -1px; font-weight: 500; }
  .cn-char { font-size: 1.15rem; font-weight: 700; color: var(--text-main); }
  .other-text-block { font-size: 1.0rem; font-weight: 600; color: var(--text-main); margin: 0 2px; transform: translateY(-2px); }

  .bubble-audio-btn {
    align-self: flex-end;
    width: 28px; height: 28px;
    background: #eef2ff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: var(--primary-color);
    cursor: pointer; font-size: 0.8rem;
    margin-top: 4px;
  }
  .bubble-audio-btn.playing { background: var(--primary-color); color: white; animation: pulse 1.2s infinite; }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
    100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  }

  .question-ref-img {
    width: 100%; max-height: 140px; object-fit: contain;
    border-radius: 8px; margin-bottom: 5px;
    background: #f8fafc;
    display: block;
  }

  /* --- 选项区域 --- */
  .xzt-options-grid { 
    width: 90%; 
    max-width: 480px; 
    display: grid; 
    gap: 12px;
    grid-template-columns: 1fr; /* 默认单列 */
  }

  /* 有图片的选项改为两列 */
  .xzt-options-grid.grid-images {
    grid-template-columns: 1fr 1fr;
  }
  
  .xzt-option-card {
    position: relative;
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    cursor: pointer;
    padding: 14px 18px;
    display: flex; 
    align-items: center; /* 垂直居中 (Text模式) */
    border: 2px solid transparent;
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    overflow: hidden;
  }

  /* 图片模式的卡片布局 */
  .xzt-option-card.card-with-image {
    flex-direction: column; /* 垂直排列：上图下文 */
    padding: 0; /* 图片贴边，去掉padding */
    align-items: stretch; /* 宽度拉伸 */
  }

  .xzt-option-card:not(.disabled):active { transform: scale(0.97); background: #f8fafc; }
  .xzt-option-card.selected { border-color: var(--primary-color); background: #eef2ff; }
  
  .xzt-option-card.correct-answer { border-color: var(--success-color); background: #ecfdf5; }
  .xzt-option-card.wrong-answer { border-color: var(--error-color); background: #fef2f2; opacity: 0.9; }
  .xzt-option-card.disabled { pointer-events: none; }

  /* 选项内的图片样式 */
  .opt-img {
    width: 45px; height: 45px; border-radius: 8px;
    object-fit: cover; margin-right: 12px; flex-shrink: 0;
    background-color: #f1f5f9;
  }

  /* 图片模式下的图片样式（变大、贴顶） */
  .card-with-image .opt-img {
    width: 100%;
    height: 130px; /* 图片高度 */
    margin-right: 0;
    margin-bottom: 0;
    border-radius: 0;
    object-fit: cover;
  }

  /* 选项文字居中显示 */
  .opt-content { 
    flex: 1; 
    display: flex; 
    flex-direction: column; 
    justify-content: center; 
    align-items: center; 
    text-align: center;
  }

  /* 图片模式下的文字容器要加回Padding */
  .card-with-image .opt-content {
    padding: 12px 10px;
  }

  .opt-py { font-size: 0.8rem; color: var(--text-sub); margin-bottom: 2px; }
  .opt-txt { font-size: 1.1rem; font-weight: 600; color: var(--text-main); }
  
  .status-icon { font-size: 1.4rem; margin-left: 10px; position: absolute; right: 16px; }
  /* 图片模式下状态图标位置调整 */
  .card-with-image .status-icon { top: 8px; right: 8px; background: rgba(255,255,255,0.8); border-radius: 50%; padding: 2px; }

  .text-green { color: var(--success-color); }
  .text-red { color: var(--error-color); }

  /* --- 底部提交按钮 --- */
  .bottom-submit-area {
    position: fixed; bottom: 30px; left: 0; right: 0;
    display: flex; justify-content: center;
    pointer-events: none; z-index: 50;
  }
  .submit-btn {
    pointer-events: auto;
    background: var(--primary-color);
    color: white; border: none;
    padding: 14px 70px;
    border-radius: 99px;
    font-size: 1.1rem; font-weight: 700;
    box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.4);
    transition: transform 0.2s;
    text-align: center;
  }
  .submit-btn:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }
  .submit-btn:active { transform: scale(0.96); }

  /* --- 设置弹窗 (Overlay) --- */
  .settings-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 200;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.2s;
    backdrop-filter: blur(4px);
  }
  .settings-overlay.show { opacity: 1; pointer-events: auto; }
  
  .settings-panel {
    background: white; width: 85%; max-width: 320px;
    border-radius: 20px; padding: 24px;
    transform: scale(0.9); transition: transform 0.2s;
  }
  .settings-overlay.show .settings-panel { transform: scale(1); }

  .setting-group { margin-bottom: 20px; }
  .setting-label { font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 10px; display: block;}
  
  .setting-select {
    width: 100%; padding: 10px; border-radius: 10px;
    border: 1px solid #e2e8f0; background: #f8fafc;
    font-size: 1rem; color: var(--text-main);
  }
  
  .speed-options { display: flex; gap: 8px; }
  .speed-btn {
    flex: 1; padding: 8px; border-radius: 8px;
    border: 1px solid #e2e8f0; background: white;
    font-size: 0.9rem; font-weight: 500; color: var(--text-sub);
    cursor: pointer;
  }
  .speed-btn.active {
    background: var(--primary-color); color: white; border-color: var(--primary-color);
  }

  .close-settings-btn {
    width: 100%; padding: 12px;
    background: #f1f5f9; color: var(--text-main);
    border: none; border-radius: 12px;
    font-weight: 700; cursor: pointer;
  }

  /* --- 解析遮罩层 (底部) --- */
  .overlay-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.1);
    z-index: 90;
    opacity: 0; pointer-events: none;
    transition: opacity 0.3s;
  }
  .overlay-backdrop.show { opacity: 1; pointer-events: auto; }

  /* 底部面板根据状态变色 - 透明度增加，尺寸加大 */
  .explanation-sheet {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: white;
    border-radius: 24px 24px 0 0;
    box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
    z-index: 100;
    transform: translateY(110%);
    transition: transform 0.35s cubic-bezier(0.19, 1, 0.22, 1);
    
    /* 加大尺寸 */
    padding: 32px 24px 50px 24px;
    display: flex; flex-direction: column; gap: 20px;
    
    border-top: 1px solid rgba(0,0,0,0.05);
    backdrop-filter: blur(10px); /* 磨砂效果 */
  }
  .explanation-sheet.show { transform: translateY(0); }

  /* 答对时的样式：带透明度的大绿色背景 */
  .explanation-sheet.is-right {
    background: rgba(240, 253, 244, 0.85); /* 浅绿带透明 */
    border-top-color: var(--success-color);
  }
  /* 答错时的样式：带透明度的大红色背景 */
  .explanation-sheet.is-wrong {
    background: rgba(254, 242, 242, 0.85); /* 浅红带透明 */
    border-top-color: var(--error-color);
  }

  .sheet-header { display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .result-badge {
    padding: 8px 24px; border-radius: 30px;
    font-size: 1.2rem; font-weight: 800;
    display: flex; align-items: center; gap: 8px;
    background: white; box-shadow: 0 4px 10px rgba(0,0,0,0.05);
  }
  .is-right .result-badge { color: var(--success-color); }
  .is-wrong .result-badge { color: var(--error-color); }

  .explanation-box {
    background: rgba(255, 255, 255, 0.8); /* 解释框也要带点半透明 */
    border-radius: 16px;
    padding: 20px;
    border: 1px solid rgba(0,0,0,0.05);
    text-align: center; /* 解释内容也居中 */
  }
  .exp-label { font-size: 0.9rem; font-weight: 700; color: var(--text-sub); margin-bottom: 8px; display:flex; align-items:center; justify-content: center; gap:6px;}
  .exp-text { font-size: 1rem; color: var(--text-main); line-height: 1.6; }

  .next-btn {
    width: 100%;
    background: var(--text-main);
    color: white; border: none;
    padding: 18px;
    border-radius: 18px;
    font-size: 1.15rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    margin-top: 10px; cursor: pointer;
  }
  .is-right .next-btn { background: var(--success-color); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.3); }
  .is-wrong .next-btn { background: var(--error-color); box-shadow: 0 6px 15px rgba(239, 68, 68, 0.3); }
`;


// --- 4. 文本解析 ---
const parseTitleText = (text) => {
  if (!text) return [];
  const result = [];
  const regex = /([\p{Script=Han}]+)|([^\p{Script=Han}]+)/gu;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const segment = match[0];
    if (/\p{Script=Han}/u.test(segment)) {
      const pinyins = pinyin(segment, { type: 'array', toneType: 'symbol' });
      segment.split('').forEach((char, i) => {
        result.push({ type: 'zh', char, pinyin: pinyins[i] || '' });
      });
    } else {
      result.push({ type: 'other', text: segment });
    }
  }
  return result;
};

const parseOptionText = (text) => {
  const isZh = /[\u4e00-\u9fa5]/.test(text);
  if (!isZh) return { isZh: false, text };
  const pinyins = pinyin(text, { type: 'array', toneType: 'symbol', nonZh: 'consecutive' });
  return { isZh: true, text, pinyins: pinyins.join(' ') };
};

// --- 5. 语音列表 ---
const VOICE_OPTIONS = [
  { id: 'zh-CN-XiaoyouMultilingualNeural', name: '中文-女声 (小悠)' },
  { id: 'zh-CN-YunxiNeural', name: '中文-男声 (云希)' },
  { id: 'zh-CN-XiaoxiaoNeural', name: '中文-活泼女声 (晓晓)' },
  { id: 'zh-TW-HsiaoChenNeural', name: '台湾-女声 (晓臻)' }
];

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5];


// --- 6. 组件主体 ---
const XuanZeTi = (props) => {
  const rawData = props.data || props;
  const rawQuestion = props.question || rawData.question || {};
  const rawOptions = props.options || rawData.options || [];
  const rawCorrectAnswer = props.correctAnswer || rawData.correctAnswer || [];
  const explanationText = props.explanation || rawData.explanation || "";

  const questionText = typeof rawQuestion === 'string' ? rawQuestion : (rawQuestion.text || '');
  const questionImage = typeof rawQuestion === 'object' ? rawQuestion.imageUrl : null;
  const teacherImage = "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png";
  
  const { onCorrect, onIncorrect, onNext } = props;

  // 状态
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  
  const [titleSegments, setTitleSegments] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 设置状态
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    voice: 'zh-CN-XiaoyouMultilingualNeural',
    speed: 1.0
  });

  const mountedRef = useRef(true);
  const hasAutoPlayedRef = useRef(false);

  // 初始化与重置逻辑
  useEffect(() => {
    mountedRef.current = true;
    
    // 切换题目时重置
    audioController.stop();
    setIsPlaying(false);
    setSelectedId(null);
    setIsSubmitted(false);
    setIsRight(false);
    hasAutoPlayedRef.current = false;

    setTitleSegments(parseTitleText(questionText));
    setOrderedOptions(rawOptions.map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    // 自动播放
    if (questionText) {
      const timer = setTimeout(() => {
        if (mountedRef.current && !hasAutoPlayedRef.current) {
          handleTitlePlay(null, true);
          hasAutoPlayedRef.current = true;
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    return () => { mountedRef.current = false; audioController.stop(); };
  }, [questionText, rawOptions]); 

  // 判断是否应该以图片模式显示选项 (只要有一个选项有图片，就采用Grid模式)
  const hasOptionImages = orderedOptions.some(opt => opt.hasImage);

  // 播放处理 (传入当前设置)
  const handleTitlePlay = (e, isAuto = false) => {
    if (e) e.stopPropagation();
    
    // 自动播放时不震动，手动点击时震动
    if (!isAuto && navigator.vibrate) navigator.vibrate(30);

    audioController.playMixed(
      questionText,
      () => setIsPlaying(true),
      () => setIsPlaying(false),
      settings // 传入 voice 和 speed
    );
  };

  const handleCardClick = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    // 选项播放也使用当前语速和发音人（如果是中文）
    audioController.playMixed(option.text || '', null, null, settings);
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    
    const isCorrect = rawCorrectAnswer.map(String).includes(String(selectedId));
    setIsRight(isCorrect);
    setIsSubmitted(true);
    audioController.stop();

    if (isCorrect) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ['#10b981', '#34d399', '#fcd34d'] });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  const handleNext = () => {
    if (isRight) {
      if (onCorrect) onCorrect();
    } else {
      if (onIncorrect) onIncorrect();
    }
    if (onNext) onNext();
  };

  return (
    <>
      <style>{cssStyles}</style>

      <div className="xzt-container">
        
        {/* 顶部栏 */}
        <div className="top-bar">
          <div className="settings-btn" onClick={() => setShowSettings(true)}>
            <FaCog />
          </div>
        </div>

        {/* 滚动区域 */}
        <div className="xzt-scroll-area">
          
          {/* 场景区域：人物+气泡 */}
          <div className="scene-wrapper">
            <img src={teacherImage} alt="Teacher" className="teacher-img" />
            
            <div className="bubble-container">
              <div className="bubble-tail"></div>
              
              <div className="bubble-content">
                {/* 
                  逻辑修改：
                  如果标题有图片 (questionImage)，则只显示图片。
                  如果没有图片，则显示文本。
                */}
                {questionImage ? (
                  <img src={questionImage} alt="ref" className="question-ref-img" />
                ) : (
                  <div className="rich-text-container">
                    {titleSegments.map((seg, i) => (
                      seg.type === 'zh' ? (
                        <div key={i} className="cn-block">
                          <span className="pinyin-top">{seg.pinyin}</span>
                          <span className="cn-char">{seg.char}</span>
                        </div>
                      ) : (
                        <span key={i} className="other-text-block">{seg.text}</span>
                      )
                    ))}
                  </div>
                )}

                <div 
                  className={`bubble-audio-btn ${isPlaying ? 'playing' : ''}`} 
                  onClick={(e) => handleTitlePlay(e, false)}
                >
                  <FaVolumeUp />
                </div>
              </div>
            </div>
          </div>

          {/* 选项网格 */}
          {/* 
             如果有选项图片，增加 'grid-images' 类，使网格变为2列。
          */}
          <div className={`xzt-options-grid ${hasOptionImages ? 'grid-images' : ''}`}>
            {orderedOptions.map(opt => {
              const isSel = String(opt.id) === String(selectedId);
              const isCorrectOpt = rawCorrectAnswer.map(String).includes(String(opt.id));
              
              let cardClass = "";
              if (opt.hasImage) cardClass += " card-with-image"; // 图片模式的特殊样式类

              if (isSubmitted) {
                cardClass += " disabled";
                if (isCorrectOpt) cardClass += " correct-answer";
                else if (isSel) cardClass += " wrong-answer";
              } else if (isSel) {
                cardClass += " selected";
              }

              return (
                <div 
                  key={opt.id} 
                  className={`xzt-option-card ${cardClass}`} 
                  onClick={() => handleCardClick(opt)}
                >
                  {/* 图片显示 */}
                  {opt.hasImage && <img src={opt.imageUrl} alt="" className="opt-img" />}
                  
                  {/* 文字内容区域 */}
                  <div className="opt-content">
                    {opt.parsed.isZh ? (
                      <>
                        <div className="opt-py">{opt.parsed.pinyins}</div>
                        <div className="opt-txt">{opt.text}</div>
                      </>
                    ) : (
                      <div className="opt-txt">{opt.text}</div>
                    )}
                  </div>
                  
                  {isSubmitted && isCorrectOpt && <FaCheck className="status-icon text-green" />}
                  {isSubmitted && isSel && !isCorrectOpt && <FaTimes className="status-icon text-red" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部按钮 (未提交时显示) */}
        {!isSubmitted && (
          <div className="bottom-submit-area">
            <button 
              className="submit-btn"
              onClick={handleSubmit}
              disabled={!selectedId}
            >
              တင်သွင်းသည်
            </button>
          </div>
        )}

        {/* 遮罩层 (用于 Settings 和 Result Sheet) */}
        <div 
          className={`overlay-backdrop ${isSubmitted ? 'show' : ''}`} 
          onClick={() => {}} 
        />

        {/* 底部解析面板 (颜色根据对错变化，带透明背景) */}
        <div className={`explanation-sheet ${isSubmitted ? 'show' : ''} ${isRight ? 'is-right' : 'is-wrong'}`}>
          <div className="sheet-header">
            <div className="result-badge">
              {isRight ? <FaCheck /> : <FaTimes />}
              <span>{isRight ? 'မှန်ပါတယ်' : 'မှားပါတယ်'}</span>
            </div>
          </div>

          {explanationText && (
            <div className="explanation-box">
              <div className="exp-label"><FaLightbulb /> ရှင်းလင်းချက်</div>
              <div className="exp-text">{explanationText}</div>
            </div>
          )}

          <button 
            className="next-btn"
            onClick={handleNext}
          >
            နောက်တစ်ပုဒ် <FaArrowRight />
          </button>
        </div>

        {/* 设置弹窗 */}
        <div className={`settings-overlay ${showSettings ? 'show' : ''}`} onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom: 20, marginTop:0, color:'#1e293b'}}>Playback Settings</h3>
            
            <div className="setting-group">
              <label className="setting-label">Voice / 发音人</label>
              <select 
                className="setting-select"
                value={settings.voice}
                onChange={(e) => setSettings({...settings, voice: e.target.value})}
              >
                {VOICE_OPTIONS.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Speed / 语速 ({settings.speed}x)</label>
              <div className="speed-options">
                {SPEED_OPTIONS.map(s => (
                  <button 
                    key={s} 
                    className={`speed-btn ${settings.speed === s ? 'active' : ''}`}
                    onClick={() => setSettings({...settings, speed: s})}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <button className="close-settings-btn" onClick={() => setShowSettings(false)}>
              Done
            </button>
          </div>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
