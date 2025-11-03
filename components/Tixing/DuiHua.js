// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaTimes } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

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
//                           主组件
// ========================================================================
const DuiHua = (props) => {
    const scene = props.scenes ? props.scenes[0] : (props.data || null);

    if (!scene || !scene.dialogue || !scene.characters) {
        return <div style={styles.loadingOrError}>正在加载对话数据...</div>;
    }

    const { id, title, imageSrc, characters, dialogue } = scene;
    const [currentLineIndex, setCurrentLineIndex] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const audioRef = useRef(null);
    const timeoutRef = useRef(null);

    const speakerKeys = Object.keys(characters);
    const speakerAKey = speakerKeys[0];

    const playLine = async (index, isRepeating = false) => {
        if (index >= dialogue.length) {
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
                // 仅在自动播放且非重复点击时继续
                if (isPlaying && !isRepeating) {
                    timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
                }
            };
        } else if (isPlaying && !isRepeating) {
            timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
        }
    };
    
    // 核心播放逻辑
    useEffect(() => {
        clearTimeout(timeoutRef.current);
        if (isPlaying) {
            const nextIndex = currentLineIndex === null || currentLineIndex >= dialogue.length - 1 ? 0 : currentLineIndex + 1;
            playLine(nextIndex);
        } else {
            audioRef.current?.pause();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    // 预加载与清理
    useEffect(() => {
        dialogue.forEach(line => {
            const character = characters[line.speaker];
            getTTSAudio(line.hanzi, character?.voice, character?.rate);
        });
        return () => { clearTimeout(timeoutRef.current); audioRef.current?.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleBubbleClick = () => {
        if (currentLineIndex === null) return;
        playLine(currentLineIndex, true); // 重复播放当前句
    };

    if (!isVisible) {
        return null;
    }

    const currentLine = currentLineIndex !== null ? dialogue[currentLineIndex] : null;

    return (
        <>
            <style>{`
                @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                .bubble { animation: fadeInUp 0.5s ease-out; }
                /* 左气泡尾巴 */
                .bubble-a::after { content: ''; position: absolute; left: 20px; bottom: -8px; width: 0; height: 0; border: 8px solid transparent; border-top-color: #f3f4f6; border-bottom: 0; }
                /* 右气泡尾巴 */
                .bubble-b::after { content: ''; position: absolute; right: 20px; bottom: -8px; width: 0; height: 0; border: 8px solid transparent; border-top-color: #3b82f6; border-bottom: 0; }
            `}</style>
            <div style={styles.fullScreenContainer}>
                <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                <div style={styles.overlay}></div>
                <button onClick={() => setIsVisible(false)} style={styles.closeButton} aria-label="关闭"><FaTimes /></button>

                
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
        </>
    );
};

// --- 样式表 ---
const styles = {
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    fullScreenContainer: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: '#000', display: 'flex', flexDirection: 'column' },
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)', zIndex: 1 },
    closeButton: { position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, fontSize: '1.2rem' },
    bubbleArea: { position: 'absolute', top: '30%', left: '0', right: '0', zIndex: 5, display: 'flex', padding: '0 5%' },
    bubble: { position: 'relative', maxWidth: '65%', padding: '12px 20px', borderRadius: '20px', boxShadow: '0 5px 20px rgba(0,0,0,0.3)', cursor: 'pointer' },
    bubbleA: { backgroundColor: '#f3f4f6', color: '#1f2937' },
    bubbleB: { backgroundColor: '#3b82f6', color: '#fff' },
    pinyin: { margin: '0 0 2px 0', opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.2, letterSpacing: '-0.5px' },
    hanzi: { margin: '0', fontSize: '1.4rem', fontWeight: '500', lineHeight: 1.4 },
    myanmarText: { margin: '10px 0 0 0', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '10px', fontSize: '1rem', opacity: 0.9, lineHeight: 1.5 },
    controlsArea: { position: 'absolute', bottom: '5vh', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', justifyContent: 'center' },
    controlButton: { background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.5rem', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease' },
};

export default DuiHua;
