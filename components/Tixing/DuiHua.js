// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaTimes } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';
import { useDrag } from '@use-gesture/react';

// --- TTS 引擎 ---
let ttsCache = new Map();
const getTTSAudio = async (text, voice, rate = 0) => {
    if (!text || !voice) return null;
    const cacheKey = `${text}|${voice}|${rate}`;
    if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey);
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('TTS API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(cacheKey, audio);
        return audio;
    } catch (e) { console.error(`Failed to get TTS for "${text}"`, e); return null; }
};
const playTTS = async (text, voice, rate) => {
    ttsCache.forEach(a => { if (a && !a.paused) { a.pause(); a.currentTime = 0; } });
    const audio = await getTTSAudio(text, voice, rate);
    audio?.play();
    return audio;
};

// ========================================================================
//                           单个场景组件
// ========================================================================
const SceneInstance = ({ scene, isActive, onExit }) => {
    const { id, title, imageSrc, characters, dialogue } = scene;
    const [currentLineIndex, setCurrentLineIndex] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const timeoutRef = useRef(null);

    const speakerKeys = Object.keys(characters);
    const speakerAKey = speakerKeys[0];

    const playLine = async (index, isRepeating = false) => {
        if (index >= dialogue.length || !isActive) {
            setIsPlaying(false);
            timeoutRef.current = setTimeout(() => setCurrentLineIndex(null), 1500);
            return;
        }
        setCurrentLineIndex(index);
        const line = dialogue[index];
        const character = characters[line.speaker];
        audioRef.current = await playTTS(line.hanzi, character?.voice, character?.rate);

        if (audioRef.current) {
            audioRef.current.onended = () => {
                if (isActive && isPlaying && !isRepeating) {
                    timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
                }
            };
        } else if (isActive && isPlaying && !isRepeating) {
            timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
        }
    };

    // 播放/暂停的副作用处理
    useEffect(() => {
        clearTimeout(timeoutRef.current);
        if (isActive && isPlaying) {
            const nextIndex = currentLineIndex === null || currentLineIndex >= dialogue.length - 1 ? 0 : currentLineIndex + 1;
            playLine(nextIndex);
        } else {
            audioRef.current?.pause();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);
    
    // 场景激活时自动播放
    useEffect(() => {
        if (isActive) {
            dialogue.forEach(line => {
                const character = characters[line.speaker];
                getTTSAudio(line.hanzi, character?.voice, character?.rate);
            });
            timeoutRef.current = setTimeout(() => setIsPlaying(true), 500);
        } else {
            // 清理状态
            clearTimeout(timeoutRef.current);
            audioRef.current?.pause();
            setIsPlaying(false);
            setCurrentLineIndex(null);
        }
        return () => { clearTimeout(timeoutRef.current); audioRef.current?.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, id]);

    const handleBubbleClick = () => {
        if (currentLineIndex === null) return;
        playLine(currentLineIndex, true);
    };

    const currentLine = currentLineIndex !== null ? dialogue[currentLineIndex] : null;

    return (
        <div style={styles.fullScreenContainer}>
            <img src={imageSrc} alt={title} style={styles.backgroundImage} />
            <div style={styles.overlay}></div>
            <button onClick={onExit} style={styles.closeButton} aria-label="关闭"><FaTimes /></button>

            {currentLine && (
                <div style={{...styles.bubbleArea, justifyContent: currentLine.speaker === speakerAKey ? 'flex-start' : 'flex-end'}}>
                    <div className={`bubble ${currentLine.speaker === speakerAKey ? 'bubble-a' : 'bubble-b'}`}
                         style={{...styles.bubble, ...(currentLine.speaker === speakerAKey ? styles.bubbleA : styles.bubbleB)}}
                         onClick={handleBubbleClick}>
                        <p style={styles.pinyin}>{pinyin(currentLine.hanzi)}</p>
                        <p style={styles.hanzi}>{currentLine.hanzi}</p>
                        {currentLine.myanmar && <p style={styles.myanmarText}>{currentLine.myanmar}</p>}
                    </div>
                </div>
            )}

            <div style={styles.controlsArea}>
                <button onClick={() => setIsPlaying(p => !p)} style={styles.controlButton}>
                    {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
            </div>
        </div>
    );
};

// ========================================================================
//                           主容器与滑动逻辑
// ========================================================================
const DuiHua = (props) => {
    const scenes = props.scenes || (props.data ? [props.data] : null);
    if (!scenes || scenes.length === 0) {
        return <div style={styles.loadingOrError}>正在加载对话数据...</div>;
    }

    const [sceneIndex, setSceneIndex] = useState(0);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const containerRef = useRef(null);

    const bind = useDrag(({ active, movement: [, my], direction: [, dy], distance, cancel }) => {
        if (active && distance > (containerRef.current?.offsetHeight ?? 800) / 4) {
            const newIndex = sceneIndex + (dy < 0 ? 1 : -1);
            if (newIndex >= 0 && newIndex < scenes.length) {
                setSceneIndex(newIndex);
            }
            cancel();
        }
    }, { axis: 'y', filterTaps: true, taps: true });

    if (!isFullScreen) {
        return (
            <div style={styles.triggerContainer} onClick={() => setIsFullScreen(true)}>
                <img src={scenes[0].imageSrc} alt={scenes[0].title} style={styles.triggerImage} />
                <div style={styles.triggerOverlay}></div>
                <div style={styles.triggerPlayButton}><FaPlay size={24}/></div>
                <h3 style={styles.triggerTitle}>{scenes[0].title || '开始情景对话'}</h3>
            </div>
        );
    }

    return (
        <>
            <style>{`
                @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                .bubble { animation: fadeInUp 0.5s ease-out; }
            `}</style>
            <div {...bind()} style={styles.swipeContainer} ref={containerRef}>
                <div style={{ ...styles.sceneWrapper, transform: `translateY(-${sceneIndex * 100}%)` }}>
                    {scenes.map((scene, index) => (
                        <div key={scene.id || index} style={{width: '100%', height: '100%'}}>
                            <SceneInstance scene={scene} isActive={index === sceneIndex} onExit={() => setIsFullScreen(false)} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

// --- 样式表 ---
const styles = {
    // 触发器样式
    triggerContainer: { position: 'relative', width: '100%', maxWidth: '960px', aspectRatio: '16 / 9', margin: '1rem auto', borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' },
    triggerImage: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' },
    triggerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', transition: 'background-color 0.3s ease' },
    triggerPlayButton: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)', boxShadow: '0 0 20px rgba(0,0,0,0.5)', transition: 'transform 0.3s ease' },
    triggerTitle: { position: 'absolute', bottom: '20px', left: '20px', color: 'white', fontSize: '1.5rem', fontWeight: 'bold', textShadow: '0 2px 5px rgba(0,0,0,0.7)' },

    // 全屏样式
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    swipeContainer: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, overflow: 'hidden', touchAction: 'pan-y', cursor: 'grab' },
    sceneWrapper: { height: '100%', transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' },
    fullScreenContainer: { position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' },
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)', zIndex: 1 },
    closeButton: { position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, fontSize: '1.2rem' },
    bubbleArea: { position: 'absolute', top: '25%', left: '0', right: '0', zIndex: 5, display: 'flex', padding: '0 5%' },
    bubble: { position: 'relative', maxWidth: '60%', padding: '12px 20px', borderRadius: '20px', boxShadow: '0 5px 20px rgba(0,0,0,0.3)', cursor: 'pointer' },
    bubbleA: { backgroundColor: '#f3f4f6', color: '#1f2937', marginRight: 'auto' },
    bubbleB: { backgroundColor: '#3b82f6', color: '#fff', marginLeft: 'auto' },
    'bubbleA::after': { content: '""', position: 'absolute', left: '20px', bottom: '-15px', width: '20px', height: '20px', backgroundColor: '#f3f4f6', clipPath: 'polygon(0 0, 100% 0, 0 100%)' },
    'bubbleB::after': { content: '""', position: 'absolute', right: '20px', bottom: '-15px', width: '20px', height: '20px', backgroundColor: '#3b82f6', clipPath: 'polygon(0 0, 100% 0, 100% 100%)' },
    pinyin: { margin: '0 0 2px 0', opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.2, letterSpacing: '-0.5px' },
    hanzi: { margin: '0', fontSize: '1.4rem', fontWeight: '500', lineHeight: 1.4 },
    myanmarText: { margin: '10px 0 0 0', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '10px', fontSize: '1rem', opacity: 0.9, lineHeight: 1.5 },
    controlsArea: { position: 'absolute', bottom: '5vh', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', justifyContent: 'center' },
    controlButton: { background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.5rem', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease' },
};

export default DuiHua;
