// components/Tixing/GrammarPointPlayer.jsx (V8 - 滚动字幕与最终稳定性修复版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl } from 'howler';
import { FaVolumeUp, FaStopCircle, FaSpinner, FaChevronUp } from 'react-icons/fa';

// --- 辅助函数 ---
const generateRubyHTML = (text) => {
  if (!text) return '';
  return text.replace(/[\u4e00-\u9fa5]/g, char => `<ruby>${char}<rt>${pinyinConverter(char)}</rt></ruby>`);
};

// --- 主组件 ---
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
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

        return () => {
            metaTags.forEach(tagInfo => {
                const meta = document.getElementById(`gp-player-meta-${tagInfo.name}`);
                if (meta) document.head.removeChild(meta);
            });
        };
    }, []);

    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) return null;

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    
    const [settings] = useState({
      chineseVoice: 'zh-CN-XiaomengNeural',
      myanmarVoice: 'my-MM-NilarNeural',
    });
    
    const [activeAudio, setActiveAudio] = useState(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    
    // 【字幕滚动系统】
    const [subtitleHistory, setSubtitleHistory] = useState([]);
    const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(-1);

    const audioQueueRef = useRef([]);
    const audioCache = useRef({});
    const playbackIdRef = useRef(0);

    const stopPlayback = useCallback(() => {
        playbackIdRef.current += 1;
        audioQueueRef.current.forEach(sound => sound.stop());
        audioQueueRef.current = [];
        setActiveAudio(null);
        setIsLoadingAudio(false);
        setHighlightedIndex(-1);
        // 清空字幕历史记录
        setSubtitleHistory([]);
        setCurrentSubtitleIndex(-1);
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

    const playMixedAudio = useCallback((text, translation, type) => {
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

        // 【滚动字幕逻辑】将新字幕添加到历史记录
        const newSubtitle = {
            id: currentPlaybackId,
            original: parts,
            translation: translation
        };
        setSubtitleHistory(prev => [...prev, newSubtitle]);
        setCurrentSubtitleIndex(prev => prev + 1);

        setActiveAudio({ text, type });
        setIsLoadingAudio(true);
        setHighlightedIndex(-1);

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
                setHighlightedIndex(currentSoundIndex);
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
            const voice = part.isChinese ? settings.chineseVoice : settings.myanmarVoice;
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
    }, [settings, stopPlayback]);
    
    const handlePlayButtonClick = (text, translation, type) => {
        if (activeAudio?.type === type) {
            stopPlayback();
        } else {
            // 在播放新音频前，清空之前的字幕历史
            setSubtitleHistory([]);
            setCurrentSubtitleIndex(-1);
            // 使用 setTimeout 确保状态更新后再播放，避免滚动动画冲突
            setTimeout(() => playMixedAudio(text, translation, type), 50);
        }
    };
    
    useEffect(() => {
        stopPlayback();
        const timer = setTimeout(() => {
            const gp = grammarPoints[currentIndex];
            if (gp?.narrationScript) {
                playMixedAudio(gp.narrationScript, "", `narration_${gp.id}`);
            }
        }, 800);
        return () => {
            clearTimeout(timer);
            stopPlayback();
        };
    }, [currentIndex, grammarPoints, playMixedAudio, stopPlayback]);
    
    useEffect(() => {
        const preloadAudioFor = (index) => {
            const gp = grammarPoints[index];
            if (!gp) return;
            const textsToPreload = [gp.narrationScript, ...gp.examples.map(ex => ex.narrationScript || ex.sentence)];
            textsToPreload.filter(Boolean).forEach(text => {
                const parts = parseTextForAudio(text);
                parts.forEach(part => {
                    const voice = part.isChinese ? settings.chineseVoice : settings.myanmarVoice;
                    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(part.text)}&v=${voice}`;
                    if (!audioCache.current[url]) {
                        audioCache.current[url] = new Howl({ src: [url], preload: true });
                    }
                });
            });
        };
        preloadAudioFor(currentIndex);
        if (currentIndex + 1 < grammarPoints.length) {
            preloadAudioFor(currentIndex + 1);
        }
    }, [currentIndex, grammarPoints, settings.chineseVoice, settings.myanmarVoice]);

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
    
    const renderMixedText = (text, pattern = "") => {
        const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        const highlightIndices = new Set();
        
        const mappedPartsWithIndices = parts.map((p, i) => ({ text: p, index: i }));
        const chineseParts = mappedPartsWithIndices.filter(p => p.text.startsWith('{{'));
        
        const zaiStandaloneIndex = chineseParts.findIndex(p => p.text === '{{在}}');
        const zaiNarIndex = chineseParts.findIndex(p => p.text === '{{在哪儿}}');

        if (zaiStandaloneIndex !== -1) {
            highlightIndices.add(chineseParts[zaiStandaloneIndex].index);
            if (zaiStandaloneIndex + 1 < chineseParts.length) {
                highlightIndices.add(chineseParts[zaiStandaloneIndex + 1].index);
            }
        } else if (zaiNarIndex !== -1) {
            highlightIndices.add(chineseParts[zaiNarIndex].index);
        }

        return parts.map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            const isPunctuation = /^[,\.!?\s\u3000-\u303F\uff00-\uffef]+$/.test(content);
            let partStyle = (isChinese || isPunctuation) ? styles.textChinese : styles.textBurmese;
            
            if (highlightIndices.has(pIndex)) {
                partStyle = { ...partStyle, ...styles.textHighlight };
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
            if (line.trim() === '') return <div key={index} style={{height: '8px'}} />;
            const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return <p key={index} style={styles.explanationText} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
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
                                {gp.pattern && <div style={styles.pattern}>{gp.pattern}</div>}
                            </div>
                            
                            <div style={styles.sectionContainer}>
                                <div style={styles.sectionTitle}>
                                    <span>💡 语法解释</span>
                                    <button className="play-button" style={styles.playButton} onClick={() => handlePlayButtonClick(gp.narrationScript, "", `narration_${gp.id}`)}>
                                        {isLoadingAudio && activeAudio?.type === `narration_${gp.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `narration_${gp.id}` ? <FaStopCircle/> : <FaVolumeUp/>) }
                                    </button>
                                </div>
                                {renderExplanation(gp.visibleExplanation)}
                            </div>
                            
                            <div style={styles.sectionContainer}>
                                <div style={styles.sectionTitle}>✍️ 例句示范</div>
                                <div style={styles.examplesList}>
                                    {gp.examples.map((ex, index) => (
                                        <div key={ex.id} style={styles.exampleItem}>
                                            <div style={styles.exampleSentence}>
                                                <span style={styles.exampleNumber}>{index + 1}.</span>
                                                {renderMixedText(ex.sentence, gp.pattern)}
                                            </div>
                                            <div style={styles.exampleTranslation}>{ex.translation}</div>
                                            <button className="play-button" style={styles.playButton} onClick={() => handlePlayButtonClick(ex.narrationScript || ex.sentence, ex.translation, `example_${ex.id}`)}>
                                                 {isLoadingAudio && activeAudio?.type === `example_${ex.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `example_${ex.id}` ? <FaStopCircle/> : <FaVolumeUp/>) }
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 【滚动字幕渲染】 */}
                        <div style={styles.subtitleContainer}>
                            <div style={{...styles.subtitleScroller, transform: `translateY(-${currentSubtitleIndex * 80}px)`}}>
                                {subtitleHistory.map((sub, subIndex) => (
                                    <div key={sub.id} style={styles.subtitleEntry}>
                                        <p style={styles.subtitleLine}>
                                            {sub.original.map((part, index) => (
                                                <span key={index} style={{
                                                    ...styles.subtitlePart, 
                                                    color: part.isChinese 
                                                        ? (activeAudio && sub.id === playbackIdRef.current && highlightedIndex === index ? '#fde047' : 'white') 
                                                        : (activeAudio && sub.id === playbackIdRef.current && highlightedIndex === index ? '#fde047' : '#5eead4')
                                                }}>
                                                    {part.text}
                                                </span>
                                            ))}
                                        </p>
                                        {sub.translation && <p style={styles.subtitleTranslation}>{sub.translation}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div style={styles.footer} onClick={() => navigate(1)}>
                            <div className="bounce-icon"><FaChevronUp size="1.2em" /></div>
                            <span>上滑查看下一个</span>
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
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', background: '#111827' },
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundSize: 'cover', backgroundPosition: 'center', willChange: 'transform, opacity' },
    contentWrapper: { width: '100%', maxWidth: '500px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', color: 'white', paddingTop: 'env(safe-area-inset-top, 20px)', paddingBottom: '160px' },
    header: { textAlign: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' },
    grammarPointTitle: { fontSize: '2.2rem', fontWeight: 'bold' },
    pattern: { fontSize: '1rem', color: '#7dd3fc', fontFamily: 'monospace', marginTop: '10px', letterSpacing: '1px' },
    
    sectionContainer: { width: '100%' },
    
    sectionTitle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem', fontWeight: 'bold', color: '#fcd34d', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.15)' },
    explanationText: { fontSize: '0.9rem', lineHeight: 1.7, color: '#d1d5db', margin: '0 0 8px 0', textAlign: 'left' },
    examplesList: { display: 'flex', flexDirection: 'column', gap: '20px' },
    exampleItem: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '8px 16px' },
    exampleNumber: { color: '#9ca3af', marginRight: '8px', fontSize: '0.9rem' },
    exampleSentence: { gridColumn: '1 / 2', fontSize: '1.3rem', fontWeight: 500, lineHeight: 1.6, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
    exampleTranslation: { gridColumn: '1 / 2', fontSize: '0.85rem', color: '#e5e7eb', fontStyle: 'italic', textAlign: 'left', marginTop: '4px' },
    
    playButton: { gridColumn: '2 / 3', gridRow: '1 / 3', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.3)', color: 'white', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 0.2s, transform 0.2s' },
    
    footer: { position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 30px)', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' },
    textChinese: { color: 'white', margin: '0 1px' },
    textBurmese: { color: '#5eead4', margin: '0 1px' },
    textHighlight: { backgroundColor: 'rgba(253, 224, 71, 0.2)', color: '#fde047', fontWeight: 'bold', padding: '1px 4px', borderRadius: '4px' },
    
    // 【滚动字幕样式】
    subtitleContainer: { position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)', left: '20px', right: '20px', height: '80px', pointerEvents: 'none', overflow: 'hidden' },
    subtitleScroller: { transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' },
    subtitleEntry: { height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' },
    subtitleLine: { fontSize: '1.3rem', fontWeight: '500', margin: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
    subtitlePart: { transition: 'color 0.2s ease-in-out', margin: '0 2px' },
    subtitleTranslation: { fontSize: '0.9rem', color: '#d1d5db', textAlign: 'center', marginTop: '8px' },
};

const styleTag = document.getElementById('grammar-player-styles') || document.createElement('style');
styleTag.id = 'grammar-player-styles';
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .play-button:hover {
        background-color: rgba(255, 255, 255, 0.15);
        transform: scale(1.1);
    }
    
    .bounce-icon { animation: bounce 2s infinite; }
    @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-10px); }
        60% { transform: translateY(-5px); }
    }
`;
if (!document.getElementById('grammar-player-styles')) {
    document.head.appendChild(styleTag);
}

export default GrammarPointPlayer;
