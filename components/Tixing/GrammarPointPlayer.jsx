// components/Tixing/GrammarPointPlayer.jsx (全屏抖音模式最终版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { Howl } from 'howler';
import { FaPlay, FaPause, FaSpinner } from 'react-icons/fa';

// --- 辅助函数和工具 ---
const generateRubyHTML = (text) => {
  if (!text) return '';
  return text.replace(/[\u4e00-\u9fa5]/g, char => `<ruby>${char}<rt>${pinyinConverter(char)}</rt></ruby>`);
};

const parseMixedLanguageText = (text, isSentence = false) => {
    if (!text) return [];
    const parts = text.split(/(\{\{.*?\}\})/g).filter(Boolean);
    return parts.map((part, index) => {
        const isChinese = part.startsWith('{{') && part.endsWith('}}');
        const content = isChinese ? part.slice(2, -2) : part;
        // 注意：这里我们直接使用了 styles 变量，它在主组件作用域中定义
        return (
            <span key={index} className={isChinese ? 'text-chinese' : 'text-burmese'}>
                {isSentence && isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content) }} /> : content}
            </span>
        );
    });
};


// --- 主组件 ---
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) {
        return null; 
    }

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    
    const [settings] = useState({
      chineseVoice: 'zh-CN-XiaoyouNeural',
      myanmarVoice: 'my-MM-NilarNeural',
    });
    
    // --- 音频与字幕状态管理 ---
    const [activeAudio, setActiveAudio] = useState(null); // { type, text }
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [subtitle, setSubtitle] = useState(''); // 新增：用于存储当前朗读的字幕
    const audioQueueRef = useRef([]); // 新增：用于管理音频播放队列

    // 统一的音频停止函数
    const stopPlayback = useCallback(() => {
        if (audioQueueRef.current.length > 0) {
            audioQueueRef.current.forEach(sound => sound && sound.stop());
            audioQueueRef.current = [];
        }
        setActiveAudio(null);
        setIsLoadingAudio(false);
        setSubtitle(''); // 停止时清空字幕
    }, []);

    // 播放混合语言音频的函数
    const playMixedAudio = useCallback((text, type) => {
        if (activeAudio && activeAudio.type === type) {
            stopPlayback();
            return;
        }

        stopPlayback(); // 播放前先停止所有当前音频
        setIsLoadingAudio(true);
        setActiveAudio({ type, text });
        setSubtitle(text); // 设置当前字幕

        const parts = text.split(/(\{\{.*?\}\})/g).filter(Boolean);
        let localAudioQueue = [];
        let loadedSounds = 0;

        // 队列播放结束后的清理工作
        const onQueueEnd = () => {
            audioQueueRef.current = [];
            setActiveAudio(null);
            setIsLoadingAudio(false);
            setSubtitle(''); // 播放结束时清空字幕
        };
        
        if (parts.length === 0) {
            onQueueEnd();
            return;
        }

        parts.forEach((part, index) => {
            const isChinese = part.startsWith('{{') && part.endsWith('}}');
            const content = isChinese ? part.slice(2, -2) : part;
            const voice = isChinese ? settings.chineseVoice : settings.myanmarVoice;
            const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(content)}&v=${voice}`;
            
            const sound = new Howl({
                src: [url],
                html5: true,
                onload: () => {
                    loadedSounds++;
                    if (loadedSounds === parts.length) {
                        setIsLoadingAudio(false);
                        // 确认在加载完成时，播放请求仍然是同一个
                        if (activeAudio && activeAudio.type === type) {
                            audioQueueRef.current = localAudioQueue;
                            playQueue();
                        }
                    }
                },
                onloaderror: (id, err) => {
                    console.error("音频加载失败:", url, err);
                    loadedSounds++;
                    if (loadedSounds === parts.length) {
                         if (activeAudio && activeAudio.type === type) {
                            setIsLoadingAudio(false);
                            audioQueueRef.current = localAudioQueue;
                            playQueue();
                        }
                    }
                }
            });
            localAudioQueue[index] = sound;
        });

        let currentSoundIndex = 0;
        const playQueue = () => {
            // 如果在播放过程中被停止，则中断队列
            if (audioQueueRef.current.length === 0) return;

            if (currentSoundIndex < audioQueueRef.current.length) {
                const sound = audioQueueRef.current[currentSoundIndex];
                if (sound && sound.state() === 'loaded') {
                    sound.once('end', () => {
                        currentSoundIndex++;
                        playQueue();
                    });
                    sound.play();
                } else {
                    currentSoundIndex++;
                    playQueue();
                }
            } else {
                onQueueEnd();
            }
        };
    }, [activeAudio, settings, stopPlayback]);

    // 当切换语法点时，停止所有音频
    useEffect(() => {
        stopPlayback();
    }, [currentIndex, stopPlayback]);
    
    // 组件卸载时清理
    useEffect(() => {
        return () => stopPlayback();
    }, [stopPlayback]);

    const navigate = useCallback((direction) => {
        lastDirection.current = direction;
        setCurrentIndex(prev => {
            const newIndex = prev + direction;
            if (newIndex >= 0 && newIndex < grammarPoints.length) {
                return newIndex;
            }
            if (newIndex >= grammarPoints.length) {
                onComplete();
            }
            return prev;
        });
    }, [grammarPoints.length, onComplete]);

    const transitions = useTransition(currentIndex, {
        key: grammarPoints[currentIndex]?.id || currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100vh' : '-100vh'})` },
        enter: { opacity: 1, transform: 'translateY(0vh)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100vh' : '100vh'})`, position: 'absolute' },
        config: { mass: 1, tension: 280, friction: 30 },
    });

    const bind = useDrag(({ down, movement: [mx, my], velocity: { y: vy }, direction: [xDir, yDir], cancel }) => {
        if (!down && (Math.abs(my) > window.innerHeight / 4 || vy > 0.5)) {
            // 【修复】上滑 (yDir < 0) 是下一个 (+1)，下滑 (yDir > 0) 是上一个 (-1)
            const direction = yDir < 0 ? 1 : -1;
            const newIndex = currentIndex + direction;

            if (newIndex >= grammarPoints.length) {
                onComplete();
            } else if (newIndex >= 0) {
                navigate(direction);
            }
            cancel();
        }
    }, { filterTaps: true, axis: 'y' });

    const content = (
        <div style={styles.fullScreen}>
            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if (!gp) return null;

                const bgStyle = {
                    backgroundImage: gp.background?.imageUrl ? `url(${gp.background.imageUrl})` : `linear-gradient(135deg, ${gp.background?.gradientStart || '#2d3748'} 0%, ${gp.background?.gradientEnd || '#1a202c'} 100%)`,
                };

                return (
                    <animated.div style={{ ...styles.page, ...bgStyle, ...style }} {...bind()}>
                        <div style={styles.contentWrapper}>
                            {/* 标题区域 */}
                            <div style={styles.header}>
                                <div style={styles.grammarPointTitle} dangerouslySetInnerHTML={{ __html: generateRubyHTML(gp.grammarPoint) }} />
                                <div style={styles.pattern}>{gp.pattern}</div>
                            </div>

                            {/* 解释区域 */}
                            <div style={styles.explanationSection}>
                                <div style={styles.sectionTitle}>
                                    <span>💡 语法解释</span>
                                    <button style={styles.playButton} onClick={() => playMixedAudio(gp.narrationScript, `narration_${gp.id}`)}>
                                        {isLoadingAudio && activeAudio?.type === `narration_${gp.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `narration_${gp.id}` ? <FaPause/> : <FaPlay/>) }
                                    </button>
                                </div>
                                <p style={styles.explanationText}>{gp.visibleExplanation}</p>
                            </div>

                            {/* 例句区域 */}
                            <div style={styles.examplesSection}>
                                <div style={styles.sectionTitle}>✍️ 例句示范</div>
                                <div style={styles.examplesList}>
                                    {gp.examples.map((ex, index) => (
                                        <div key={ex.id} style={styles.exampleItem}>
                                            <div style={styles.exampleSentence}>
                                                <span style={styles.exampleNumber}>{index + 1}.</span>
                                                {parseMixedLanguageText(ex.sentence, true)}
                                            </div>
                                            <div style={styles.exampleTranslation}>{ex.translation}</div>
                                            <button style={styles.playButton} onClick={() => playMixedAudio(ex.sentence, `example_${ex.id}`)}>
                                                {isLoadingAudio && activeAudio?.type === `example_${ex.id}` ? <FaSpinner className="spin" /> : (activeAudio?.type === `example_${ex.id}` ? <FaPause/> : <FaPlay/>) }
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        {/* 【新增】字幕显示区域 */}
                        {subtitle && (
                            <div style={styles.subtitleContainer}>
                                <div style={styles.subtitleText}>
                                    {/* isSentence=false 以避免在字幕中显示拼音 */}
                                    {parseMixedLanguageText(subtitle, false)}
                                </div>
                            </div>
                        )}

                        {/* 底部导航 */}
                        <div style={styles.footer}>
                            <span>上滑切换下一个语法</span>
                        </div>
                    </animated.div>
                );
            })}
        </div>
    );

    if (isMounted) return createPortal(content, document.body);
    return null;
};

// --- Prop类型定义 ---
GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

// --- 样式表 ---
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' },
    page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundSize: 'cover', backgroundPosition: 'center', willChange: 'transform, opacity' },
    contentWrapper: { width: '100%', maxWidth: '500px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', color: 'white', paddingBottom: '80px', paddingTop: '20px' },
    header: { textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.6)' },
    grammarPointTitle: { fontSize: '2.5rem', fontWeight: 'bold' },
    pattern: { fontSize: '1.2rem', color: '#a0aec0', fontFamily: 'monospace', marginTop: '8px' },
    explanationSection: { background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '16px' },
    sectionTitle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: '#fcd34d', marginBottom: '12px' },
    explanationText: { fontSize: '1rem', lineHeight: 1.7, color: '#e2e8f0', margin: 0 },
    examplesSection: { background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '16px' },
    examplesList: { display: 'flex', flexDirection: 'column', gap: '20px' },
    exampleItem: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '8px 16px' },
    exampleNumber: { color: '#a0aec0', marginRight: '8px' },
    exampleSentence: { gridColumn: '1 / 2', fontSize: '1.5rem', fontWeight: 500, lineHeight: 1.6, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
    exampleTranslation: { gridColumn: '1 / 2', fontSize: '1rem', color: '#cbd5e0', fontStyle: 'italic' },
    playButton: { gridColumn: '2 / 3', gridRow: '1 / 3', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    footer: { position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' },
    textChinese: { color: 'white' }, // 在 JSX 中通过 className 使用
    textBurmese: { color: '#81e6d9' }, // 在 JSX 中通过 className 使用
    // 【新增】字幕样式
    subtitleContainer: {
        position: 'absolute',
        bottom: '60px',
        left: '0',
        right: '0',
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
    },
    subtitleText: {
        background: 'rgba(0, 0, 0, 0.6)',
        padding: '10px 16px',
        borderRadius: '12px',
        fontSize: '1.1rem',
        lineHeight: 1.6,
        textAlign: 'center',
        color: 'white',
        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    },
};

// 动态添加用于 parseMixedLanguageText 的样式类
const styleTag = document.createElement('style');
styleTag.innerHTML = `
    .text-chinese { color: ${styles.textChinese.color}; }
    .text-burmese { color: ${styles.textBurmese.color}; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
document.head.appendChild(styleTag);


export default GrammarPointPlayer;
