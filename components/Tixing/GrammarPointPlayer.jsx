import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { 
  FaVolumeUp, FaSpinner, FaChevronLeft, FaChevronRight, 
  FaRobot, FaTimes, FaPause, FaPlay, FaFacebookMessenger 
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// ⚠️ 请确保这个路径下有您的 AI 聊天组件，如果报错 404 请检查此路径
import AiChatAssistant from '../AiChatAssistant';

// =================================================================================
// ===== 1. IndexedDB 工具函数 (保持不变) =====
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

const inFlightRequests = new Map();

// =================================================================================
// ===== 2. 混合 TTS Hook (保持不变) =====
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
    if (window.speechSynthesis && window.speechSynthesis.cancel) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
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
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    return 'other';
  };

  const fetchAudioBlob = async (text, lang) => {
    if (!text || !text.trim()) throw new Error('Empty text');

    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-blob-${voice}-${text}`;

    try {
      const cached = await idb.get(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn('Cache read failed', e);
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const promise = (async () => {
      try {
        // 使用您的 TTS API
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`TTS Fetch Failed: ${res.status}`);
        }
        const blob = await res.blob();
        if (!blob || blob.size < 100) {
          throw new Error('TTS Response too small or invalid');
        }
        idb.set(cacheKey, blob).catch(e => console.warn('Cache write failed', e));
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

  const play = useCallback(async (text, uniqueId, options = { allowNativeFallback: true }) => {
    if (!text) return;
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

      const blobPromises = segments.map(seg => fetchAudioBlob(seg.text, seg.lang === 'other' ? 'zh' : seg.lang));
      const blobs = await Promise.all(blobPromises);

      if (myRequestId !== latestRequestIdRef.current) return;

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

      const playNext = (index) => {
        if (myRequestId !== latestRequestIdRef.current) return;
        if (index >= audioObjects.length) {
          setIsPlaying(false);
          setPlayingId(null);
          playingIdRef.current = null;
          currentAudioRef.current = null;
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
          try { URL.revokeObjectURL(objectURL); } catch (e) {}
          createdObjectURLsRef.current.delete(objectURL);
          playNext(index + 1);
        };

        audio.onended = cleanupAndNext;
        audio.onerror = (e) => {
          console.error('Audio play error', e);
          setTimeout(cleanupAndNext, 30);
        };
        audio.play().catch((e) => {
          console.error('Play prevented', e);
          if (options.allowNativeFallback && window.speechSynthesis) {
            try {
              const utterText = segments.map(s => s.text).join(' ');
              const utter = new SpeechSynthesisUtterance(utterText);
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
            setTimeout(cleanupAndNext, 30);
          }
        });
      };

      playNext(0);

    } catch (e) {
      console.error('网络 TTS 失败：', e);
      setLoadingId(null);

      // 降级处理
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
        setPlayingId(null);
        playingIdRef.current = null;
        setIsPlaying(false);
      }
    }
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
// ===== 3. 辅助组件与格式化工具 =====
// =================================================================================

// 1. Ruby 拼音生成
const generateRubyHTML = (text) => {
  if (!text) return '';
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

// 2. 简单的 Markdown 转 HTML 解析器（用于处理数据中的表格、粗体和标题）
const simpleMarkdownToHtml = (markdown) => {
  if (!markdown) return '';
  let html = markdown;

  // 1. 处理标题 (###)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  
  // 2. 处理粗体 (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  
  // 3. 处理引用 (> text)
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // 4. 处理简单的表格 (非常基础的转换)
  if (html.includes('|')) {
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let resultLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableHtml = '<table class="md-table">';
            }
            // 忽略分隔行 |---|
            if (line.includes('---')) continue; 
            
            const cells = line.split('|').filter(c => c.length > 0);
            tableHtml += '<tr>';
            cells.forEach(cell => {
                tableHtml += `<td>${cell.trim()}</td>`;
            });
            tableHtml += '</tr>';
        } else {
            if (inTable) {
                tableHtml += '</table>';
                resultLines.push(tableHtml);
                inTable = false;
            }
            resultLines.push(line);
        }
    }
    if (inTable) resultLines.push(tableHtml + '</table>');
    html = resultLines.join('\n');
  }

  // 5. 处理换行 (\n)
  html = html.replace(/\n/g, '<br/>');
  
  return html;
};

// 3. AI 助手悬浮球
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
                      <div style={{ marginTop: 12 }}>未检测到 AI 组件</div>
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
  
  // 配置 Facebook App ID (电脑端分享需要，移动端可直接唤起 App)
  const FACEBOOK_APP_ID = ''; 

  // ✅ 核心修复 1：数据格式化
  // 将中文 Key 映射为组件使用的英文 Key
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map(item => ({
      id: item.id,
      grammarPoint: item.语法标题 || item.grammarPoint,
      pattern: item.句型结构 || item.pattern,
      visibleExplanation: item.语法详解 || item.visibleExplanation,
      usage: item.适用场景 || item.usage,
      attention: item.注意事项 || item.attention,
      narrationScript: item.讲解脚本 || item.narrationScript,
      examples: (item.例句列表 || item.examples || []).map(ex => ({
        id: ex.id,
        sentence: ex.句子 || ex.sentence,
        translation: ex.翻译 || ex.translation,
        narrationScript: ex.例句发音 || ex.narrationScript
      }))
    }));
  }, [grammarPoints]);

  useEffect(() => {
    setIsMounted(true);
    const prev = document.body.style.overscrollBehavior;
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overscrollBehavior = prev || '';
    };
  }, []);

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

  useEffect(() => {
    const preloadNextItems = (count) => {
      for (let i = 1; i <= count; i++) {
        const nextIndex = currentIndex + i;
        if (nextIndex < normalizedPoints.length) {
          const nextGp = normalizedPoints[nextIndex];
          if (nextGp.narrationScript) preload(nextGp.narrationScript);
          if (Array.isArray(nextGp.examples)) {
            nextGp.examples.forEach(ex => preload(ex.narrationScript || ex.sentence));
          }
        }
      }
    };
    preloadNextItems(2);
  }, [currentIndex, normalizedPoints, preload]);

  const handleMessengerShare = () => {
    const link = typeof window !== 'undefined' ? window.location.href : '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        window.location.href = `fb-messenger://share/?link=${encodeURIComponent(link)}`;
        setTimeout(() => {
            if (FACEBOOK_APP_ID) {
                 window.open(`https://www.facebook.com/dialog/send?app_id=${FACEBOOK_APP_ID}&link=${encodeURIComponent(link)}&redirect_uri=${encodeURIComponent(link)}`, '_blank');
            }
        }, 1500);
    } else {
        if (!FACEBOOK_APP_ID) {
            alert("请在代码中配置 FACEBOOK_APP_ID 以使用网页版分享。");
            return;
        }
        const url = `https://www.facebook.com/dialog/send?app_id=${FACEBOOK_APP_ID}&link=${encodeURIComponent(link)}&redirect_uri=${encodeURIComponent(link)}`;
        window.open(url, '_blank', 'width=600,height=500');
    }
  };

  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isBottom = scrollTop + clientHeight >= scrollHeight - 40;
    if (isBottom && !canGoNext) setCanGoNext(true);
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

  // ✅ 核心修复 2：使用 Markdown 解析器渲染内容
  const renderRichExplanation = (content) => {
    if (!content) return null;
    const htmlContent = simpleMarkdownToHtml(content);
    return <div className="rich-text-content" style={styles.richTextContainer} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  };

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
        onClick={(e) => { e.stopPropagation(); play(script, id, opts); }}
        aria-label="播放朗读" title="播放朗读"
      >
        <Icon className={isLoading ? "spin" : ""} />
      </button>
    );
  };

  if (!normalizedPoints || normalizedPoints.length === 0) {
    return <div className="flex h-full items-center justify-center text-gray-400">暂无语法数据</div>;
  }

  const currentGp = normalizedPoints[currentIndex];
  const contextText = currentGp ? `我在学习语法点：【${currentGp.grammarPoint}】。\n结构是：${currentGp.pattern || '无'}。\n解释：${(currentGp.visibleExplanation || '').replace(/<[^>]+>/g, '')}` : '';

  return (
    <div style={styles.container}>
      <DraggableAiBtn contextText={contextText} />

      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        if (!gp) return null;
        const narrationId = `narration_${gp.id}`;

        return (
          <animated.div style={{ ...styles.page, ...style }} key={gp.id || i}>
            <div style={styles.scrollContainer} ref={contentRef} onScroll={handleScroll}>
              <div style={styles.contentWrapper}>
                
                {/* 标题栏 & Messenger 按钮 */}
                <div style={styles.header}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <h2 style={styles.grammarPointTitle}>{gp.grammarPoint}</h2>
                    <button 
                      onClick={handleMessengerShare}
                      title="发给 Facebook 朋友"
                      style={{
                        background: 'transparent', border: 'none', color: '#0084FF',
                        cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', borderRadius: '50%', transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#eef2ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                    {renderPlayButton(gp.narrationScript, narrationId, false, { allowNativeFallback: true })}
                  </div>
                  <div style={styles.textBlock}>
                    {renderRichExplanation(gp.visibleExplanation)}
                  </div>
                </div>

                {gp.usage && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={{ ...styles.sectionTitleText, color: '#059669' }}>📌 适用场景</span>
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
                style={{ ...styles.navButton, visibility: i === 0 ? 'hidden' : 'visible', background: '#f1f5f9', color: '#64748b' }}
                onClick={handlePrev} aria-label="上一条"
              >
                <FaChevronLeft /> 上一条
              </button>
              <button
                style={{ ...styles.navButton, background: '#2563eb', color: 'white', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
                onClick={handleNext} aria-label="下一条"
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
// ===== 5. 样式与全局动画 =====
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
    .rich-text-content blockquote { border-left: 4px solid #3b82f6; background: #eff6ff; margin: 1em 0; padding: 0.5em 1em; color: #1e40af; }
    .rich-text-content table.md-table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
    .rich-text-content table.md-table td, .rich-text-content table.md-table th { border: 1px solid #e2e8f0; padding: 8px; }
    .rich-text-content table.md-table tr:nth-child(even) { background-color: #f8fafc; }
    .rich-text-content ul, .rich-text-content ol { margin: 0.6em 0 0.6em 1.2em; padding-left: 0.6em; }
    .rich-text-content li { margin: 0.4em 0; color: #475569; }
    .rich-text-content code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; }
    ruby rt { font-size: 0.65em; color: #0b3d91; }
  `;
  if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);
}

export default GrammarPointPlayer;
