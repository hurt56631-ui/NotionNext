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
    
    useEffect(() => {
        setIsMounted(true);
        // 防止橡皮筋效果
        document.body.style.overscrollBehavior = 'none';
        
        const metaTags = [
            { name: 'apple-mobile-web-app-capable', content: 'yes' },
            { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }
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
    const currentSoundRef = useRef(null); 

    // 滚动交互状态
    const contentRef = useRef(null);
    const [canSwipeNext, setCanSwipeNext] = useState(false); 
    const [showBottomHint, setShowBottomHint] = useState(false);

    // --- 音频控制逻辑 ---
    const stopPlayback = useCallback(() => {
        if (currentSoundRef.current) {
            currentSoundRef.current.stop();
            currentSoundRef.current = null;
        }
        setActiveAudio(null);
        setIsLoadingAudio(false);
    }, []);

    const playSingleAudio = useCallback((text, type) => {
        stopPlayback();
        if (!text) return;

        setActiveAudio({ type });
        setIsLoadingAudio(true);

        // --- 核心修改：处理文本以优化 TTS ---
        // 1. 去除视觉标记 {{ }}
        let cleanText = text.replace(/\{\{| \}\}|\}\}/g, '');
        
        // 2. 强制停顿处理：
        // 将换行符(\n) 替换为 "。" 甚至 "..."，让 Xiaoxiao 明显停顿
        // 这样中文和缅文就不会粘在一起读了
        cleanText = cleanText.replace(/\n/g, '... ').replace(/[\r\n]+/g, '... ');

        // 3. 构建 URL
        const voice = 'zh-CN-XiaoxiaoMultilingualNeural';
        // 使用 encodeURIComponent 确保特殊字符传递正确
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanText)}&v=${voice}`;

        const sound = new Howl({
            src: [url],
            html5: true,
            onload: () => {
                setIsLoadingAudio(false);
            },
            onend: () => {
                setActiveAudio(null);
                currentSoundRef.current = null;
            },
            onloaderror: (id, err) => {
                console.error('Audio Load Error:', err);
                setIsLoadingAudio(false);
                setActiveAudio(null);
            }
        });

        currentSoundRef.current = sound;
        sound.play();

    }, [stopPlayback]);
    
    const handlePlayButtonClick = (text, type) => {
        if (activeAudio?.type === type) {
            stopPlayback();
        } else {
            playSingleAudio(text, type);
        }
    };
    
    // --- 页面切换副作用 ---
    useEffect(() => {
        stopPlayback();
        
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
        setCanSwipeNext(false);
        setShowBottomHint(false);

        // 自动播放延迟稍微加长，等待动画完全结束
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playSingleAudio(gp.narrationScript, `narration_${gp.id}`);
            }
            
            if (contentRef.current) {
                const { scrollHeight, clientHeight } = contentRef.current;
                // 宽松判定，防止微小误差
                if (scrollHeight <= clientHeight + 60) { 
                    setCanSwipeNext(true);
                    setShowBottomHint(true);
                }
            }
        }, 800);
        
        return () => {
            clearTimeout(timer);
            stopPlayback();
        };
    }, [currentIndex, grammarPoints, playSingleAudio, stopPlayback]);
    
    // --- 滚动监听 ---
    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        // 阈值设为 20px
        const isBottom = scrollTop + clientHeight >= scrollHeight - 20;
        
        if (isBottom && !canSwipeNext) {
            setCanSwipeNext(true);
            setShowBottomHint(true);
        }
    };

    // --- 导航逻辑 ---
    const navigate = useCallback((direction) => {
        if (direction > 0 && !canSwipeNext) return;

        lastDirection.current = direction;
        setCurrentIndex(prev => {
            const newIndex = prev + direction;
            if (newIndex >= 0 && newIndex < grammarPoints.length) return newIndex;
            if (newIndex >= grammarPoints.length) onComplete();
            return prev;
        });
    }, [grammarPoints.length, onComplete, canSwipeNext]);

    const swipeHandlers = useSwipeable({
        onSwipedUp: () => navigate(1),
        onSwipedDown: () => navigate(-1),
        preventDefaultTouchmoveEvent: false,
        trackMouse: true,
        // --- 核心修改：大幅增加滑动阈值 ---
        delta: 120, // 之前是 50，现在需要滑动 120px 才会触发，防误触
        swipeDuration: 500 // 限制滑动时间，防止极慢的拖动也触发
    });

    const transitions = useTransition(currentIndex, {
        key: grammarPoints[currentIndex]?.id || currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '40px' : '-40px'})` },
        enter: { opacity: 1, transform: 'translateY(0px)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-40px' : '40px'})`, position: 'absolute' },
        config: { mass: 1, tension: 220, friction: 26 }, // 动画稍微调柔和一点
    });
    
    // --- 渲染混合文本 ---
    const renderMixedText = (text, isPattern = false) => {
        // 过滤掉用户可能输入的用于语音停顿的换行符，只在视觉上保留空格
        const visualText = text.replace(/\\n/g, ' '); 
        const parts = visualText.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        
        return parts.map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            
            let partStyle;
            if (isPattern) {
                partStyle = isChinese ? styles.patternChinese : styles.patternMyanmar;
            } else {
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
                                <div style={styles.header}>
                                    <h2 style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                    {i > 0 && <div style={styles.topHint}><FaChevronDown /> 下滑复习</div>}
                                </div>
                                
                                {gp.pattern && (
                                    <div style={styles.patternBox}>
                                        <div style={styles.boxLabel}>核心公式</div>
                                        <div style={styles.patternContent}>
                                            {renderMixedText(gp.pattern, true)}
                                        </div>
                                    </div>
                                )}
                                
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

                                <div style={{ height: '120px' }}></div>
                            </div>
                        </div>

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

const styles = {
    fullScreen: { 
        position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden', 
        background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    page: { 
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', 
        background: 'linear-gradient(180deg, #ffffff 0%, #f0f4f8 100%)', willChange: 'transform, opacity' 
    },
    scrollContainer: {
        flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: '0 20px',
    },
    contentWrapper: { 
        maxWidth: '800px', margin: '0 auto', paddingTop: 'env(safe-area-inset-top, 20px)', minHeight: '100%'
    },
    header: { textAlign: 'center', marginTop: '20px', marginBottom: '20px', position: 'relative' },
    grammarPointTitle: { 
        fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0, lineHeight: 1.3,
        // --- 核心修改：限制标题行数，最多两行，防止太长 ---
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
    },
    topHint: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
    patternBox: {
        background: '#ffffff', borderRadius: '16px', padding: '20px', marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(148, 163, 184, 0.15)', border: '1px solid #e2e8f0', textAlign: 'center'
    },
    boxLabel: { fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '10px', fontWeight: '600' },
    patternContent: { fontSize: '1.2rem', fontWeight: 'bold', lineHeight: 1.6 },
    patternChinese: { color: '#2563eb', margin: '0 4px' }, 
    patternMyanmar: { color: '#059669', margin: '0 4px' }, 
    sectionContainer: { marginBottom: '24px' },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    sectionTitleText: { fontSize: '1rem', fontWeight: '700', color: '#334155' },
    playButton: { 
        background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: 'none', borderRadius: '50%', 
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
    },
    playButtonSmall: {
        background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '50%',
        width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', 
    },
    textBlock: { background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '10px' },
    explanationText: { fontSize: '1rem', lineHeight: 1.7, color: '#475569', margin: '0 0 10px 0', textAlign: 'justify' },
    examplesList: { display: 'flex', flexDirection: 'column', gap: '16px' },
    exampleItem: { 
        background: '#ffffff', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', 
        gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
    },
    exampleMain: { flex: 1 },
    exampleSentence: { fontSize: '1.1rem', fontWeight: 500, marginBottom: '4px', lineHeight: 1.5 },
    exampleTranslation: { fontSize: '0.9rem', color: '#64748b', fontStyle: 'normal' },
    textChinese: { color: '#1e293b' }, 
    textBurmese: { color: '#059669' }, 
    bottomHintBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '90px',
        background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#2563eb', fontWeight: '600', fontSize: '0.95rem', paddingBottom: 'env(safe-area-inset-bottom, 10px)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease', boxShadow: '0 -4px 20px rgba(0,0,0,0.05)', zIndex: 10
    }
};

const styleTag = document.getElementById('grammar-player-styles') || document.createElement('style');
styleTag.id = 'grammar-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .play-button:active { transform: scale(0.95); }
    .bounce-icon { animation: bounce 1.5s infinite; }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
`;
if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);

export default GrammarPointPlayer;
