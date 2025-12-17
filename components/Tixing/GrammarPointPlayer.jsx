import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { 
  FaPlay, FaPause, FaStepBackward, FaStepForward, 
  FaTimes, FaChevronLeft, FaChevronRight, FaExpand 
} from 'react-icons/fa';
import { TbMultiplier1X, TbMultiplier15X, TbMultiplier05X } from "react-icons/tb";
import { motion, useDragControls } from 'framer-motion';

// =================================================================================
// ===== 1. IndexedDB 工具 (保持不变) =====
// =================================================================================
const DB_NAME = 'MixedTTSCache';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db || typeof window === 'undefined' || !window.indexedDB) return;
    return new Promise((resolve, reject) => {
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
    try { await this.init(); if (!this.db) return null; } catch (e) { return null; }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result?.size > 100 ? req.result : null);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (!blob || blob.size < 100) return;
    try { await this.init(); if (!this.db) return; } catch (e) { return; }
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
  }
};

const inFlightRequests = new Map();

// =================================================================================
// ===== 2. 增强版 Audio Hook (支持倍速和进度) =====
// =================================================================================
function useMixedTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 播放器状态
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const audioObjRef = useRef(null);
  const currentUrlRef = useRef(null);

  useEffect(() => {
    return () => stop();
  }, []);

  // 监听倍速变化
  useEffect(() => {
    if (audioObjRef.current) {
      audioObjRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const stop = useCallback(() => {
    if (audioObjRef.current) {
      audioObjRef.current.pause();
      audioObjRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlayingId(null);
    setCurrentTime(0);
  }, []);

  const fetchAudioBlob = async (text, lang) => {
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-blob-${voice}-${text}`;
    
    // 尝试缓存
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey);

    const promise = (async () => {
      try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        const blob = await res.blob();
        if (blob.size > 100) idb.set(cacheKey, blob);
        return blob;
      } finally { inFlightRequests.delete(cacheKey); }
    })();
    inFlightRequests.set(cacheKey, promise);
    return promise;
  };

  const play = useCallback(async (textOrUrl, uniqueId, isLink = false) => {
    // 如果点击的是当前正在播放的，则暂停/继续
    if (playingId === uniqueId && audioObjRef.current) {
      if (audioObjRef.current.paused) {
        audioObjRef.current.play();
        setIsPlaying(true);
      } else {
        audioObjRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    stop();
    setIsLoading(true);
    setPlayingId(uniqueId);

    try {
      let finalUrl = textOrUrl;

      // 如果不是链接，则是TTS文本，需要转换
      if (!isLink) {
        let cleanText = String(textOrUrl).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').trim();
        if (!cleanText) { setIsLoading(false); return; }
        
        // 简单处理：目前播放器模式只支持单段音频控制进度。
        // 如果是长文本，这里直接请求整段中文（忽略缅语混合以保证进度条可用性，或者你可以保留之前的混合逻辑但进度条会比较难做）
        // 为了"音乐播放器"体验，这里假设是一段完整的TTS
        const blob = await fetchAudioBlob(cleanText, 'zh');
        finalUrl = URL.createObjectURL(blob);
      }

      if (currentUrlRef.current && !isLink) URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = isLink ? null : finalUrl;

      const audio = new Audio(finalUrl);
      audioObjRef.current = audio;
      audio.playbackRate = playbackRate;
      
      // 事件监听
      audio.onloadedmetadata = () => setDuration(audio.duration);
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        setPlayingId(null);
      };
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);

      await audio.play();
      setIsLoading(false);

    } catch (e) {
      console.error("Play failed", e);
      setIsLoading(false);
      setPlayingId(null);
    }
  }, [playbackRate, stop, playingId]);

  const seek = (time) => {
    if (audioObjRef.current) {
      audioObjRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return { 
    play, stop, isPlaying, playingId, isLoading, 
    duration, currentTime, seek, 
    playbackRate, setPlaybackRate 
  };
}

// =================================================================================
// ===== 3. 浮动音乐播放器组件 (UI核心) =====
// =================================================================================
const FloatingMusicPlayer = ({ 
  isPlaying, onToggle, duration, currentTime, onSeek, 
  playbackRate, onRateChange, title, isLoading 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const formatTime = (t) => {
    if (!t || isNaN(t)) return "00:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 切换倍速
  const cycleSpeed = () => {
    if (playbackRate === 1.0) onRateChange(1.25);
    else if (playbackRate === 1.25) onRateChange(0.75);
    else onRateChange(1.0);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      whileDrag={{ scale: 1.05 }}
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        position: 'fixed', bottom: '100px', right: '20px', zIndex: 100,
        touchAction: 'none' // 防止拖动时触发页面滚动
      }}
    >
      <div style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: '24px',
        boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        padding: isExpanded ? '16px' : '10px',
        width: isExpanded ? '280px' : '60px',
        height: isExpanded ? 'auto' : '60px',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        overflow: 'hidden'
      }}>
        
        {/* 收起状态 */}
        {!isExpanded && (
          <div 
            onClick={() => setIsExpanded(true)} 
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2563eb' }}
          >
            {isLoading ? <FaTimes className="spin" /> : (isPlaying ? <span className="music-bars-anim" /> : <FaExpand />)}
          </div>
        )}

        {/* 展开状态 */}
        {isExpanded && (
          <>
            {/* 顶部：标题与关闭 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isPlaying ? '#22c55e' : '#cbd5e1', flexShrink: 0 }}></div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title || "语音播放器"}
                </span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <FaTimes />
              </button>
            </div>

            {/* 中部：控制按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button onClick={cycleSpeed} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', minWidth: '40px' }}>
                {playbackRate}x
              </button>

              <button 
                onClick={onToggle}
                style={{ 
                  width: '48px', height: '48px', borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                  color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)', cursor: 'pointer'
                }}
              >
                {isLoading ? <FaTimes className="spin" /> : (isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: '2px' }} />)}
              </button>
              
              <div style={{ width: '40px' }}></div> {/* 占位，保持居中 */}
            </div>

            {/* 底部：进度条 */}
            <div style={{ width: '100%' }}>
              <input 
                type="range" 
                min="0" max={duration || 100} 
                value={currentTime} 
                onChange={(e) => onSeek(Number(e.target.value))}
                style={{
                  width: '100%', cursor: 'pointer', height: '4px', borderRadius: '2px',
                  accentColor: '#2563eb', marginBottom: '6px', display: 'block'
                }} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 音乐跳动动画 CSS */}
      <style>{`
        .music-bars-anim {
          width: 20px; height: 20px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E");
          background-size: cover;
          animation: bounce 1s infinite alternate;
        }
        @keyframes bounce { from { transform: scale(0.9); } to { transform: scale(1.1); } }
      `}</style>
    </motion.div>
  );
};

// =================================================================================
// ===== 4. 聊天气泡组件 (新功能) =====
// =================================================================================
const ChatMessage = ({ text, role, onPlay, isPlaying }) => {
  const isMe = role === 'B'; // 假设 B 是"我"（右侧），A 是"对方"（左侧）
  
  // 头像颜色
  const avatarColor = isMe ? '#2563eb' : '#ea580c';
  const avatarText = role;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: isMe ? 'row-reverse' : 'row', 
      marginBottom: '20px', 
      gap: '10px',
      alignItems: 'flex-start'
    }}>
      {/* 头像 */}
      <div style={{ 
        width: '40px', height: '40px', borderRadius: '50%', 
        background: avatarColor, color: 'white', 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 'bold', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}>
        {avatarText}
      </div>

      {/* 气泡 */}
      <div 
        onClick={onPlay}
        style={{
          maxWidth: '75%',
          background: isMe ? '#eff6ff' : '#ffffff',
          border: isMe ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
          padding: '12px 16px',
          borderRadius: '16px',
          borderTopRightRadius: isMe ? '2px' : '16px',
          borderTopLeftRadius: isMe ? '16px' : '2px',
          position: 'relative',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'transform 0.1s',
          transform: isPlaying ? 'scale(1.02)' : 'scale(1)'
        }}
      >
        <div style={{ fontSize: '15px', color: '#1e293b', lineHeight: '1.6' }}>
          {/* 渲染文本，支持高亮 */}
          {text.split(/(\{\{.*?\}\})/).map((part, i) => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
               return <span key={i} style={{ color: isMe ? '#1d4ed8' : '#c2410c', fontWeight: 'bold' }}>{part.slice(2, -2)}</span>;
            }
            return part;
          })}
        </div>
        
        {/* 播放状态指示器 */}
        {isPlaying && (
          <div style={{ position: 'absolute', bottom: '-20px', right: isMe ? '0' : 'auto', left: isMe ? 'auto' : '0', fontSize: '10px', color: '#2563eb', fontWeight: 'bold' }}>
            正在朗读...
          </div>
        )}
      </div>
    </div>
  );
};

// =================================================================================
// ===== 5. 内容解析器 (自动分离对话) =====
// =================================================================================
const parseContent = (htmlString) => {
  if (!htmlString) return { explanation: [], dialogues: [] };
  
  const lines = htmlString.split('\n');
  const explanationLines = [];
  const dialogues = [];
  let isDialogueSection = false;

  lines.forEach(line => {
    const trim = line.trim();
    if (!trim) { explanationLines.push({type: 'br'}); return; }
    
    // 检测是否进入对话部分 (模糊匹配)
    if (trim.includes('对话') && (trim.startsWith('##') || trim.startsWith('◆'))) {
      isDialogueSection = true;
      return; 
    }

    // 识别对话行 "A: ..." 或 "B: ..."
    const dialogueMatch = trim.match(/^([AB])[:：](.*)/);
    
    if (dialogueMatch) {
      // 只要匹配到A/B，就认为是对话，无论是否在对话章节下
      dialogues.push({
        id: Math.random().toString(36).substr(2, 9),
        role: dialogueMatch[1].toUpperCase(),
        text: dialogueMatch[2].trim()
      });
    } else {
      // 非对话内容，只有在非对话章节才加入解释
      if (!isDialogueSection) {
        explanationLines.push({ type: 'text', content: trim });
      }
    }
  });

  return { explanationLines, dialogues };
};

// =================================================================================
// ===== 6. 主组件: GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const lastDirection = useRef(0);
  const contentRef = useRef(null);
  
  // 引入新的播放器钩子
  const { 
    play, stop, isPlaying, playingId, isLoading, 
    duration, currentTime, seek, 
    playbackRate, setPlaybackRate 
  } = useMixedTTS();

  const currentGp = grammarPoints[currentIndex] || {};
  
  // 解析当前内容，分离解释和对话
  const { explanationLines, dialogues } = useMemo(() => 
    parseContent(currentGp['语法详解'] || currentGp.visibleExplanation || ''), 
  [currentGp]);

  const transitions = useTransition(currentIndex, {
    key: currentGp.id || currentIndex,
    from: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '100%' : '-100%'})` },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
    config: { mass: 1, tension: 280, friction: 30 },
  });

  const handleNext = () => {
    stop();
    if (currentIndex < grammarPoints.length - 1) {
      lastDirection.current = 1;
      setCurrentIndex(p => p + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    stop();
    if (currentIndex > 0) {
      lastDirection.current = -1;
      setCurrentIndex(p => p - 1);
    }
  };

  // 生成顶部解释的HTML (不包含对话)
  const renderExplanationHtml = () => {
    let html = '';
    explanationLines.forEach(item => {
      if (item.type === 'br') html += '<div style="height:10px"></div>';
      else {
        // 简单的Markdown处理
        let t = item.content;
        if (t.startsWith('##')) html += `<h2>${t.replace(/^##\s*/, '')}</h2>`;
        else if (t.startsWith('✅')) html += `<div class="check-item correct">✅ ${t.substring(1)}</div>`;
        else if (t.startsWith('❌')) html += `<div class="check-item wrong">❌ ${t.substring(1)}</div>`;
        else if (t.startsWith('◆')) html += `<div class="pattern-item">${t}</div>`;
        else html += `<p>${t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</p>`;
      }
    });
    return html;
  };

  return (
    <div style={styles.container}>
      {/* 浮动播放器 (全局) */}
      <FloatingMusicPlayer 
        isPlaying={isPlaying}
        isLoading={isLoading}
        onToggle={() => play(playingId === 'main_narration' ? null : (currentGp['讲解脚本'] || currentGp.grammarPoint), 'main_narration')}
        duration={duration}
        currentTime={currentTime}
        onSeek={seek}
        playbackRate={playbackRate}
        onRateChange={setPlaybackRate}
        title={playingId === 'main_narration' ? "语法讲解" : "对话朗读"}
      />

      {transitions((style, i) => {
        const gp = grammarPoints[i];
        if (!gp) return null;
        
        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                {/* 1. 标题区 */}
                <div style={styles.header}>
                  <h2 style={styles.title}>{gp['语法标题'] || gp.grammarPoint}</h2>
                  {/* 点击这个播放按钮，将触发 "main_narration" */}
                  <button 
                    onClick={() => play(gp['讲解脚本'] || gp.grammarPoint, 'main_narration')}
                    style={styles.mainPlayBtn}
                  >
                    {playingId === 'main_narration' && isPlaying ? <FaPause /> : <FaPlay />} 
                    <span style={{marginLeft:8}}>听讲解</span>
                  </button>
                </div>

                {/* 2. 句型结构 */}
                {gp['句型结构'] && (
                  <div style={styles.patternBox}>
                    <div style={styles.patternLabel}>句型结构</div>
                    <div style={styles.patternText}>{gp['句型结构']}</div>
                  </div>
                )}

                {/* 3. 语法详解 (解析后的剩余部分) */}
                <div style={styles.section}>
                  <div 
                    className="rich-text-content"
                    dangerouslySetInnerHTML={{ __html: renderExplanationHtml() }} 
                  />
                </div>

                {/* 4. 对话区 (新版气泡) */}
                {dialogues.length > 0 && (
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>💬 场景对话</div>
                    <div style={styles.chatContainer}>
                      {dialogues.map((d) => (
                        <ChatMessage 
                          key={d.id} 
                          role={d.role} 
                          text={d.text} 
                          isPlaying={playingId === d.id && isPlaying}
                          onPlay={() => play(d.text, d.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ height: '140px' }}></div>
              </div>
            </div>

            {/* 底部导航 */}
            <div style={styles.bottomBar}>
              <button 
                onClick={handlePrev} 
                style={{ ...styles.navBtn, opacity: i === 0 ? 0 : 1, pointerEvents: i === 0 ? 'none' : 'auto' }}
              >
                <FaChevronLeft /> 上一个
              </button>
              <div style={styles.pageIndicator}>{i + 1} / {grammarPoints.length}</div>
              <button onClick={handleNext} style={{ ...styles.navBtn, background: '#2563eb', color: 'white' }}>
                {i === grammarPoints.length - 1 ? '完成' : '下一个'} <FaChevronRight />
              </button>
            </div>
          </animated.div>
        );
      })}

      {/* 注入 CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .rich-text-content h2 { font-size: 1.1rem; color: #334155; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px; }
        .rich-text-content p { margin-bottom: 12px; line-height: 1.7; color: #475569; }
        .check-item { padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; font-size: 0.95rem; }
        .check-item.correct { background: #f0fdf4; color: #166534; }
        .check-item.wrong { background: #fef2f2; color: #991b1b; }
        .pattern-item { font-weight: bold; color: #2563eb; margin: 10px 0; padding-left: 10px; border-left: 3px solid #2563eb; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

// =================================================================================
// ===== 7. 样式定义 =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', background: '#f8fafc', overflow: 'hidden' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc' },
  scrollContainer: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  contentWrapper: { maxWidth: '800px', margin: '0 auto', padding: '24px 20px' },
  header: { textAlign: 'center', marginBottom: '24px' },
  title: { fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', marginBottom: '16px' },
  mainPlayBtn: { display: 'inline-flex', alignItems: 'center', padding: '8px 20px', borderRadius: '30px', background: '#e0e7ff', color: '#3730a3', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  patternBox: { background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '32px', textAlign: 'center' },
  patternLabel: { fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' },
  patternText: { fontSize: '1.4rem', color: '#2563eb', fontWeight: 'bold' },
  section: { marginBottom: '32px' },
  sectionTitle: { fontSize: '1rem', fontWeight: '700', color: '#64748b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  chatContainer: { display: 'flex', flexDirection: 'column' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 10 },
  navBtn: { border: 'none', background: '#f1f5f9', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' },
  pageIndicator: { fontSize: '14px', fontWeight: '600', color: '#94a3b8' }
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array.isRequired,
  onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
