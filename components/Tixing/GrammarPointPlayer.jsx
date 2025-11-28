// components/Tixing/GrammarPointPlayer.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl, Howler } from 'howler';
import { 
    FaVolumeUp, FaStopCircle, FaSpinner, FaChevronUp, 
    FaFont, FaLightbulb, FaLink, FaPlay, FaPause, FaStepForward 
} from 'react-icons/fa';

// --- 辅助函数：生成拼音 HTML ---
const generateRubyHTML = (text) => {
    if (!text) return '';
    return text.replace(/[\u4e00-\u9fa5]/g, char => `<ruby>${char}<rt>${pinyinConverter(char)}</rt></ruby>`);
};

// --- 辅助函数：生成TTS URL ---
const getTTSUrl = (text, voice) => {
    return `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
};

// --- 辅助函数：解析混合文本 ---
const parseTextForAudio = (text) => {
    if (!text) return [];
    const matchedParts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
    return matchedParts.map(part => {
        const isChinese = part.startsWith('{{') && part.endsWith('}}');
        return { 
            text: isChinese ? part.slice(2, -2) : part, 
            isChinese 
        };
    }).filter(p => p.text.trim() !== '');
};

// --- 主组件 ---
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    const [isMounted, setIsMounted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fontSizeLevel, setFontSizeLevel] = useState(1);
    const [isAtBottom, setIsAtBottom] = useState(false);
    
    // --- Audio Player State ---
    const [activeAudioId, setActiveAudioId] = useState(null); // 'narration_ID' or 'example_ID'
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [seekProgress, setSeekProgress] = useState(0); // 0-100 for current clip
    const [currentDuration, setCurrentDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    // Refs
    const lastDirection = useRef(0);
    const audioQueueRef = useRef([]); // 存放当前播放队列的 Howl 对象
    const activeHowlRef = useRef(null); // 当前正在播放的那一个 Howl 实例
    const audioCache = useRef({}); // 缓存已加载的 Howl 对象
    const playbackIdRef = useRef(0);
    const rafRef = useRef(null); // requestAnimationFrame for progress bar
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        setIsMounted(true);
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
            stopPlayback();
            cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // 切换页面时重置
    useEffect(() => {
        setIsAtBottom(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight <= clientHeight + 20) setIsAtBottom(true);
        }
        // 预加载后两页
        preloadNextPages(currentIndex);
    }, [currentIndex, grammarPoints]);

    // --- 预加载逻辑 ---
    const preloadNextPages = (idx) => {
        const pagesToLoad = [grammarPoints[idx + 1], grammarPoints[idx + 2]].filter(Boolean);
        
        pagesToLoad.forEach(gp => {
            // 预加载解说
            if (gp.narrationScript) {
                const parts = parseTextForAudio(gp.narrationScript);
                parts.forEach(part => {
                    const voice = part.isChinese ? (gp.chineseVoice || 'zh-CN-XiaomengNeural') : (gp.myanmarVoice || 'my-MM-NilarNeural');
                    const url = getTTSUrl(part.text, voice);
                    if (!audioCache.current[url]) {
                        const sound = new Howl({ src: [url], html5: true, preload: true });
                        audioCache.current[url] = sound;
                    }
                });
            }
        });
    };

    // --- 音频控制核心 ---
    const stopPlayback = useCallback(() => {
        playbackIdRef.current += 1;
        audioQueueRef.current.forEach(sound => sound.stop());
        audioQueueRef.current = [];
        activeHowlRef.current = null;
        setActiveAudioId(null);
        setIsPlaying(false);
        setIsLoadingAudio(false);
        setSeekProgress(0);
        setCurrentTime(0);
        cancelAnimationFrame(rafRef.current);
    }, []);

    const updateProgress = () => {
        if (activeHowlRef.current && activeHowlRef.current.playing()) {
            const seek = activeHowlRef.current.seek();
            const duration = activeHowlRef.current.duration();
            setCurrentTime(seek);
            setCurrentDuration(duration);
            setSeekProgress((seek / duration) * 100);
            rafRef.current = requestAnimationFrame(updateProgress);
        }
    };

    const playMixedAudio = useCallback((text, type) => {
        // 如果点击的是当前正在播放的，则执行 暂停/播放 切换
        if (activeAudioId === type) {
            if (isPlaying) {
                // 暂停
                if (activeHowlRef.current) activeHowlRef.current.pause();
                setIsPlaying(false);
                cancelAnimationFrame(rafRef.current);
            } else {
                // 继续
                if (activeHowlRef.current) {
                    activeHowlRef.current.play();
                    setIsPlaying(true);
                    rafRef.current = requestAnimationFrame(updateProgress);
                } else {
                    // 如果因为某种原因丢失了引用，重新开始
                    stopPlayback();
                    playMixedAudio(text, type);
                }
            }
            return;
        }

        const currentPlaybackId = playbackIdRef.current + 1;
        playbackIdRef.current = currentPlaybackId;
        stopPlayback(); 

        if (!text) return;
        
        const parts = parseTextForAudio(text);
        if (parts.length === 0) return;
        
        const currentGp = grammarPoints[currentIndex];
        const chineseVoice = currentGp.chineseVoice || 'zh-CN-XiaomengNeural';
        const myanmarVoice = currentGp.myanmarVoice || 'my-MM-NilarNeural';

        setActiveAudioId(type);
        setIsLoadingAudio(true);

        let sounds = [];
        let loadedCount = 0;

        const startQueuePlayback = () => {
            if (playbackIdRef.current !== currentPlaybackId) return;
            setIsLoadingAudio(false);
            setIsPlaying(true);
            audioQueueRef.current = sounds;
            
            let currentSoundIndex = 0;

            const playNext = () => {
                if (playbackIdRef.current !== currentPlaybackId || currentSoundIndex >= sounds.length) {
                    if (playbackIdRef.current === currentPlaybackId) stopPlayback();
                    return;
                }
                
                const sound = sounds[currentSoundIndex];
                activeHowlRef.current = sound;
                
                // 应用当前的倍速
                sound.rate(playbackRate);

                sound.off('end'); // 清除旧的监听器防止叠加
                sound.once('end', () => {
                    currentSoundIndex++;
                    playNext();
                });
                
                sound.play();
                rafRef.current = requestAnimationFrame(updateProgress);
            };

            playNext();
        };
        
        parts.forEach((part, index) => {
            const voice = part.isChinese ? chineseVoice : myanmarVoice;
            const url = getTTSUrl(part.text, voice);
            
            const checkLoad = () => {
                loadedCount++;
                if (loadedCount === parts.length) startQueuePlayback();
            };

            if (audioCache.current[url] && audioCache.current[url].state() === 'loaded') {
                sounds[index] = audioCache.current[url];
                checkLoad();
            } else {
                const sound = new Howl({
                    src: [url],
                    html5: true,
                    onload: () => { 
                        audioCache.current[url] = sound; 
                        checkLoad(); 
                    },
                    onloaderror: () => { 
                        console.error('音频加载失败'); 
                        checkLoad(); 
                    }
                });
                sounds[index] = sound;
            }
        });
    }, [grammarPoints, currentIndex, stopPlayback, activeAudioId, isPlaying, playbackRate]);

    // 改变倍速
    const handleRateChange = (rate) => {
        setPlaybackRate(rate);
        if (activeHowlRef.current) {
            activeHowlRef.current.rate(rate);
        }
        // 同时更新队列中所有音频的倍速，以防切到下一句时失效
        audioQueueRef.current.forEach(s => s.rate(rate));
    };

    // 拖动进度条
    const handleSeek = (e) => {
        const percent = parseFloat(e.target.value);
        if (activeHowlRef.current) {
            const duration = activeHowlRef.current.duration();
            activeHowlRef.current.seek(duration * (percent / 100));
            setSeekProgress(percent);
        }
    };

    // 自动播放首句
    useEffect(() => {
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playMixedAudio(gp.narrationScript, `narration_${gp.id}`);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [currentIndex, grammarPoints, playMixedAudio]);


    // --- 导航与交互逻辑 ---
    const navigate = useCallback((direction) => {
        lastDirection.current = direction;
        stopPlayback();
        setCurrentIndex(prev => {
            const newIndex = prev + direction;
            if (newIndex >= 0 && newIndex < grammarPoints.length) return newIndex;
            if (newIndex >= grammarPoints.length) onComplete();
            return prev;
        });
    }, [grammarPoints.length, onComplete, stopPlayback]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isBottom = scrollHeight - scrollTop - clientHeight < 20;
        setIsAtBottom(isBottom);
    };

    const swipeHandlers = useSwipeable({
        onSwipedUp: () => {
            const el = scrollContainerRef.current;
            if (!el) return;
            const isScrollable = el.scrollHeight > el.clientHeight;
            if (!isScrollable || isAtBottom) {
                navigate(1);
            }
        },
        onSwipedDown: () => {
             const el = scrollContainerRef.current;
             if (el && el.scrollTop <= 0) navigate(-1);
        },
        preventDefaultTouchmoveEvent: false,
        trackMouse: true,
        delta: 40
    });

    const transitions = useTransition(currentIndex, {
        key: currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
        config: { mass: 1, tension: 280, friction: 30 },
    });

    const renderMixedText = (text, pattern = "") => {
        const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        return parts.map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            const isPunctuation = /^[,\.!?\s]+$/.test(content);
            let baseStyle = isChinese ? styles.textChinese : styles.textBurmese;
            if (isPunctuation) baseStyle = { color: '#9ca3af' }; 
            return (
                <span key={pIndex} style={{...baseStyle, fontSize: `${fontSizeLevel}rem`}}>
                    {isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} /> : content}
                </span>
            );
        });
    };

    if (!isMounted || !grammarPoints || grammarPoints.length === 0) return null;

    return createPortal(
        <div style={styles.fullScreen} {...swipeHandlers}>
            {/* 顶部指示器 (无关闭按钮) */}
            <div style={styles.topBar}>
                <div style={styles.progressBar}>
                    <div style={{...styles.progressFill, width: `${((currentIndex + 1) / grammarPoints.length) * 100}%`}} />
                </div>
                <div style={styles.topControls}>
                    <span style={styles.pageIndicator}>{currentIndex + 1} / {grammarPoints.length}</span>
                    <button style={styles.iconBtn} onClick={() => setFontSizeLevel(prev => prev >= 1.4 ? 1 : prev + 0.2)}>
                        <FaFont size={14} />
                    </button>
                </div>
            </div>

            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;
                const bgGradient = gp.background?.imageUrl 
                    ? `linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${gp.background.imageUrl})`
                    : `linear-gradient(135deg, ${gp.background?.gradientStart || '#1f2937'} 0%, ${gp.background?.gradientEnd || '#111827'} 100%)`;

                return (
                    <animated.div style={{ ...styles.page, background: bgGradient, ...style }}>
                        <div ref={scrollContainerRef} style={styles.scrollContainer} onScroll={handleScroll}>
                            <div style={styles.contentWrapper}>
                                
                                {/* 1. 标题卡片 (紧凑型) */}
                                <div style={styles.cardGlass}>
                                    <div style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                    {gp.pattern && <div style={styles.pattern}>{gp.pattern}</div>}
                                </div>
                                
                                {/* 2. 语法解释 (带高级播放器) */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <div style={styles.headerTitle}>
                                            <FaLightbulb color="#fcd34d" />
                                            <span style={styles.sectionLabel}>语法解释</span>
                                        </div>
                                    </div>
                                    
                                    <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} 
                                         dangerouslySetInnerHTML={{ __html: gp.visibleExplanation?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} 
                                    />
                                    
                                    {/* 音乐播放器控件区域 */}
                                    <div style={styles.playerControlBox}>
                                        <div style={styles.sliderRow}>
                                            <span style={styles.timeText}>{formatTime(currentTime)}</span>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={activeAudioId === `narration_${gp.id}` ? seekProgress : 0} 
                                                onChange={handleSeek}
                                                style={styles.slider}
                                                disabled={activeAudioId !== `narration_${gp.id}`}
                                            />
                                            <span style={styles.timeText}>{formatTime(currentDuration)}</span>
                                        </div>
                                        <div style={styles.controlRow}>
                                            <button 
                                                style={styles.rateBtn} 
                                                onClick={() => {
                                                    const rates = [0.5, 0.75, 1.0, 1.25, 1.5];
                                                    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
                                                    handleRateChange(rates[nextIdx]);
                                                }}
                                            >
                                                {playbackRate}x
                                            </button>

                                            <button 
                                                style={styles.mainPlayBtn} 
                                                onClick={() => playMixedAudio(gp.narrationScript, `narration_${gp.id}`)}
                                            >
                                                {isLoadingAudio && activeAudioId === `narration_${gp.id}` ? 
                                                    <FaSpinner className="spin" size={20} /> : 
                                                    (activeAudioId === `narration_${gp.id}` && isPlaying ? <FaPause size={20} /> : <FaPlay size={20} style={{marginLeft: '2px'}}/>)
                                                }
                                            </button>

                                            <div style={{width: '32px'}}></div> {/* 占位平衡布局 */}
                                        </div>
                                    </div>
                                </div>

                                {/* 3. 补充模块 */}
                                {gp.collocations && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <div style={styles.headerTitle}>
                                                <FaLink color="#60a5fa" />
                                                <span style={styles.sectionLabel}>常见搭配</span>
                                            </div>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} dangerouslySetInnerHTML={{ __html: gp.collocations.replace(/\n/g, '<br/>') }} />
                                    </div>
                                )}

                                {/* 4. 例句示范 (右侧按钮布局) */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionLabel}>例句示范</span>
                                    </div>
                                    <div style={styles.examplesList}>
                                        {gp.examples.map((ex, index) => (
                                            <div key={ex.id} style={styles.exampleItem}>
                                                <div style={styles.exampleRow}>
                                                    {/* 左侧：文字内容 */}
                                                    <div style={styles.exampleContent}>
                                                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                                                            <span style={styles.exampleNumber}>{index + 1}</span>
                                                            <div style={styles.sentenceRow}>{renderMixedText(ex.sentence, gp.pattern)}</div>
                                                        </div>
                                                        <div style={{...styles.translation, fontSize: `${0.8 * fontSizeLevel}rem`, paddingLeft: '26px'}}>
                                                            {ex.translation}
                                                        </div>
                                                    </div>

                                                    {/* 右侧：播放按钮 */}
                                                    <PlayButton 
                                                        isActive={activeAudioId === `example_${ex.id}`}
                                                        isPlaying={isPlaying}
                                                        isLoading={isLoadingAudio && activeAudioId === `example_${ex.id}`}
                                                        onClick={() => playMixedAudio(ex.narrationScript || ex.sentence, `example_${ex.id}`)}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{height: '100px'}}></div>
                            </div>
                        </div>

                        <div style={{...styles.footer, opacity: isAtBottom ? 1 : 0}}>
                            <div className="bounce-icon"><FaChevronUp size={24} color="#4ade80" /></div>
                            <span style={{textShadow: '0 1px 2px rgba(0,0,0,0.8)'}}>上滑进入下一课</span>
                        </div>
                    </animated.div>
                );
            })}
        </div>,
        document.body
    );
};

// --- 小组件 ---
const PlayButton = ({ isActive, isPlaying, isLoading, onClick }) => (
    <button style={styles.playButtonSide} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {isLoading ? <FaSpinner className="spin" /> : (isActive && isPlaying ? <FaPause size={12}/> : <FaVolumeUp size={14}/>)}
    </button>
);

const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

// --- 样式定义 ---
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#111827', color: '#fff', touchAction: 'none' },
    
    // Top Bar
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: 'env(safe-area-inset-top) 16px 10px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)' },
    progressBar: { height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginBottom: '8px' },
    progressFill: { height: '100%', background: '#4ade80', borderRadius: '2px', transition: 'width 0.3s' },
    topControls: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px' },
    pageIndicator: { fontSize: '0.8rem', fontFamily: 'monospace', opacity: 0.6 },
    iconBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer' },

    // Layout
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
    scrollContainer: { 
        flex: 1, overflowY: 'auto', overflowX: 'hidden', 
        padding: '60px 16px 40px', 
        scrollBehavior: 'smooth', 
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'none' 
    },
    contentWrapper: { maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }, // 间距更紧密

    // Cards (Light Gray style)
    cardGlass: { background: 'rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '12px', textAlign: 'center' },
    grammarPointTitle: { fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '4px', lineHeight: 1.2 }, // 字体缩小
    pattern: { color: '#67e8f9', fontFamily: 'monospace', fontSize: '0.9rem', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' },

    // Sections
    sectionContainer: { background: 'rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '16px' },
    sectionHeader: { display: 'flex', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' },
    headerTitle: { display: 'flex', alignItems: 'center', gap: '6px' },
    sectionLabel: { fontSize: '0.85rem', fontWeight: 'bold', color: '#fcd34d' },
    explanationText: { lineHeight: 1.5, color: '#e5e7eb', textAlign: 'justify' },

    // Player Control Box
    playerControlBox: { marginTop: '15px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' },
    sliderRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
    slider: { flex: 1, height: '4px', accentColor: '#4ade80', cursor: 'pointer' },
    timeText: { fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'monospace', width: '30px', textAlign: 'center' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' },
    mainPlayBtn: { width: '40px', height: '40px', borderRadius: '50%', background: '#4ade80', border: 'none', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' },
    rateBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '4px', fontSize: '0.75rem', padding: '2px 6px', width: '40px' },

    // Example List
    examplesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    exampleItem: { borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' },
    exampleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
    exampleContent: { flex: 1 },
    exampleNumber: { background: 'rgba(255,255,255,0.15)', minWidth: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', color: '#ddd' },
    sentenceRow: { lineHeight: 1.4, wordBreak: 'break-word' },
    translation: { color: '#9ca3af', fontStyle: 'italic', marginTop: '2px', lineHeight: 1.3 },
    
    // Side Play Button
    playButtonSide: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#4ade80', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

    textChinese: { color: '#fff', marginRight: '4px' },
    textBurmese: { color: '#5eead4' },
    
    footer: { position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#fff', pointerEvents: 'none', transition: 'all 0.3s' },
};

// --- Styles Injection ---
const styleTag = document.getElementById('gp-player-styles') || document.createElement('style');
styleTag.id = 'gp-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .bounce-icon { animation: bounce 1.5s infinite; }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    input[type=range] { -webkit-appearance: none; background: transparent; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #4ade80; margin-top: -4px; }
    input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; }
`;
if (!document.getElementById('gp-player-styles')) document.head.appendChild(styleTag);

GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
