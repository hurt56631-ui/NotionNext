// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause } from 'react-icons/fa';

// --- TTS Engine (Unchanged, proven to work) ---
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
// -----------------------------------------------------------

const DuiHua = (props) => {
    // This smart data handling prevents crashes
    const data = props.data && props.data.dialogue ? props.data : props;

    if (!data || !data.dialogue || !data.characters) {
        return <div style={styles.loadingOrError}>正在加载对话数据...</div>;
    }

    const { id, title, imageSrc, characters, dialogue } = data;

    const [currentLineIndex, setCurrentLineIndex] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const timeoutRef = useRef(null);

    // Preload audio on mount
    useEffect(() => {
        dialogue.forEach(line => {
            const voice = characters[line.speaker]?.voice;
            getTTSAudio(line.hanzi, voice);
        });
    }, [id]);

    const playAudioForLine = async (index) => {
        if (index >= dialogue.length) {
            handleStoryEnd();
            return;
        }

        setCurrentLineIndex(index);
        const line = dialogue[index];
        const voice = characters[line.speaker]?.voice;

        audioRef.current = await playTTS(line.hanzi, voice);
        
        if (audioRef.current) {
            audioRef.current.onended = () => {
                if (isPlaying) {
                    // Natural pause before the next line
                    timeoutRef.current = setTimeout(() => {
                        playAudioForLine(index + 1);
                    }, 800);
                }
            };
        } else {
            // If audio fails, still move to the next line in play mode
            if (isPlaying) {
                 timeoutRef.current = setTimeout(() => {
                    playAudioForLine(index + 1);
                }, 800);
            }
        }
    };

    const handlePlayPause = () => {
        // Clear any pending transitions
        clearTimeout(timeoutRef.current);

        if (isPlaying) {
            setIsPlaying(false);
            audioRef.current?.pause();
        } else {
            setIsPlaying(true);
            const nextIndex = currentLineIndex === null || currentLineIndex >= dialogue.length - 1 ? 0 : currentLineIndex + 1;
            playAudioForLine(nextIndex);
        }
    };

    const handleBubbleClick = () => {
        if (currentLineIndex === null) return;
        
        // Stop autoplay and repeat the current line
        setIsPlaying(false);
        clearTimeout(timeoutRef.current);
        audioRef.current?.pause();

        playAudioForLine(currentLineIndex);
    };

    const handleStoryEnd = () => {
        setIsPlaying(false);
        setCurrentLineIndex(null);
    };

    const currentLine = currentLineIndex !== null ? dialogue[currentLineIndex] : null;
    const activeSpeaker = currentLine?.speaker;

    return (
        <div style={styles.container}>
            <div style={styles.sceneContainer}>
                <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                <div style={styles.overlay}></div>

                <div style={styles.characterA}>
                    <img src={characters.A?.imageSrc} alt={characters.A?.name} style={{...styles.avatar, ...(activeSpeaker === 'A' ? styles.avatarActive : {})}} />
                </div>
                <div style={styles.characterB}>
                    <img src={characters.B?.imageSrc} alt={characters.B?.name} style={{...styles.avatar, ...(activeSpeaker === 'B' ? styles.avatarActive : {})}} />
                </div>

                {currentLine && (
                    <div style={{...styles.bubbleContainer, ...(activeSpeaker === 'B' ? styles.bubbleContainerB : {})}} onClick={handleBubbleClick}>
                        <div style={{...styles.bubble, ...(activeSpeaker === 'B' ? styles.bubbleB : {})}}>
                            <p style={styles.pinyin}>{currentLine.pinyin}</p>
                            <p style={styles.hanzi}>{currentLine.hanzi}</p>
                        </div>
                    </div>
                )}
            </div>

            <div style={styles.controlsAndTranslation}>
                <button onClick={handlePlayPause} style={styles.playButton}>
                    {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
                </button>
                <div style={styles.translationArea}>
                    <p style={styles.translationText}>
                        {currentLine?.myanmar || '點擊 ▶️ 開始對話'}
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- Styles ---
const styles = {
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    container: { width: '100%', maxWidth: '900px', margin: '1rem auto', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
    sceneContainer: { position: 'relative', width: '100%', aspectRatio: '16 / 9' },
    backgroundImage: { width: '100%', height: '100%', objectFit: 'cover' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
    characterA: { position: 'absolute', bottom: 0, left: '5%' },
    characterB: { position: 'absolute', bottom: 0, right: '5%' },
    avatar: { width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,0.3)', transition: 'all 0.4s ease', opacity: 0.6, filter: 'grayscale(80%)', transform: 'scale(0.95)' },
    avatarActive: { opacity: 1, filter: 'grayscale(0%)', transform: 'scale(1)', borderColor: 'rgba(255,255,255,0.9)', boxShadow: '0 0 25px rgba(255,255,255,0.5)' },
    bubbleContainer: { position: 'absolute', top: '20%', width: '50%', left: '15%', cursor: 'pointer', transition: 'opacity 0.3s ease', opacity: 1 },
    bubbleContainerB: { left: 'auto', right: '15%' },
    bubble: { backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '18px', borderTopLeftRadius: '4px', padding: '12px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' },
    bubbleB: { borderTopLeftRadius: '18px', borderTopRightRadius: '4px' },
    pinyin: { margin: '0 0 4px 0', color: '#475569', fontSize: '1rem' },
    hanzi: { margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 'bold' },
    controlsAndTranslation: { display: 'flex', backgroundColor: '#1e293b', alignItems: 'center', padding: '12px 20px', minHeight: '80px' },
    playButton: { background: '#3b82f6', color: 'white', border: 'none', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 10px rgba(59, 130, 246, 0.5)' },
    translationArea: { flex: 1, paddingLeft: '20px', textAlign: 'center' },
    translationText: { color: '#cbd5e1', fontSize: '1.2rem', margin: 0, transition: 'opacity 0.3s ease' },
};

export default DuiHua;
