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
    FaFont, FaLightbulb, FaLink, FaPlay, FaPause, 
    FaExclamationTriangle, FaComments, FaInfoCircle 
} from 'react-icons/fa';

// =================================================================================
// ===== 数据库与 TTS 核心逻辑 (移植自 WordCard.js) ==================================
// =================================================================================

const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 2;
const STORE_AUDIO = 'audioCache';

// 1. 打开数据库
function openDB() {
    if (typeof window === 'undefined') return Promise.reject("Server side");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('数据库打开失败');
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_AUDIO)) {
                db.createObjectStore(STORE_AUDIO);
            }
        };
    });
}

// 2. 生成缓存 Key
const generateAudioKey = (text, voice, rate) => `${text}_${voice}_${rate}`;

// 3. 写入缓存
async function cacheAudioData(key, blob) {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        const store = tx.objectStore(STORE_AUDIO);
        store.put(blob, key);
    } catch (e) {
        console.warn("缓存写入失败", e);
    }
}

// 4. 读取缓存
async function getCachedAudio(key) {
    if (typeof window === 'undefined') return null;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_AUDIO, 'readonly');
        const store = tx.objectStore(STORE_AUDIO);
        return new Promise((resolve) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

// --- 辅助函数 ---
const generateRubyHTML = (text) => {
    if (!text) return '';
    return text.replace(/[\u4e00-\u9fa5]/g, char => `<ruby>${char}<rt>${pinyinConverter(char)}</rt></ruby>`);
};

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

// =================================================================================
// ===== 主组件 =====================================================================
// =================================================================================

const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    const [isMounted, setIsMounted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fontSizeLevel, setFontSizeLevel] = useState(1);
    const [isAtBottom, setIsAtBottom] = useState(false);
    
    // --- 播放器状态 ---
    const [activeAudioId, setActiveAudioId] = useState(null); // 'narration_ID' or 'example_ID'
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [seekProgress, setSeekProgress] = useState(0); // 0-100
    const [currentDuration, setCurrentDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    // Refs
    const lastDirection = useRef(0);
    const activeHowlRef = useRef(null); // 当前播放的 Howl 实例
    const audioQueueRef = useRef([]); // 播放队列 (用于混合语言播放)
    const playbackIdRef = useRef(0);
    const rafRef = useRef(null); // 进度条动画帧
    const scrollContainerRef = useRef(null);
    const currentAudioUrlRef = useRef(null); // 记录当前 Blob URL 以便销毁

    useEffect(() => {
        setIsMounted(true);
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
            stopPlayback();
        };
    }, []);

    // 页面切换时的重置与预加载
    useEffect(() => {
        setIsAtBottom(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight <= clientHeight + 20) setIsAtBottom(true);
        }
        
        // 预加载后两页 (Preload Logic)
        const preloadNext = async () => {
            const nextIndices = [currentIndex + 1, currentIndex + 2];
            for (let idx of nextIndices) {
                if (idx < grammarPoints.length) {
                    const gp = grammarPoints[idx];
                    // 预加载解说
                    if (gp.narrationScript) {
                        await playTTS(gp.narrationScript, gp.chineseVoice, gp.myanmarVoice, 1.0, null, true);
                    }
                    // 预加载前两个例句
                    if (gp.examples && gp.examples.length > 0) {
                        for (let i = 0; i < Math.min(2, gp.examples.length); i++) {
                            const ex = gp.examples[i];
                            await playTTS(ex.sentence, gp.chineseVoice, gp.myanmarVoice, 1.0, null, true);
                        }
                    }
                }
            }
        };
        preloadNext();

    }, [currentIndex, grammarPoints]);

    // --- 核心播放控制 ---
    const stopPlayback = useCallback(() => {
        playbackIdRef.current += 1;
        
        if (activeHowlRef.current) {
            activeHowlRef.current.stop();
            activeHowlRef.current.unload();
            activeHowlRef.current = null;
        }
        
        // 停止队列中可能的后续播放
        audioQueueRef.current = [];
        
        if (currentAudioUrlRef.current) {
            URL.revokeObjectURL(currentAudioUrlRef.current);
            currentAudioUrlRef.current = null;
        }

        cancelAnimationFrame(rafRef.current);
        setActiveAudioId(null);
        setIsPlaying(false);
        setIsLoadingAudio(false);
        setSeekProgress(0);
        setCurrentTime(0);
    }, []);

    // 更新进度条循环
    const updateProgress = useCallback(() => {
        if (activeHowlRef.current && activeHowlRef.current.playing()) {
            const seek = activeHowlRef.current.seek();
            const duration = activeHowlRef.current.duration();
            
            // 如果是队列播放，进度条逻辑比较复杂，这里简化为只显示当前片段的进度
            // 或者如果是 narration，通常是一段长音频（如果合并了的话）。
            // 鉴于 TTS 是分段的，我们只对当前活动的 Howl 显示进度。
            
            setCurrentTime(seek);
            setCurrentDuration(duration);
            setSeekProgress((seek / duration) * 100);
            rafRef.current = requestAnimationFrame(updateProgress);
        }
    }, []);

    // --- 强大的 playTTS 函数 (移植并适配) ---
    // 支持混合文本 ({{中文}} 缅文) 解析播放
    const playTTS = useCallback(async (text, cnVoice, mmVoice, rate, audioId, onlyCache = false) => {
        if (!text) return;
        
        const currentPlaybackId = playbackIdRef.current + 1;
        if (!onlyCache) {
            // 如果点击同一个 ID 且正在播放，则暂停/恢复
            if (activeAudioId === audioId && activeHowlRef.current) {
                if (isPlaying) {
                    activeHowlRef.current.pause();
                    setIsPlaying(false);
                    cancelAnimationFrame(rafRef.current);
                } else {
                    activeHowlRef.current.play();
                    setIsPlaying(true);
                    rafRef.current = requestAnimationFrame(updateProgress);
                }
                return;
            }
            playbackIdRef.current = currentPlaybackId;
            stopPlayback();
            setActiveAudioId(audioId);
            setIsLoadingAudio(true);
        }

        // 解析文本段落
        const parts = parseTextForAudio(text);
        let audioBlobs = [];

        try {
            // 串行获取所有音频 Blob (为了保证顺序和简单性，虽然并行更快但容易乱)
            for (let part of parts) {
                const voice = part.isChinese ? (cnVoice || 'zh-CN-XiaoxiaoNeural') : (mmVoice || 'my-MM-NilarNeural');
                // 速率转换: WordCard 存的是 -100 到 100，这里我们用 0.5 - 1.5 倍率
                // 为了兼容缓存 key，我们将 rate 转回整数存储。比如 1.0 -> 0, 1.5 -> 50
                const cacheRate = Math.round((rate - 1) * 100); 
                const cacheKey = generateAudioKey(part.text, voice, cacheRate);

                let blob = await getCachedAudio(cacheKey);

                if (!blob) {
                    // 请求 API
                    const apiUrl = 'https://libretts.is-an.org/api/tts';
                    let response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: part.text, voice, rate: cacheRate, pitch: 0 }),
                    });

                    if (!response.ok) {
                        // 备用接口逻辑...
                        throw new Error('TTS Fetch Failed');
                    }
                    blob = await response.blob();
                    await cacheAudioData(cacheKey, blob);
                }
                audioBlobs.push(blob);
            }

            if (onlyCache) return; // 如果是预加载，到这里就结束了

            if (playbackIdRef.current !== currentPlaybackId) return;

            // 开始播放逻辑
            setIsLoadingAudio(false);
            setIsPlaying(true);
            
            let currentBlobIndex = 0;

            const playNextBlob = () => {
                if (playbackIdRef.current !== currentPlaybackId || currentBlobIndex >= audioBlobs.length) {
                    setIsPlaying(false);
                    setActiveAudioId(null);
                    setSeekProgress(0);
                    return;
                }

                const blob = audioBlobs[currentBlobIndex];
                const url = URL.createObjectURL(blob);
                
                if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
                currentAudioUrlRef.current = url;

                const sound = new Howl({
                    src: [url],
                    format: ['mp3', 'webm'],
                    html5: true,
                    rate: rate, // 应用播放倍速
                    onend: () => {
                        currentBlobIndex++;
                        playNextBlob();
                    },
                    onloaderror: (id, err) => console.error("Load Error", err),
                    onplayerror: (id, err) => {
                        sound.once('unlock', () => sound.play());
                    }
                });

                activeHowlRef.current = sound;
                sound.play();
                rafRef.current = requestAnimationFrame(updateProgress);
            };

            playNextBlob();

        } catch (error) {
            console.error("TTS Playback Error:", error);
            setIsLoadingAudio(false);
            setActiveAudioId(null);
        }
    }, [activeAudioId, isPlaying, stopPlayback, updateProgress]);

    // 改变倍速
    const handleRateChange = (newRate) => {
        setPlaybackRate(newRate);
        if (activeHowlRef.current) {
            activeHowlRef.current.rate(newRate);
        }
    };

    // 拖动进度条
    const handleSeek = (e) => {
        const percent = parseFloat(e.target.value);
        if (activeHowlRef.current) {
            const duration = activeHowlRef.current.duration();
            const seekPos = duration * (percent / 100);
            activeHowlRef.current.seek(seekPos);
            setSeekProgress(percent);
            setCurrentTime(seekPos);
        }
    };

    // 自动播放首句
    useEffect(() => {
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playTTS(gp.narrationScript, gp.chineseVoice, gp.myanmarVoice, 1.0, `narration_${gp.id}`);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [currentIndex, grammarPoints, playTTS]);


    // --- 导航与交互 ---
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
            if (!isScrollable || isAtBottom) navigate(1);
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
        const parts = parseTextForAudio(text);
        return parts.map((part, pIndex) => {
            const isPunctuation = /^[,\.!?\s]+$/.test(part.text);
            let baseStyle = part.isChinese ? styles.textChinese : styles.textBurmese;
            if (isPunctuation) baseStyle = { color: '#9ca3af' }; 
            return (
                <span key={pIndex} style={{...baseStyle, fontSize: `${fontSizeLevel}rem`}}>
                    {part.isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(part.text) }} /> : part.text}
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
                    : `linear-gradient(135deg, ${gp.background?.gradientStart || '#111827'} 0%, ${gp.background?.gradientEnd || '#000'} 100%)`;

                return (
                    <animated.div style={{ ...styles.page, background: bgGradient, ...style }}>
                        <div ref={scrollContainerRef} style={styles.scrollContainer} onScroll={handleScroll}>
                            <div style={styles.contentWrapper}>
                                
                                {/* 1. 标题卡片 (磨砂白风格) */}
                                <div style={styles.cardGlass}>
                                    <div style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                    {gp.pattern && <div style={styles.pattern}>{gp.pattern}</div>}
                                </div>
                                
                                {/* 2. 语法解释 (带音乐播放器) */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <div style={styles.headerTitle}>
                                            <FaLightbulb color="#f59e0b" />
                                            <span style={styles.sectionLabel}>语法解释</span>
                                        </div>
                                    </div>
                                    
                                    <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} 
                                         dangerouslySetInnerHTML={{ __html: gp.visibleExplanation?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} 
                                    />
                                    
                                    {/* 音乐播放器控件 */}
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
                                            <span style={styles.timeText}>{activeAudioId === `narration_${gp.id}` ? formatTime(currentDuration) : "--:--"}</span>
                                        </div>
                                        <div style={styles.controlRow}>
                                            <button 
                                                style={styles.rateBtn} 
                                                onClick={() => {
                                                    const rates = [0.5, 0.7, 1.0, 1.25, 1.5];
                                                    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
                                                    handleRateChange(rates[nextIdx]);
                                                }}
                                            >
                                                {playbackRate}x
                                            </button>

                                            <button 
                                                style={styles.mainPlayBtn} 
                                                onClick={() => playTTS(gp.narrationScript, gp.chineseVoice, gp.myanmarVoice, playbackRate, `narration_${gp.id}`)}
                                            >
                                                {isLoadingAudio && activeAudioId === `narration_${gp.id}` ? 
                                                    <FaSpinner className="spin" size={20} /> : 
                                                    (activeAudioId === `narration_${gp.id}` && isPlaying ? <FaPause size={20} /> : <FaPlay size={20} style={{marginLeft: '4px'}}/>)
                                                }
                                            </button>

                                            <div style={{width: '32px'}}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. 补充模块 (回归!) */}
                                {gp.attention && (
                                    <div style={{...styles.sectionContainer, borderLeft: '4px solid #ef4444'}}>
                                        <div style={styles.sectionHeader}>
                                            <div style={styles.headerTitle}>
                                                <FaExclamationTriangle color="#ef4444" />
                                                <span style={{...styles.sectionLabel, color: '#ef4444'}}>易错点 (Attention)</span>
                                            </div>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} 
                                             dangerouslySetInnerHTML={{ __html: gp.attention.replace(/\n/g, '<br/>') }} 
                                        />
                                    </div>
                                )}

                                {gp.usage && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <div style={styles.headerTitle}>
                                                <FaInfoCircle color="#3b82f6" />
                                                <span style={styles.sectionLabel}>用法说明 (Usage)</span>
                                            </div>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} 
                                             dangerouslySetInnerHTML={{ __html: gp.usage.replace(/\n/g, '<br/>') }} 
                                        />
                                    </div>
                                )}

                                {gp.collocations && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <div style={styles.headerTitle}>
                                                <FaLink color="#10b981" />
                                                <span style={styles.sectionLabel}>常见搭配 (Collocations)</span>
                                            </div>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`, fontFamily: 'monospace'}} 
                                             dangerouslySetInnerHTML={{ __html: gp.collocations.replace(/\n/g, '<br/>') }} 
                                        />
                                    </div>
                                )}

                                {gp.dialogue && (
                                     <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <div style={styles.headerTitle}>
                                                <FaComments color="#8b5cf6" />
                                                <span style={styles.sectionLabel}>场景对话 (Dialogue)</span>
                                            </div>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} 
                                             dangerouslySetInnerHTML={{ __html: gp.dialogue.replace(/\n/g, '<br/>') }} 
                                        />
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
                                                        <div style={{...styles.translation, fontSize: `${0.8 * fontSizeLevel}rem`, paddingLeft: '28px'}}>
                                                            {ex.translation}
                                                        </div>
                                                    </div>

                                                    {/* 右侧：播放按钮 */}
                                                    <PlayButton 
                                                        isActive={activeAudioId === `example_${ex.id}`}
                                                        isPlaying={isPlaying}
                                                        isLoading={isLoadingAudio && activeAudioId === `example_${ex.id}`}
                                                        onClick={() => playTTS(ex.sentence, gp.chineseVoice, gp.myanmarVoice, playbackRate, `example_${ex.id}`)}
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
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

// --- 样式定义 ---
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#111827', color: '#1f2937', touchAction: 'none' },
    
    // Top Bar
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: 'env(safe-area-inset-top) 10px 10px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', pointerEvents: 'none' },
    progressBar: { height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginBottom: '6px' },
    progressFill: { height: '100%', background: '#4ade80', borderRadius: '2px', transition: 'width 0.3s' },
    topControls: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', pointerEvents: 'auto' },
    pageIndicator: { fontSize: '0.8rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' },
    iconBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer', backdropFilter: 'blur(4px)' },

    // Layout
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
    scrollContainer: { 
        flex: 1, overflowY: 'auto', overflowX: 'hidden', 
        padding: '50px 16px 40px', 
        scrollBehavior: 'smooth', 
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'none' // 禁止下拉刷新
    },
    contentWrapper: { maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' },

    // Cards (White/Light Gray Frosted Glass)
    cardGlass: { background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', padding: '16px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.2)' },
    grammarPointTitle: { fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '4px', lineHeight: 1.2, color: '#111827' },
    pattern: { color: '#0ea5e9', fontFamily: 'monospace', fontSize: '0.9rem', background: 'rgba(14, 165, 233, 0.1)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' },

    // Sections (White/Light Gray)
    sectionContainer: { background: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    sectionHeader: { display: 'flex', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '6px' },
    headerTitle: { display: 'flex', alignItems: 'center', gap: '6px' },
    sectionLabel: { fontSize: '0.85rem', fontWeight: 'bold', color: '#4b5563' }, // Darker gray for headers
    explanationText: { lineHeight: 1.5, color: '#374151', textAlign: 'justify' }, // Dark gray text

    // Player Control Box
    playerControlBox: { marginTop: '12px', background: '#f3f4f6', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' },
    sliderRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
    slider: { flex: 1, height: '4px', accentColor: '#4ade80', cursor: 'pointer' },
    timeText: { fontSize: '0.7rem', color: '#6b7280', fontFamily: 'monospace', width: '30px', textAlign: 'center' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' },
    mainPlayBtn: { width: '40px', height: '40px', borderRadius: '50%', background: '#4ade80', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', cursor: 'pointer' },
    rateBtn: { background: 'transparent', border: '1px solid #d1d5db', color: '#4b5563', borderRadius: '4px', fontSize: '0.75rem', padding: '2px 6px', width: '40px', cursor: 'pointer' },

    // Example List
    examplesList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    exampleItem: { borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' },
    exampleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' },
    exampleContent: { flex: 1 },
    exampleNumber: { background: '#e5e7eb', minWidth: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280' },
    sentenceRow: { lineHeight: 1.4, wordBreak: 'break-word', color: '#1f2937' },
    translation: { color: '#6b7280', fontStyle: 'italic', marginTop: '2px', lineHeight: 1.3 },
    
    // Side Play Button
    playButtonSide: { background: '#e0f2fe', border: 'none', color: '#0ea5e9', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' },

    textChinese: { color: '#111827', marginRight: '4px', fontWeight: 500 },
    textBurmese: { color: '#059669' }, // Greenish for Burmese
    
    footer: { position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', pointerEvents: 'none', transition: 'all 0.3s' },
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
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #4ade80; margin-top: -4px; cursor: pointer; }
    input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: #d1d5db; border-radius: 2px; }
`;
if (!document.getElementById('gp-player-styles')) document.head.appendChild(styleTag);

GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
