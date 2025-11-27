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
    FaFont, FaChevronLeft, FaTimes 
} from 'react-icons/fa';

// --- 辅助函数 ---
const generateRubyHTML = (text) => {
    if (!text) return '';
    return text.replace(/[\u4e00-\u9fa5]/g, char => `<ruby>${char}<rt>${pinyinConverter(char)}</rt></ruby>`);
};

// --- 主组件 ---
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    const [isMounted, setIsMounted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fontSizeLevel, setFontSizeLevel] = useState(1); // 1: normal, 1.2: large, 1.4: extra large
    const [isAtBottom, setIsAtBottom] = useState(false); // 是否滚动到底部
    
    // Audio State
    const [activeAudio, setActiveAudio] = useState(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    
    // Refs
    const lastDirection = useRef(0);
    const audioQueueRef = useRef([]);
    const audioCache = useRef({});
    const playbackIdRef = useRef(0);
    const scrollContainerRef = useRef(null); // 用于检测滚动

    useEffect(() => {
        setIsMounted(true);
        // 锁定背景滚动
        document.body.style.overflow = 'hidden';
        
        return () => {
            document.body.style.overflow = '';
            stopPlayback();
        };
    }, []);

    // 每次切换页面重置滚动状态和音频
    useEffect(() => {
        setIsAtBottom(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [currentIndex]);

    // --- 音频逻辑 (保持原有逻辑，稍作优化) ---
    const stopPlayback = useCallback(() => {
        playbackIdRef.current += 1;
        audioQueueRef.current.forEach(sound => sound.stop());
        audioQueueRef.current = [];
        setActiveAudio(null);
        setIsLoadingAudio(false);
    }, []);

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

    const playMixedAudio = useCallback((text, type) => {
        const currentPlaybackId = playbackIdRef.current + 1;
        playbackIdRef.current = currentPlaybackId;
        stopPlayback(); // 先停止之前的

        if (!text) return;
        
        const parts = parseTextForAudio(text);
        if (parts.length === 0) return;
        
        const currentGp = grammarPoints[currentIndex];
        const chineseVoice = currentGp.chineseVoice || 'zh-CN-XiaomengNeural';
        const myanmarVoice = currentGp.myanmarVoice || 'my-MM-NilarNeural';

        setActiveAudio({ text, type });
        setIsLoadingAudio(true);

        let sounds = [];
        let loadedCount = 0;

        const startPlayback = () => {
            if (playbackIdRef.current !== currentPlaybackId) return;
            setIsLoadingAudio(false);
            audioQueueRef.current = sounds;
            
            let currentSoundIndex = 0;
            const playNext = () => {
                if (playbackIdRef.current !== currentPlaybackId || currentSoundIndex >= sounds.length) {
                    if (playbackIdRef.current === currentPlaybackId) stopPlayback();
                    return;
                }
                const sound = sounds[currentSoundIndex];
                sound.once('end', () => {
                    currentSoundIndex++;
                    playNext();
                });
                sound.play();
            };
            playNext();
        };
        
        parts.forEach((part, index) => {
            const voice = part.isChinese ? chineseVoice : myanmarVoice;
            const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(part.text)}&v=${voice}`;
            
            const checkLoad = () => {
                loadedCount++;
                if (loadedCount === parts.length) startPlayback();
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
                        checkLoad(); // 即使失败也继续，避免卡死
                    }
                });
                sounds[index] = sound;
            }
        });
    }, [grammarPoints, currentIndex, stopPlayback]);

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


    // --- 导航与交互逻辑 (核心修改) ---

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

    // 监听滚动事件，判断是否到底部
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        // 允许 10px 的误差
        const isBottom = scrollHeight - scrollTop - clientHeight < 20;
        setIsAtBottom(isBottom);
    };

    const swipeHandlers = useSwipeable({
        onSwipedUp: (e) => {
            // 只有当内容很少不需要滚动，或者已经滚动到底部时，才允许切下一页
            const el = scrollContainerRef.current;
            if (!el) return;
            
            const isOverflowing = el.scrollHeight > el.clientHeight;
            // 如果内容溢出且没到底部，阻止翻页，让原生滚动处理
            if (isOverflowing && !isAtBottom) {
                // 如果用户用力滑，也可以辅助滚动一下（可选）
                el.scrollBy({ top: 200, behavior: 'smooth' });
                return;
            }
            navigate(1);
        },
        onSwipedDown: (e) => {
             const el = scrollContainerRef.current;
             if (!el) return;
             // 只有在顶部时才允许切上一页
             if (el.scrollTop <= 0) {
                 navigate(-1);
             }
        },
        preventDefaultTouchmoveEvent: false, // 关键：允许内部文字滚动
        trackMouse: true,
        delta: 50 // 滑动灵敏度
    });

    const transitions = useTransition(currentIndex, {
        key: currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
        config: { mass: 1, tension: 260, friction: 26 },
    });

    // --- 渲染辅助 ---
    const renderMixedText = (text, pattern = "") => {
        const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        const highlightIndices = new Set();
        
        const mappedPartsWithIndices = parts.map((p, i) => ({ text: p, index: i }));
        const chineseParts = mappedPartsWithIndices.filter(p => p.text.startsWith('{{'));
        
        // 简单的逻辑高亮第一个中文块，实际逻辑可按需复杂化
        if (chineseParts.length > 0) highlightIndices.add(chineseParts[0].index);

        return parts.map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            const isPunctuation = /^[,\.!?\s]+$/.test(content);
            
            let baseStyle = isChinese ? styles.textChinese : styles.textBurmese;
            if (isPunctuation) baseStyle = { color: '#bbb' }; // 标点符号淡化

            if (highlightIndices.has(pIndex)) {
                baseStyle = { ...baseStyle, ...styles.textHighlight };
            }

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
            {/* 顶部工具栏 */}
            <div style={styles.topBar}>
                <div style={styles.progressBar}>
                    <div style={{...styles.progressFill, width: `${((currentIndex + 1) / grammarPoints.length) * 100}%`}} />
                </div>
                <div style={styles.topControls}>
                    <button style={styles.iconBtn} onClick={onComplete}><FaTimes /></button>
                    <span style={styles.pageIndicator}>{currentIndex + 1} / {grammarPoints.length}</span>
                    <button style={styles.iconBtn} onClick={() => setFontSizeLevel(prev => prev >= 1.4 ? 1 : prev + 0.2)}>
                        <FaFont size={14} />
                    </button>
                </div>
            </div>

            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;
                const bgImage = gp.background?.imageUrl || '';
                const bgGradient = gp.background?.imageUrl 
                    ? `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.85)), url(${gp.background.imageUrl})`
                    : `linear-gradient(135deg, ${gp.background?.gradientStart || '#1f2937'} 0%, ${gp.background?.gradientEnd || '#111827'} 100%)`;

                return (
                    <animated.div style={{ ...styles.page, background: bgGradient, ...style }}>
                        {/* 可滚动区域 */}
                        <div 
                            ref={scrollContainerRef} 
                            style={styles.scrollContainer} 
                            onScroll={handleScroll}
                        >
                            <div style={styles.contentWrapper}>
                                {/* 头部标题卡片 */}
                                <div style={styles.cardGlass}>
                                    <div style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                    {gp.pattern && <div style={styles.pattern}>{gp.pattern}</div>}
                                </div>
                                
                                {/* 解释部分 */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionLabel}>语法解释</span>
                                        <PlayButton 
                                            isActive={activeAudio?.type === `narration_${gp.id}`}
                                            isLoading={isLoadingAudio && activeAudio?.type === `narration_${gp.id}`}
                                            onClick={() => activeAudio?.type === `narration_${gp.id}` ? stopPlayback() : playMixedAudio(gp.narrationScript, `narration_${gp.id}`)}
                                        />
                                    </div>
                                    <div style={{...styles.explanationText, fontSize: `${0.95 * fontSizeLevel}rem`}} 
                                         dangerouslySetInnerHTML={{ __html: gp.visibleExplanation?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} 
                                    />
                                </div>
                                
                                {/* 例句部分 */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionLabel}>例句示范</span>
                                    </div>
                                    <div style={styles.examplesList}>
                                        {gp.examples.map((ex, index) => (
                                            <div key={ex.id} style={styles.exampleItem}>
                                                <div style={styles.exampleHeader}>
                                                    <span style={styles.exampleNumber}>{index + 1}</span>
                                                    <PlayButton 
                                                        mini
                                                        isActive={activeAudio?.type === `example_${ex.id}`}
                                                        isLoading={isLoadingAudio && activeAudio?.type === `example_${ex.id}`}
                                                        onClick={() => activeAudio?.type === `example_${ex.id}` ? stopPlayback() : playMixedAudio(ex.narrationScript || ex.sentence, `example_${ex.id}`)}
                                                    />
                                                </div>
                                                <div style={styles.exampleContent}>
                                                    <div style={styles.sentenceRow}>{renderMixedText(ex.sentence, gp.pattern)}</div>
                                                    <div style={{...styles.translation, fontSize: `${0.85 * fontSizeLevel}rem`}}>{ex.translation}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 底部占位，防止内容贴底 */}
                                <div style={{height: '100px'}}></div>
                            </div>
                        </div>

                        {/* 底部导航提示 - 浮动在上方 */}
                        <div style={{...styles.footer, opacity: isAtBottom ? 1 : 0.3 }}>
                            <div className="bounce-icon">
                                {isAtBottom ? <FaChevronUp size={24} color="#4ade80" /> : <FaChevronUp size={20} />}
                            </div>
                            <span>{isAtBottom ? "上滑切换下一个" : "滑动浏览内容"}</span>
                        </div>
                    </animated.div>
                );
            })}
        </div>,
        document.body
    );
};

// 小组件：播放按钮
const PlayButton = ({ isActive, isLoading, onClick, mini }) => (
    <button style={mini ? styles.playButtonMini : styles.playButton} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {isLoading ? <FaSpinner className="spin" /> : (isActive ? <FaStopCircle /> : <FaVolumeUp />)}
    </button>
);

// --- 样式定义 ---
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#000', color: '#fff', touchAction: 'none' },
    
    // Top Bar
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: 'env(safe-area-inset-top) 16px 10px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' },
    progressBar: { height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginBottom: '10px' },
    progressFill: { height: '100%', background: '#4ade80', borderRadius: '2px', transition: 'width 0.3s' },
    topControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    pageIndicator: { fontSize: '0.9rem', fontFamily: 'monospace', opacity: 0.8 },
    iconBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '50%', cursor: 'pointer', backdropFilter: 'blur(4px)' },

    // Page Layout
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
    
    // Scroll Container (Critical for content scrolling)
    scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '80px 20px 40px', scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' },
    contentWrapper: { maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' },

    // Components
    cardGlass: { background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'center', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)' },
    grammarPointTitle: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
    pattern: { color: '#67e8f9', fontFamily: 'monospace', fontSize: '1.1rem', background: 'rgba(0,0,0,0.3)', padding: '4px 12px', borderRadius: '8px', display: 'inline-block' },

    sectionContainer: { background: 'rgba(0, 0, 0, 0.2)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255, 255, 255, 0.05)' },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' },
    sectionLabel: { fontSize: '1rem', fontWeight: 'bold', color: '#fcd34d', letterSpacing: '1px' },
    
    explanationText: { lineHeight: 1.8, color: '#e5e7eb', textAlign: 'justify' },

    examplesList: { display: 'flex', flexDirection: 'column', gap: '24px' },
    exampleItem: { display: 'flex', flexDirection: 'column', gap: '8px' },
    exampleHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
    exampleNumber: { background: 'rgba(255,255,255,0.2)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' },
    exampleContent: { paddingLeft: '10px', borderLeft: '2px solid rgba(255,255,255,0.1)' },
    sentenceRow: { lineHeight: 1.6, marginBottom: '6px' },
    translation: { color: '#9ca3af', fontStyle: 'italic' },

    // Buttons & Text
    playButton: { background: 'rgba(59, 130, 246, 0.8)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' },
    playButtonMini: { background: 'rgba(255, 255, 255, 0.15)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

    textChinese: { color: '#fff', marginRight: '4px' },
    textBurmese: { color: '#5eead4', marginRight: '2px' },
    textHighlight: { color: '#fde047', fontWeight: 'bold', textShadow: '0 0 10px rgba(253, 224, 71, 0.3)' },

    footer: { position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#fff', pointerEvents: 'none', transition: 'opacity 0.3s' },
};

// --- CSS 动画注入 ---
const styleTag = document.getElementById('gp-player-styles') || document.createElement('style');
styleTag.id = 'gp-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .bounce-icon { animation: bounce 2s infinite; }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    
    /* 隐藏滚动条但保留功能 */
    div::-webkit-scrollbar { width: 4px; }
    div::-webkit-scrollbar-track { background: transparent; }
    div::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); borderRadius: 2px; }
`;
if (!document.getElementById('gp-player-styles')) document.head.appendChild(styleTag);

GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
