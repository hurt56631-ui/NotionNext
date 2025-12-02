import React, { useState, useEffect, useRef, useCallback } from 'react';
// ❌ 移除 createPortal，因为我们要把它作为普通组件渲染
// import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl } from 'howler';
import { FaVolumeUp, FaStop, FaSpinner, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

// --- 辅助函数：自动生成拼音 HTML ---
const generateRubyHTML = (text) => {
  if (!text) return '';
  return text.replace(/[\u4e00-\u9fa5]+/g, word => {
      const pinyin = pinyinConverter(word);
      return `<ruby>${word}<rt>${pinyin}</rt></ruby>`;
  });
};

// --- 音频缓存与预加载模块 ---
const audioCache = {
    cache: new Map(),
    async get(url) {
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }
        try {
            const cachedBlobUrl = sessionStorage.getItem(url);
            if (cachedBlobUrl) {
                this.cache.set(url, cachedBlobUrl);
                return cachedBlobUrl;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`音频获取失败: ${response.statusText}`);
            const blob = await response.blob();
            
            const reader = new FileReader();
            const promise = new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64data = reader.result;
                    try { sessionStorage.setItem(url, base64data); } catch (e) {}
                    this.cache.set(url, base64data);
                    resolve(base64data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return promise;

        } catch (error) {
            console.error("音频缓存模块错误:", error);
            return url;
        }
    },
    preload(url) {
        if (!this.cache.has(url) && !sessionStorage.getItem(url)) {
            this.get(url).catch(err => console.error(`预加载失败: ${url}`, err));
        }
    }
};

const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    // 移除 isMounted 检查，因为不再需要 Portal
    
    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) {
        return <div className="flex h-full items-center justify-center text-gray-400">暂无语法数据</div>;
    }

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    
    const [activeAudio, setActiveAudio] = useState(null); 
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const currentSoundRef = useRef(null); 

    const contentRef = useRef(null);
    const [canGoNext, setCanGoNext] = useState(false);

    // --- 音频控制逻辑 ---
    const stopPlayback = useCallback(() => {
        if (currentSoundRef.current) {
            currentSoundRef.current.stop();
            currentSoundRef.current.unload();
            currentSoundRef.current = null;
        }
        setActiveAudio(null);
        setIsLoadingAudio(false);
    }, []);

    const playSingleAudio = useCallback(async (text, type, voice = 'zh-CN-XiaoxiaoMultilingualNeural', rate = 1.0) => {
        stopPlayback();
        if (!text) return;

        setActiveAudio({ type });
        setIsLoadingAudio(true);

        let cleanText = text.replace(/<[^>]+>/g, ''); 
        cleanText = cleanText.replace(/\{\{| \}\}|\}\}/g, '');
        cleanText = cleanText.replace(/\n/g, '... ').replace(/[\r\n]+/g, '... ');

        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanText)}&v=${voice}`;
        
        try {
            const audioSrc = await audioCache.get(url);

            const sound = new Howl({
                src: [audioSrc],
                html5: true,
                format: ['mp3'],
                rate: rate,
                onload: () => { setIsLoadingAudio(false); },
                onend: () => { setActiveAudio(null); currentSoundRef.current = null; },
                onloaderror: (id, err) => {
                    console.error('音频加载错误:', err);
                    setIsLoadingAudio(false);
                    setActiveAudio(null);
                },
                onplayerror: (id, err) => {
                    console.error('音频播放错误:', err);
                    const fallbackSound = new Howl({
                        src: [url],
                        html5: true,
                        rate: rate,
                        onload: () => setIsLoadingAudio(false),
                        onend: () => setActiveAudio(null),
                    });
                    fallbackSound.play();
                    currentSoundRef.current = fallbackSound;
                }
            });

            currentSoundRef.current = sound;
            sound.play();
        } catch (error) {
            console.error("播放音频失败:", error);
            setIsLoadingAudio(false);
            setActiveAudio(null);
        }
    }, [stopPlayback]);
    
    const handlePlayButtonClick = (text, type, voice, rate) => {
        if (activeAudio?.type === type) {
            stopPlayback();
        } else {
            playSingleAudio(text, type, voice, rate);
        }
    };
    
    // --- 页面切换副作用 ---
    useEffect(() => {
        stopPlayback();
        if (contentRef.current) contentRef.current.scrollTop = 0;
        
        // 简化逻辑：默认允许下一步，防止卡住，也可以保留滚动检测
        setCanGoNext(true); 

        // 自动播放解说
        const autoPlayTimer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playSingleAudio(gp.narrationScript, `narration_${gp.id}`, 'zh-CN-XiaoxiaoMultilingualNeural', 0.82);
            }
        }, 600);

        // 预加载
        const preloadNextItems = (count) => {
            for (let i = 1; i <= count; i++) {
                const nextIndex = currentIndex + i;
                if (nextIndex < grammarPoints.length) {
                    const nextGp = grammarPoints[nextIndex];
                    if (nextGp.narrationScript) {
                        const cleanText = nextGp.narrationScript.replace(/<[^>]+>/g, '').replace(/\n/g, '... ');
                        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanText)}&v=zh-CN-XiaoxiaoMultilingualNeural`;
                        audioCache.preload(url);
                    }
                    nextGp.examples.forEach(ex => {
                         const cleanText = (ex.narrationScript || ex.sentence).replace(/<[^>]+>/g, '').replace(/\n/g, '... ');
                         const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanText)}&v=zh-CN-YunxiNeural`;
                         audioCache.preload(url);
                    });
                }
            }
        };
        preloadNextItems(2);
        
        return () => { clearTimeout(autoPlayTimer); stopPlayback(); };
    }, [currentIndex, grammarPoints, playSingleAudio, stopPlayback]);
    
    // --- 滚动监听 ---
    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const isBottom = scrollTop + clientHeight >= scrollHeight - 50;
        if (isBottom && !canGoNext) {
            setCanGoNext(true);
        }
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
    
    // --- 渲染辅助 ---
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

    // ✅✅✅ 重点：作为普通 DIV 渲染，而非 Portal
    return (
        <div style={styles.container}>
            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;

                return (
                    <animated.div style={{ ...styles.page, ...style }}>
                        {/* 滚动区域 */}
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
                                            className={`play-button ${activeAudio?.type === `narration_${gp.id}` ? 'playing' : ''}`} 
                                            style={styles.playButton} 
                                            onClick={() => handlePlayButtonClick(gp.narrationScript, `narration_${gp.id}`, 'zh-CN-XiaoxiaoMultilingualNeural', 0.7)}
                                        >
                                            {isLoadingAudio && activeAudio?.type === `narration_${gp.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `narration_${gp.id}` ? <FaStop/> : <FaVolumeUp/>) }
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
                                        {gp.examples.map((ex) => (
                                            <div key={ex.id} style={styles.exampleItem}>
                                                <div style={styles.exampleMain}>
                                                    <div style={styles.exampleSentence}>
                                                        {renderMixedText(ex.sentence)}
                                                    </div>
                                                    <div style={styles.exampleTranslation}>{ex.translation}</div>
                                                </div>
                                                <button 
                                                    className={`play-button ${activeAudio?.type === `example_${ex.id}` ? 'playing' : ''}`}
                                                    style={styles.playButtonSmall} 
                                                    onClick={() => handlePlayButtonClick(ex.narrationScript || ex.sentence, `example_${ex.id}`, 'zh-CN-YunxiNeural', 0.85)}
                                                >
                                                     {isLoadingAudio && activeAudio?.type === `example_${ex.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `example_${ex.id}` ? <FaStop/> : <FaVolumeUp/>) }
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ height: '120px' }}></div>
                            </div>
                        </div>

                        {/* 底部导航栏 */}
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

// ✅✅✅ 修正样式：使用 relative 和 100% 填充父容器，不再 fixed
const styles = {
    container: { 
        position: 'relative', 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden', 
        background: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
    },
    page: { 
        position: 'absolute', 
        inset: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        background: 'white', 
        willChange: 'transform, opacity' 
    },
    scrollContainer: { 
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden', 
        WebkitOverflowScrolling: 'touch', 
        padding: '0 16px' 
    },
    contentWrapper: { 
        maxWidth: '800px', 
        margin: '0 auto', 
        paddingTop: '20px', 
        minHeight: '100%' 
    },
    
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
    
    playButton: { 
        background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: 'none', borderRadius: '50%', 
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
    },
    playButtonSmall: { 
        background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '50%', 
        width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
    },
    
    textBlock: { background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', lineHeight: 1.7, color: '#475569' },
    richTextContainer: { whiteSpace: 'normal' },

    examplesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    exampleItem: { background: '#f8fafc', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #e2e8f0' },
    exampleMain: { flex: 1 },
    exampleSentence: { fontSize: '1.1rem', fontWeight: 500, marginBottom: '4px', lineHeight: 1.5 },
    exampleTranslation: { fontSize: '0.9rem', color: '#64748b' },
    
    textChinese: { color: '#1e293b' }, 
    textBurmese: { color: '#059669' }, 

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '90px',
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
        borderTop: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px',
        paddingBottom: '20px', // 适配手机底部安全区
        zIndex: 50
    },
    navButton: {
        border: 'none', borderRadius: '30px', padding: '12px 24px', fontSize: '1rem', fontWeight: '600',
        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.3s'
    }
};

const styleTag = document.getElementById('grammar-player-styles') || document.createElement('style');
styleTag.id = 'grammar-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    
    .play-button:active { transform: scale(0.9); }
    .playing { 
      animation: pulse-ring 2s infinite; 
      background-color: rgba(37, 99, 235, 0.2) !important; 
      color: #2563eb !important; 
      border-color: #2563eb !important;
    }
    @keyframes pulse-ring { 
      0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5); } 
      70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 
      100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } 
    }
    
    /* 富文本样式 */
    .rich-text-content h3 { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 1.5em 0 0.8em 0; padding-bottom: 0.3em; border-bottom: 1px solid #e2e8f0; }
    .rich-text-content p { margin: 0.8em 0; color: #475569; }
    .rich-text-content strong, .rich-text-content b { color: #0d46ba; font-weight: 600; }
    .rich-text-content ul, .rich-text-content ol { margin: 0.8em 0; padding-left: 1.8em; }
    .rich-text-content li { margin: 0.5em 0; color: #475569; }
`;
if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);

export default GrammarPointPlayer;
