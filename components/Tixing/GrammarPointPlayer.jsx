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
// ===== 1. IndexedDB 工具函数 =====
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
        resolve((blob && blob.size > 100) ? blob : null);
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
// ===== 2. TTS Hook =====
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
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
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
        currentAudioRef.current.play().catch(() => {});
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
    } catch (e) {}

    if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey);

    const promise = (async () => {
      try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('TTS Fetch Failed');
        const blob = await res.blob();
        if (!blob || blob.size < 100) throw new Error('TTS Invalid');
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
      let cleanText = String(text)
        .replace(/<[^>]+>/g, '')
        .replace(/\{\{|\}\}/g, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/#/g, '')
        .replace(/\n+/g, ' ')
        .trim();

      const segments = [];
      const regex = /([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g;
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

      const blobs = await Promise.all(segments.map(seg => fetchAudioBlob(seg.text, seg.lang === 'other' ? 'zh' : seg.lang)));
      if (myRequestId !== latestRequestIdRef.current) return;

      const audioObjects = blobs.map((blob, idx) => {
        const objectURL = URL.createObjectURL(blob);
        createdObjectURLsRef.current.add(objectURL);
        const audio = new Audio(objectURL);
        const segLang = segments[idx].lang;
        audio.playbackRate = segLang === 'zh' ? 0.75 : 1.0;
        return { audio, objectURL };
      });

      audioQueueRef.current = audioObjects;
      setLoadingId(null);
      setPlayingId(uniqueId);
      playingIdRef.current = uniqueId;
      setIsPlaying(true);

      const playNext = (index) => {
        if (myRequestId !== latestRequestIdRef.current) return;
        if (index >= audioObjects.length) {
          stop();
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
        audio.onerror = cleanupAndNext;
        audio.play().catch(cleanupAndNext);
      };

      playNext(0);

    } catch (e) {
      console.error('Network TTS failed', e);
      setLoadingId(null);
      // Fallback to native (omitted for brevity, assume supported or fail gracefully)
      setPlayingId(null);
      playingIdRef.current = null;
      setIsPlaying(false);
    }
  }, [stop, toggle]);

  return { play, stop, toggle, isPlaying, isPaused, playingId, loadingId };
}

// =================================================================================
// ===== 3. 辅助函数与组件 =====
// =================================================================================

// 核心功能：自动生成拼音 HTML
const generateRubyHTML = (text) => {
  if (!text) return '';
  // 匹配所有汉字，自动加拼音
  return text.replace(/[\u4e00-\u9fff]+/g, word => {
    try {
      // pinyin-pro 配置：使用数字声调便于 TTS 引擎识别，或者这里显示用符号
      // 这里为了显示好看，用 'symbol'；如果是给 TTS 读，TTS 引擎通常自己会处理
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
        // ⚠️ 修改：尺寸变小
        style={{
          position: 'absolute',
          bottom: '100px',
          right: '16px',
          width: '40px',   // 变小
          height: '40px',  // 变小
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
        <FaRobot size={20} /> {/* 图标变小 */}
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
  // ⚠️ 调试：使用内置数据（如果外部没传）
  const dataToUse = (grammarPoints && Array.isArray(grammarPoints) && grammarPoints.length > 0) ? grammarPoints : TEST_DATA;
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const lastDirection = useRef(0);
  const contentRef = useRef(null);
  const [canGoNext, setCanGoNext] = useState(false);
  const { play, stop, toggle, playingId, isPaused, loadingId } = useMixedTTS();

  useEffect(() => {
    stop();
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setCanGoNext(true);
  }, [currentIndex, stop]);

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '100%' : '-100%'})` },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
    config: { mass: 1, tension: 280, friction: 30 },
  });

  // ⚠️ 核心函数：支持中文 key 的数据映射
  const getGpData = (gp) => {
    if (!gp) return null;
    return {
      id: gp.id,
      // 优先读取中文 Key，读不到再读英文 Key
      title: gp['语法标题'] || gp['grammarPoint'],
      pattern: gp['句型结构'] || gp['pattern'],
      explanation: gp['语法详解'] || gp['visibleExplanation'],
      usage: gp['适用场景'] || gp['usage'],
      attention: gp['注意事项'] || gp['attention'],
      script: gp['讲解脚本'] || gp['narrationScript'],
      examples: gp['例句列表'] || gp['examples'] || [],
    };
  };

  // 渲染带拼音的文本
  const renderMixedText = (text, isPattern = false) => {
    if (!text) return null;
    // 1. 如果包含 {{}}，说明有特定高亮
    if (text.includes('{{')) {
      const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
      return parts.map((part, pIndex) => {
        const isChinese = part.startsWith('{{') && part.endsWith('}}');
        const content = isChinese ? part.slice(2, -2) : part;
        let partStyle = isPattern
          ? (isChinese ? styles.patternChinese : styles.patternMyanmar)
          : (isChinese ? styles.textChinese : styles.textBurmese);

        // 如果是中文内容，自动生成拼音
        if (isChinese) {
          return <span key={pIndex} style={partStyle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} />;
        }
        // 如果不是高亮部分，但也包含中文（自动检测）
        if (/[\u4e00-\u9fff]/.test(content)) {
           return <span key={pIndex} style={partStyle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} />;
        }
        return <span key={pIndex} style={partStyle}>{content}</span>;
      });
    }

    // 2. 如果没有 {{}}，但有汉字，直接全文生成拼音
    if (/[\u4e00-\u9fff]/.test(text)) {
      return <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(text) }} />;
    }

    // 3. 纯缅文或英文
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

  if (!dataToUse || dataToUse.length === 0) return <div style={{padding:20,textAlign:'center'}}>暂无数据</div>;

  const currentRawGp = dataToUse[currentIndex];
  const currentGp = getGpData(currentRawGp); // 转换数据
  const contextText = currentGp ? `学习语法：${currentGp.title}` : '';

  return (
    <div style={styles.container}>
      <DraggableAiBtn contextText={contextText} />

      {transitions((style, i) => {
        const rawGp = dataToUse[i];
        const gp = getGpData(rawGp); // ⚠️ 使用转换后的数据对象
        if (!gp) return null;
        const narrationId = `narration_${gp.id}`;

        return (
          <animated.div style={{ ...styles.page, ...style }} key={gp.id || i}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                {/* 标题：自动生成拼音 */}
                <div style={styles.header}>
                  <h2 style={styles.grammarPointTitle}>
                    {renderMixedText(gp.title)} 
                  </h2>
                </div>

                {/* 句型结构 */}
                {gp.pattern && (
                  <div style={styles.patternBox}>
                    <div style={styles.boxLabel}>句型结构 (Structure)</div>
                    <div style={styles.patternContent}>{renderMixedText(gp.pattern, true)}</div>
                  </div>
                )}

                {/* 详解 */}
                <div style={styles.sectionContainer}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitleText}>💡 详解 (Explanation)</span>
                    {/* 播放讲解脚本 */}
                    {renderPlayButton(gp.script, narrationId, false)}
                  </div>
                  <div style={styles.textBlock}>
                    <div className="rich-text-content" style={styles.richTextContainer}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{gp.explanation}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* 适用场景 */}
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

                {/* 注意事项 */}
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

                {/* 例句 */}
                {gp.examples && gp.examples.length > 0 && (
                  <div style={styles.sectionContainer}>
                    <div style={styles.sectionHeader}>
                      <span style={styles.sectionTitleText}>🗣️ 例句 (Examples)</span>
                    </div>
                    <div style={styles.examplesList}>
                      {gp.examples.map((ex) => {
                        const exId = `example_${ex.id}`;
                        // ⚠️ 修复：优先读取中文 key
                        const sentence = ex['句子'] || ex['sentence'];
                        const trans = ex['翻译'] || ex['translation'];
                        // ⚠️ 朗读：优先读'例句发音'，如果没有，就读'句子'
                        const audioText = ex['例句发音'] || ex['narrationScript'] || sentence;

                        return (
                          <div key={ex.id || Math.random()} style={styles.exampleItem}>
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
                   if (currentIndex < dataToUse.length - 1) { lastDirection.current = 1; setCurrentIndex(p => p + 1); }
                   else onComplete();
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
    "讲解脚本": "ကျောင်းသားတို့ရေ၊ တရုတ်စကားမှာ အသုံးအများဆုံး နှုတ်ဆက်စကားက '你好' ဖြစ်ပါတယ်။",
    "例句列表": [
      {
        "id": "u1_ex1",
        "句子": "{{你好}}！{{好久不见}}。",
        "翻译": "မင်္ဂလာပါ! မတွေ့ရတာကြာပြီနော်။",
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
  playButton: { background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.18s' },
  playButtonSmall: { background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '50%', width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' },
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
