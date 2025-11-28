// components/Tixing/GrammarPointPlayer.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl } from 'howler';
import { FaVolumeUp, FaStopCircle, FaSpinner, FaChevronUp, FaChevronDown } from 'react-icons/fa';

// --- 辅助函数：生成注音 HTML ---
const generateRubyHTML = (text) => {
  if (!text) return '';
  return text.replace(/[\u4e00-\u9fa5]/g, char => `<ruby>${char}<rt>${pinyinConverter(char)}</rt></ruby>`);
};

// --- 主组件 ---
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    const [isMounted, setIsMounted] = useState(false);
    
    // 初始化全屏和Meta标签
    useEffect(() => {
        setIsMounted(true);
        // 锁定背景，防止橡皮筋效果
        document.body.style.overscrollBehavior = 'none';
        
        const metaTags = [
            { name: 'apple-mobile-web-app-capable', content: 'yes' },
            { name: 'apple-mobile-web-app-status-bar-style', content: 'default' } // 浅色背景改回默认状态栏
        ];
        
        metaTags.forEach(tagInfo => {
            let meta = document.createElement('meta');
            meta.name = tagInfo.name;
            meta.content = tagInfo.content;
            meta.id = `gp-player-meta-${tagInfo.name}`;
            document.head.appendChild(meta);
        });

        return () => {
            document.body.style.overscrollBehavior = 'auto';
            metaTags.forEach(tagInfo => {
                const meta = document.getElementById(`gp-player-meta-${tagInfo.name}`);
                if (meta) document.head.removeChild(meta);
            });
        };
    }, []);

    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) return null;

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    
    // 音频状态
    const [activeAudio, setActiveAudio] = useState(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const audioQueueRef = useRef([]);
    const audioCache = useRef({});
    const playbackIdRef = useRef(0);

    // 滚动交互状态
    const contentRef = useRef(null);
    const [canSwipeNext, setCanSwipeNext] = useState(false); // 是否允许滑动到下一页
    const [showBottomHint, setShowBottomHint] = useState(false); // 是否显示底部提示条

    // --- 音频控制逻辑 ---
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
        return matchedParts
            .map(part => {
                const isChinese = part.startsWith('{{') && part.endsWith('}}');
                const content = isChinese ? part.slice(2, -2) : part;
                if (content.trim() === '') return null;
                return { text: content, isChinese };
            })
            .filter(Boolean);
    };

    const playMixedAudio = useCallback((text, type) => {
        const currentPlaybackId = playbackIdRef.current + 1;
        playbackIdRef.current = currentPlaybackId;
        
        audioQueueRef.current.forEach(sound => sound.stop());
        audioQueueRef.current = [];

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
        // --- 修改点：中文发音人更新 ---
        const chineseVoice = 'zh-CN-XiaoxiaoMultilingualNeural'; 
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
                    if(playbackIdRef.current === currentPlaybackId) stopPlayback();
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
            
            const onSoundLoad = (sound) => {
                if (playbackIdRef.current !== currentPlaybackId) return;
                loadedCount++;
                if (loadedCount === parts.length) startPlayback();
            };

            if (audioCache.current[url] && audioCache.current[url].state() === 'loaded') {
                sounds[index] = audioCache.current[url];
                onSoundLoad(sounds[index]);
            } else {
                const sound = new Howl({
                    src: [url],
                    html5: true,
                    onload: () => { audioCache.current[url] = sound; onSoundLoad(sound); },
                    onloaderror: () => { console.error(`语音片段加载失败: ${part.text}`); onSoundLoad(null); }
                });
                sounds[index] = sound;
            }
        });
    }, [grammarPoints, currentIndex, stopPlayback]);
    
    const handlePlayButtonClick = (text, type) => {
        if (activeAudio?.type === type) {
            stopPlayback();
        } else {
            playMixedAudio(text, type);
        }
    };
    
    // --- 页面切换副作用 ---
    useEffect(() => {
        stopPlayback();
        
        // 重置滚动状态
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
        setCanSwipeNext(false);
        setShowBottomHint(false);

        // 自动播放标题（稍微延迟）
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playMixedAudio(gp.narrationScript, `narration_${gp.id}`);
            }
            
            // 检查内容是否短于屏幕（无需滚动即可进入下一页）
            if (contentRef.current) {
                const { scrollHeight, clientHeight } = contentRef.current;
                if (scrollHeight <= clientHeight + 50) { // 50px buffer
                    setCanSwipeNext(true);
                    setShowBottomHint(true);
                }
            }
        }, 600);
        
        return () => {
            clearTimeout(timer);
            stopPlayback();
        };
    }, [currentIndex, grammarPoints, playMixedAudio, stopPlayback]);
    
    // --- 滚动监听逻辑 ---
    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        
        // 判定是否触底 (阈值 20px)
        const isBottom = scrollTop + clientHeight >= scrollHeight - 20;
        
        if (isBottom && !canSwipeNext) {
            setCanSwipeNext(true);
            setShowBottomHint(true);
        }
    };

    // --- 导航逻辑 ---
    const navigate = useCallback((direction) => {
        // 如果是向后（direction > 0），必须满足 canSwipeNext
        if (direction > 0 && !canSwipeNext) {
            // 这里可以加一个微小的弹性动画提示用户要先看完
            return;
        }

        lastDirection.current = direction;
        setCurrentIndex(prev => {
            const newIndex = prev + direction;
            if (newIndex >= 0 && newIndex < grammarPoints.length) return newIndex;
            if (newIndex >= grammarPoints.length) onComplete();
            return prev;
        });
    }, [grammarPoints.length, onComplete, canSwipeNext]);

    // --- 滑动处理 ---
    const swipeHandlers = useSwipeable({
        onSwipedUp: () => navigate(1),
        onSwipedDown: () => navigate(-1),
        preventDefaultTouchmoveEvent: false, // 允许内部滚动
        trackMouse: true,
        // 只有当提示出现时，才更容易触发Swipe
        delta: 50 
    });

    const transitions = useTransition(currentIndex, {
        key: grammarPoints[currentIndex]?.id || currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '60px' : '-60px'})` },
        enter: { opacity: 1, transform: 'translateY(0px)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-60px' : '60px'})`, position: 'absolute' },
        config: { mass: 1, tension: 260, friction: 20 },
    });
    
    // --- 渲染混合文本（颜色区分） ---
    const renderMixedText = (text, isPattern = false) => {
        const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        
        return parts.map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            
            // 样式选择
            let partStyle;
            if (isPattern) {
                // 公式拆解中的颜色逻辑
                partStyle = isChinese ? styles.patternChinese : styles.patternMyanmar;
            } else {
                // 例句中的颜色逻辑
                partStyle = isChinese ? styles.textChinese : styles.textBurmese;
            }

            return (
                <span key={pIndex} style={partStyle}>
                    {isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} /> : content}
                </span>
            );
        });
    };

    const renderExplanation = (text) => {
        if (!text) return null;
        return text.split('\n').map((line, index) => {
            if (line.trim() === '') return <div key={index} style={{height: '10px'}} />;
            // 高亮重点标记
            const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #2563eb; background: rgba(37, 99, 235, 0.1); padding: 0 4px; border-radius: 4px;">$1</strong>');
            return <p key={index} style={styles.explanationText} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
        });
    };

    const content = (
        <div style={styles.fullScreen} {...swipeHandlers}>
            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;

                return (
                    <animated.div style={{ ...styles.page, ...style }}>
                        <div 
                            style={styles.scrollContainer} 
                            ref={contentRef}
                            onScroll={handleScroll}
                        >
                            <div style={styles.contentWrapper}>
                                {/* 1. 顶部标题区 */}
                                <div style={styles.header}>
                                    <h2 style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                    {/* 下滑提示 icon (如果是第一页就不显示) */}
                                    {i > 0 && <div style={styles.topHint}><FaChevronDown /> 下滑复习</div>}
                                </div>
                                
                                {/* 2. 核心公式区 - 重点突出 */}
                                {gp.pattern && (
                                    <div style={styles.patternBox}>
                                        <div style={styles.boxLabel}>核心公式</div>
                                        <div style={styles.patternContent}>
                                            {renderMixedText(gp.pattern, true)}
                                        </div>
                                    </div>
                                )}
                                
                                {/* 3. 语法解释区 */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionTitleText}>💡 详解</span>
                                        <button className="play-button" style={styles.playButton} onClick={() => handlePlayButtonClick(gp.narrationScript, `narration_${gp.id}`)}>
                                            {isLoadingAudio && activeAudio?.type === `narration_${gp.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `narration_${gp.id}` ? <FaStopCircle/> : <FaVolumeUp/>) }
                                        </button>
                                    </div>
                                    <div style={styles.textBlock}>
                                        {renderExplanation(gp.visibleExplanation)}
                                    </div>
                                </div>
                                
                                {/* 4. 例句区 */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionTitleText}>🗣️ 例句</span>
                                    </div>
                                    <div style={styles.examplesList}>
                                        {gp.examples.map((ex, index) => (
                                            <div key={ex.id} style={styles.exampleItem}>
                                                <div style={styles.exampleMain}>
                                                    <div style={styles.exampleSentence}>
                                                        {renderMixedText(ex.sentence)}
                                                    </div>
                                                    <div style={styles.exampleTranslation}>{ex.translation}</div>
                                                </div>
                                                <button className="play-button" style={styles.playButtonSmall} onClick={() => handlePlayButtonClick(ex.narrationScript || ex.sentence, `example_${ex.id}`)}>
                                                     {isLoadingAudio && activeAudio?.type === `example_${ex.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `example_${ex.id}` ? <FaStopCircle/> : <FaVolumeUp/>) }
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 底部占位符，确保最后内容不被提示条遮挡 */}
                                <div style={{ height: '100px' }}></div>
                            </div>
                        </div>

                        {/* 上滑进入下一课 提示条 (磨砂玻璃效果) */}
                        <div style={{
                            ...styles.bottomHintBar,
                            transform: showBottomHint ? 'translateY(0)' : 'translateY(100%)',
                            opacity: showBottomHint ? 1 : 0
                        }} onClick={() => canSwipeNext && navigate(1)}>
                            <div className="bounce-icon" style={{ marginBottom: '4px' }}><FaChevronUp size="1.2em" /></div>
                            <span>上滑进入下一课</span>
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
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

// --- 样式定义 (浅色 + 磨砂玻璃风格) ---
const styles = {
    fullScreen: { 
        position: 'fixed', 
        inset: 0, 
        zIndex: 1000, 
        overflow: 'hidden', 
        background: '#f8fafc', // 浅色背景
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    page: { 
        position: 'absolute', 
        inset: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        background: 'linear-gradient(180deg, #ffffff 0%, #f0f4f8 100%)', // 微妙的渐变
        willChange: 'transform, opacity' 
    },
    scrollContainer: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        padding: '0 20px',
    },
    contentWrapper: { 
        maxWidth: '800px', 
        margin: '0 auto', 
        paddingTop: 'env(safe-area-inset-top, 20px)', 
        minHeight: '100%'
    },

    // 头部
    header: { 
        textAlign: 'center', 
        marginTop: '20px', 
        marginBottom: '20px',
        position: 'relative'
    },
    grammarPointTitle: { 
        fontSize: '1.6rem', // 标题缩小
        fontWeight: '800', 
        color: '#1e293b', // 深蓝灰
        margin: 0,
        lineHeight: 1.3
    },
    topHint: {
        fontSize: '0.75rem',
        color: '#94a3b8',
        marginTop: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px'
    },

    // 核心公式盒子
    patternBox: {
        background: '#ffffff',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(148, 163, 184, 0.15)', // 柔和阴影
        border: '1px solid #e2e8f0',
        textAlign: 'center'
    },
    boxLabel: {
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#64748b',
        marginBottom: '10px',
        fontWeight: '600'
    },
    patternContent: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        lineHeight: 1.6
    },
    patternChinese: { color: '#2563eb', margin: '0 4px' }, // 蓝色
    patternMyanmar: { color: '#059669', margin: '0 4px' }, // 墨绿色

    // 通用部分
    sectionContainer: { 
        marginBottom: '24px' 
    },
    sectionHeader: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '12px' 
    },
    sectionTitleText: {
        fontSize: '1rem',
        fontWeight: '700',
        color: '#334155'
    },
    playButton: { 
        background: 'rgba(37, 99, 235, 0.1)', 
        color: '#2563eb',
        border: 'none', 
        borderRadius: '50%', 
        width: '32px', 
        height: '32px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        cursor: 'pointer'
    },
    playButtonSmall: {
        background: 'transparent',
        border: '1px solid #cbd5e1',
        color: '#64748b',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        flexShrink: 0,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
    },

    // 解释文本
    textBlock: {
        background: 'rgba(255,255,255,0.6)',
        borderRadius: '12px',
        padding: '10px'
    },
    explanationText: { 
        fontSize: '1rem', 
        lineHeight: 1.7, 
        color: '#475569', 
        margin: '0 0 10px 0', 
        textAlign: 'justify' 
    },

    // 例句列表
    examplesList: { display: 'flex', flexDirection: 'column', gap: '16px' },
    exampleItem: { 
        background: '#ffffff',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        border: '1px solid #f1f5f9'
    },
    exampleMain: { flex: 1 },
    exampleSentence: { 
        fontSize: '1.1rem', 
        fontWeight: 500, 
        marginBottom: '4px',
        lineHeight: 1.5
    },
    exampleTranslation: { 
        fontSize: '0.9rem', 
        color: '#64748b', 
        fontStyle: 'normal' 
    },
    
    // 文字颜色 (例句中)
    textChinese: { color: '#1e293b' }, // 深色中文
    textBurmese: { color: '#059669' }, // 绿色缅文

    // 底部提示条 (磨砂玻璃)
    bottomHintBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '90px',
        background: 'rgba(255, 255, 255, 0.85)', // 半透明白
        backdropFilter: 'blur(12px)', // 磨砂玻璃
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#2563eb', // 提示文字蓝色
        fontWeight: '600',
        fontSize: '0.95rem',
        paddingBottom: 'env(safe-area-inset-bottom, 10px)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
        zIndex: 10
    }
};

const styleTag = document.getElementById('grammar-player-styles') || document.createElement('style');
styleTag.id = 'grammar-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .play-button:active { transform: scale(0.95); }
    
    .bounce-icon { animation: bounce 1.5s infinite; }
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
    }
`;
if (!document.getElementById('grammar-player-styles')) {
    document.head.appendChild(styleTag);
}

export default GrammarPointPlayer;
