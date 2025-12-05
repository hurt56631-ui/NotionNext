import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { 
  FaVolumeUp, FaSpinner, FaChevronLeft, FaChevronRight, 
  FaRobot, FaTimes, FaPause, FaPlay, FaFacebookMessenger 
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// ⚠️ 请确保这个路径下有您的 AI 聊天组件，如果没有可注释掉
import AiChatAssistant from '../AiChatAssistant';

// =================================================================================
// ===== 1. IndexedDB 工具函数 (缓存音频，减少请求) =====
// =================================================================================
const DB_NAME = 'MixedTTSCache';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    try {
      await this.init();
    } catch (e) {
      console.warn('idb.init failed', e);
      return null;
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const blob = req.result;
        if (blob && blob.size > 100) {
          resolve(blob);
        } else {
          // 如果缓存了无效的小文件，清理掉
          if (blob) { this.del(key).catch(() => {}); }
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (!blob || blob.size < 100) return;
    try {
      await this.init();
    } catch (e) {
      return;
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  },
  async del(key) {
    try { await this.init(); } catch (e) { return; }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }
};

const inFlightRequests = new Map();

// =================================================================================
// ===== 2. 混合 TTS Hook (核心修复版) =====
// =================================================================================
function useMixedTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  const audioQueueRef = useRef([]);
  const currentAudioRef = useRef(null);
  const createdObjectURLsRef = useRef(new Set());
  const latestRequestIdRef = useRef(0);
  const playingIdRef = useRef(null);

  useEffect(() => {
    return () => {
      stop();
      for (const url of createdObjectURLsRef.current) {
        try { URL.revokeObjectURL(url); } catch (e) {}
      }
      createdObjectURLsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    latestRequestIdRef.current++;
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
      currentAudioRef.current = null;
    }
    if (audioQueueRef.current && audioQueueRef.current.length) {
      audioQueueRef.current.forEach(a => {
        try { a.pause(); } catch (e) {}
        try { a.src = ''; } catch (e) {}
      });
      audioQueueRef.current = [];
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    // 稍后清理 URL，避免立即清理导致某些浏览器报错
    setTimeout(() => {
        for (const url of createdObjectURLsRef.current) {
            try { URL.revokeObjectURL(url); } catch (e) {}
        }
        createdObjectURLsRef.current.clear();
    }, 500);

    setIsPlaying(false);
    setIsPaused(false);
    setPlayingId(null);
    playingIdRef.current = null;
    setLoadingId(null);
  }, []);

  const toggle = useCallback((uniqueId) => {
    if (playingIdRef.current !== uniqueId) return;

    if (currentAudioRef.current) {
      if (currentAudioRef.current.paused) {
        currentAudioRef.current.play().catch(e => console.error('Resume failed', e));
        setIsPaused(false);
      } else {
        currentAudioRef.current.pause();
        setIsPaused(true);
      }
    } else if (window.speechSynthesis && window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    }
  }, []);

  // 降级使用浏览器自带 TTS
  const fallbackToNativeTTS = (text, onEnd) => {
    if (!window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 0.9;
      utter.onend = () => { if (onEnd) onEnd(); };
      utter.onerror = () => { if (onEnd) onEnd(); };
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Native TTS failed:", e);
      if (onEnd) onEnd();
    }
  };

  const fetchAudioBlob = async (text, lang) => {
    if (!text || !text.trim()) throw new Error('Empty text');

    // 缅甸语使用专用引擎，其他（中文/英文/混合）使用强大的多语言引擎
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-blob-${voice}-${text}`;

    try {
      const cached = await idb.get(cacheKey);
      if (cached) return cached;
    } catch (e) {}

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const promise = (async () => {
      try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TTS Fetch Failed: ${res.status}`);
        
        const blob = await res.blob();
        if (!blob || blob.size < 100) throw new Error('TTS Response too small');
        
        idb.set(cacheKey, blob).catch(() => {});
        return blob;
      } catch (e) {
        try { idb.del(cacheKey).catch(()=>{}); } catch (_) {}
        throw e;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, promise);
    return promise;
  };

  const play = useCallback(async (text, uniqueId) => {
    // 1. 基础检查
    if (!text) return;
    
    // 2. 暂停/继续逻辑
    if (playingIdRef.current === uniqueId) {
      toggle(uniqueId);
      return;
    }

    stop(); 
    setLoadingId(uniqueId);
    const myRequestId = ++latestRequestIdRef.current;

    // 3. 清理文本 (保留文字本身，去除HTML标签和模板符号)
    let cleanText = String(text)
      .replace(/<[^>]+>/g, '') 
      .replace(/\{\{|\}\}/g, '') 
      .trim();
    
    if (!cleanText) {
      setLoadingId(null);
      return;
    }

    try {
      // 4. 智能分段逻辑 (修复版)
      const segments = [];
      const hasBurmese = /[\u1000-\u109F]/.test(cleanText);

      if (!hasBurmese) {
        // ✅ 场景 A: 只有中文、英文、拼音、标点 -> **不要切分**
        // 直接作为一个整体发送，AI 引擎会自动处理语调和停顿，不会读错拼音，也不会因为标点报错
        segments.push({ text: cleanText, lang: 'zh' });
      } else {
        // ✅ 场景 B: 包含缅甸语 -> 必须切分，因为缅甸语需要特定 Voice
        const regex = /([\u1000-\u109F]+)|([^\u1000-\u109F]+)/g;
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
          const chunk = match[0];
          if (chunk && chunk.trim()) {
            const isMy = /[\u1000-\u109F]/.test(chunk);
            segments.push({ text: chunk.trim(), lang: isMy ? 'my' : 'zh' });
          }
        }
      }

      // 5. 并行请求音频
      const blobPromises = segments.map(seg => fetchAudioBlob(seg.text, seg.lang));
      const blobs = await Promise.all(blobPromises);

      if (myRequestId !== latestRequestIdRef.current) return;

      // 6. 准备播放队列
      const audioObjects = blobs.map((blob, idx) => {
        const objectURL = URL.createObjectURL(blob);
        createdObjectURLsRef.current.add(objectURL);
        const audio = new Audio(objectURL);
        audio.playbackRate = 1.0; 
        return audio;
      });

      audioQueueRef.current = audioObjects;
      setLoadingId(null);
      setPlayingId(uniqueId);
      playingIdRef.current = uniqueId;
      setIsPlaying(true);
      setIsPaused(false);

      // 7. 递归播放
      const playNext = (index) => {
        if (myRequestId !== latestRequestIdRef.current) return;
        
        if (index >= audioObjects.length) {
          stop();
          return;
        }

        const audio = audioObjects[index];
        currentAudioRef.current = audio;

        // 播放结束或出错时，继续下一段
        const onFinish = () => playNext(index + 1);

        audio.onended = onFinish;
        audio.onerror = (e) => {
          console.error('Audio play error', e);
          onFinish();
        };
        
        audio.play().catch((e) => {
          console.warn('Play prevented', e);
          onFinish();
        });
      };

      playNext(0);

    } catch (e) {
      console.warn('云端 TTS 失败，尝试降级:', e);
      if (myRequestId === latestRequestIdRef.current) {
        setLoadingId(null);
        setPlayingId(uniqueId);
        playingIdRef.current = uniqueId;
        setIsPlaying(true);
        // 降级到浏览器原生朗读
        fallbackToNativeTTS(cleanText, () => stop());
      }
    }
  }, [stop, toggle]);

  const preload = useCallback((text) => {
    if (!text) return;
    let cleanText = String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').trim();
    if (!cleanText) return;
    // 预加载默认为中文引擎，除非明显是缅甸语（简化处理）
    const lang = /[\u1000-\u109F]/.test(cleanText) ? 'my' : 'zh';
    fetchAudioBlob(cleanText, lang).catch(()=>{});
  }, []);

  return { play, stop, toggle, isPlaying, isPaused, playingId, loadingId, preload };
}

// =================================================================================
// ===== 3. 辅助组件与格式化工具 =====
// =================================================================================

const generateRubyHTML = (text) => {
  if (!text) return '';
  // 排除 {{}}，仅对中文加注音
  return text.replace(/[\u4e00-\u9fff]+/g, word => {
    try {
      const pinyin = pinyinConverter(word, { toneType: 'numeric', type: 'array', multiple: false });
      const rt = Array.isArray(pinyin) ? pinyin.join(' ') : pinyin || '';
      return `<ruby>${word}<rt>${rt}</rt></ruby>`;
    } catch (e) {
      return word;
    }
  });
};

const simpleMarkdownToHtml = (markdown) => {
  if (!markdown) return '';
  let html = markdown;
  // 简单处理 Markdown 语法
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  if (html.includes('|')) {
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let resultLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|')) {
            if (!inTable) { inTable = true; tableHtml = '<table class="md-table">'; }
            if (line.includes('---')) continue; 
            const cells = line.split('|').filter(c => c.length > 0);
            tableHtml += '<tr>';
            cells.forEach(cell => { tableHtml += `<td>${cell.trim()}</td>`; });
            tableHtml += '</tr>';
        } else {
            if (inTable) { tableHtml += '</table>'; resultLines.push(tableHtml); inTable = false; }
            resultLines.push(line);
        }
    }
    if (inTable) resultLines.push(tableHtml + '</table>');
    html = resultLines.join('\n');
  }
  html = html.replace(/\n/g, '<br/>');
  return html;
};

const DraggableAiBtn = ({ contextText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const constraintsRef = useRef(null);

  return (
    <>
      <div ref={constraintsRef} style={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 100, pointerEvents: 'none', zIndex: 90 }} />
      <motion.button
        drag dragConstraints={constraintsRef} dragElastic={0.08} dragMomentum={false}
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        style={{
          position: 'absolute', bottom: '120px', right: '20px', width: '56px', height: '56px',
          borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)', color: 'white', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, cursor: 'pointer',
          border: 'none', touchAction: 'none', outline: 'none'
        }}
      >
        <FaRobot size={26} />
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1001, backdropFilter: 'blur(3px)' }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, height: '72vh',
                background: 'white', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
                boxShadow: '0 -4px 30px rgba(0,0,0,0.12)', zIndex: 1002, display: 'flex',
                flexDirection: 'column', overflow: 'hidden'
              }}
            >
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <div style={{ fontWeight: '700', fontSize: '1rem', color: '#0f172a' }}>AI 语法助手</div>
                <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} style={{ padding: '8px', background: '#f8fafc', borderRadius: '50%', border: 'none', color: '#64748b', cursor: 'pointer' }}><FaTimes size={14} /></button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#fbfdff' }}>
                {AiChatAssistant ? <AiChatAssistant context={contextText} /> : <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>AI 组件未加载</div>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// =================================================================================
// ===== 4. 主组件: GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
  const FACEBOOK_APP_ID = ''; 

  // 数据标准化
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    
    const stripHtml = (html) => {
      if (!html) return '';
      return html.replace(/<[^>]+>/g, '').replace(/\{\{|}\}/g, '').trim();
    };

    return grammarPoints.map(item => {
      const rawTitle = item['语法标题'] || item.grammarPoint || '';
      const rawPattern = item['句型结构'] || item.pattern || '';
      const rawExplanation = item['语法详解'] || item.visibleExplanation || '';
      
      const fallbackScript = `${rawTitle}。${rawPattern}。${stripHtml(rawExplanation)}`;
      const narrationScript = item['讲解脚本'] || item.narrationScript || fallbackScript;

      return {
        id: item.id,
        grammarPoint: rawTitle,
        pattern: rawPattern,
        visibleExplanation: rawExplanation,
        usage: item['适用场景'] || item.usage,
        attention: item['注意事项'] || item.attention,
        narrationScript: narrationScript,
        examples: (item['例句列表'] || item.examples || []).map(ex => {
          const sentence = ex['句子'] || ex.sentence || '';
          const exampleScript = ex['例句发音'] || ex.narrationScript || sentence;
          return {
            id: ex.id,
            sentence: sentence,
            translation: ex['翻译'] || ex.translation,
            narrationScript: exampleScript
          };
        })
      };
    });
  }, [grammarPoints]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const lastDirection = useRef(0);
  const contentRef = useRef(null);
  
  // 使用修复后的 Hook
  const { play, stop, playingId, isPaused, loadingId, preload } = useMixedTTS();

  useEffect(() => {
    stop();
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  useEffect(() => {
    // 预加载下一条
    const nextIndex = currentIndex + 1;
    if (nextIndex < normalizedPoints.length) {
       const nextGp = normalizedPoints[nextIndex];
       if (nextGp.narrationScript) preload(nextGp.narrationScript);
    }
  }, [currentIndex, normalizedPoints, preload]);

  const handleMessengerShare = () => {
    const link = typeof window !== 'undefined' ? window.location.href : '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = `fb-messenger://share/?link=${encodeURIComponent(link)}`;
    } else {
        if (!FACEBOOK_APP_ID) { alert("请配置 FACEBOOK_APP_ID"); return; }
        window.open(`https://www.facebook.com/dialog/send?app_id=${FACEBOOK_APP_ID}&link=${encodeURIComponent(link)}&redirect_uri=${encodeURIComponent(link)}`, '_blank', 'width=600,height=500');
    }
  };

  const handleNext = () => {
    if (currentIndex < normalizedPoints.length - 1) {
      lastDirection.current = 1;
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      lastDirection.current = -1;
      setCurrentIndex(prev => prev - 1);
    }
  };

  const transitions = useTransition(currentIndex, {
    key: normalizedPoints[currentIndex]?.id || currentIndex,
    from: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '100%' : '-100%'})` },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
    config: { mass: 1, tension: 280, friction: 30 },
  });

  const renderMixedText = (text, isPattern = false) => {
    if (!text) return null;
    const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
    return parts.map((part, pIndex) => {
      const isChinese = part.startsWith('{{') && part.endsWith('}}');
      const content = isChinese ? part.slice(2, -2) : part;
      const trimmed = String(content);
      const partStyle = isPattern
        ? (isChinese ? styles.patternChinese : styles.patternMyanmar)
        : (isChinese ? styles.textChinese : styles.textBurmese);
      
      if (isChinese) {
        return <span key={pIndex} style={partStyle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(trimmed) }} />;
      } else {
        return <span key={pIndex} style={partStyle}>{trimmed}</span>;
      }
    });
  };

  const renderPlayButton = (script, id, isSmall = false) => {
    const isCurrentPlaying = playingId === id;
    const isLoading = loadingId === id;
    let Icon = FaVolumeUp;
    if (isLoading) Icon = FaSpinner;
    else if (isCurrentPlaying) Icon = isPaused ? FaPlay : FaPause;

    const isDisabled = !script || script.trim() === '';

    return (
      <button
        className={`play-button ${isCurrentPlaying && !isPaused ? 'playing' : ''}`}
        style={{
          ...(isSmall ? styles.playButtonSmall : styles.playButton),
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer'
        }}
        onClick={(e) => { 
          e.stopPropagation(); 
          if (!isDisabled) play(script, id); 
        }}
        disabled={isDisabled}
      >
        <Icon className={isLoading ? "spin" : ""} />
      </button>
    );
  };

  if (!normalizedPoints || normalizedPoints.length === 0) {
    return <div className="flex h-full items-center justify-center text-gray-400">暂无语法数据</div>;
  }

  const currentGp = normalizedPoints[currentIndex];
  const contextText = currentGp ? 
    `语法：${currentGp.grammarPoint}\n句型：${currentGp.pattern}\n详解：${(currentGp.visibleExplanation || '').slice(0, 100)}...` 
    : '';

  return (
    <div style={styles.container}>
      <DraggableAiBtn contextText={contextText} />

      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        if (!gp) return null;
        const narrationId = `narration_${gp.id}`;

        return (
          <animated.div style={{ ...styles.page, ...style }} key={gp.id || i}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                <div style={styles.header}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <h2 style={styles.grammarPointTitle}>{gp.grammarPoint}</h2>
                    <button 
                      onClick={handleMessengerShare}
                      style={{ background: 'transparent', border: 'none', color: '#0084FF', cursor: 'pointer', padding: '6px', borderRadius: '50%' }}
                    >
                      <FaFacebookMessenger size={22} />
                    </button>
                  </div>
                </div>

                {gp.pattern && (
                  <div style={styles.patternBox}>
                    <div style={styles.boxLabel}>句型结构</div>
                    <div style={styles.patternContent}>{renderMixedText(gp.pattern, true)}</div>
                  </div>
                )}

                <div style={styles.sectionContainer}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitleText}>💡 详解</span>
                    {renderPlayButton(gp.narrationScript, narrationId, false)}
                  </div>
                  <div style={styles.textBlock} dangerouslySetInnerHTML={{__html: simpleMarkdownToHtml(gp.visibleExplanation)}} />
                </div>

                {gp.usage && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={{ ...styles.sectionTitleText, color: '#059669' }}>📌 适用场景</span>
                    </div>
                    <div style={{ ...styles.textBlock, background: '#ecfdf5', border: '1px solid #a7f3d0' }} dangerouslySetInnerHTML={{__html: simpleMarkdownToHtml(gp.usage)}} />
                  </div>
                )}

                {gp.attention && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={{ ...styles.sectionTitleText, color: '#ef4444' }}>⚠️ 易错点</span>
                    </div>
                    <div style={{ ...styles.textBlock, background: '#fff1f2', border: '1px solid #fecaca' }} dangerouslySetInnerHTML={{__html: simpleMarkdownToHtml(gp.attention)}} />
                  </div>
                )}

                <div style={styles.sectionContainer}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitleText}>🗣️ 例句</span>
                  </div>
                  <div style={styles.examplesList}>
                    {Array.isArray(gp.examples) && gp.examples.map((ex) => {
                      const exId = `example_${ex.id}`;
                      return (
                        <div key={ex.id} style={styles.exampleItem}>
                          <div style={styles.exampleMain}>
                            <div style={styles.exampleSentence}>
                              {renderMixedText(ex.sentence)}
                            </div>
                            <div style={styles.exampleTranslation}>{ex.translation}</div>
                          </div>
                          {renderPlayButton(ex.narrationScript, exId, true)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ height: '120px' }} />
              </div>
            </div>

            <div style={styles.bottomBar}>
              <button
                style={{ ...styles.navButton, visibility: i === 0 ? 'hidden' : 'visible', background: '#f1f5f9', color: '#64748b' }}
                onClick={handlePrev}
              >
                <FaChevronLeft /> 上一条
              </button>
              <button
                style={{ ...styles.navButton, background: '#2563eb', color: 'white', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
                onClick={handleNext}
              >
                {i === normalizedPoints.length - 1 ? '完成学习' : '下一条'} <FaChevronRight />
              </button>
            </div>
          </animated.div>
        );
      })}
    </div>
  );
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array.isRequired,
  onComplete: PropTypes.func,
};

// =================================================================================
// ===== 5. 样式 =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white', willChange: 'transform, opacity' },
  scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: '0 16px' },
  contentWrapper: { maxWidth: '840px', margin: '0 auto', paddingTop: '20px', minHeight: '100%' },
  header: { textAlign: 'center', marginTop: '10px', marginBottom: '20px' },
  grammarPointTitle: { fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: 0, lineHeight: 1.3 },
  patternBox: { background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid #e2e8f0', textAlign: 'center' },
  boxLabel: { fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', fontWeight: '600', letterSpacing: '1px' },
  patternContent: { fontSize: '1.2rem', fontWeight: '700', display: 'inline-block' },
  patternChinese: { color: '#2563eb', margin: '0 4px' },
  patternMyanmar: { color: '#059669', margin: '0 4px' },
  sectionContainer: { marginBottom: '24px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  sectionTitleText: { fontSize: '1rem', fontWeight: '700', color: '#0f172a' },
  playButton: { background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.18s' },
  playButtonSmall: { background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '50%', width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' },
  textBlock: { background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e6eef8', fontSize: '1rem', lineHeight: 1.75, color: '#475569', wordWrap: 'break-word' },
  examplesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  exampleItem: { background: '#f8fafc', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #e2e8f0' },
  exampleMain: { flex: 1 },
  exampleSentence: { fontSize: '1.05rem', fontWeight: 500, marginBottom: '6px', lineHeight: 1.5 },
  exampleTranslation: { fontSize: '0.9rem', color: '#64748b' },
  textChinese: { color: '#0f172a' },
  textBurmese: { color: '#064e3b' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '86px', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', paddingBottom: '20px', zIndex: 50 },
  navButton: { border: 'none', borderRadius: '30px', padding: '12px 22px', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.22s' }
};

const styleTag = typeof document !== 'undefined' ? (document.getElementById('grammar-player-styles') || document.createElement('style')) : null;
if (styleTag) {
  styleTag.id = 'grammar-player-styles';
  styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .play-button:active { transform: scale(0.94); }
    .playing { animation: pulse-ring 2s infinite; background-color: rgba(37, 99, 235, 0.12) !important; color: #2563eb !important; border-color: #2563eb !important; }
    @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); } 70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
    .md-table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
    .md-table td, .md-table th { border: 1px solid #e2e8f0; padding: 8px; }
    .md-table tr:nth-child(even) { background-color: #f8fafc; }
    blockquote { border-left: 4px solid #3b82f6; background: #eff6ff; margin: 1em 0; padding: 0.5em 1em; color: #1e40af; }
    ruby rt { font-size: 0.6em; color: #64748b; user-select: none; }
  `;
  if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);
}

export default GrammarPointPlayer;
