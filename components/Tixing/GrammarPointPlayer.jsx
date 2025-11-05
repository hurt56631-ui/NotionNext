// components/Tixing/GrammarPointPlayer.jsx (V3 - 最终修复版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl, Howler } from 'howler';
import { FaPlay, FaPause, FaSpinner, FaChevronDown } from 'react-icons/fa';

// --- 辅助函数 ---
const generateRubyHTML = (text) => {
  if (!text) return '';
  // 返回 HTML 字符串，用于 dangerouslySetInnerHTML
  return text.replace(/[\u4e00-\u9fa5]/g, char => `<ruby>${char}<rt>${pinyinConverter(char)}</rt></ruby>`);
};

// --- 主组件 ---
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) return null;

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    
    const [settings] = useState({
      chineseVoice: 'zh-CN-XiaomengNeural',
      myanmarVoice: 'my-MM-NilarNeural',
    });
    
    const [activeAudio, setActiveAudio] = useState(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [subtitles, setSubtitles] = useState({ original: [], translation: '' });
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const isPlayingRef = useRef(false);
    const progressIntervalRef = useRef(null);

    const stopPlayback = useCallback(() => {
        Howler.stop();
        isPlayingRef.current = false;
        setActiveAudio(null);
        setIsLoadingAudio(false);
        setHighlightedIndex(-1);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }, []);

    const playMixedAudio = useCallback((text, translation) => {
        if (isPlayingRef.current) {
            stopPlayback();
            return;
        }

        if (!text) return;

        const parts = text.split(/(\{\{.*?\}\})/g).filter(Boolean).map(part => {
            const isChinese = part.startsWith('{{') && part.endsWith('}}');
            return {
                text: isChinese ? part.slice(2, -2) : part,
                isChinese: isChinese,
            };
        });

        setSubtitles({ original: parts, translation });
        isPlayingRef.current = true;
        setActiveAudio({ text });
        setIsLoadingAudio(true);
        setHighlightedIndex(-1);

        let sounds = [];
        let loadedCount = 0;

        const startPlayback = () => {
            if (!isPlayingRef.current) return;
            setIsLoadingAudio(false);
            
            let currentSoundIndex = 0;

            const playNext = () => {
                if (!isPlayingRef.current || currentSoundIndex >= sounds.length) {
                    stopPlayback();
                    return;
                }
                const sound = sounds[currentSoundIndex];
                
                sound.once('play', () => {
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = setInterval(() => {
                        if (sound.playing()) {
                            setHighlightedIndex(currentSoundIndex);
                        }
                    }, 100);
                });
                
                sound.once('end', () => {
                    clearInterval(progressIntervalRef.current);
                    currentSoundIndex++;
                    playNext();
                });

                sound.play();
            };
            playNext();
        };

        parts.forEach((part, index) => {
            const voice = part.isChinese ? settings.chineseVoice : settings.myanmarVoice;
            const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(part.text)}&v=${voice}`;
            
            sounds[index] = new Howl({
                src: [url],
                html5: true,
                onload: () => {
                    loadedCount++;
                    if (loadedCount === parts.length) startPlayback();
                },
                onloaderror: () => {
                    console.error(`语音片段加载失败: ${part.text}`);
                    loadedCount++;
                    if (loadedCount === parts.length) startPlayback();
                }
            });
        });

    }, [settings, stopPlayback]);

    const handlePlayButtonClick = (text, translation) => {
        if (activeAudio?.text === text) {
            stopPlayback();
        } else {
            // 先停止当前播放，再开始新的
            if (isPlayingRef.current) {
                stopPlayback();
                setTimeout(() => playMixedAudio(text, translation), 100); // 短暂延迟确保完全停止
            } else {
                playMixedAudio(text, translation);
            }
        }
    };
    
    useEffect(() => {
        stopPlayback();
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playMixedAudio(gp.narrationScript, ""); // 旁白没有翻译字幕
            }
        }, 800);
        return () => {
            clearTimeout(timer);
            stopPlayback();
        };
    }, [currentIndex, grammarPoints, playMixedAudio, stopPlayback]);

    const navigate = useCallback((direction) => {
        lastDirection.current = direction;
        setCurrentIndex(prev => {
            const newIndex = prev + direction;
            if (newIndex >= 0 && newIndex < grammarPoints.length) return newIndex;
            if (newIndex >= grammarPoints.length) onComplete();
            return prev;
        });
    }, [grammarPoints.length, onComplete]);

    const swipeHandlers = useSwipeable({
        onSwipedUp: () => navigate(1),
        onSwipedDown: () => navigate(-1),
        preventDefaultTouchmoveEvent: true,
        trackMouse: true,
    });

    const transitions = useTransition(currentIndex, {
        key: grammarPoints[currentIndex]?.id || currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100vh' : '-100vh'})` },
        enter: { opacity: 1, transform: 'translateY(0vh)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100vh' : '100vh'})`, position: 'absolute' },
        config: { mass: 1, tension: 280, friction: 30 },
    });
    
    // ✅ 【核心修复】使用辅助函数来渲染混合文本，并修复 style 属性
    const renderMixedText = (text) => {
        return text.split(/(\{\{.*?\}\})/g).filter(Boolean).map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            return (
                <span key={pIndex} style={isChinese ? styles.textChinese : styles.textBurmese}>
                    {isChinese 
                        ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} /> 
                        : content
                    }
                </span>
            );
        });
    };

    const content = (
        <div style={styles.fullScreen} {...swipeHandlers}>
            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;
                const bgStyle = { backgroundImage: gp.background?.imageUrl ? `url(${gp.background.imageUrl})` : `linear-gradient(135deg, ${gp.background?.gradientStart || '#2d3748'} 0%, ${gp.background?.gradientEnd || '#1a202c'} 100%)` };

                return (
                    <animated.div style={{ ...styles.page, ...bgStyle, ...style }}>
                        <div style={styles.contentWrapper}>
                            <div style={styles.header}>
                                <div style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                <div style={styles.pattern}>{gp.pattern}</div>
                            </div>
                            <div style={styles.explanationSection}>
                                <div style={styles.sectionTitle}>
                                    <span>💡 语法解释</span>
                                    <button style={styles.playButton} onClick={() => handlePlayButtonClick(gp.narrationScript, "")}>
                                        {isLoadingAudio && activeAudio?.text === gp.narrationScript ? <FaSpinner className="spin" /> : (activeAudio?.text === gp.narrationScript ? <FaPause/> : <FaPlay/>) }
                                    </button>
                                </div>
                                <p style={styles.explanationText}>{gp.visibleExplanation}</p>
                            </div>
                            <div style={styles.examplesSection}>
                                <div style={styles.sectionTitle}>✍️ 例句示范</div>
                                <div style={styles.examplesList}>
                                    {gp.examples.map((ex, index) => (
                                        <div key={ex.id} style={styles.exampleItem}>
                                            <div style={styles.exampleSentence}>
                                                <span style={styles.exampleNumber}>{index + 1}.</span>
                                                {/* ✅ 使用修复后的渲染逻辑 */}
                                                {renderMixedText(ex.sentence)}
                                            </div>
                                            <div style={styles.exampleTranslation}>{ex.translation}</div>
                                            <button style={styles.playButton} onClick={() => handlePlayButtonClick(ex.sentence, ex.translation)}>
                                                {isLoadingAudio && activeAudio?.text === ex.sentence ? <FaSpinner className="spin" /> : (activeAudio?.text === ex.sentence ? <FaPause/> : <FaPlay/>) }
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {activeAudio && (
                             <div style={styles.subtitleContainer}>
                                <p style={styles.subtitleLine}>
                                    {subtitles.original.map((part, index) => (
                                        <span key={index} style={{...styles.subtitlePart, color: highlightedIndex === index ? '#facc15' : 'white'}}>
                                            {part.text}
                                        </span>
                                    ))}
                                </p>
                                {subtitles.translation && <p style={styles.subtitleTranslation}>{subtitles.translation}</p>}
                            </div>
                        )}
                        
                        <div style={styles.footer} onClick={() => navigate(1)}>
                            <FaChevronDown />
                            <span>上滑或点击切换</span>
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
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' },
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundSize: 'cover', backgroundPosition: 'center', willChange: 'transform, opacity' },
    contentWrapper: { width: '100%', maxWidth: '500px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', color: 'white' },
    header: { textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.6)' },
    grammarPointTitle: { fontSize: '2.5rem', fontWeight: 'bold' },
    pattern: { fontSize: '1.2rem', color: '#a0aec0', fontFamily: 'monospace', marginTop: '8px' },
    explanationSection: { background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '16px' },
    sectionTitle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: '#fcd34d', marginBottom: '12px' },
    explanationText: { fontSize: '1rem', lineHeight: 1.7, color: '#e2e8f0', margin: 0, textAlign: 'left' },
    examplesSection: { background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '16px' },
    examplesList: { display: 'flex', flexDirection: 'column', gap: '20px' },
    exampleItem: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '8px 16px' },
    exampleNumber: { color: '#a0aec0', marginRight: '8px' },
    exampleSentence: { gridColumn: '1 / 2', fontSize: '1.5rem', fontWeight: 500, lineHeight: 1.6, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
    exampleTranslation: { gridColumn: '1 / 2', fontSize: '1rem', color: '#cbd5e0', fontStyle: 'italic', textAlign: 'left' },
    playButton: { gridColumn: '2 / 3', gridRow: '1 / 3', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' },
    footer: { position: 'absolute', bottom: '20px', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' },
    textChinese: { color: 'white', margin: '0 2px' },
    textBurmese: { color: '#81e6d9' },
    subtitleContainer: { position: 'absolute', bottom: '80px', left: '20px', right: '20px', textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.7)', pointerEvents: 'none' },
    subtitleLine: { fontSize: '1.8rem', fontWeight: '500', margin: '0 0 8px 0' },
    subtitlePart: { transition: 'color 0.2s ease-in-out' },
    subtitleTranslation: { fontSize: '1.1rem', color: '#cbd5e0' },
};

export default GrammarPointPlayer;
