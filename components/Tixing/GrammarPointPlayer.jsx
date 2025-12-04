import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { FaVolumeUp, FaStop, FaSpinner, FaChevronLeft, FaChevronRight, FaRobot, FaTimes, FaPause, FaPlay } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ⚠️ 请确保这个路径下有您的 AI 聊天组件
import AiChatAssistant from '../AiChatAssistant';

// =================================================================================
// ===== 1. IndexedDB 工具函数 (保持不变，增加容错) =====
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
    try { await this.init(); } catch (e) { return null; }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const blob = req.result;
        // 校验 blob 有效性
        resolve((blob && blob.size > 100 && blob.type.startsWith('audio')) ? blob : null);
      };
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (!blob || blob.size < 100) return;
    try { await this.init(); } catch (e) { return; }
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
    });
  }
};

const inFlightRequests = new Map();

// =================================================================================
// ===== 2. TTS Hook (已修复) =====
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

  // 清理函数
  const cleanup = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    if (audioQueueRef.current.length) {
      audioQueueRef.current.forEach(({ audio }) => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
      audioQueueRef.current = [];
    }
    // 释放 URL 对象
    for (const url of createdObjectURLsRef.current) {
      try { URL.revokeObjectURL(url); } catch (e) {}
    }
    createdObjectURLsRef.current.clear();
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const stop = useCallback(() => {
    latestRequestIdRef.current++;
    cleanup();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    setIsPlaying(false);
    setIsPaused(false);
    setPlayingId(null);
    playingIdRef.current = null;
    setLoadingId(null);
  }, [cleanup]);

  const toggle = useCallback((uniqueId) => {
    if (playingIdRef.current !== uniqueId) return;
    
    if (currentAudioRef.current) {
      if (currentAudioRef.current.paused) {
        // 尝试恢复播放，处理 Promise 错误
        const playPromise = currentAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Playback failed on toggle:", error);
            stop(); // 如果恢复失败，直接停止
          });
        }
        setIsPaused(false);
      } else {
        currentAudioRef.current.pause();
        setIsPaused(true);
      }
    }
  }, [stop]);

  const detectLanguage = (text) => {
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    // 包含汉字则认为是中文，否则默认处理
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    return 'other';
  };

  const fetchAudioBlob = async (text, lang) => {
    if (!text || !text.trim()) throw new Error('Empty text');
    // 强制指定 voice 参数，确保后端能正确识别
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-blob-v2-${voice}-${text}`; // 更新缓存 Key 版本以防旧缓存损坏

    try {
      const cached = await idb.get(cacheKey);
      if (cached) return cached;
    } catch (e) { console.warn("Cache read error", e); }

    if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey);

    const promise = (async () => {
      try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TTS Fetch Failed: ${res.status}`);
        
        const blob = await res.blob();
        // 增加 Blob 类型检查
        if (!blob || blob.size < 100 || !blob.type.startsWith('audio')) {
            throw new Error('Invalid Audio Blob');
        }
        
        idb.set(cacheKey, blob).catch(() => {});
        return blob;
      } catch (e) {
        idb.del(cacheKey).catch(() => {});
        throw e;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();
    
    inFlightRequests.set(cacheKey, promise);
    return promise;
  };

  const play = useCallback(async (text, uniqueId) => {
    if (!text) return;
    
    // 如果点击的是当前正在播放/暂停的按钮
    if (playingIdRef.current === uniqueId) {
      toggle(uniqueId);
      return;
    }

    stop(); // 停止之前的
    setLoadingId(uniqueId);
    const myRequestId = ++latestRequestIdRef.current;

    try {
      // 1. 文本清洗
      let cleanText = String(text)
        .replace(/<[^>]+>/g, '') // 去除 HTML 标签
        .replace(/\{\{|}}/g, '') // 去除 {{ }}
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/#/g, '')
        .replace(/\n+/g, ' ')
        .trim();

      // 2. 分段逻辑：中文和其他语言分开，避免引擎混淆
      const segments = [];
      const regex = /([\u4e00-\u9fff\uff00-\uffef]+)|([^\u4e00-\u9fff\uff00-\uffef]+)/g;
      let match;
      while ((match = regex.exec(cleanText)) !== null) {
        const chunk = match[0];
        if (chunk && chunk.trim()) {
          segments.push({ text: chunk.trim(), lang: detectLanguage(chunk) });
        }
      }

      if (segments.length === 0) {
        setLoadingId(null);
        return;
      }

      // 3. 并行请求所有音频段
      const blobs = await Promise.all(
        segments.map(seg => fetchAudioBlob(seg.text, seg.lang === 'other' ? 'zh' : seg.lang))
      );

      // 如果请求期间用户点击了停止或其他，则取消
      if (myRequestId !== latestRequestIdRef.current) return;

      // 4. 构建音频队列
      const audioObjects = blobs.map((blob, idx) => {
        const objectURL = URL.createObjectURL(blob);
        createdObjectURLsRef.current.add(objectURL);
        const audio = new Audio(objectURL);
        const segLang = segments[idx].lang;
        // 中文语速稍微慢一点点，便于学习
        audio.playbackRate = segLang === 'zh' ? 0.9 : 1.0; 
        audio.preload = 'auto'; // 强制预加载
        return { audio, objectURL };
      });

      audioQueueRef.current = audioObjects;
      setLoadingId(null);
      setPlayingId(uniqueId);
      playingIdRef.current = uniqueId;
      setIsPlaying(true);

      // 5. 递归播放函数
      const playNext = async (index) => {
        if (myRequestId !== latestRequestIdRef.current) return;
        
        if (index >= audioObjects.length) {
          stop(); // 全部播放完毕
          return;
        }

        const { audio, objectURL } = audioObjects[index];
        currentAudioRef.current = audio;

        // 清理当前段并播放下一段
        const handleEnd = () => {
          try { URL.revokeObjectURL(objectURL); } catch(e){}
          createdObjectURLsRef.current.delete(objectURL);
          playNext(index + 1);
        };

        audio.onended = handleEnd;
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          handleEnd(); // 即使出错也尝试播下一段
        };

        try {
          // ⚠️ 关键修复：先 load 再 play，处理 Promise
          audio.load();
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
        } catch (error) {
          console.error("Autoplay prevented or network error:", error);
          // 如果是被浏览器拦截，停止播放流程
          stop();
        }
      };

      // 启动播放
      playNext(0);

    } catch (e) {
      console.error('TTS execution failed:', e);
      setLoadingId(null);
      setPlayingId(null);
      playingIdRef.current = null;
      setIsPlaying(false);
      alert("朗读失败，请检查网络或点击重试");
    }
  }, [stop, toggle]);

  return { play, stop, toggle, isPlaying, isPaused, playingId, loadingId };
}

// =================================================================================
// ===== 3. 辅助函数与组件 =====
// =================================================================================

const generateRubyHTML = (text) => {
  if (!text) return '';
  return text.replace(/[\u4e00-\u9fff]+/g, word => {
    try {
      const pinyin = pinyinConverter(word, { toneType: 'symbol', type: 'array', multiple: false });
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

  return (
    <>
      <div ref={constraintsRef} style={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 80, pointerEvents: 'none', zIndex: 90 }} />
      <motion.button
        drag
        dragConstraints={constraintsRef}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        style={{
          position: 'absolute',
          bottom: '100px',
          right: '16px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          cursor: 'pointer',
          border: 'none',
          outline: 'none'
        }}
      >
        <FaRobot size={20} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1001, backdropFilter: 'blur(2px)' }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, height: '72vh',
                background: 'white', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
                zIndex: 1002, display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <FaRobot size={18} color="#2563eb"/> AI 助手
                </div>
                <button onClick={() => setIsOpen(false)} style={{ border:'none', background:'transparent', padding:4 }}><FaTimes size={16}/></button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', background: '#fbfdff' }}>
                {AiChatAssistant ? <AiChatAssistant context={contextText} /> : <div style={{padding:20, textAlign:'center', color:'#999'}}>AI 组件未加载</div>}
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
  // 调试：使用内置数据（如果外部没传）
  const dataToUse = (grammarPoints && Array.isArray(grammarPoints) && grammarPoints.length > 0) ? grammarPoints : TEST_DATA;
  
  // 状态
  const [currentIndex, setCurrentIndex] = useState(0);
  const lastDirection = useRef(0);
  const contentRef = useRef(null);
  
  // TTS
  const { play, stop, toggle, playingId, isPaused, loadingId } = useMixedTTS();

  // ⚠️ 关键修复：监听 grammarPoints 变化，重置索引
  useEffect(() => {
    setCurrentIndex(0);
    stop(); // 切换数据时停止播放
  }, [grammarPoints, stop]);

  // 切换卡片时的副作用
  useEffect(() => {
    stop(); // 翻页时停止播放
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '100%' : '-100%'})` },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
    config: { mass: 1, tension: 280, friction: 30 },
  });

  const getGpData = (gp) => {
    if (!gp) return null;
    return {
      id: gp.id,
      title: gp['语法标题'] || gp['grammarPoint'],
      pattern: gp['句型结构'] || gp['pattern'],
      explanation: gp['语法详解'] || gp['visibleExplanation'],
      usage: gp['适用场景'] || gp['usage'],
      attention: gp['注意事项'] || gp['attention'],
      script: gp['讲解脚本'] || gp['narrationScript'],
      examples: gp['例句列表'] || gp['examples'] || [],
    };
  };

  const renderMixedText = (text, isPattern = false) => {
    if (!text) return null;
    if (text.includes('{{')) {
      const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
      return parts.map((part, pIndex) => {
        const isChinese = part.startsWith('{{') && part.endsWith('}}');
        const content = isChinese ? part.slice(2, -2) : part;
        let partStyle = isPattern
          ? (isChinese ? styles.patternChinese : styles.patternMyanmar)
          : (isChinese ? styles.textChinese : styles.textBurmese);

        if (isChinese || /[\u4e00-\u9fff]/.test(content)) {
          return <span key={pIndex} style={partStyle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} />;
        }
        return <span key={pIndex} style={partStyle}>{content}</span>;
      });
    }

    if (/[\u4e00-\u9fff]/.test(text)) {
      return <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(text) }} />;
    }
    return <span>{text}</span>;
  };

  const renderPlayButton = (script, id, isSmall = false) => {
    const isCurrentPlaying = playingId === id;
    const isLoading = loadingId === id;
    let Icon = FaVolumeUp;
    if (isLoading) Icon = FaSpinner;
    else if (isCurrentPlaying) Icon = isPaused ? FaPlay : FaPause;

    return (
      <button
        className={`play-button ${isCurrentPlaying && !isPaused ? 'playing' : ''}`}
        style={isSmall ? styles.playButtonSmall : styles.playButton}
        onClick={(e) => { e.stopPropagation(); play(script, id); }}
      >
        <Icon className={isLoading ? "spin" : ""} />
      </button>
    );
  };

  // 如果没有数据
  if (!dataToUse || dataToUse.length === 0) return <div style={{padding:20,textAlign:'center'}}>暂无数据</div>;

  const currentRawGp = dataToUse[currentIndex];
  const currentGp = getGpData(currentRawGp); 
  const contextText = currentGp ? `学习语法：${currentGp.title}` : '';

  return (
    <div style={styles.container}>
      <DraggableAiBtn contextText={contextText} />

      {transitions((style, i) => {
        const rawGp = dataToUse[i];
        if (!rawGp) return null; // 保护性检查
        const gp = getGpData(rawGp);
        if (!gp) return null;
        
        const narrationId = `narration_${gp.id || i}`;

        return (
          <animated.div style={{ ...styles.page, ...style }} key={gp.id || i}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                <div style={styles.header}>
                  <h2 style={styles.grammarPointTitle}>
                    {renderMixedText(gp.title)} 
                  </h2>
                </div>

                {gp.pattern && (
                  <div style={styles.patternBox}>
                    <div style={styles.boxLabel}>句型结构 (Structure)</div>
                    <div style={styles.patternContent}>{renderMixedText(gp.pattern, true)}</div>
                  </div>
                )}

                <div style={styles.sectionContainer}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitleText}>💡 详解 (Explanation)</span>
                    {renderPlayButton(gp.script, narrationId, false)}
                  </div>
                  <div style={styles.textBlock}>
                    <div className="rich-text-content" style={styles.richTextContainer}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{gp.explanation}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {gp.usage && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={{ ...styles.sectionTitleText, color: '#059669' }}>📌 适用场景 (Usage)</span>
                    </div>
                    <div style={{ ...styles.textBlock, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                       <div className="rich-text-content" style={styles.richTextContainer}>
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{gp.usage}</ReactMarkdown>
                       </div>
                    </div>
                  </div>
                )}

                {gp.attention && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={{ ...styles.sectionTitleText, color: '#ef4444' }}>⚠️ 注意事项 (Attention)</span>
                    </div>
                    <div style={{ ...styles.textBlock, background: '#fff1f2', border: '1px solid #fecaca' }}>
                       <div className="rich-text-content" style={styles.richTextContainer}>
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{gp.attention}</ReactMarkdown>
                       </div>
                    </div>
                  </div>
                )}

                {gp.examples && gp.examples.length > 0 && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={styles.sectionTitleText}>🗣️ 例句 (Examples)</span>
                    </div>
                    <div style={styles.examplesList}>
                      {gp.examples.map((ex, exIndex) => {
                        const exId = `example_${ex.id || exIndex}`;
                        const sentence = ex['句子'] || ex['sentence'];
                        const trans = ex['翻译'] || ex['translation'];
                        const audioText = ex['例句发音'] || ex['narrationScript'] || sentence;

                        return (
                          <div key={exId} style={styles.exampleItem}>
                            <div style={styles.exampleMain}>
                              <div style={styles.exampleSentence}>
                                {renderMixedText(sentence)}
                              </div>
                              <div style={styles.exampleTranslation}>{trans}</div>
                            </div>
                            {renderPlayButton(audioText, exId, true)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ height: '120px' }} />
              </div>
            </div>

            <div style={styles.bottomBar}>
              <button
                style={{ ...styles.navButton, visibility: i === 0 ? 'hidden' : 'visible', background: '#f1f5f9', color: '#64748b' }}
                onClick={() => { if (currentIndex > 0) { lastDirection.current = -1; setCurrentIndex(p => p - 1); } }}
              >
                <FaChevronLeft /> 上一条
              </button>
              <button
                style={{ ...styles.navButton, background: '#2563eb', color: 'white', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
                onClick={() => {
                   if (currentIndex < dataToUse.length - 1) { 
                     lastDirection.current = 1; 
                     setCurrentIndex(p => p + 1); 
                   } else {
                     onComplete();
                   }
                }}
              >
                {i === dataToUse.length - 1 ? '完成学习' : '下一条'} <FaChevronRight />
              </button>
            </div>
          </animated.div>
        );
      })}
    </div>
  );
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array,
  onComplete: PropTypes.func,
};

// =================================================================================
// ===== 6. 默认数据 (用于测试) =====
// =================================================================================
const TEST_DATA = [
  {
    "id": "u1_rich",
    "语法标题": "基础问候：你好 vs 您好",
    "句型结构": "{{Subject}} + {{好}}",
    "语法详解": "### 1. 核心概念\n这是中文里最万能的打招呼方式。结构非常简单：**对象 + 好**。\n\n| 中文 | 拼音 | 缅文含义 |\n| :--- | :--- | :--- |\n| **你好** | Nǐ hǎo | မင်္ဂလာပါ |\n| **您好** | Nín hǎo | မင်္ဂလာပါ (ယဉ်ကျေး) |",
    "讲解脚本": "你好！这是测试音频。",
    "例句列表": [
      {
        "id": "u1_ex1",
        "句子": "{{你好}}！{{好久不见}}。",
        "翻译": "你好！好久不见。",
        "例句发音": "你好！好久不见。"
      }
    ]
  }
];

// =================================================================================
// ===== 7. 样式 =====
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
  playButton: { background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.18s', padding: 0 },
  playButtonSmall: { background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '50%', width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s', padding: 0 },
  textBlock: { background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e6eef8', fontSize: '1rem', lineHeight: 1.75, color: '#475569' },
  richTextContainer: { whiteSpace: 'normal', overflowWrap: 'break-word' },
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

// 注入 CSS 动画和样式
const styleTag = typeof document !== 'undefined' ? (document.getElementById('grammar-player-styles') || document.createElement('style')) : null;
if (styleTag) {
  styleTag.id = 'grammar-player-styles';
  styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .play-button:active { transform: scale(0.94); }
    .playing { animation: pulse-ring 2s infinite; background-color: rgba(37, 99, 235, 0.12) !important; color: #2563eb !important; border-color: #2563eb !important; }
    @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); } 70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
    .rich-text-content h1, .rich-text-content h2 { color: #0f172a; margin: 1em 0 0.5em 0; font-weight: 700; font-size: 1.1em; border-bottom: 1px solid #eee; }
    .rich-text-content p { margin: 0.8em 0; line-height: 1.8; color: #475569; }
    .rich-text-content strong { color: #0b3d91; background: rgba(37, 99, 235, 0.05); padding: 0 2px; }
    .rich-text-content table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.95em; }
    .rich-text-content th { background: #f1f5f9; color: #334155; padding: 8px; border: 1px solid #e2e8f0; }
    .rich-text-content td { padding: 8px; border: 1px solid #e2e8f0; vertical-align: top; }
    ruby rt { font-size: 0.6em; color: #0b3d91; user-select: none; }
  `;
  if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);
}

export default GrammarPointPlayer;
