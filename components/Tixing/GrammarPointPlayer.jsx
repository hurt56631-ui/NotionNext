import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { FaVolumeUp, FaStop, FaSpinner, FaChevronLeft, FaChevronRight, FaRobot, FaTimes, FaPause, FaPlay } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// ⚠️ 请确保这个路径下有您的 AI 聊天组件，如果报错 404 请检查此路径
import AiChatAssistant from '../AiChatAssistant';

// =================================================================================
// ===== 1. IndexedDB 工具函数（增强版：防坏死缓存 & in-flight 去重） =====
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
          // 清理可疑缓存
          if (blob) {
            this.del(key).catch(() => {});
          }
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
      console.warn('idb.init failed', e);
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
    try {
      await this.init();
    } catch (e) {
      return;
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }
};

// 用于去重进行中的请求，避免同一文本重复下载
const inFlightRequests = new Map();

// =================================================================================
// ===== 2. 混合 TTS Hook（支持可选原生降级、缓存、播放队列、资源回收） =====
// =================================================================================
function useMixedTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  const audioQueueRef = useRef([]);
  const currentAudioRef = useRef(null);
  const createdObjectURLsRef = useRef(new Set()); // 追踪 objectURLs，用于 revoke
  const latestRequestIdRef = useRef(0);
  const playingIdRef = useRef(null);

  useEffect(() => {
    return () => {
      // 组件卸载时彻底清理
      stop();
      // revoke any remaining URLs
      for (const url of createdObjectURLsRef.current) {
        try { URL.revokeObjectURL(url); } catch (e) {}
      }
      createdObjectURLsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    // increase request id to abort pending flows
    latestRequestIdRef.current++;
    // stop current audio
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
      currentAudioRef.current = null;
    }
    // stop all queued audios
    if (audioQueueRef.current && audioQueueRef.current.length) {
      audioQueueRef.current.forEach(a => {
        try { a.pause(); } catch (e) {}
        try { a.src = ''; } catch (e) {}
      });
      audioQueueRef.current = [];
    }
    // cancel native speech
    if (window.speechSynthesis && window.speechSynthesis.cancel) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    // revoke created URLs
    for (const url of createdObjectURLsRef.current) {
      try { URL.revokeObjectURL(url); } catch (e) {}
    }
    createdObjectURLsRef.current.clear();

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
      // toggle native speech
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsPaused(false);
        } else {
          window.speechSynthesis.pause();
          setIsPaused(true);
        }
      } catch (e) {
        console.warn('SpeechSynthesis toggle failed', e);
      }
    }
  }, []);

  const detectLanguage = (text) => {
    // 缅甸文范围常用 \u1000-\u109F，中文汉字 \u4e00-\u9fff（更广）
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    // 默认 latin -> 返回 'other'（当作非中文，使用默认英文/缅甸 TTS）
    return 'other';
  };

  const fetchAudioBlob = async (text, lang) => {
    if (!text || !text.trim()) throw new Error('Empty text');

    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-blob-${voice}-${text}`;

    // 1. 尝试缓存
    try {
      const cached = await idb.get(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn('Cache read failed', e);
    }

    // 2. 若已有进行中请求，复用它
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    // 3. 发起网络请求（并加入 inFlight）
    const promise = (async () => {
      try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`TTS Fetch Failed: ${res.status}`);
        }
        const blob = await res.blob();
        if (!blob || blob.size < 100) {
          throw new Error('TTS Response too small or invalid');
        }
        // 尝试写入缓存（异步）
        idb.set(cacheKey, blob).catch(e => console.warn('Cache write failed', e));
        return blob;
      } catch (e) {
        // 如果网络失败，确保删除疑似坏缓存
        try { idb.del(cacheKey).catch(()=>{}); } catch (_) {}
        throw e;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, promise);
    return promise;
  };

  const play = useCallback(async (text, uniqueId, options = { allowNativeFallback: true }) => {
    if (!text) return;
    // 如果点击的是当前播放项，切换暂停/继续
    if (playingIdRef.current === uniqueId) {
      toggle(uniqueId);
      return;
    }

    stop();
    setLoadingId(uniqueId);
    const myRequestId = ++latestRequestIdRef.current;

    try {
      let cleanText = String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').replace(/\n+/g, ' ').trim();
      if (!cleanText) {
        setLoadingId(null);
        return;
      }

      // 划分中/非中文段（尽量保持原有逻辑）
      const segments = [];
      const regex = /([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g;
      let match;
      while ((match = regex.exec(cleanText)) !== null) {
        const chunk = match[0];
        if (chunk && chunk.trim()) {
          const lang = detectLanguage(chunk);
          segments.push({ text: chunk.trim(), lang });
        }
      }

      if (segments.length === 0) {
        setLoadingId(null);
        return;
      }

      // fetchBlobs: 注意 segments.map 生成 promise 数组
      const blobPromises = segments.map(seg => fetchAudioBlob(seg.text, seg.lang === 'other' ? 'zh' : seg.lang));
      const blobs = await Promise.all(blobPromises);

      if (myRequestId !== latestRequestIdRef.current) return; // 请求被取消

      // create Audio objects
      const audioObjects = blobs.map((blob, idx) => {
        const objectURL = URL.createObjectURL(blob);
        createdObjectURLsRef.current.add(objectURL);
        const audio = new Audio(objectURL);
        const segLang = segments[idx].lang;
        audio.playbackRate = segLang === 'zh' ? 0.7 : 1.0;
        return { audio, objectURL, lang: segLang };
      });

      audioQueueRef.current = audioObjects;
      setLoadingId(null);
      setPlayingId(uniqueId);
      playingIdRef.current = uniqueId;
      setIsPlaying(true);
      setIsPaused(false);

      // play sequentially
      const playNext = (index) => {
        if (myRequestId !== latestRequestIdRef.current) return;
        if (index >= audioObjects.length) {
          // finished
          setIsPlaying(false);
          setPlayingId(null);
          playingIdRef.current = null;
          currentAudioRef.current = null;
          // revoke used urls for this run
          audioObjects.forEach(item => {
            try { URL.revokeObjectURL(item.objectURL); } catch (e) {}
            createdObjectURLsRef.current.delete(item.objectURL);
          });
          audioQueueRef.current = [];
          return;
        }

        const { audio, objectURL } = audioObjects[index];
        currentAudioRef.current = audio;

        const cleanupAndNext = () => {
          // revoke this objectURL after use
          try { URL.revokeObjectURL(objectURL); } catch (e) {}
          createdObjectURLsRef.current.delete(objectURL);
          playNext(index + 1);
        };

        audio.onended = cleanupAndNext;
        audio.onerror = (e) => {
          console.error('Audio play error', e);
          // 尝试跳到下一个
          setTimeout(cleanupAndNext, 30);
        };
        audio.play().catch((e) => {
          console.error('Play prevented', e);
          // 如果播放被策略阻止或发生异常，尝试降级到 native（仅当允许且 segments 都非空）
          if (options.allowNativeFallback && window.speechSynthesis) {
            try {
              const utterText = segments.map(s => s.text).join(' ');
              const utter = new SpeechSynthesisUtterance(utterText);
              // 尝试选择语言（优先中文）
              utter.lang = /[\u1000-\u109F]/.test(utterText) ? 'my-MM' : 'zh-CN';
              utter.rate = 0.8;
              utter.onend = () => {
                if (playingIdRef.current === uniqueId) {
                  setIsPlaying(false);
                  setPlayingId(null);
                  playingIdRef.current = null;
                }
              };
              utter.onerror = () => {
                setIsPlaying(false);
                setPlayingId(null);
                playingIdRef.current = null;
              };
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(utter);
            } catch (nativeErr) {
              console.error('Native TTS failed', nativeErr);
              setIsPlaying(false);
              setPlayingId(null);
              playingIdRef.current = null;
            }
          } else {
            // 不允许 native fallback 或不支持 -> 直接继续下一个
            setTimeout(cleanupAndNext, 30);
          }
        });
      };

      playNext(0);

    } catch (e) {
      console.error('网络 TTS 失败：', e);
      setLoadingId(null);

      // 降级到原生（仅当允许）
      if (options.allowNativeFallback && window.speechSynthesis) {
        try {
          const utter = new SpeechSynthesisUtterance(String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').replace(/\n+/g, ' ').trim());
          utter.lang = /[\u1000-\u109F]/.test(text) ? 'my-MM' : 'zh-CN';
          utter.rate = 0.8;
          setPlayingId(uniqueId);
          playingIdRef.current = uniqueId;
          setIsPlaying(true);
          setIsPaused(false);

          utter.onend = () => {
            if (playingIdRef.current === uniqueId) {
              setIsPlaying(false);
              setPlayingId(null);
              playingIdRef.current = null;
            }
          };
          utter.onerror = () => {
            setIsPlaying(false);
            setPlayingId(null);
            playingIdRef.current = null;
          };
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        } catch (nativeError) {
          console.error('Native TTS also failed', nativeError);
          setPlayingId(null);
          playingIdRef.current = null;
          setIsPlaying(false);
        }
      } else {
        // 不允许 native 降级 -> 直接失败
        setPlayingId(null);
        playingIdRef.current = null;
        setIsPlaying(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, toggle]);

  const preload = useCallback((text) => {
    if (!text) return;
    let cleanText = String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').replace(/\n+/g, ' ').trim();
    const regex = /([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g;
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      const chunk = match[0];
      if (chunk && chunk.trim()) {
        const lang = detectLanguage(chunk);
        fetchAudioBlob(chunk.trim(), lang === 'other' ? 'zh' : lang).catch(()=>{});
      }
    }
  }, []);

  return { play, stop, toggle, isPlaying, isPaused, playingId, loadingId, preload };
}

// =================================================================================
// ===== 3. 辅助函数与组件 =====
// =================================================================================
const generateRubyHTML = (text) => {
  if (!text) return '';
  // 只对连续汉字做拼音
  return text.replace(/[\u4e00-\u9fff]+/g, word => {
    try {
      const pinyin = pinyinConverter(word, { toneType: 'numeric', type: 'array', multiple: false });
      // pinyin-pro 返回数组，合并为空格分隔
      const rt = Array.isArray(pinyin) ? pinyin.join(' ') : pinyin || '';
      return `<ruby>${word}<rt>${rt}</rt></ruby>`;
    } catch (e) {
      return word;
    }
  });
};

const DraggableAiBtn = ({ contextText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const constraintsRef = useRef(null);

  const handleOpen = (e) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  return (
    <>
      <div
        ref={constraintsRef}
        style={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 100, pointerEvents: 'none', zIndex: 90 }}
      />
      <motion.button
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.08}
        dragMomentum={false}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        onClick={handleOpen}
        aria-label="打开 AI 语法助手"
        title="打开 AI 语法助手"
        style={{
          position: 'absolute',
          bottom: '120px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          cursor: 'pointer',
          border: 'none',
          touchAction: 'none',
          outline: 'none'
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
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: '72vh',
                background: 'white',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                boxShadow: '0 -4px 30px rgba(0,0,0,0.12)',
                zIndex: 1002,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                    <FaRobot size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '1rem', color: '#0f172a' }}>AI 语法助手</div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>随时解答您的疑问（上下文已注入）</div>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} style={{ padding: '8px', background: '#f8fafc', borderRadius: '50%', border: 'none', color: '#64748b', cursor: 'pointer', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="关闭"><FaTimes size={14} /></button>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#fbfdff' }}>
                {AiChatAssistant ? <AiChatAssistant context={contextText} /> : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', padding: 20 }}>
                    <div style={{ textAlign: 'center' }}>
                      <FaRobot size={44} className="opacity-40" />
                      <div style={{ marginTop: 12 }}>未检测到 AI 组件，请检查路径：../AiChatAssistant</div>
                    </div>
                  </div>
                )}
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
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    // 仅在 mount 时修改 overscrollBehavior，unmount 时恢复
    const prev = document.body.style.overscrollBehavior;
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overscrollBehavior = prev || '';
    };
  }, []);

  if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) {
    return <div className="flex h-full items-center justify-center text-gray-400">暂无语法数据</div>;
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const lastDirection = useRef(0);
  const contentRef = useRef(null);
  const [canGoNext, setCanGoNext] = useState(false);

  const { play, stop, toggle, playingId, isPaused, loadingId, preload } = useMixedTTS();

  useEffect(() => {
    stop();
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setCanGoNext(true);
  }, [currentIndex, stop]);

  // 只做预加载（不自动播放）
  useEffect(() => {
    const preloadNextItems = (count) => {
      for (let i = 1; i <= count; i++) {
        const nextIndex = currentIndex + i;
        if (nextIndex < grammarPoints.length) {
          const nextGp = grammarPoints[nextIndex];
          if (nextGp.narrationScript) preload(nextGp.narrationScript);
          if (Array.isArray(nextGp.examples)) {
            nextGp.examples.forEach(ex => preload(ex.narrationScript || ex.sentence));
          }
        }
      }
    };
    preloadNextItems(2);
  }, [currentIndex, grammarPoints, preload]);

  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isBottom = scrollTop + clientHeight >= scrollHeight - 40;
    if (isBottom && !canGoNext) setCanGoNext(true);
  };

  const handleNext = () => {
    if (currentIndex < grammarPoints.length - 1) {
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
    key: grammarPoints[currentIndex]?.id || currentIndex,
    from: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '100%' : '-100%'})` },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
    config: { mass: 1, tension: 280, friction: 30 },
  });

  const renderMixedText = (text, isPattern = false) => {
    if (!text) return null;
    // 支持 {{汉字}} 与其余文字混合渲染
    const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
    return parts.map((part, pIndex) => {
      const isChinese = part.startsWith('{{') && part.endsWith('}}');
      const content = isChinese ? part.slice(2, -2) : part;
      const trimmed = String(content);
      let partStyle = isPattern
        ? (isChinese ? styles.patternChinese : styles.patternMyanmar)
        : (isChinese ? styles.textChinese : styles.textBurmese);

      if (isChinese) {
        return (
          <span key={pIndex} style={partStyle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(trimmed) }} />
        );
      } else {
        return <span key={pIndex} style={partStyle}>{trimmed}</span>;
      }
    });
  };

  const renderRichExplanation = (htmlContent) => {
    if (!htmlContent) return null;
    return <div className="rich-text-content" style={styles.richTextContainer} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  };

  // render play button (allow options to control fallback behavior)
  const renderPlayButton = (script, id, isSmall = false, opts = { allowNativeFallback: true }) => {
    const isCurrentPlaying = playingId === id;
    const isLoading = loadingId === id;

    let Icon = FaVolumeUp;
    if (isLoading) Icon = FaSpinner;
    else if (isCurrentPlaying) Icon = isPaused ? FaPlay : FaPause;

    return (
      <button
        className={`play-button ${isCurrentPlaying && !isPaused ? 'playing' : ''}`}
        style={isSmall ? styles.playButtonSmall : styles.playButton}
        onClick={(e) => {
          e.stopPropagation();
          play(script, id, opts);
        }}
        aria-label="播放朗读"
        title="播放朗读"
      >
        <Icon className={isLoading ? "spin" : ""} />
      </button>
    );
  };

  const currentGp = grammarPoints[currentIndex];
  const contextText = currentGp ? `我在学习语法点：【${currentGp.grammarPoint}】。\n结构是：${currentGp.pattern || '无'}。\n解释：${(currentGp.visibleExplanation || '').replace(/<[^>]+>/g, '')}` : '';

  return (
    <div style={styles.container}>
      <DraggableAiBtn contextText={contextText} />

      {transitions((style, i) => {
        const gp = grammarPoints[i];
        if (!gp) return null;
        const narrationId = `narration_${gp.id}`;

        return (
          <animated.div style={{ ...styles.page, ...style }} key={gp.id || i}>
            <div style={styles.scrollContainer} ref={contentRef} onScroll={handleScroll}>
              <div style={styles.contentWrapper}>
                <div style={styles.header}>
                  <h2 style={styles.grammarPointTitle}>{gp.grammarPoint}</h2>
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
                    {renderPlayButton(gp.narrationScript, narrationId, false, { allowNativeFallback: true })}
                  </div>
                  <div style={styles.textBlock}>
                    {renderRichExplanation(gp.visibleExplanation)}
                  </div>
                </div>

                {gp.usage && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={{ ...styles.sectionTitleText, color: '#059669' }}>📌 使用场景</span>
                    </div>
                    <div style={{ ...styles.textBlock, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                      {renderRichExplanation(gp.usage)}
                    </div>
                  </div>
                )}

                {gp.attention && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={{ ...styles.sectionTitleText, color: '#ef4444' }}>⚠️ 易错点</span>
                    </div>
                    <div style={{ ...styles.textBlock, background: '#fff1f2', border: '1px solid #fecaca' }}>
                      {renderRichExplanation(gp.attention)}
                    </div>
                  </div>
                )}

                <div style={styles.sectionContainer}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitleText}>🗣️ 例句</span>
                  </div>
                  <div style={styles.examplesList}>
                    {Array.isArray(gp.examples) && gp.examples.map((ex) => {
                      const exId = `example_${ex.id}`;
                      // 例句不允许走本地原生 tts 降级
                      return (
                        <div key={ex.id} style={styles.exampleItem}>
                          <div style={styles.exampleMain}>
                            <div style={styles.exampleSentence}>
                              {renderMixedText(ex.sentence)}
                            </div>
                            <div style={styles.exampleTranslation}>{ex.translation}</div>
                          </div>
                          {renderPlayButton(ex.narrationScript || ex.sentence, exId, true, { allowNativeFallback: false })}
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
                style={{
                  ...styles.navButton,
                  visibility: i === 0 ? 'hidden' : 'visible',
                  background: '#f1f5f9',
                  color: '#64748b'
                }}
                onClick={handlePrev}
                aria-label="上一条"
              >
                <FaChevronLeft /> 上一条
              </button>
              <button
                style={{
                  ...styles.navButton,
                  background: '#2563eb',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}
                onClick={handleNext}
                aria-label="下一条"
              >
                {i === grammarPoints.length - 1 ? '完成学习' : '下一条'} <FaChevronRight />
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
// ===== 5. 样式与全局动画（保留并增强富文本） =====
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
  textBlock: { background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e6eef8', fontSize: '1rem', lineHeight: 1.75, color: '#475569' },
  richTextContainer: { whiteSpace: 'normal' },
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
    .rich-text-content h1, .rich-text-content h2, .rich-text-content h3 { color: #0f172a; margin: 1.2em 0 0.5em 0; padding-bottom: 0.2em; border-bottom: 1px solid #eef2ff; font-weight: 700; }
    .rich-text-content p { margin: 0.6em 0; color: #475569; line-height: 1.8; }
    .rich-text-content strong, .rich-text-content b { color: #0b3d91; font-weight: 700; }
    .rich-text-content ul, .rich-text-content ol { margin: 0.6em 0 0.6em 1.2em; padding-left: 0.6em; }
    .rich-text-content li { margin: 0.4em 0; color: #475569; }
    .rich-text-content code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; }
    ruby rt { font-size: 0.65em; color: #0b3d91; }
  `;
  if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);
}

export default GrammarPointPlayer;
