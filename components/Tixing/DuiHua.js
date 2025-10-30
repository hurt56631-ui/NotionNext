// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaRedo, FaTimes, FaVolumeUp } from 'react-icons/fa';

// --- TTS 引擎 (无需改动) ---
let ttsCache = new Map();
const getTTSAudio = async (text, voice) => {
    if (!text || !voice) return null;
    const cacheKey = `${text}|${voice}`;
    if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey);
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('TTS API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(cacheKey, audio);
        return audio;
    } catch (e) { console.error(`Failed to get TTS for "${text}"`, e); return null; }
};
const playTTS = async (text, voice) => {
    const audio = await getTTSAudio(text, voice);
    ttsCache.forEach(cachedAudio => {
        if (cachedAudio && !cachedAudio.paused) {
            cachedAudio.pause();
            cachedAudio.currentTime = 0;
        }
    });
    audio?.play();
    return audio;
};

// ========================================================================
//                           主组件
// ========================================================================
const DuiHua = (props) => {
    // 智能数据处理，防止因数据加载延迟导致崩溃
    const data = props.data && props.data.dialogue ? props.data : props;
    const [isFullScreen, setIsFullScreen] = useState(false);

    if (!data || !data.dialogue || !data.characters) {
        return null; // 如果数据无效，不渲染任何内容
    }

    const FullScreenDialogue = ({ onClose }) => {
        const { id, title, imageSrc, characters, dialogue } = data;
        const [currentLineIndex, setCurrentLineIndex] = useState(null);
        const [isPlaying, setIsPlaying] = useState(false);
        const [transcript, setTranscript] = useState([]);
        const audioRef = useRef(null);
        const timeoutRef = useRef(null);

        // 获取角色A和B的key，用于区分左右
        const speakerKeys = Object.keys(characters);
        const speakerAKey = speakerKeys[0];

        // 自动播放与清理
        useEffect(() => {
            dialogue.forEach(line => getTTSAudio(line.hanzi, characters[line.speaker]?.voice));
            // 进入全屏后，延迟半秒自动开始播放
            timeoutRef.current = setTimeout(() => handlePlayPause(), 500);

            return () => { // 组件卸载时清理
                clearTimeout(timeoutRef.current);
                audioRef.current?.pause();
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [id]);

        const playLine = async (index, isRepeating = false) => {
            if (index >= dialogue.length) {
                handleStoryEnd();
                return;
            }
            setCurrentLineIndex(index);
            // 如果历史记录里没有，就添加进去
            if (!transcript.some(t => t.index === index)) {
                setTranscript(prev => [...prev, { ...dialogue[index], index }]);
            }

            const line = dialogue[index];
            const voice = characters[line.speaker]?.voice;
            audioRef.current = await playTTS(line.hanzi, voice);
            
            if (audioRef.current) {
                audioRef.current.onended = () => {
                    if (isPlaying && !isRepeating) {
                        timeoutRef.current = setTimeout(() => playLine(index + 1), 800); // 自然停顿
                    }
                };
            } else if (isPlaying && !isRepeating) {
                timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
            }
        };

        const handlePlayPause = () => {
            clearTimeout(timeoutRef.current);
            if (isPlaying) {
                setIsPlaying(false);
                audioRef.current?.pause();
            } else {
                setIsPlaying(true);
                let nextIndex = currentLineIndex;
                if (nextIndex === null || nextIndex >= dialogue.length - 1) {
                    nextIndex = 0; // 从头开始
                    setTranscript([]);
                } else if (!audioRef.current || audioRef.current.paused) {
                    // 从暂停处继续
                } else {
                    nextIndex++; // 播放下一行
                }
                playLine(nextIndex);
            }
        };

        const handleRepeat = () => {
            if (currentLineIndex === null) return;
            playLine(currentLineIndex, true); 
        };

        const handleStoryEnd = () => {
            setIsPlaying(false);
            timeoutRef.current = setTimeout(() => setCurrentLineIndex(null), 1500);
        };

        const currentLine = currentLineIndex !== null ? dialogue[currentLineIndex] : null;

        return (
            <>
                <style>{`
                    /* CSS动画和气泡尾巴样式 */
                    @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
                    @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                    .bubble-container { position: absolute; width: 100%; bottom: 120px; display: flex; padding: 0 5%; box-sizing: border-box; animation: fadeInUp 0.5s ease-out forwards; }
                    .bubble { position: relative; max-width: 65%; padding: 14px 22px; border-radius: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); }
                    .bubble-a { background-color: #3b82f6; color: white; border-bottom-left-radius: 5px; margin-right: auto; }
                    .bubble-b { background-color: #f9fafb; color: #1f2937; border-bottom-right-radius: 5px; margin-left: auto; }
                    .bubble-a::after { content: ''; position: absolute; left: -10px; bottom: 6px; width: 0; height: 0; border: 12px solid transparent; border-right-color: #3b82f6; border-left: 0; }
                    .bubble-b::after { content: ''; position: absolute; right: -10px; bottom: 6px; width: 0; height: 0; border: 12px solid transparent; border-left-color: #f9fafb; border-right: 0; }
                `}</style>
                <div style={styles.fullScreenContainer} className="fade-in">
                    <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                    <div style={styles.overlay}></div>
                    <button onClick={onClose} style={styles.closeButton} aria-label="关闭"><FaTimes /></button>

                    <div style={styles.transcriptContainer}>
                        {transcript.map((line, tIndex) => (
                            <div key={tIndex} style={{...styles.transcriptLine, textAlign: line.speaker === speakerAKey ? 'left' : 'right'}}>
                                <span>{line.hanzi}</span>
                                <span style={{color: line.speaker === speakerAKey ? '#93c5fd' : '#fcd34d'}}>
                                    &nbsp;- {characters[line.speaker]?.name}
                                </span>
                            </div>
                        ))}
                    </div>

                    {currentLine && (
                        <div className="bubble-container">
                            <div className={`bubble ${currentLine.speaker === speakerAKey ? 'bubble-a' : 'bubble-b'}`} onClick={handleRepeat}>
                                <p style={styles.pinyin}>{currentLine.pinyin}</p>
                                <p style={styles.hanzi}>{currentLine.hanzi}</p>
                            </div>
                        </div>
                    )}

                    <div style={styles.footer}>
                        <div style={styles.translationArea}>
                            <p style={styles.translationText}>{currentLine?.myanmar || '...'}</p>
                        </div>
                        <div style={styles.controls}>
                            <button onClick={handlePlayPause} style={styles.controlButton} aria-label="播放/暂停">{isPlaying ? <FaPause /> : <FaPlay />}</button>
                            <button onClick={handleRepeat} style={styles.controlButton} aria-label="重复"><FaRedo /></button>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <>
            <button onClick={() => setIsFullScreen(true)} style={styles.triggerButton}>
                <FaPlay style={{marginRight: '10px'}}/> 开始情景对话
            </button>
            {isFullScreen && <FullScreenDialogue onClose={() => setIsFullScreen(false)} />}
        </>
    );
};

// --- 样式表 ---
const styles = {
    triggerButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease' },
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    fullScreenContainer: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' },
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)' },
    closeButton: { position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, fontSize: '1.2rem' },
    transcriptContainer: { position: 'absolute', top: '20px', left: '20px', right: '20px', padding: '16px', maxHeight: '40%', overflowY: 'auto', zIndex: 5, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)', fontSize: '1rem' },
    transcriptLine: { marginBottom: '8px', opacity: 0.9 },
    pinyin: { margin: '0 0 4px 0', opacity: 0.7, fontSize: '1rem' },
    hanzi: { margin: 0, fontSize: '1.6rem', fontWeight: 'bold' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 5 },
    translationArea: { flex: 1, textAlign: 'left' },
    translationText: { color: 'white', fontSize: '1.2rem', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.5)' },
    controls: { display: 'flex', gap: '16px' },
    controlButton: { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }
};

export default DuiHua;
