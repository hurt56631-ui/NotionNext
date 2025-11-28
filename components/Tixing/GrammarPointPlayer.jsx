// components/Tixing/GrammarPointPlayer.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl } from 'howler';
import { 
    FaVolumeUp, FaStopCircle, FaSpinner, FaChevronUp, 
    FaFont, FaLightbulb, FaLink, FaPlay, FaPause 
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
    const [activeAudioId, setActiveAudioId] = useState(null); 
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    
    // 修改：默认语速改为 0.8
    const [playbackRate, setPlaybackRate] = useState(0.8);
    
    const [seekProgress, setSeekProgress] = useState(0); 
    const [currentDuration, setCurrentDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    // Refs
    const lastDirection = useRef(0);
    const audioQueueRef = useRef([]); 
    const activeHowlRef = useRef(null); 
    const audioCache = useRef({}); 
    const playbackIdRef = useRef(0);
    const rafRef = useRef(null); 
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        setIsMounted(true);
        // 添加 meta 标签防止 iOS 缩放问题等
        const metaTags = [
            { name: 'apple-mobile-web-app-capable', content: 'yes' },
            { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
        ];
        metaTags.forEach(tagInfo => {
            let meta = document.createElement('meta');
            meta.name = tagInfo.name;
            meta.content = tagInfo.content;
            meta.id = `gp-player-meta-${tagInfo.name}`;
            document.head.appendChild(meta);
        });

        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
            stopPlayback();
            cancelAnimationFrame(rafRef.current);
            metaTags.forEach(tagInfo => {
                const meta = document.getElementById(`gp-player-meta-${tagInfo.name}`);
                if (meta) document.head.removeChild(meta);
            });
        };
    }, []);

    // 切换页面时重置
    useEffect(() => {
        setIsAtBottom(false);
        stopPlayback(); // 切换页面必须停止播放
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight <= clientHeight + 20) setIsAtBottom(true);
        }
        preloadNextPages(currentIndex);
        
        // 自动播放首句 (延迟稍微缩短以提高响应感)
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playMixedAudio(gp.narrationScript, `narration_${gp.id}`);
            }
        }, 600);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, grammarPoints]);

    // --- 预加载逻辑 ---
    const preloadNextPages = (idx) => {
        const pagesToLoad = [grammarPoints[idx], grammarPoints[idx + 1]].filter(Boolean);
        
        pagesToLoad.forEach(gp => {
            const textsToLoad = [gp.narrationScript, ...gp.examples.map(ex => ex.narrationScript || ex.sentence)].filter(Boolean);
            
            textsToLoad.forEach(text => {
                const parts = parseTextForAudio(text);
                parts.forEach(part => {
                    const voice = part.isChinese ? (gp.chineseVoice || 'zh-CN-XiaomengNeural') : (gp.myanmarVoice || 'my-MM-NilarNeural');
                    const url = getTTSUrl(part.text, voice);
                    if (!audioCache.current[url]) {
                        // html5: true 适合长音频，但为了低延迟 preload 设为 true
                        audioCache.current[url] = new Howl({ src: [url], html5: true, preload: true });
                    }
                });
            });
        });
    };

    // --- 音频控制核心 ---
    const stopPlayback = useCallback(() => {
        playbackIdRef.current += 1;
        audioQueueRef.current.forEach(sound => {
            if (sound) sound.stop();
        });
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

    // --- 修复后的播放逻辑 (基于第一个代码的逻辑) ---
    const playMixedAudio = useCallback((text, type) => {
        // 如果点击的是当前正在播放的 ID
        if (activeAudioId === type) {
            if (isPlaying) {
                // 暂停
                if (activeHowlRef.current) activeHowlRef.current.pause();
                setIsPlaying(false);
                cancelAnimationFrame(rafRef.current);
            } else {
                // 继续播放
                if (activeHowlRef.current) {
                    activeHowlRef.current.play();
                    setIsPlaying(true);
                    rafRef.current = requestAnimationFrame(updateProgress);
                } else {
                    // 异常状态，重新开始
                    stopPlayback();
                    playMixedAudio(text, type);
                }
            }
            return;
        }

        // 开始新的播放
        const currentPlaybackId = playbackIdRef.current + 1;
        playbackIdRef.current = currentPlaybackId;
        
        // 停止之前的
        audioQueueRef.current.forEach(s => s.stop());
        audioQueueRef.current = [];
        cancelAnimationFrame(rafRef.current);

        if (!text) {
            stopPlayback();
            return;
        }
        
        const parts = parseTextForAudio(text);
        if (parts.length === 0) {
            stopPlayback();
            return;
        }
        
        const currentGp = grammarPoints[currentIndex];
        const chineseVoice = currentGp.chineseVoice || 'zh-CN-XiaomengNeural';
        const myanmarVoice = currentGp.myanmarVoice || 'my-MM-NilarNeural';

        setActiveAudioId(type);
        setIsLoadingAudio(true);
        setIsPlaying(false); // 加载完成后才设为 true

        let sounds = [];
        let loadedCount = 0;

        // 定义播放队列函数
        const startQueuePlayback = () => {
            if (playbackIdRef.current !== currentPlaybackId) return;
            
            setIsLoadingAudio(false);
            setIsPlaying(true);
            audioQueueRef.current = sounds;
            
            let currentSoundIndex = 0;

            const playNext = () => {
                if (playbackIdRef.current !== currentPlaybackId || currentSoundIndex >= sounds.length) {
                    if (playbackIdRef.current === currentPlaybackId) {
                        setIsPlaying(false);
                        setActiveAudioId(null);
                        cancelAnimationFrame(rafRef.current);
                    }
                    return;
                }
                
                const sound = sounds[currentSoundIndex];
                activeHowlRef.current = sound;
                
                // 设置当前语速
                sound.rate(playbackRate);

                // 清除之前的监听器，避免重复
                sound.off('end');
                sound.once('end', () => {
                    currentSoundIndex++;
                    playNext();
                });
                
                sound.play();
                rafRef.current = requestAnimationFrame(updateProgress);
            };

            playNext();
        };

        // 加载回调
        const onSoundLoad = () => {
            if (playbackIdRef.current !== currentPlaybackId) return;
            loadedCount++;
            if (loadedCount === parts.length) {
                startQueuePlayback();
            }
        };
        
        // 并行加载所有片段
        parts.forEach((part, index) => {
            const voice = part.isChinese ? chineseVoice : myanmarVoice;
            const url = getTTSUrl(part.text, voice);
            
            if (audioCache.current[url] && audioCache.current[url].state() === 'loaded') {
                sounds[index] = audioCache.current[url];
                onSoundLoad();
            } else {
                // 如果缓存中有但不一定是 loaded (比如 loading)，或者没有
                // 为了保险，这里如果是 new Howl，确保 html5: true
                const sound = new Howl({
                    src: [url],
                    html5: true, 
                    onload: () => { 
                        audioCache.current[url] = sound; 
                        onSoundLoad(); 
                    },
                    onloaderror: (_id, err) => { 
                        console.error(`Audio load error: ${url}`, err); 
                        // 即使错误也增加计数，防止转圈圈死锁，只是跳过该段
                        onSoundLoad(); 
                    }
                });
                sounds[index] = sound;
            }
        });
    }, [grammarPoints, currentIndex, stopPlayback, activeAudioId, isPlaying, playbackRate]);

    // 改变倍速
    const handleRateChange = (rate) => {
        setPlaybackRate(rate);
        // 如果正在播放，立即应用
        if (activeHowlRef.current) {
            activeHowlRef.current.rate(rate);
        }
        // 确保队列中所有音频都更新（防止下一句变回原速）
        audioQueueRef.current.forEach(s => s && s.rate(rate));
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
            // 允许内容内部滚动，只有到底部或无法滚动时才触发翻页
            const isScrollable = el.scrollHeight > el.clientHeight;
            if (!isScrollable || isAtBottom) {
                navigate(1);
            }
        },
        onSwipedDown: () => {
             const el = scrollContainerRef.current;
             if (el && el.scrollTop <= 5) navigate(-1);
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
            {/* 顶部指示器 */}
            <div style={styles.topBar}>
                <div style={styles.progressBar}>
                    <div style={{...styles.progressFill, width: `${((currentIndex + 1) / grammarPoints.length) * 100}%`}} />
                </div>
                <div style={styles.topControls}>
                    <span style={styles.pageIndicator}>{currentIndex + 1} / {grammarPoints.length}</span>
                    <button style={styles.iconBtn} onClick={() => setFontSizeLevel(prev => prev >= 1.4 ? 1 : prev + 0.1)}>
                        <FaFont size={14} />
                    </button>
                </div>
            </div>

            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;
                const bgGradient = gp.background?.imageUrl 
                    ? `linear-gradient(to bottom, rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 0.95)), url(${gp.background.imageUrl})`
                    : `linear-gradient(135deg, ${gp.background?.gradientStart || '#111827'} 0%, ${gp.background?.gradientEnd || '#1f2937'} 100%)`;

                return (
                    <animated.div style={{ ...styles.page, background: bgGradient, ...style }}>
                        <div ref={scrollContainerRef} style={styles.scrollContainer} onScroll={handleScroll}>
                            <div style={styles.contentWrapper}>
                                
                                {/* 1. 标题 (移除卡片背景) */}
                                <div style={styles.headerTitleContainer}>
                                    <div style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                    {gp.pattern && <div style={styles.pattern}>{gp.pattern}</div>}
                                </div>
                                
                                {/* 2. 语法解释 (移除卡片背景) */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <FaLightbulb color="#fcd34d" />
                                        <span style={styles.sectionLabel}>语法解释</span>
                                    </div>
                                    
                                    <div style={{...styles.explanationText, fontSize: `${0.95 * fontSizeLevel}rem`}} 
                                         dangerouslySetInnerHTML={{ __html: gp.visibleExplanation?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} 
                                    />
                                    
                                    {/* 音乐播放器控件区域 (仅保留此处的背景以突显控件) */}
                                    <div style={styles.playerControlBox}>
                                        <div style={styles.sliderRow}>
                                            <span style={styles.timeText}>{formatTime(activeAudioId === `narration_${gp.id}` ? currentTime : 0)}</span>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={activeAudioId === `narration_${gp.id}` ? seekProgress : 0} 
                                                onChange={handleSeek}
                                                style={styles.slider}
                                                disabled={activeAudioId !== `narration_${gp.id}`}
                                            />
                                            <span style={styles.timeText}>{formatTime(activeAudioId === `narration_${gp.id}` ? currentDuration : 0)}</span>
                                        </div>
                                        <div style={styles.controlRow}>
                                            <button 
                                                style={styles.rateBtn} 
                                                onClick={() => {
                                                    const rates = [0.5, 0.8, 1.0, 1.25, 1.5];
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
                                                    <FaSpinner className="spin" size={18} /> : 
                                                    (activeAudioId === `narration_${gp.id}` && isPlaying ? <FaPause size={18} /> : <FaPlay size={18} style={{marginLeft: '2px'}}/>)
                                                }
                                            </button>

                                            <div style={{width: '32px'}}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. 补充模块 */}
                                {gp.collocations && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <FaLink color="#60a5fa" />
                                            <span style={styles.sectionLabel}>常见搭配</span>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.9 * fontSizeLevel}rem`}} dangerouslySetInnerHTML={{ __html: gp.collocations.replace(/\n/g, '<br/>') }} />
                                    </div>
                                )}

                                {/* 4. 例句示范 (移除卡片背景，使用分割线) */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionLabel}>💡 例句示范</span>
                                    </div>
                                    <div style={styles.examplesList}>
                                        {gp.examples.map((ex, index) => (
                                            <div key={ex.id} style={styles.exampleItem}>
                                                <div style={styles.exampleRow}>
                                                    <div style={styles.exampleContent}>
                                                        <div style={{display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px'}}>
                                                            <span style={styles.exampleNumber}>{index + 1}.</span>
                                                            <div style={styles.sentenceRow}>{renderMixedText(ex.sentence, gp.pattern)}</div>
                                                        </div>
                                                        <div style={{...styles.translation, fontSize: `${0.85 * fontSizeLevel}rem`, paddingLeft: '24px'}}>
                                                            {ex.translation}
                                                        </div>
                                                    </div>

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
    if (!seconds || isNaN(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

// --- 样式定义 ---
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#111827', color: '#fff', touchAction: 'none' },
    
    // Top Bar
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: 'env(safe-area-inset-top) 16px 10px', background: 'linear-gradient(to bottom, rgba(17,24,39,0.9), transparent)' },
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
    contentWrapper: { maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }, // 间距调大

    // Headers (No Card Style)
    headerTitleContainer: { textAlign: 'center', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    grammarPointTitle: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px', lineHeight: 1.2, textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
    pattern: { color: '#67e8f9', fontFamily: 'monospace', fontSize: '1rem', background: 'rgba(0,0,0,0.3)', padding: '4px 12px', borderRadius: '4px', display: 'inline-block', letterSpacing: '1px' },

    // Sections (Transparent, List-like)
    sectionContainer: { background: 'transparent', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#fcd34d', fontSize: '1rem', fontWeight: 'bold' },
    sectionLabel: {  },
    explanationText: { lineHeight: 1.8, color: '#e5e7eb', textAlign: 'justify' },

    // Player Control Box (Keep background slightly for visibility)
    playerControlBox: { marginTop: '20px', background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' },
    sliderRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
    slider: { flex: 1, height: '4px', accentColor: '#4ade80', cursor: 'pointer' },
    timeText: { fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', minWidth: '35px', textAlign: 'center' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' },
    mainPlayBtn: { width: '44px', height: '44px', borderRadius: '50%', background: '#4ade80', border: 'none', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(74, 222, 128, 0.4)', cursor: 'pointer' },
    rateBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '12px', fontSize: '0.8rem', padding: '4px 10px', minWidth: '40px', cursor: 'pointer' },

    // Example List
    examplesList: { display: 'flex', flexDirection: 'column', gap: '24px' },
    exampleItem: {  },
    exampleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' },
    exampleContent: { flex: 1 },
    exampleNumber: { color: '#9ca3af', fontSize: '0.9rem', minWidth: '18px', fontWeight: 500 },
    sentenceRow: { lineHeight: 1.6, wordBreak: 'break-word', color: '#fff' },
    translation: { color: '#9ca3af', fontStyle: 'italic', marginTop: '6px', lineHeight: 1.4 },
    
    // Side Play Button
    playButtonSide: { background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#4ade80', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' },

    textChinese: { color: '#fff', marginRight: '4px' },
    textBurmese: { color: '#5eead4' },
    
    footer: { position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#fff', pointerEvents: 'none', transition: 'all 0.3s' },
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
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #4ade80; margin-top: -4px; border: 2px solid #1f2937; }
    input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; }
`;
if (!document.getElementById('gp-player-styles')) document.head.appendChild(styleTag);

GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
