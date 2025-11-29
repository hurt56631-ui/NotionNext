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
  // 排除掉HTML标签，只给汉字加拼音
  return text.replace(/[\u4e00-\u9fa5]+/g, word => {
      const pinyin = pinyinConverter(word);
      return `<ruby>${word}<rt>${pinyin}</rt></ruby>`;
  });
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
    
    // 音频状态
    const [activeAudio, setActiveAudio] = useState(null); 
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const currentSoundRef = useRef(null); 

    // 滚动交互状态
    const contentRef = useRef(null);
    const [canGoNext, setCanGoNext] = useState(false); // 控制“下一条”按钮是否激活

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

        // 去除HTML标签和辅助符号，只留纯文本给TTS朗读
        let cleanText = text.replace(/<[^>]+>/g, ''); 
        cleanText = cleanText.replace(/\{\{| \}\}|\}\}/g, '');
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
        setCanGoNext(false); 

        // 自动播放解说
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playSingleAudio(gp.narrationScript, `narration_${gp.id}`);
            }
            // 如果内容很短，无需滚动，直接激活下一页
            if (contentRef.current) {
                const { scrollHeight, clientHeight } = contentRef.current;
                if (scrollHeight <= clientHeight + 50) { 
                    setCanGoNext(true);
                }
            }
        }, 600);
        
        return () => { clearTimeout(timer); stopPlayback(); };
    }, [currentIndex, grammarPoints, playSingleAudio, stopPlayback]);
    
    // --- 滚动监听 (到底部激活按钮) ---
    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const isBottom = scrollTop + clientHeight >= scrollHeight - 30;
        if (isBottom && !canGoNext) {
            setCanGoNext(true);
        }
    };

    // --- 按钮点击切换逻辑 ---
    const handleNext = () => {
        if (!canGoNext) return; // 如果还没读完（没滚到底），不让点
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
        from: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '100%' : '-100%'})` }, // 改为左右平移动画
        enter: { opacity: 1, transform: 'translateX(0%)' },
        leave: { opacity: 0, transform: `translateX(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
        config: { mass: 1, tension: 280, friction: 30 },
    });
    
    // --- 渲染文本辅助函数 ---
    const renderMixedText = (text, isPattern = false) => {
        const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        return parts.map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            let partStyle = isPattern 
                ? (isChinese ? styles.patternChinese : styles.patternMyanmar)
                : (isChinese ? styles.textChinese : styles.textBurmese);
            
            return (
                <span key={pIndex} style={partStyle}>
                    {isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} /> : content}
                </span>
            );
        });
    };

    // --- 富文本渲染 (支持HTML标签) ---
    const renderRichExplanation = (htmlContent) => {
        if (!htmlContent) return null;
        // 这里直接渲染HTML，支持数据中的 <br>, <strong>, <div style="..."> 等标签
        return <div style={styles.richTextContainer} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
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
                                        <div style={styles.boxLabel}>核心公式</div>
                                        <div style={styles.patternContent}>{renderMixedText(gp.pattern, true)}</div>
                                    </div>
                                )}
                                
                                {/* 💡 语法详解 (富文本) */}
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
                                        {/* 使用新的富文本渲染方法 */}
                                        {renderRichExplanation(gp.visibleExplanation)}
                                    </div>
                                </div>

                                {/* ⚠️ 易错点 */}
                                {gp.attention && (
                                    <div style={styles.sectionContainer}>
                                        <div style={styles.sectionHeader}>
                                            <span style={{...styles.sectionTitleText, color: '#ef4444'}}>⚠️ 易错点</span>
                                        </div>
                                        <div style={{...styles.textBlock, background: '#fff1f2', border: '1px solid #fecaca'}}>
                                            {renderRichExplanation(gp.attention)}
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
                                            {renderRichExplanation(gp.usage)}
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

                                <div style={{ height: '100px' }}></div>
                            </div>
                        </div>

                        {/* --- 底部按钮控制栏 --- */}
                        <div style={styles.bottomBar}>
                            {/* 上一条按钮 */}
                            <button 
                                style={{
                                    ...styles.navButton, 
                                    visibility: i === 0 ? 'hidden' : 'visible',
                                    background: '#f1f5f9', color: '#64748b'
                                }}
                                onClick={handlePrev}
                            >
                                <FaChevronLeft /> 上一条
                            </button>

                            {/* 下一条按钮 */}
                            <button 
                                style={{
                                    ...styles.navButton,
                                    background: canGoNext ? '#2563eb' : '#cbd5e1',
                                    color: 'white',
                                    transform: canGoNext ? 'scale(1.05)' : 'scale(1)',
                                    boxShadow: canGoNext ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
                                    opacity: canGoNext ? 1 : 0.7
                                }}
                                onClick={handleNext}
                                disabled={!canGoNext}
                            >
                                {i === grammarPoints.length - 1 ? '完成学习' : '下一条'} <FaChevronRight />
                            </button>
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
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white', willChange: 'transform, opacity' },
    scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: '0 20px' },
    contentWrapper: { maxWidth: '800px', margin: '0 auto', paddingTop: 'env(safe-area-inset-top, 20px)', minHeight: '100%' },
    
    header: { textAlign: 'center', marginTop: '20px', marginBottom: '20px' },
    grammarPointTitle: { fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', margin: 0, lineHeight: 1.3 },
    
    patternBox: { background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid #e2e8f0', textAlign: 'center' },
    boxLabel: { fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', fontWeight: '600', letterSpacing: '1px' },
    patternContent: { fontSize: '1.2rem', fontWeight: 'bold' },
    patternChinese: { color: '#2563eb', margin: '0 4px' }, 
    patternMyanmar: { color: '#059669', margin: '0 4px' }, 
    
    sectionContainer: { marginBottom: '24px' },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    sectionTitleText: { fontSize: '1rem', fontWeight: '700', color: '#334155' },
    
    playButton: { 
        background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: 'none', borderRadius: '50%', 
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
    },
    playButtonSmall: { 
        background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '50%', 
        width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
    },
    
    // --- 富文本容器样式 ---
    textBlock: { background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', lineHeight: 1.6, color: '#475569' },
    richTextContainer: { whiteSpace: 'normal' }, // 允许正常换行

    examplesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    exampleItem: { background: '#f8fafc', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #e2e8f0' },
    exampleMain: { flex: 1 },
    exampleSentence: { fontSize: '1.1rem', fontWeight: 500, marginBottom: '4px', lineHeight: 1.5 },
    exampleTranslation: { fontSize: '0.9rem', color: '#64748b' },
    
    textChinese: { color: '#1e293b' }, 
    textBurmese: { color: '#059669' }, 

    // --- 底部固定按钮栏 ---
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px',
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)',
        borderTop: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px',
        paddingBottom: 'env(safe-area-inset-bottom, 10px)'
    },
    navButton: {
        border: 'none', borderRadius: '30px', padding: '10px 20px', fontSize: '0.95rem', fontWeight: '600',
        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
};

const styleTag = document.getElementById('grammar-player-styles') || document.createElement('style');
styleTag.id = 'grammar-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .play-button:active { transform: scale(0.9); }
    .playing { animation: pulse-ring 2s infinite; background-color: rgba(37, 99, 235, 0.2) !important; color: #2563eb !important; border-color: #2563eb !important; }
    @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
    
    /* 富文本内部样式，模拟文档排版 */
    .indent-level-1 { margin-left: 20px; color: #555; font-size: 0.95em; margin-bottom: 5px; }
    .indent-level-2 { margin-left: 40px; color: #777; font-size: 0.9em; margin-bottom: 5px; }
    .highlight-bold { font-weight: bold; color: #333; }
`;
if (!document.getElementById('grammar-player-styles')) document.head.appendChild(styleTag);

export default GrammarPointPlayer;
