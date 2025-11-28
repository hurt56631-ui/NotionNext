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
    FaFont, FaChevronLeft, FaTimes, FaLightbulb, FaLink 
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
    const scrollContainerRef = useRef(null); 

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
            // 如果内容很少不需要滚动，直接标记为到底部
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight <= clientHeight + 20) {
                setIsAtBottom(true);
            }
        }
    }, [currentIndex]);

    // --- 音频逻辑 ---
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
        stopPlayback(); 

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
                        checkLoad(); 
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

    // 监听滚动事件
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        // 判定触底 (允许 10px 误差)
        const isBottom = scrollHeight - scrollTop - clientHeight < 20;
        setIsAtBottom(isBottom);
    };

    const swipeHandlers = useSwipeable({
        onSwipedUp: (e) => {
            const el = scrollContainerRef.current;
            if (!el) return;
            
            const isScrollable = el.scrollHeight > el.clientHeight;
            
            // 逻辑核心：
            // 1. 如果内容短(不可滚动)，允许直接下一页
            // 2. 如果内容长，必须先滚动到底部(isAtBottom 为 true)才允许下一页
            if (!isScrollable || isAtBottom) {
                navigate(1);
            } else {
                // 如果没到底部，用户上滑可能是为了看下面内容，这里给一个微小的滚动反馈，
                // 或者什么都不做，让原生滚动处理 (preventDefaultTouchmoveEvent: false)
            }
        },
        onSwipedDown: (e) => {
             const el = scrollContainerRef.current;
             if (!el) return;
             // 只有在顶部时才允许切上一页
             if (el.scrollTop <= 0) {
                 navigate(-1);
             }
        },
        preventDefaultTouchmoveEvent: false, // 允许浏览器原生滚动
        trackMouse: true,
        delta: 40 // 降低灵敏度，避免误触
    });

    const transitions = useTransition(currentIndex, {
        key: currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
        config: { mass: 1, tension: 280, friction: 30 },
    });

    // --- 文本渲染 ---
    const renderMixedText = (text, pattern = "") => {
        const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        const highlightIndices = new Set();
        
        // 简单逻辑：高亮第一个中文块
        parts.forEach((p, i) => {
            if (p.startsWith('{{')) {
                // 这里可以根据 pattern 稍微做点匹配逻辑，目前简化为全部高亮
                // highlightIndices.add(i); 
            }
        });

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
                    ? `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${gp.background.imageUrl})`
                    : `linear-gradient(135deg, ${gp.background?.gradientStart || '#1f2937'} 0%, ${gp.background?.gradientEnd || '#111827'} 100%)`;

                return (
                    <animated.div style={{ ...styles.page, background: bgGradient, ...style }}>
                        {/* 可滚动区域 - 添加 overscroll-behavior 禁止下拉刷新 */}
                        <div 
                            ref={scrollContainerRef} 
                            style={styles.scrollContainer} 
                            onScroll={handleScroll}
                        >
                            <div style={styles.contentWrapper}>
                                {/* 1. 标题卡片 */}
                                <div style={styles.cardGlass}>
                                    <div style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                    {gp.pattern && <div style={styles.pattern}>{gp.pattern}</div>}
                                </div>
                                
                                {/* 2. 语法解释 */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <div style={styles.headerTitle}>
                                            <FaLightbulb color="#fcd34d" />
                                            <span style={styles.sectionLabel}>语法解释</span>
                                        </div>
                                        <PlayButton 
                                            isActive={activeAudio?.type === `narration_${gp.id}`}
                                            isLoading={isLoadingAudio && activeAudio?.type === `narration_${gp.id}`}
                                            onClick={() => activeAudio?.type === `narration_${gp.id}` ? stopPlayback() : playMixedAudio(gp.narrationScript, `narration_${gp.id}`)}
                                        />
                                    </div>
                                    <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} 
                                         dangerouslySetInnerHTML={{ __html: gp.visibleExplanation?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} 
                                    />
                                </div>

                                {/* 3. 常见搭配 (新) - 如果有才显示 */}
                                {gp.collocations && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <div style={styles.headerTitle}>
                                                <FaLink color="#60a5fa" />
                                                <span style={styles.sectionLabel}>常见搭配</span>
                                            </div>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} 
                                             dangerouslySetInnerHTML={{ __html: gp.collocations.replace(/\n/g, '<br/>') }} 
                                        />
                                    </div>
                                )}

                                {/* 4. 用法 (新) - 如果有才显示 */}
                                {gp.usage && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <div style={styles.headerTitle}>
                                                <span style={styles.sectionLabel}>用法说明</span>
                                            </div>
                                        </div>
                                        <div style={{...styles.explanationText, fontSize: `${0.85 * fontSizeLevel}rem`}} 
                                             dangerouslySetInnerHTML={{ __html: gp.usage.replace(/\n/g, '<br/>') }} 
                                        />
                                    </div>
                                )}
                                
                                {/* 5. 例句示范 */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionLabel}>例句示范</span>
                                    </div>
                                    <div style={styles.examplesList}>
                                        {gp.examples.map((ex, index) => (
                                            <div key={ex.id} style={styles.exampleItem}>
                                                <div style={styles.exampleRow}>
                                                    {/* 编号与播放按钮 */}
                                                    <div style={styles.exampleLeftCol}>
                                                        <span style={styles.exampleNumber}>{index + 1}</span>
                                                        <PlayButton 
                                                            mini
                                                            isActive={activeAudio?.type === `example_${ex.id}`}
                                                            isLoading={isLoadingAudio && activeAudio?.type === `example_${ex.id}`}
                                                            onClick={() => activeAudio?.type === `example_${ex.id}` ? stopPlayback() : playMixedAudio(ex.narrationScript || ex.sentence, `example_${ex.id}`)}
                                                        />
                                                    </div>
                                                    
                                                    {/* 句子与翻译 (并排显示) */}
                                                    <div style={styles.exampleContent}>
                                                        <div style={styles.sentenceRow}>
                                                            {renderMixedText(ex.sentence, gp.pattern)}
                                                        </div>
                                                        <div style={{...styles.translation, fontSize: `${0.8 * fontSizeLevel}rem`}}>
                                                            {ex.translation}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 底部占位 */}
                                <div style={{height: '100px'}}></div>
                            </div>
                        </div>

                        {/* 底部导航提示 - 仅在触底时高亮 */}
                        <div style={{
                            ...styles.footer, 
                            opacity: isAtBottom ? 1 : 0,
                            transform: isAtBottom ? 'translateY(0)' : 'translateY(10px)'
                        }}>
                            <div className="bounce-icon">
                                <FaChevronUp size={24} color="#4ade80" />
                            </div>
                            <span style={{textShadow: '0 1px 2px rgba(0,0,0,0.8)'}}>上滑进入下一课</span>
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
    
    // Scroll Container
    scrollContainer: { 
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden', 
        padding: '80px 16px 40px', // paddingReduced
        scrollBehavior: 'smooth', 
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'none' // 禁止下拉刷新关键代码
    },
    contentWrapper: { maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }, // 卡片间距减少

    // Components
    cardGlass: { background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', padding: '14px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'center', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)' },
    grammarPointTitle: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '6px', textShadow: '0 2px 4px rgba(0,0,0,0.5)', lineHeight: 1.3 }, // Font Reduced
    pattern: { color: '#67e8f9', fontFamily: 'monospace', fontSize: '1rem', background: 'rgba(0,0,0,0.3)', padding: '2px 10px', borderRadius: '6px', display: 'inline-block', marginTop: '4px' },

    sectionContainer: { background: 'rgba(0, 0, 0, 0.25)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }, // Padding reduced
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' },
    headerTitle: { display: 'flex', alignItems: 'center', gap: '8px' },
    sectionLabel: { fontSize: '0.9rem', fontWeight: 'bold', color: '#fcd34d', letterSpacing: '0.5px' },
    
    explanationText: { lineHeight: 1.6, color: '#e5e7eb', textAlign: 'justify' }, // Font size handled in inline style

    examplesList: { display: 'flex', flexDirection: 'column', gap: '14px' }, // Gap reduced
    exampleItem: { display: 'flex', flexDirection: 'column' },
    exampleRow: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
    exampleLeftCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', paddingTop: '2px' },
    exampleNumber: { background: 'rgba(255,255,255,0.15)', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', color: '#ddd' }, // Smaller number
    
    exampleContent: { flex: 1 },
    sentenceRow: { lineHeight: 1.5, marginBottom: '4px' },
    translation: { color: '#9ca3af', fontStyle: 'italic', marginTop: '2px' },

    // Buttons & Text
    playButton: { background: 'rgba(59, 130, 246, 0.9)', border: 'none', color: 'white', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' },
    playButtonMini: { background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

    textChinese: { color: '#fff', marginRight: '6px', verticalAlign: 'middle' },
    textBurmese: { color: '#5eead4', verticalAlign: 'middle' }, // Removed marginRight to keep tight
    
    footer: { position: 'absolute', bottom: '24px', left: 0, right: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#fff', pointerEvents: 'none', transition: 'all 0.4s ease-out' },
};

// --- CSS 动画注入 ---
const styleTag = document.getElementById('gp-player-styles') || document.createElement('style');
styleTag.id = 'gp-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .bounce-icon { animation: bounce 1.5s infinite; }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    
    /* 隐藏滚动条但保留功能 */
    div::-webkit-scrollbar { width: 3px; }
    div::-webkit-scrollbar-track { background: transparent; }
    div::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); borderRadius: 2px; }
`;
if (!document.getElementById('gp-player-styles')) document.head.appendChild(styleTag);

GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
