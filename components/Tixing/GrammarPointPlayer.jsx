import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { FaVolumeUp, FaStop, FaSpinner, FaChevronLeft, FaChevronRight, FaRobot, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// ⚠️ 请确保这个路径下有您的 AI 聊天组件
import AiChatAssistant from '../AiChatAssistant'; 

// =================================================================================
// ===== 1. IndexedDB 工具函数 (缓存 Blob) =====
// =================================================================================
const DB_NAME = 'MixedTTSCache';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

const idb = {
    db: null,
    async init() {
        if (this.db) return Promise.resolve();
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
        await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    },
    async set(key, blob) {
        await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).put(blob, key);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
    }
};

// =================================================================================
// ===== 2. 混合 TTS 核心 Hook (HTML5 Audio 链式播放 - 极速版) =====
// =================================================================================
function useMixedTTS() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [loadingId, setLoadingId] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    
    // 引用：用于存储当前播放队列，方便随时停止
    const audioQueueRef = useRef([]); 
    const currentAudioRef = useRef(null);
    const latestRequestIdRef = useRef(0);

    // 组件卸载时清理
    useEffect(() => {
        return () => stop();
    }, []);

    const stop = useCallback(() => {
        // 停止当前正在播放的
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current = null;
        }
        // 清空队列引用
        audioQueueRef.current = [];
        // 更新状态
        setIsPlaying(false);
        setPlayingId(null);
        setLoadingId(null);
        // 增加请求ID，使旧的异步操作失效
        latestRequestIdRef.current++;
    }, []);

    // 语种检测
    const detectLanguage = (text) => {
        if (/[\u1000-\u109F]/.test(text)) return 'my'; // 缅文
        return 'zh'; // 默认中文
    };

    // 获取音频 Blob
    const fetchAudioBlob = async (text, lang) => {
        const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoxiaoMultilingualNeural';
        const cacheKey = `tts-blob-${voice}-${text}`;
        
        // 1. 查缓存
        const cached = await idb.get(cacheKey);
        if (cached) return cached;

        // 2. 请求
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TTS Fetch Failed: ${res.status}`);
        const blob = await res.blob();

        // 3. 存缓存
        await idb.set(cacheKey, blob);
        return blob;
    };

    const play = useCallback(async (text, uniqueId) => {
        if (!text) return;

        // 如果点击的是当前正在播放的，则停止
        if (playingId === uniqueId) {
            stop();
            return;
        }

        stop(); // 停止之前的
        setLoadingId(uniqueId);
        const myRequestId = ++latestRequestIdRef.current;

        try {
            // 1. 文本清洗与拆分
            let cleanText = text.replace(/<[^>]+>/g, '').replace(/\{\{| \}\}|\}\}/g, '').replace(/\n/g, ' ');
            const segments = [];
            const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g; // 简单拆分中文和非中文
            let match;
            while ((match = regex.exec(cleanText)) !== null) {
                if (match[0].trim()) {
                    segments.push({
                        text: match[0],
                        lang: detectLanguage(match[0])
                    });
                }
            }

            if (segments.length === 0) {
                setLoadingId(null);
                return;
            }

            // 2. 并行请求所有片段
            const blobs = await Promise.all(
                segments.map(seg => fetchAudioBlob(seg.text, seg.lang))
            );

            // 如果请求期间被停止了，直接返回
            if (myRequestId !== latestRequestIdRef.current) return;

            // 3. 创建 Audio 对象队列
            const audioObjects = blobs.map((blob, index) => {
                const audio = new Audio(URL.createObjectURL(blob));
                // ✅ 中文 0.7 倍速，缅文 1.0 倍速
                if (segments[index].lang === 'zh') {
                    audio.playbackRate = 0.7; 
                    audio.preservesPitch = false; 
                } else {
                    audio.playbackRate = 1.0;
                }
                return audio;
            });

            audioQueueRef.current = audioObjects;
            setLoadingId(null);
            setPlayingId(uniqueId);
            setIsPlaying(true);

            // 4. 递归播放函数
            const playNext = (index) => {
                if (myRequestId !== latestRequestIdRef.current) return;
                
                if (index >= audioObjects.length) {
                    setIsPlaying(false);
                    setPlayingId(null);
                    currentAudioRef.current = null;
                    return;
                }

                const audio = audioObjects[index];
                currentAudioRef.current = audio;

                const targetRate = segments[index].lang === 'zh' ? 0.7 : 1.0;
                audio.playbackRate = targetRate;

                audio.onended = () => {
                    playNext(index + 1);
                };

                audio.onerror = (e) => {
                    console.error("Audio play error", e);
                    playNext(index + 1);
                };

                audio.play().catch(e => {
                    console.error("Play prevented", e);
                    setIsPlaying(false);
                    setPlayingId(null);
                });
            };

            playNext(0);

        } catch (e) {
            console.error("TTS Play Error:", e);
            setLoadingId(null);
            setPlayingId(null);
        }
    }, [stop, playingId]); // playingId 加入依赖，确保状态正确判断

    const preload = useCallback((text) => {
        if (!text) return;
        let cleanText = text.replace(/<[^>]+>/g, '').replace(/\{\{| \}\}|\}\}/g, '').replace(/\n/g, ' ');
        const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
            if (match[0].trim()) {
                const t = match[0];
                const lang = detectLanguage(t);
                fetchAudioBlob(t, lang).catch(()=>{});
            }
        }
    }, []);

    return { play, stop, isPlaying, playingId, loadingId, preload };
}

// =================================================================================
// ===== 3. 辅助组件 =====
// =================================================================================
const generateRubyHTML = (text) => {
  if (!text) return '';
  return text.replace(/[\u4e00-\u9fa5]+/g, word => {
      const pinyin = pinyinConverter(word);
      return `<ruby>${word}<rt>${pinyin}</rt></ruby>`;
  });
};

const DraggableAiBtn = ({ contextText }) => {
    const [isOpen, setIsOpen] = useState(false);
    const constraintsRef = useRef(null);

    return (
        <>
            <div 
                ref={constraintsRef} 
                style={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 100, pointerEvents: 'none', zIndex: 90 }} 
            />
            <motion.button
                drag
                dragConstraints={constraintsRef}
                dragElastic={0.1}
                dragMomentum={false}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'absolute', bottom: '120px', right: '20px', width: '56px', height: '56px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
                    cursor: 'pointer', border: 'none', touchAction: 'none', outline: 'none'
                }}
            >
                <FaRobot size={28} />
            </motion.button>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1001, backdropFilter: 'blur(3px)' }}
                        />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            style={{
                                position: 'fixed', bottom: 0, left: 0, right: 0, height: '75vh', background: 'white',
                                borderTopLeftRadius: '24px', borderTopRightRadius: '24px', boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
                                zIndex: 1002, display: 'flex', flexDirection: 'column', overflow: 'hidden'
                            }}
                        >
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '36px', height: '36px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                                        <FaRobot size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' }}>AI 语法助手</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>随时解答您的疑问</div>
                                    </div>
                                </div>
                                <button onClick={() => setIsOpen(false)} style={{ padding: '8px', background: '#f8fafc', borderRadius: '50%', border: 'none', color: '#64748b', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={16} /></button>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#f8fafc' }}>
                                {AiChatAssistant ? <AiChatAssistant context={contextText} /> : <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center"><FaRobot size={48} className="mb-4 opacity-50" /><p>请确保已正确导入 components/AiChatAssistant.js 组件</p></div>}
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
        document.body.style.overscrollBehavior = 'none';
        return () => { document.body.style.overscrollBehavior = 'auto'; };
    }, []);

    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) {
        return <div className="flex h-full items-center justify-center text-gray-400">暂无语法数据</div>;
    }

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    const contentRef = useRef(null);
    const [canGoNext, setCanGoNext] = useState(false);

    // 使用新的混合 TTS Hook
    const { play, stop, playingId, loadingId, preload } = useMixedTTS();

    // ✅ 关键修复：将滚动条重置逻辑单独抽离，仅依赖 currentIndex
    useEffect(() => {
        // 切换页面时，停止之前的音频
        stop();
        // 只有切换页面时，才重置滚动条
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
        // 重置按钮状态
        setCanGoNext(true);
    }, [currentIndex, stop]);

    // ✅ 处理自动播放和预加载（不再包含 scrollTop 逻辑）
    useEffect(() => {
        const currentGp = grammarPoints[currentIndex];

        // 自动播放解说
        const autoPlayTimer = setTimeout(() => {
            if (currentGp?.narrationScript) {
                play(currentGp.narrationScript, `narration_${currentGp.id}`);
            }
        }, 600);

        // 预加载下两条
        const preloadNextItems = (count) => {
            for (let i = 1; i <= count; i++) {
                const nextIndex = currentIndex + i;
                if (nextIndex < grammarPoints.length) {
                    const nextGp = grammarPoints[nextIndex];
                    if (nextGp.narrationScript) preload(nextGp.narrationScript);
                    nextGp.examples.forEach(ex => {
                         preload(ex.narrationScript || ex.sentence);
                    });
                }
            }
        };
        preloadNextItems(2);
        
        return () => { clearTimeout(autoPlayTimer); };
    }, [currentIndex, grammarPoints, play, preload]);
    
    // 滚动监听
    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const isBottom = scrollTop + clientHeight >= scrollHeight - 50;
        if (isBottom && !canGoNext) setCanGoNext(true);
    };

    // 翻页逻辑
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
    
    // 渲染混合文本 (用于显示)
    const renderMixedText = (text, isPattern = false) => {
        const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        return parts.map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            let partStyle = isPattern 
                ? (isChinese ? styles.patternChinese : styles.patternMyanmar)
                : (isChinese ? styles.textChinese : styles.textBurmese);
            
            return (
                <span key={pIndex} style={partStyle}>
                    {isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} /> : content}
                </span>
            );
        });
    };

    const renderRichExplanation = (htmlContent) => {
        if (!htmlContent) return null;
        return <div className="rich-text-content" style={styles.richTextContainer} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    };

    const currentGp = grammarPoints[currentIndex];
    const contextText = currentGp ? `我在学习语法点：【${currentGp.grammarPoint}】。\n结构是：${currentGp.pattern || '无'}。\n解释：${currentGp.visibleExplanation?.replace(/<[^>]+>/g, '')}` : "";

    return (
        <div style={styles.container}>
            <DraggableAiBtn contextText={contextText} />

            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;
                const narrationId = `narration_${gp.id}`;

                return (
                    <animated.div style={{ ...styles.page, ...style }}>
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
                                        <button 
                                            className={`play-button ${playingId === narrationId ? 'playing' : ''}`} 
                                            style={styles.playButton} 
                                            onClick={() => play(gp.narrationScript, narrationId)}
                                        >
                                            {loadingId === narrationId ? <FaSpinner className="spin" /> : (playingId === narrationId ? <FaStop/> : <FaVolumeUp/>) }
                                        </button>
                                    </div>
                                    <div style={styles.textBlock}>
                                        {renderRichExplanation(gp.visibleExplanation)}
                                    </div>
                                </div>

                                {gp.usage && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <span style={{...styles.sectionTitleText, color: '#059669'}}>📌 使用场景</span>
                                        </div>
                                        <div style={{...styles.textBlock, background: '#ecfdf5', border: '1px solid #a7f3d0'}}>
                                            {renderRichExplanation(gp.usage)}
                                        </div>
                                    </div>
                                )}

                                {gp.attention && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <span style={{...styles.sectionTitleText, color: '#ef4444'}}>⚠️ 易错点</span>
                                        </div>
                                        <div style={{...styles.textBlock, background: '#fff1f2', border: '1px solid #fecaca'}}>
                                            {renderRichExplanation(gp.attention)}
                                        </div>
                                    </div>
                                )}
                                
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionTitleText}>🗣️ 例句</span>
                                    </div>
                                    <div style={styles.examplesList}>
                                        {gp.examples.map((ex) => {
                                            const exId = `example_${ex.id}`;
                                            return (
                                                <div key={ex.id} style={styles.exampleItem}>
                                                    <div style={styles.exampleMain}>
                                                        <div style={styles.exampleSentence}>
                                                            {renderMixedText(ex.sentence)}
                                                        </div>
                                                        <div style={styles.exampleTranslation}>{ex.translation}</div>
                                                    </div>
                                                    <button 
                                                        className={`play-button ${playingId === exId ? 'playing' : ''}`}
                                                        style={styles.playButtonSmall} 
                                                        onClick={() => play(ex.narrationScript || ex.sentence, exId)}
                                                    >
                                                         {loadingId === exId ? <FaSpinner className="spin" /> : (playingId === exId ? <FaStop/> : <FaVolumeUp/>) }
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ height: '120px' }}></div>
                            </div>
                        </div>

                        <div style={styles.bottomBar}>
                            <button 
                                style={{
                                    ...styles.navButton, 
                                    visibility: i === 0 ? 'hidden' : 'visible',
                                    background: '#f1f5f9', color: '#64748b'
                                }}
                                onClick={handlePrev}
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
// ===== 5. 样式与动画注入 =====
// =================================================================================
const styles = {
    container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white', willChange: 'transform, opacity' },
    scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: '0 16px' },
    contentWrapper: { maxWidth: '800px', margin: '0 auto', paddingTop: '20px', minHeight: '100%' },
    header: { textAlign: 'center', marginTop: '10px', marginBottom: '20px' },
    grammarPointTitle: { fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', margin: 0, lineHeight: 1.3 },
    patternBox: { background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid #e2e8f0', textAlign: 'center' },
    boxLabel: { fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', fontWeight: '600', letterSpacing: '1px' },
    patternContent: { fontSize: '1.2rem', fontWeight: 'bold' },
    patternChinese: { color: '#2563eb', margin: '0 4px' }, 
    patternMyanmar: { color: '#059669', margin: '0 4px' }, 
    sectionContainer: { marginBottom: '24px' },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    sectionTitleText: { fontSize: '1rem', fontWeight: '700', color: '#334155' },
    playButton: { background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
    playButtonSmall: { background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '50%', width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' },
    textBlock: { background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', lineHeight: 1.7, color: '#475569' },
    richTextContainer: { whiteSpace: 'normal' },
    examplesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    exampleItem: { background: '#f8fafc', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #e2e8f0' },
    exampleMain: { flex: 1 },
    exampleSentence: { fontSize: '1.1rem', fontWeight: 500, marginBottom: '4px', lineHeight: 1.5 },
    exampleTranslation: { fontSize: '0.9rem', color: '#64748b' },
    textChinese: { color: '#1e293b' }, 
    textBurmese: { color: '#059669' }, 
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '90px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', paddingBottom: '20px', zIndex: 50 },
    navButton: { border: 'none', borderRadius: '30px', padding: '12px 24px', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.3s' }
};

const styleTag = typeof document !== 'undefined' ? (document.getElementById('grammar-player-styles') || document.createElement('style')) : null;
if (styleTag) {
    styleTag.id = 'grammar-player-styles';
    styleTag.innerHTML = `
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .play-button:active { transform: scale(0.9); }
        .playing { animation: pulse-ring 2s infinite; background-color: rgba(37, 99, 235, 0.2) !important; color: #2563eb !important; border-color: #2563eb !important; }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
        .rich-text-content h3 { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 1.5em 0 0.8em 0; padding-bottom: 0.3em; border-bottom: 1px solid #e2e8f0; }
        .rich-text-content p { margin: 0.8em 0; color: #475569; }
        .rich-text-content strong, .rich-text-content b { color: #0d46ba; font-weight: 600; }
        .rich-text-content ul, .rich-text-content ol { margin: 0.8em 0; padding-left: 1.8em; }
        .rich-text-content li { margin: 0.5em 0; color: #475569; }
    `;
    if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);
}

export default GrammarPointPlayer;
