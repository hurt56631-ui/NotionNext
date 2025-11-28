// components/Tixing/GrammarPointPlayer.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { 
    FaVolumeUp, FaStopCircle, FaSpinner, FaChevronUp, 
    FaFont, FaLightbulb, FaLink, FaPlay, FaPause 
} from 'react-icons/fa';

// --- 辅助函数 ---
const generateRubyHTML = (text) => {
    if (!text) return '';
    return text.replace(/[\u4e00-\u9fa5]/g, char => `<ruby>${char}<rt>${pinyinConverter(char)}</rt></ruby>`);
};

const getTTSUrl = (text, voice) => {
    return `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
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

// --- 主组件 ---
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    const [isMounted, setIsMounted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fontSizeLevel, setFontSizeLevel] = useState(1);
    const [isAtBottom, setIsAtBottom] = useState(false);
    
    // --- 播放器状态 ---
    const [activeAudioId, setActiveAudioId] = useState(null); 
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    
    // 默认语速 0.8
    const [playbackRate, setPlaybackRate] = useState(0.8);
    
    const [seekProgress, setSeekProgress] = useState(0); 
    const [currentTime, setCurrentTime] = useState(0);
    const [currentDuration, setCurrentDuration] = useState(0);

    // Refs
    const lastDirection = useRef(0);
    const playbackIdRef = useRef(0);
    const scrollContainerRef = useRef(null);
    const rafRef = useRef(null);

    // --- Web Audio API Refs ---
    const audioContextRef = useRef(null);
    const activeSourcesRef = useRef([]); // 存储当前正在播放的所有音频源节点
    const startTimeRef = useRef(0); // 记录开始播放的时间戳
    const pauseOffsetRef = useRef(0); // 记录暂停时的进度
    const audioBufferCache = useRef({}); // 缓存解码后的 AudioBuffer

    useEffect(() => {
        setIsMounted(true);
        // 初始化 AudioContext (需要用户交互后才能 resume，但在 useEffect 初始化是安全的)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();

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
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            metaTags.forEach(tagInfo => {
                const meta = document.getElementById(`gp-player-meta-${tagInfo.name}`);
                if (meta) document.head.removeChild(meta);
            });
        };
    }, []);

    // 切换页面清理
    useEffect(() => {
        setIsAtBottom(false);
        stopPlayback();
        pauseOffsetRef.current = 0; // 重置暂停进度
        
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight <= clientHeight + 20) setIsAtBottom(true);
        }

        // 自动播放
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playMixedAudio(gp.narrationScript, `narration_${gp.id}`);
            }
        }, 600);
        
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, grammarPoints]);

    // --- 核心播放控制 ---

    const stopPlayback = useCallback(() => {
        playbackIdRef.current += 1;
        
        // 停止所有 Web Audio 源节点
        activeSourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { /* ignore */ }
            try { source.disconnect(); } catch (e) { /* ignore */ }
        });
        activeSourcesRef.current = [];

        cancelAnimationFrame(rafRef.current);
        
        // 只有当完全停止而不是暂停时，才重置 offset
        // 注意：这里简单的 stopPlayback 会重置所有状态。
        // 如果要做暂停功能，需要更复杂的逻辑，这里为了稳定性，
        // "暂停"实现为停止，下次点击重新开始(或者点击暂停只改变UI，内部暂存offset)
        
        // 由于 Web Audio 调度一旦开始很难暂停（需要记录 pausedTime），
        // 这里的策略是：点击暂停 = 停止播放并记录时间；点击播放 = 从头播放(简单版) 或 跳转播放(复杂版)。
        // 为了简化且保证流畅，我们让暂停变成“停止”。下次点击从头放。
        // 如果需要继续播放，逻辑会非常复杂。
        
        setIsPlaying(false);
        setIsLoadingAudio(false);
        setActiveAudioId(null);
        setSeekProgress(0);
        setCurrentTime(0);
    }, []);

    // 进度条更新循环
    const updateProgress = useCallback(() => {
        if (!audioContextRef.current) return;
        
        const ctx = audioContextRef.current;
        // 计算当前播放了多久
        const elapsed = ctx.currentTime - startTimeRef.current;
        
        if (elapsed >= currentDuration) {
            // 播放结束
            setIsPlaying(false);
            setSeekProgress(100);
            setCurrentTime(currentDuration);
            setActiveAudioId(null);
        } else {
            setCurrentTime(elapsed);
            setSeekProgress((elapsed / currentDuration) * 100);
            rafRef.current = requestAnimationFrame(updateProgress);
        }
    }, [currentDuration]);

    // --- Web Audio 加载器 ---
    const loadAudioBuffer = async (url) => {
        if (audioBufferCache.current[url]) {
            return audioBufferCache.current[url];
        }
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            // decodeAudioData 也是基于 Promise 的
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            audioBufferCache.current[url] = audioBuffer;
            return audioBuffer;
        } catch (error) {
            console.error("Audio decode error:", error);
            return null;
        }
    };

    const playMixedAudio = useCallback(async (text, type) => {
        // 1. 如果点击的是正在播放的，则执行停止（模拟暂停）
        if (activeAudioId === type && isPlaying) {
            stopPlayback();
            return;
        }

        const currentPlaybackId = playbackIdRef.current + 1;
        playbackIdRef.current = currentPlaybackId;

        stopPlayback(); // 先停止之前的
        
        if (!text) return;
        const parts = parseTextForAudio(text);
        if (parts.length === 0) return;

        // UI 状态更新
        setActiveAudioId(type);
        setIsLoadingAudio(true); // 开始转圈

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const currentGp = grammarPoints[currentIndex];
        const chineseVoice = currentGp.chineseVoice || 'zh-CN-XiaomengNeural';
        const myanmarVoice = currentGp.myanmarVoice || 'my-MM-NilarNeural';

        // 2. 并行加载所有音频数据 (Promise.all)
        const loadPromises = parts.map(part => {
            const voice = part.isChinese ? chineseVoice : myanmarVoice;
            const url = getTTSUrl(part.text, voice);
            return loadAudioBuffer(url);
        });

        try {
            const buffers = await Promise.all(loadPromises);
            
            // 检查是否在加载过程中被切歌了
            if (playbackIdRef.current !== currentPlaybackId) return;

            // 过滤掉加载失败的 null
            const validBuffers = buffers.filter(b => b !== null);
            if (validBuffers.length === 0) {
                setIsLoadingAudio(false);
                setActiveAudioId(null);
                return;
            }

            // --- 3. 核心算法：计算无缝拼接的时间轴 ---
            
            // 这里的 magic number 是为了消除 TTS 甚至句子间的停顿
            // 0.1 表示让下一句提前 0.1秒 开始（重叠），吃掉静音
            const OVERLAP_TIME = 0.12; 
            
            let accumulatedTime = 0;
            let totalDuration = 0;
            const schedule = [];

            validBuffers.forEach((buffer, i) => {
                // 根据语速调整持续时间
                const duration = buffer.duration / playbackRate;
                
                schedule.push({
                    buffer: buffer,
                    startTime: accumulatedTime,
                    duration: duration
                });

                // 计算下一句的开始时间
                // 如果当前句子很短（比如只有一个字），overlap 不能超过句子长度
                const actualOverlap = Math.min(duration * 0.5, OVERLAP_TIME);
                
                // 只有当不是最后一句时，才应用 overlap 减法
                if (i < validBuffers.length - 1) {
                    accumulatedTime += (duration - actualOverlap);
                } else {
                    accumulatedTime += duration;
                }
            });
            
            totalDuration = accumulatedTime;
            setCurrentDuration(totalDuration); // 设置总时长用于进度条

            // 4. 调度播放
            const now = ctx.currentTime + 0.1; // 延迟 0.1s 启动，给浏览器喘息
            startTimeRef.current = now; // 记录起点用于进度条计算

            schedule.forEach(item => {
                const source = ctx.createBufferSource();
                source.buffer = item.buffer;
                source.playbackRate.value = playbackRate;
                source.connect(ctx.destination);
                
                // 精确时间调度
                source.start(now + item.startTime);
                
                activeSourcesRef.current.push(source);
            });

            setIsLoadingAudio(false);
            setIsPlaying(true);
            
            // 启动进度条动画
            cancelAnimationFrame(rafRef.current);
            updateProgress();

            // 设置总定时器，播放完自动清理状态
            const tempSource = activeSourcesRef.current[activeSourcesRef.current.length - 1];
            tempSource.onended = () => {
                // 这里只是一种保险，实际依靠 updateProgress 判断结束
            };

        } catch (err) {
            console.error("Playback sequence error:", err);
            setIsLoadingAudio(false);
            setActiveAudioId(null);
        }

    }, [activeAudioId, isPlaying, grammarPoints, currentIndex, playbackRate, stopPlayback, updateProgress]);


    // 改变倍速
    const handleRateChange = (rate) => {
        setPlaybackRate(rate);
        // 原生 Web Audio 改变倍速比较麻烦（需要重新调度或修改 current playbackRate），
        // 为了简单，改变倍速时重新播放当前句子
        if (activeAudioId && isPlaying) {
             // 这里稍微复杂，简单处理为：停止当前，用户需重新点击播放
             // 或者立刻重新触发播放：
             // 为了用户体验，我们不做任何操作，只更新状态，下次播放生效。
             // 如果想要即时生效，需要遍历 activeSourcesRef 修改 playbackRate.value，但这会打乱 overlap 的计算。
             // 结论：Web Audio 预计算模式下，改变倍速只能下次播放生效，或者强制重播。
             // 这里选择：不做即时打断，下次生效。
        }
    };

    // 拖动进度条 (不支持 seek，因为 Web Audio 调度是一次性的)
    // 如果非要支持，需要 stop 所有 -> 计算 offset -> 重新 schedule
    // 这里简单处理：禁用拖动，或者拖动无效
    const handleSeek = (e) => {
        // 空函数，暂不支持拖动，因为无缝拼接的计算成本较高
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
                                
                                <div style={styles.headerTitleContainer}>
                                    <div style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                    {gp.pattern && <div style={styles.pattern}>{gp.pattern}</div>}
                                </div>
                                
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <FaLightbulb color="#fcd34d" />
                                        <span style={styles.sectionLabel}>语法解释</span>
                                    </div>
                                    
                                    <div style={{...styles.explanationText, fontSize: `${0.95 * fontSizeLevel}rem`}} 
                                         dangerouslySetInnerHTML={{ __html: gp.visibleExplanation?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} 
                                    />
                                    
                                    <div style={styles.playerControlBox}>
                                        <div style={styles.sliderRow}>
                                            <span style={styles.timeText}>{formatTime(activeAudioId === `narration_${gp.id}` ? currentTime : 0)}</span>
                                            {/* 禁用拖动，因为 Web Audio Scheduling 模式不支持动态 seek */}
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={activeAudioId === `narration_${gp.id}` ? seekProgress : 0} 
                                                style={{...styles.slider, cursor: 'default'}}
                                                disabled
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
                                                    (activeAudioId === `narration_${gp.id}` && isPlaying ? <FaStopCircle size={18} /> : <FaPlay size={18} style={{marginLeft: '2px'}}/>)
                                                }
                                            </button>
                                            <div style={{width: '32px'}}></div>
                                        </div>
                                    </div>
                                </div>

                                {gp.collocations && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <FaLink color="#60a5fa" />
                                            <span style={styles.sectionLabel}>常见搭配</span>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.9 * fontSizeLevel}rem`}} dangerouslySetInnerHTML={{ __html: gp.collocations.replace(/\n/g, '<br/>') }} />
                                    </div>
                                )}

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
        {isLoading ? <FaSpinner className="spin" /> : (isActive && isPlaying ? <FaStopCircle size={14}/> : <FaVolumeUp size={14}/>)}
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
    contentWrapper: { maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },

    // Headers
    headerTitleContainer: { textAlign: 'center', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    grammarPointTitle: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px', lineHeight: 1.2, textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
    pattern: { color: '#67e8f9', fontFamily: 'monospace', fontSize: '1rem', background: 'rgba(0,0,0,0.3)', padding: '4px 12px', borderRadius: '4px', display: 'inline-block', letterSpacing: '1px' },

    // Sections
    sectionContainer: { background: 'transparent', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#fcd34d', fontSize: '1rem', fontWeight: 'bold' },
    sectionLabel: {  },
    explanationText: { lineHeight: 1.8, color: '#e5e7eb', textAlign: 'justify' },

    // Player Control Box
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
