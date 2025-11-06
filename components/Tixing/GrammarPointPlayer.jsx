// components/Tixing/GrammarPointPlayer.jsx (V4 - 性能和体验优化版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl, Howler } from 'howler';
import { FaPlay, FaPause, FaSpinner, FaChevronUp } from 'react-icons/fa';

// --- 辅助函数 ---
const generateRubyHTML = (text) => {
  if (!text) return '';
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
    
    const [activeAudio, setActiveAudio] = useState(null); // 存储当前活动音频的原始文本
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [subtitles, setSubtitles] = useState({ original: [], translation: '' });
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const isPlayingRef = useRef(false);
    const audioQueueRef = useRef([]); // 用于存储当前播放的 Howl 实例队列
    const audioCache = useRef({}); // 【新增】用于缓存预加载的音频

    // --- 音频播放核心逻辑 ---

    const stopPlayback = useCallback(() => {
        audioQueueRef.current.forEach(sound => sound.stop());
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        setActiveAudio(null);
        setIsLoadingAudio(false);
        setHighlightedIndex(-1);
        setSubtitles({ original: [], translation: '' }); // 清空字幕
    }, []);
    
    // 【新增】文本解析函数，用于分离语言和标点
    const parseTextForAudio = (text) => {
        if (!text) return [];
        // 使用 match 来更好地分割中/缅文块和符号
        const matchedParts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        
        return matchedParts
            .map(part => {
                const isChinese = part.startsWith('{{') && part.endsWith('}}');
                const content = isChinese ? part.slice(2, -2) : part;
                // 过滤掉纯粹的空白符，避免无效的API请求
                if (content.trim() === '') return null;
                return { text: content, isChinese };
            })
            .filter(Boolean); // 过滤掉 null
    };


    const playMixedAudio = useCallback((text, translation, type) => {
        if (isPlayingRef.current) {
            stopPlayback();
            // 如果点击的是同一个按钮，则行为是“停止”，否则延迟后播放新的
            if (activeAudio?.type === type) return;
        }

        if (!text) return;
        
        // 使用新的解析函数
        const parts = parseTextForAudio(text);
        if (parts.length === 0) return;

        setSubtitles({ original: parts, translation });
        isPlayingRef.current = true;
        setActiveAudio({ text, type });
        setIsLoadingAudio(true);
        setHighlightedIndex(-1);

        let sounds = [];
        let loadedCount = 0;

        const startPlayback = () => {
            if (!isPlayingRef.current) return;
            setIsLoadingAudio(false);
            audioQueueRef.current = sounds; // 将准备好的 sound 队列赋给 ref
            
            let currentSoundIndex = 0;

            const playNext = () => {
                if (!isPlayingRef.current || currentSoundIndex >= sounds.length) {
                    stopPlayback();
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
            // 【修复】确保正确的语音选择
            const voice = part.isChinese ? settings.chineseVoice : settings.myanmarVoice;
            const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(part.text)}&v=${voice}`;
            
            // 检查缓存
            if (audioCache.current[url] && audioCache.current[url].state() === 'loaded') {
                sounds[index] = audioCache.current[url];
                loadedCount++;
                if (loadedCount === parts.length) startPlayback();
            } else {
                const sound = new Howl({
                    src: [url],
                    html5: true,
                    onload: () => {
                        loadedCount++;
                        audioCache.current[url] = sound; // 加载后存入缓存
                        if (loadedCount === parts.length) startPlayback();
                    },
                    onloaderror: () => {
                        console.error(`语音片段加载失败: ${part.text}`);
                        loadedCount++;
                        if (loadedCount === parts.length) startPlayback();
                    }
                });
                sounds[index] = sound;
            }
        });

    }, [settings, stopPlayback, activeAudio]);

    const handlePlayButtonClick = (text, translation, type) => {
        playMixedAudio(text, translation, type);
    };
    
    // --- 自动播放与预加载 ---

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
    
    // 【新增】音频预加载 Effect
    useEffect(() => {
        const preloadAudioFor = (index) => {
            const gp = grammarPoints[index];
            if (!gp) return;

            const textsToPreload = [gp.narrationScript];
            gp.examples.forEach(ex => {
                // 【修改】优先使用讲稿
                textsToPreload.push(ex.narrationScript || ex.sentence);
            });
            
            textsToPreload.filter(Boolean).forEach(text => {
                const parts = parseTextForAudio(text);
                parts.forEach(part => {
                    const voice = part.isChinese ? settings.chineseVoice : settings.myanmarVoice;
                    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(part.text)}&v=${voice}`;
                    if (!audioCache.current[url]) {
                        // 创建 Howl 实例进行预加载，并存入缓存
                        audioCache.current[url] = new Howl({ src: [url], preload: true });
                    }
                });
            });
        };

        // 预加载当前和下一个页面的音频
        preloadAudioFor(currentIndex);
        if (currentIndex + 1 < grammarPoints.length) {
            preloadAudioFor(currentIndex + 1);
        }
    }, [currentIndex, grammarPoints, settings.chineseVoice, settings.myanmarVoice]);


    // --- 导航与动画 ---

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
    
    // 【优化】渲染函数，处理符号颜色
    const renderMixedText = (text) => {
        const parts = text.match(/\{\{.*?\}\}|[^{}]+/g) || [];
        return parts.map((part, pIndex) => {
            const isChinese = part.startsWith('{{');
            const content = isChinese ? part.slice(2, -2) : part;
            
            // 判断是否主要是标点符号
            const isPunctuation = /^[,\.!?\s\u3000-\u303F\uff00-\uffef]+$/.test(content);
            
            let partStyle = styles.textBurmese;
            if (isChinese || isPunctuation) {
                // 【修复】让中文和标点符号都用白色
                partStyle = styles.textChinese;
            }

            return (
                <span key={pIndex} style={partStyle}>
                    {isChinese 
                        ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} /> 
                        : content
                    }
                </span>
            );
        });
    };

    // --- 渲染 ---

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
                                    <button style={styles.playButton} onClick={() => handlePlayButtonClick(gp.narrationScript, "", `narration_${gp.id}`)}>
                                        {isLoadingAudio && activeAudio?.type === `narration_${gp.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `narration_${gp.id}` ? <FaPause/> : <FaPlay/>) }
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
                                                {renderMixedText(ex.sentence)}
                                            </div>
                                            <div style={styles.exampleTranslation}>{ex.translation}</div>
                                            <button style={styles.playButton} onClick={() => handlePlayButtonClick(ex.narrationScript || ex.sentence, ex.translation, `example_${ex.id}`)}>
                                                {isLoadingAudio && activeAudio?.type === `example_${ex.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `example_${ex.id}` ? <FaPause/> : <FaPlay/>) }
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 【优化】字幕容器 */}
                        {isPlayingRef.current && subtitles.original.length > 0 && (
                             <div style={styles.subtitleContainer}>
                                <p style={styles.subtitleLine}>
                                    {subtitles.original.map((part, index) => (
                                        <span key={index} style={{
                                            ...styles.subtitlePart, 
                                            // 【修复】根据 isChinese 判断颜色
                                            color: part.isChinese ? (highlightedIndex === index ? '#facc15' : 'white') : (highlightedIndex === index ? '#facc15' : '#81e6d9')
                                        }}>
                                            {part.text}
                                        </span>
                                    ))}
                                </p>
                                {subtitles.translation && <p style={styles.subtitleTranslation}>{subtitles.translation}</p>}
                            </div>
                        )}
                        
                        <div style={styles.footer} onClick={() => navigate(1)}>
                            <FaChevronUp />
                            <span>上滑切换</span>
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

// --- 样式表 ---
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', background: '#1a202c' },
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundSize: 'cover', backgroundPosition: 'center', willChange: 'transform, opacity' },
    contentWrapper: { width: '100%', maxWidth: '500px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px', color: 'white', paddingBottom: '150px' }, // 增加底部内边距给字幕留空间
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
    // 【优化】播放按钮样式
    playButton: { gridColumn: '2 / 3', gridRow: '1 / 3', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255, 255, 255, 0.3)', color: 'white', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' },
    footer: { position: 'absolute', bottom: '20px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' },
    textChinese: { color: 'white', margin: '0 2px' },
    textBurmese: { color: '#81e6d9', margin: '0 2px' },
    // 【优化】字幕样式
    subtitleContainer: { position: 'absolute', bottom: '80px', left: '20px', right: '20px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', borderRadius: '12px', padding: '12px 16px', pointerEvents: 'none' },
    subtitleLine: { 
        fontSize: '1.6rem', 
        fontWeight: '500', 
        margin: 0, 
        textAlign: 'center',
        // 【新增】限制最多两行
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
    },
    subtitlePart: { transition: 'color 0.2s ease-in-out', margin: '0 2px' },
    subtitleTranslation: { fontSize: '1rem', color: '#cbd5e0', textAlign: 'center', marginTop: '8px' },
};

// 注入动画样式
const styleTag = document.createElement('style');
styleTag.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
document.head.appendChild(styleTag);


export default GrammarPointPlayer;
