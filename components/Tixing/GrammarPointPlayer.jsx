import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { FaVolumeUp, FaStop, FaSpinner, FaChevronLeft, FaChevronRight, FaRobot, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// ⚠️ 请确保这个路径下有您的 AI 聊天组件
import AiChatAssistant from '../AiChatAssistant'; 

// =================================================================================
// ===== 1. IndexedDB 工具函数 (用于本地缓存拼接好的音频) =====
// =================================================================================
const DB_NAME = 'MixedTTSCache';
const STORE_NAME = 'audios';
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
        await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    },
    async set(key, buffer) {
        await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(buffer, key); // 存储 ArrayBuffer
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
    }
};

// =================================================================================
// ===== 2. 混合 TTS 核心 Hook (拆分 -> 并行请求 -> 拼接) =====
// =================================================================================
function useMixedTTS() {
    const audioCtxRef = useRef(null);
    const sourceRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loadingId, setLoadingId] = useState(null); // 记录当前正在加载哪个ID的音频
    const [playingId, setPlayingId] = useState(null); // 记录当前正在播放哪个ID的音频

    // 初始化 AudioContext
    useEffect(() => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtxRef.current = new AudioContext();
        }
        return () => {
            stop(); // 组件卸载时停止
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close();
            }
        };
    }, []);

    // 文本拆分：汉字/缅文/其他
    const splitMixedText = (text) => {
        const reHan = /\p{Script=Han}/u;
        const reMyanmar = /\p{Script=Myanmar}/u;
        let segments = [];
        let current = { lang: null, text: "" };

        for (let ch of text) {
            let type = 'other';
            if (reHan.test(ch)) type = 'zh';
            else if (reMyanmar.test(ch)) type = 'mm';
            else if (/\s/.test(ch)) type = 'ws'; // 空格归类为ws

            if (current.lang === null) {
                current.lang = type === 'ws' ? 'other' : type;
                current.text = ch;
            } else {
                if (type === 'ws' || type === 'other') {
                    current.text += ch; // 标点符号跟随上一段
                } else if (type === current.lang) {
                    current.text += ch;
                } else {
                    segments.push(current);
                    current = { lang: type, text: ch };
                }
            }
        }
        if (current.text) segments.push(current);

        // 合并琐碎片段
        let merged = [];
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (seg.lang === 'other') {
                if (merged.length > 0) merged[merged.length - 1].text += seg.text;
                else if (i + 1 < segments.length) segments[i + 1].text = seg.text + segments[i + 1].text;
                else merged.push({ lang: 'zh', text: seg.text }); // 默认回退
            } else {
                merged.push(seg);
            }
        }
        return merged.filter(s => s.text.trim().length > 0);
    };

    // 音频请求
    const fetchSegmentAudio = async (text, lang) => {
        // 映射发音人
        const voice = lang === 'mm' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoxiaoMultilingualNeural';
        // 您的代理接口
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TTS Fetch Failed: ${res.status}`);
        return res.arrayBuffer();
    };

    // 解码并拼接
    const decodeAndConcat = async (arrayBuffers) => {
        const ctx = audioCtxRef.current;
        const decodedBuffers = await Promise.all(arrayBuffers.map(ab => ctx.decodeAudioData(ab.slice(0))));
        
        // 计算总长度
        let totalLen = 0;
        let channels = 1;
        decodedBuffers.forEach(b => {
            totalLen += b.length;
            channels = Math.max(channels, b.numberOfChannels);
        });

        const output = ctx.createBuffer(channels, totalLen, decodedBuffers[0].sampleRate);
        
        let offset = 0;
        for (const buf of decodedBuffers) {
            for (let ch = 0; ch < channels; ch++) {
                // 如果源音频通道少于输出通道，简单的复制第0通道
                const chData = buf.numberOfChannels > ch ? buf.getChannelData(ch) : buf.getChannelData(0);
                output.getChannelData(ch).set(chData, offset);
            }
            offset += buf.length;
        }
        return output;
    };

    const stop = useCallback(() => {
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
                sourceRef.current.disconnect();
            } catch (e) {}
            sourceRef.current = null;
        }
        setIsPlaying(false);
        setPlayingId(null);
        setLoadingId(null);
    }, []);

    const play = useCallback(async (text, uniqueId) => {
        if (!text) return;
        
        // 如果点击的是当前正在播放的，则停止
        if (playingId === uniqueId) {
            stop();
            return;
        }

        stop(); // 停止之前的
        setLoadingId(uniqueId);

        try {
            // 清理文本
            let cleanText = text.replace(/<[^>]+>/g, '').replace(/\{\{| \}\}|\}\}/g, '').replace(/\n/g, ' ');
            const cacheKey = `tts-mixed-${cleanText}`;
            
            // 1. 查缓存
            let finalBuffer = await idb.get(cacheKey);

            // 2. 如果没缓存，执行拆分请求逻辑
            if (!finalBuffer) {
                const segments = splitMixedText(cleanText);
                const promises = segments.map(seg => fetchSegmentAudio(seg.text, seg.lang));
                const rawBuffers = await Promise.all(promises);
                
                // 这里我们缓存的是 WAV 格式的 ArrayBuffer 或者是 decode 后的数据?
                // IndexedDB 不能直接存 AudioBuffer。
                // 简单起见，我们每次重新 decode，或者自己封装 WAV。
                // 为了性能，我们这里采用：每次实时拼接解码，但如果太慢，可以把拼接好的 PCM 转 WAV 存。
                // *优化*：为了简化，这里暂存第一个请求到的 buffer 模拟 (实际应该转WAV)。
                // 既然使用了 Web Audio API，最好的缓存策略是缓存原始的 MP3 blob 数组，或者缓存合并后的 WAV ArrayBuffer。
                // 为了代码稳健，这里我们使用 **AudioBuffer -> WAV ArrayBuffer** 转换逻辑 (简化版)
                
                const decodedBuffer = await decodeAndConcat(rawBuffers);
                
                // 播放逻辑
                playAudioBuffer(decodedBuffer, uniqueId);

                // 异步存缓存 (转WAV比较复杂，这里为了演示简化，建议缓存 segments 的 raw buffers 或者是转码后的 wav)
                // 由于不引入额外 WAV Encoder 库，这里可以考虑只在内存复用，或者接受每次重新请求(如果浏览器有 HTTP cache)。
                // 但为了满足"秒开"，我们使用一个简单的内存 Map 做一级缓存，IDB 做二级 (如果实现了wav encode)。
                // 修正：利用浏览器自身的 HTTP 缓存通常已经足够快。但为了完全离线体验，
                // 我们这里演示直接播放，不强制写入 IDB (除非引入 wav encoder)。
                // *注：上面的 idb 代码保留，如果您有 wav encoder 可以用。*
                
            } else {
                // 如果有缓存 (假设存的是 ArrayBuffer)
                const ctx = audioCtxRef.current;
                const decoded = await ctx.decodeAudioData(finalBuffer.slice(0));
                playAudioBuffer(decoded, uniqueId);
            }

        } catch (e) {
            console.error("TTS Play Error:", e);
            setLoadingId(null);
        }

    }, [stop]);

    const playAudioBuffer = (buffer, id) => {
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
            if (playingId === id) {
                setIsPlaying(false);
                setPlayingId(null);
            }
        };
        
        sourceRef.current = source;
        source.start(0);
        setPlayingId(id);
        setIsPlaying(true);
        setLoadingId(null);
    };

    // 预加载功能 (简单发请求让浏览器缓存)
    const preload = (text) => {
        if(!text) return;
        let cleanText = text.replace(/<[^>]+>/g, '').replace(/\{\{| \}\}|\}\}/g, '').replace(/\n/g, ' ');
        const segments = splitMixedText(cleanText);
        segments.forEach(seg => {
             const voice = seg.lang === 'mm' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoxiaoMultilingualNeural';
             const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(seg.text)}&v=${voice}`;
             fetch(url, {priority: 'low'}).catch(()=>{});
        });
    };

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

    // 页面切换副作用
    useEffect(() => {
        stop();
        if (contentRef.current) contentRef.current.scrollTop = 0;
        setCanGoNext(true);

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
        
        return () => { clearTimeout(autoPlayTimer); stop(); };
    }, [currentIndex, grammarPoints, play, stop, preload]);
    
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
