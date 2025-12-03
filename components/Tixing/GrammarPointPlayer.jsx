import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { FaVolumeUp, FaStop, FaSpinner, FaChevronLeft, FaChevronRight, FaRobot, FaTimes, FaPause, FaPlay } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// ⚠️ 请确保这个路径下有您的 AI 聊天组件，如果报错 404 请检查此路径
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
// ===== 2. 混合 TTS 核心 Hook (支持暂停/继续/缓存) =====
// =================================================================================
function useMixedTTS() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [loadingId, setLoadingId] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    
    // 引用：用于存储当前播放队列
    const audioQueueRef = useRef([]); 
    const currentAudioRef = useRef(null);
    const latestRequestIdRef = useRef(0);
    const playingIdRef = useRef(null);

    // 组件卸载时清理
    useEffect(() => {
        return () => stop();
    }, []);

    const stop = useCallback(() => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current = null;
        }
        audioQueueRef.current = [];
        setIsPlaying(false);
        setIsPaused(false);
        setPlayingId(null);
        playingIdRef.current = null;
        setLoadingId(null);
        latestRequestIdRef.current++;
    }, []);

    // 暂停/继续 切换功能
    const toggle = useCallback((uniqueId) => {
        if (playingIdRef.current !== uniqueId) return;

        if (currentAudioRef.current) {
            if (currentAudioRef.current.paused) {
                currentAudioRef.current.play().catch(e => console.error("Resume failed", e));
                setIsPaused(false);
            } else {
                currentAudioRef.current.pause();
                setIsPaused(true);
            }
        }
    }, []);

    const detectLanguage = (text) => {
        if (/[\u1000-\u109F]/.test(text)) return 'my';
        return 'zh';
    };

    const fetchAudioBlob = async (text, lang) => {
        const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoxiaoMultilingualNeural';
        const cacheKey = `tts-blob-${voice}-${text}`;
        
        const cached = await idb.get(cacheKey);
        if (cached) return cached;

        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TTS Fetch Failed: ${res.status}`);
        const blob = await res.blob();

        await idb.set(cacheKey, blob);
        return blob;
    };

    const play = useCallback(async (text, uniqueId) => {
        if (!text) return;

        // 如果点击的是当前正在播放的 ID，则执行暂停/继续逻辑
        if (playingIdRef.current === uniqueId) {
            toggle(uniqueId);
            return;
        }

        stop(); // 停止旧的
        setLoadingId(uniqueId);
        const myRequestId = ++latestRequestIdRef.current;

        try {
            let cleanText = text.replace(/<[^>]+>/g, '').replace(/\{\{| \}\}|\}\}/g, '').replace(/\n/g, ' ');
            const segments = [];
            const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
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

            const blobs = await Promise.all(
                segments.map(seg => fetchAudioBlob(seg.text, seg.lang))
            );

            if (myRequestId !== latestRequestIdRef.current) return;

            const audioObjects = blobs.map((blob, index) => {
                const audio = new Audio(URL.createObjectURL(blob));
                // ✅ 修复音调问题：去掉 preservesPitch = false，让浏览器自动处理音高
                if (segments[index].lang === 'zh') {
                    audio.playbackRate = 0.7; 
                } else {
                    audio.playbackRate = 1.0;
                }
                return audio;
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
                    setTimeout(() => playNext(index + 1), 50);
                };

                audio.play().catch(e => {
                    console.error("Play prevented", e);
                    if (e.name === 'NotAllowedError') {
                         setIsPlaying(false);
                         setPlayingId(null);
                         playingIdRef.current = null;
                    } else {
                         playNext(index + 1);
                    }
                });
            };

            playNext(0);

        } catch (e) {
            console.error("TTS Play Error:", e);
            setLoadingId(null);
            setPlayingId(null);
            playingIdRef.current = null;
        }
    }, [stop, toggle]); 

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

    return { play, stop, toggle, isPlaying, isPaused, playingId, loadingId, preload };
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

    // 阻止事件冒泡，防止拖拽或点击时触发底层的其他事件
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
                dragElastic={0.1}
                dragMomentum={false}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleOpen}
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
                            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1001, backdropFilter: 'blur(3px)' }}
                        />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()} // 防止点击内部内容关闭
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
                                <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} style={{ padding: '8px', background: '#f8fafc', borderRadius: '50%', border: 'none', color: '#64748b', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={16} /></button>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#f8fafc' }}>
                                {AiChatAssistant ? <AiChatAssistant context={contextText} /> : <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center"><FaRobot size={48} className="mb-4 opacity-50" /><p>未检测到 AI 组件，请检查路径</p></div>}
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

    const { play, stop, toggle, playingId, isPaused, loadingId, preload } = useMixedTTS();

    // 切换页面时：停止之前的播放，重置滚动条
    useEffect(() => {
        stop();
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
        setCanGoNext(true);
    }, [currentIndex, stop]);

    // ✅ 修复：移除了自动播放逻辑，只保留预加载
    useEffect(() => {
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
        
        // 此处不调用 play，实现“点击后朗读”
    }, [currentIndex, grammarPoints, preload]); 
    
    // 滚动监听
    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const isBottom = scrollTop + clientHeight >= scrollHeight - 50;
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

    // 渲染播放/暂停按钮的逻辑封装
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
                onClick={(e) => {
                    e.stopPropagation();
                    play(script, id); 
                }}
            >
                <Icon className={isLoading ? "spin" : ""} />
            </button>
        );
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
                                        {renderPlayButton(gp.narrationScript, narrationId, false)}
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
                                                    {renderPlayButton(ex.narrationScript || ex.sentence, exId, true)}
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
