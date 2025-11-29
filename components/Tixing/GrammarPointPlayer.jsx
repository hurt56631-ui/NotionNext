// components/Tixing/GrammarPointPlayer.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl } from 'howler';
import { FaVolumeUp, FaStop, FaSpinner, FaChevronRight, FaChevronLeft } from 'react-icons/fa';

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
        // 允许页面内部滚动，但禁止整体橡皮筋效果
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
    const [canGoNext, setCanGoNext] = useState(false); // 是否允许点击下一页

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

        // 处理文本：去格式 + 加停顿
        let cleanText = text.replace(/\{\{| \}\}|\}\}/g, '');
        cleanText = cleanText.replace(/\n/g, '... ').replace(/[\r\n]+/g, '... ');

        const voice = 'zh-CN-XiaoxiaoMultilingualNeural';
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanText)}&v=${voice}`;

        const sound = new Howl({
            src: [url],
            html5: true,
            onload: () => { setIsLoadingAudio(false); },
            onend: () => { setActiveAudio(null); currentSoundRef.current = null; },
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
        if (contentRef.current) contentRef.current.scrollTop = 0;
        setCanGoNext(false); // 重置下一页状态

        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playSingleAudio(gp.narrationScript, `narration_${gp.id}`);
            }
            if (contentRef.current) {
                const { scrollHeight, clientHeight } = contentRef.current;
                // 如果内容很少，直接允许下一页
                if (scrollHeight <= clientHeight + 60) { 
                    setCanGoNext(true);
                }
            }
        }, 600);
        
        return () => { clearTimeout(timer); stopPlayback(); };
    }, [currentIndex, grammarPoints, playSingleAudio, stopPlayback]);
    
    // --- 滚动监听 ---
    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const isBottom = scrollTop + clientHeight >= scrollHeight - 20;
        if (isBottom && !canGoNext) {
            setCanGoNext(true);
        }
    };

    // --- 导航逻辑 (按钮点击) ---
    const navigate = useCallback((direction) => {
        // 如果是下一页，必须满足条件
        if (direction > 0 && !canGoNext) return;

        lastDirection.current = direction;
        setCurrentIndex(prev => {
            const newIndex = prev + direction;
            if (newIndex >= 0 && newIndex < grammarPoints.length) return newIndex;
            if (newIndex >= grammarPoints.length) onComplete();
            return prev;
        });
    }, [grammarPoints.length, onComplete, canGoNext]);

    const transitions = useTransition(currentIndex, {
        key: grammarPoints[currentIndex]?.id || currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '40px' : '-40px'})` },
        enter: { opacity: 1, transform: 'translateY(0px)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-40px' : '40px'})`, position: 'absolute' },
        config: { mass: 1, tension: 220, friction: 26 },
    });
    
    // --- 渲染文本辅助函数 ---
    const renderMixedText = (text, isPattern = false) => {
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
            let formattedLine = line
                .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #2563eb; background: rgba(37, 99, 235, 0.1); padding: 0 4px; border-radius: 4px;">$1</strong>')
                .replace(/❌/g, '<span style="color: #ef4444; margin-right: 4px;">❌</span>')
                .replace(/✅/g, '<span style="color: #10b981; margin-right: 4px;">✅</span>')
                .replace(/⚠️/g, '<span style="margin-right: 4px;">⚠️</span>');

            return <p key={index} style={styles.explanationText} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
        });
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
                                    <h2 style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                </div>
                                
                                {gp.pattern && (
                                    <div style={styles.patternBox}>
                                        <div style={styles.boxLabel}>核心公式</div>
                                        <div style={styles.patternContent}>{renderMixedText(gp.pattern, true)}</div>
                                    </div>
                                )}
                                
                                {/* 💡 详解部分 */}
                                <div style={styles.sectionContainer}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionTitleText}>💡 详解</span>
                                        <button 
                                            className={`play-button ${activeAudio?.type === `narration_${gp.id}` ? 'playing' : ''}`} 
                                            style={styles.playButton} 
                                            onClick={() => handlePlayButtonClick(gp.narrationScript, `narration_${gp.id}`)}
                                        >
                                            {isLoadingAudio && activeAudio?.type === `narration_${gp.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `narration_${gp.id}` ? <FaStop/> : <FaVolumeUp/>) }
                                        </button>
                                    </div>
                                    <div style={styles.textBlock}>
                                        {renderExplanation(gp.visibleExplanation)}
                                    </div>
                                </div>

                                {/* ⚠️ 易错点 */}
                                {gp.attention && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <span style={{...styles.sectionTitleText, color: '#ef4444'}}>⚠️ 易错点</span>
                                        </div>
                                        <div style={{...styles.textBlock, background: '#fff1f2', border: '1px solid #fecaca'}}>
                                            {renderExplanation(gp.attention)}
                                        </div>
                                    </div>
                                )}

                                {/* 📌 用法 */}
                                {gp.usage && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <span style={{...styles.sectionTitleText, color: '#059669'}}>📌 什么时候用？</span>
                                        </div>
                                        <div style={{...styles.textBlock, background: '#ecfdf5', border: '1px solid #a7f3d0'}}>
                                            {renderExplanation(gp.usage)}
                                        </div>
                                    </div>
                                )}
                                
                                {/* 🗣️ 例句部分 */}
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
                                                <button 
                                                    className={`play-button ${activeAudio?.type === `example_${ex.id}` ? 'playing' : ''}`}
                                                    style={styles.playButtonSmall} 
                                                    onClick={() => handlePlayButtonClick(ex.narrationScript || ex.sentence, `example_${ex.id}`)}
                                                >
                                                     {isLoadingAudio && activeAudio?.type === `example_${ex.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `example_${ex.id}` ? <FaStop/> : <FaVolumeUp/>) }
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 底部留白，防止按钮遮挡内容 */}
                                <div style={{ height: '100px' }}></div>
                            </div>
                        </div>

                        {/* --- 导航按钮 (悬浮融入背景) --- */}
                        <div style={styles.navContainer}>
                            {/* 上一页按钮 */}
                            <div 
                                style={{
                                    ...styles.navBtn, 
                                    opacity: i === 0 ? 0 : 1, 
                                    pointerEvents: i === 0 ? 'none' : 'auto'
                                }}
                                onClick={() => navigate(-1)}
                            >
                                <FaChevronLeft size={24} color="#64748b" />
                            </div>

                            {/* 下一页按钮 */}
                            <div 
                                style={{
                                    ...styles.navBtn, 
                                    // 没滚到底部时：半透明 (0.4)，滚到底部后：实心 (1)
                                    opacity: canGoNext ? 1 : 0.4,
                                    transform: canGoNext ? 'scale(1.1)' : 'scale(1)',
                                    boxShadow: canGoNext ? '0 4px 15px rgba(37, 99, 235, 0.3)' : 'none',
                                    backgroundColor: canGoNext ? '#2563eb' : 'rgba(255,255,255,0.5)'
                                }}
                                onClick={() => navigate(1)}
                            >
                                <FaChevronRight size={24} color={canGoNext ? '#ffffff' : '#64748b'} />
                            </div>
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
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #ffffff 0%, #f0f4f8 100%)', willChange: 'transform, opacity' },
    scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: '0 20px' },
    contentWrapper: { maxWidth: '800px', margin: '0 auto', paddingTop: 'env(safe-area-inset-top, 20px)', minHeight: '100%' },
    
    header: { textAlign: 'center', marginTop: '20px', marginBottom: '20px', position: 'relative' },
    grammarPointTitle: { fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    
    patternBox: { background: '#ffffff', borderRadius: '16px', padding: '20px', marginBottom: '24px', boxShadow: '0 4px 20px rgba(148, 163, 184, 0.15)', border: '1px solid #e2e8f0', textAlign: 'center' },
    boxLabel: { fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '10px', fontWeight: '600' },
    patternContent: { fontSize: '1.2rem', fontWeight: 'bold', lineHeight: 1.6 },
    patternChinese: { color: '#2563eb', margin: '0 4px' }, 
    patternMyanmar: { color: '#059669', margin: '0 4px' }, 
    
    sectionContainer: { marginBottom: '24px' },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    sectionTitleText: { fontSize: '1rem', fontWeight: '700', color: '#334155' },
    
    // --- 播放按钮样式 ---
    playButton: { 
        background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: 'none', borderRadius: '50%', 
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        transition: 'all 0.2s ease', position: 'relative'
    },
    playButtonSmall: { 
        background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '50%', 
        width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease', position: 'relative'
    },
    
    textBlock: { background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.8)' },
    explanationText: { fontSize: '1rem', lineHeight: 1.7, color: '#475569', margin: '0 0 10px 0', textAlign: 'justify' },
    
    examplesList: { display: 'flex', flexDirection: 'column', gap: '16px' },
    exampleItem: { background: '#ffffff', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' },
    exampleMain: { flex: 1 },
    exampleSentence: { fontSize: '1.1rem', fontWeight: 500, marginBottom: '4px', lineHeight: 1.5 },
    exampleTranslation: { fontSize: '0.9rem', color: '#64748b', fontStyle: 'normal' },
    
    textChinese: { color: '#1e293b' }, 
    textBurmese: { color: '#059669' }, 

    // --- 导航按钮容器 (底部悬浮) ---
    navContainer: {
        position: 'absolute',
        bottom: '30px',
        left: '0',
        right: '0',
        padding: '0 30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pointerEvents: 'none', // 让中间区域可以点击穿透
        zIndex: 20
    },
    navBtn: {
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        pointerEvents: 'auto', // 按钮自身可点击
        backgroundColor: 'rgba(255, 255, 255, 0.8)', // 默认背景
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' // 弹性动画
    }
};

const styleTag = document.getElementById('grammar-player-styles') || document.createElement('style');
styleTag.id = 'grammar-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    
    .play-button:active { transform: scale(0.9); }

    /* 播放时的波纹呼吸动画 */
    .playing {
        animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        background-color: rgba(37, 99, 235, 0.2) !important;
        color: #2563eb !important;
        border-color: #2563eb !important;
    }
    
    @keyframes pulse-ring {
        0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5); }
        70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
        100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
    }
`;
if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);

export default GrammarPointPlayer;
