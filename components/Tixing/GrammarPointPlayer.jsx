// components/Tixing/GrammarPointPlayer.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl } from 'howler';
import { FaVolumeUp, FaStop, FaSpinner, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

// --- 辅助函数：自动生成拼音 HTML ---
const generateRubyHTML = (text) => {
  if (!text) return '';
  // [FIXED] 修正了错误的正则表达式
  return text.replace(/[\u4e00-\u9fa5]+/g, word => {
      const pinyin = pinyinConverter(word);
      return `<ruby>${word}<rt>${pinyin}</rt></ruby>`;
  });
};

// --- 音频缓存与预加载模块 ---
const audioCache = {
    cache: new Map(),
    async get(url) {
        if (this.cache.has(url)) return this.cache.get(url);
        try {
            const cachedData = sessionStorage.getItem(url);
            if (cachedData) {
                this.cache.set(url, cachedData);
                return cachedData;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error(`音频获取失败: ${response.statusText}`);
            const blob = await response.blob();
            const reader = new FileReader();
            return new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64data = reader.result;
                    try {
                        sessionStorage.setItem(url, base64data);
                    } catch (e) {
                        console.warn("SessionStorage 缓存失败:", e);
                    }
                    this.cache.set(url, base64data);
                    resolve(base64data);
                };
                reader.onerror = reject;
                reader.readDataURL(blob);
            });
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
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
        document.body.style.overscrollBehavior = 'none';
        return () => { document.body.style.overscrollBehavior = 'auto'; };
    }, []);

    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) return null;

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    const [activeAudio, setActiveAudio] = useState(null); 
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const currentSoundRef = useRef(null); 
    const contentRef = useRef(null);
    const [canGoNext, setCanGoNext] = useState(false);

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
        let cleanText = text.replace(/<[^>]+>/g, '').replace(/\{\{| \}\}|\}\}/g, '').replace(/\n/g, '... ');
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanText)}&v=${voice}`;
        
        try {
            const audioSrc = await audioCache.get(url);
            const sound = new Howl({
                src: [audioSrc], html5: true, format: ['mp3'], rate: rate,
                onload: () => setIsLoadingAudio(false),
                onend: () => { setActiveAudio(null); currentSoundRef.current = null; },
                onloaderror: (id, err) => { console.error('音频加载错误:', err); setIsLoadingAudio(false); setActiveAudio(null); },
                onplayerror: (id, err) => {
                    console.error('音频播放错误:', err);
                    const fallbackSound = new Howl({ src: [url], html5: true, rate: rate, onload: () => setIsLoadingAudio(false), onend: () => setActiveAudio(null) });
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
    
    useEffect(() => {
        stopPlayback();
        if (contentRef.current) contentRef.current.scrollTop = 0;
        setCanGoNext(false); 

        const autoPlayTimer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playSingleAudio(gp.narrationScript, `narration_${gp.id}`, 'zh-CN-XiaoxiaoMultilingualNeural', 0.7);
            }
            if (contentRef.current) {
                const { scrollHeight, clientHeight } = contentRef.current;
                if (scrollHeight <= clientHeight + 50) setCanGoNext(true);
            }
        }, 600);
        
        const preloadNextItems = (index, count) => {
            for (let i = 1; i <= count; i++) {
                const nextIndex = index + i;
                if (nextIndex < grammarPoints.length) {
                    const nextGp = grammarPoints[nextIndex];
                    if (nextGp.narrationScript) {
                        const cleanText = nextGp.narrationScript.replace(/<[^>]+>/g, '').replace(/\n/g, '... ');
                        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanText)}&v=zh-CN-XiaoxiaoMultilingualNeural`;
                        audioCache.preload(url);
                    }
                }
            }
        };
        preloadNextItems(currentIndex, 3);
        
        return () => { clearTimeout(autoPlayTimer); stopPlayback(); };
    }, [currentIndex, grammarPoints, playSingleAudio, stopPlayback]);
    
    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const isBottom = scrollTop + clientHeight >= scrollHeight - 30;
        if (isBottom && !canGoNext) setCanGoNext(true);
    };

    const handleNext = () => {
        if (!canGoNext) return;
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
    
    const renderMainContent = (htmlContent) => {
        if (!htmlContent) return null;
        let processedHtml = htmlContent.replace(/\{\{(.*?)\}\}/g, (match, chineseWord) => {
            return generateRubyHTML(chineseWord);
        });
        return <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: processedHtml }} />;
    };

    const content = (
        <div style={styles.fullScreen}>
            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;

                return (
                    <animated.div style={{ ...styles.page, ...style }}>
                        <div style={styles.scrollContainer} ref={contentRef} onScroll={handleScroll}>
                            <div style={styles.contentWrapper}>
                                <div style={styles.header}>
                                    <h2 style={styles.grammarPointTitle}>{gp.grammarPoint}</h2>
                                </div>
                                
                                {gp.pattern && (
                                    <div style={styles.patternBox}>
                                        <div style={styles.boxLabel}>模板1</div>
                                        <div style={styles.patternContent} dangerouslySetInnerHTML={{ __html: gp.pattern.replace(/\{\{(.*?)\}\}/g, '$1') }}/>
                                        {gp.patternDetail && <div style={styles.patternDetail}>{gp.patternDetail}</div>}
                                    </div>
                                )}
                                
                                <div style={styles.mainContentContainer}>
                                    {renderMainContent(gp.mainContent)}
                                </div>

                                <div style={{ height: '100px' }}></div>
                            </div>
                        </div>

                        <div style={styles.bottomBar}>
                            <button 
                                style={{ ...styles.navButton, visibility: i === 0 ? 'hidden' : 'visible', background: '#f1f5f9', color: '#64748b' }}
                                onClick={handlePrev}
                            ><FaChevronLeft /> 上一条</button>
                            
                            <div style={styles.mainActions}>
                                <button
                                    aria-label="朗读全文"
                                    className={`play-button global-play-button ${activeAudio?.type === `narration_${gp.id}` ? 'playing' : ''}`} 
                                    style={styles.globalPlayButton}
                                    onClick={() => handlePlayButtonClick(gp.narrationScript, `narration_${gp.id}`, 'zh-CN-XiaoxiaoMultilingualNeural', 0.7)}
                                >
                                    {isLoadingAudio && activeAudio?.type === `narration_${gp.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `narration_${gp.id}` ? <FaStop/> : <FaVolumeUp/>) }
                                </button>
                            </div>

                            <button 
                                style={{ ...styles.navButton, background: canGoNext ? '#2563eb' : '#cbd5e1', color: 'white', transform: canGoNext ? 'scale(1.05)' : 'scale(1)', boxShadow: canGoNext ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none', opacity: canGoNext ? 1 : 0.7, justifyContent: 'flex-end' }}
                                onClick={handleNext}
                                disabled={!canGoNext}
                            >{i === grammarPoints.length - 1 ? '完成学习' : '下一条'} <FaChevronRight /></button>
                        </div>
                    </animated.div>
                );
            })}
        </div>
    );

    if (isMounted) return createPortal(content, document.body);
    return null;
};

GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        grammarPoint: PropTypes.string,
        pattern: PropTypes.string,
        patternDetail: PropTypes.string,
        mainContent: PropTypes.string,
        narrationScript: PropTypes.string,
    })).isRequired,
    onComplete: PropTypes.func,
};

const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white', willChange: 'transform, opacity' },
    scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: '0 20px', paddingBottom: '100px' },
    contentWrapper: { maxWidth: '800px', margin: '0 auto', paddingTop: 'env(safe-area-inset-top, 20px)' },
    header: { textAlign: 'center', marginTop: '20px', marginBottom: '20px' },
    grammarPointTitle: { fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0, lineHeight: 1.3 },
    patternBox: { background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid #e2e8f0', textAlign: 'center' },
    boxLabel: { fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', fontWeight: '600', letterSpacing: '1px' },
    patternContent: { fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b' },
    patternDetail: { fontSize: '1rem', color: '#475569', marginTop: '8px' },
    mainContentContainer: { fontSize: '1rem', lineHeight: 1.8, color: '#334155' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', paddingBottom: 'env(safe-area-inset-bottom, 10px)' },
    navButton: { flex: 1, border: 'none', borderRadius: '30px', padding: '10px 16px', fontSize: '0.95rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' },
    mainActions: { flexShrink: 0 },
    globalPlayButton: { background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', fontSize: '18px' }
};

const styleTag = document.getElementById('grammar-player-styles') || document.createElement('style');
styleTag.id = 'grammar-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .play-button:active { transform: scale(0.9); }
    .global-play-button.playing { animation: pulse-ring 2s infinite; background-color: rgba(37, 99, 235, 0.2) !important; color: #2563eb !important; border-color: #2563eb !important; }
    @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
    
    /* 富文本样式 */
    .rich-text-content h3 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 2em 0 1em 0; padding-bottom: 0.4em; border-bottom: 1px solid #e2e8f0; }
    .rich-text-content h4 { font-size: 1rem; font-weight: 600; color: #334155; margin: 1.5em 0 0.8em 0; }
    .rich-text-content p { margin: 0.5em 0; color: #475569; }
    .rich-text-content .example-group { margin-bottom: 1.5em; }
    .rich-text-content .example-chinese { font-size: 1.1rem; color: #1e293b; margin-bottom: 0.25em !important; }
    .rich-text-content .example-myanmar { font-size: 1rem; color: #059669; margin-bottom: 1em !important; }
    .rich-text-content .cultural-tip { border-left: 4px solid #10b981; padding: 0.8em 1.2em; margin: 1.5em 0; background-color: #f0fdfa; color: #047857; }
    .rich-text-content strong, .rich-text-content b { color: #1e40af; font-weight: 600; }
    .rich-text-content ruby { margin: 0 1px; }
    .rich-text-content rt { font-size: 0.7em; color: #64748b; opacity: 0.8; }
`;
if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);

export default GrammarPointPlayer;
