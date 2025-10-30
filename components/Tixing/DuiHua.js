// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaVolumeUp } from 'react-icons/fa';

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
    const data = props.data && props.data.dialogue ? props.data : props;

    if (!data || !data.dialogue || !data.characters) {
        return <div style={styles.loadingOrError}>正在加载对话数据...</div>;
    }

    const { id, title, imageSrc, characters, dialogue } = data;

    const [currentLineIndex, setCurrentLineIndex] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [transcript, setTranscript] = useState([]);
    const audioRef = useRef(null);
    const timeoutRef = useRef(null);

    // Reset and preload audio when the question changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentLineIndex(null);
        setTranscript([]);
        clearTimeout(timeoutRef.current);
        audioRef.current?.pause();

        dialogue.forEach(line => {
            const voice = characters[line.speaker]?.voice;
            getTTSAudio(line.hanzi, voice);
        });
    }, [id]);

    const playLine = async (index, isRepeating = false) => {
        if (index >= dialogue.length) {
            handleStoryEnd();
            return;
        }

        setCurrentLineIndex(index);
        
        if (!transcript.find(t => t.index === index)) {
            setTranscript(prev => [...prev, { ...dialogue[index], index }]);
        }

        const line = dialogue[index];
        const voice = characters[line.speaker]?.voice;

        audioRef.current = await playTTS(line.hanzi, voice);
        
        if (audioRef.current) {
            audioRef.current.onended = () => {
                // Only advance if auto-playing and not just repeating a line
                if (isPlaying && !isRepeating) {
                    timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
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
            const nextIndex = currentLineIndex === null || currentLineIndex >= dialogue.length - 1 ? 0 : currentLineIndex + 1;
            if (nextIndex === 0) setTranscript([]); // Reset transcript if starting over
            playLine(nextIndex);
        }
    };
    
    const handleBubbleClick = () => {
        if (currentLineIndex === null) return;
        // Repeat the current line without affecting autoplay state
        playLine(currentLineIndex, true); 
    };
    
    const handleTranscriptClick = (index) => {
         // Stop autoplay to focus on one line
        setIsPlaying(false);
        clearTimeout(timeoutRef.current);
        audioRef.current?.pause();
        playLine(index, true);
    }

    const handleStoryEnd = () => {
        setIsPlaying(false);
        // Keep the last line visible for a moment before clearing
        timeoutRef.current = setTimeout(() => {
             setCurrentLineIndex(null);
        }, 1500);
    };

    const currentLine = currentLineIndex !== null ? dialogue[currentLineIndex] : null;

    return (
        <>
        <style>{`
            @keyframes fadeIn { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
            .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        `}</style>
        <div style={styles.container}>
            <img src={imageSrc} alt={title} style={styles.backgroundImage} />
            <div style={styles.overlay}></div>
            
            <div style={styles.transcriptContainer}>
                {transcript.map((line, tIndex) => (
                    <div key={tIndex} style={styles.transcriptLine} onClick={() => handleTranscriptClick(line.index)}>
                        <span style={{...styles.transcriptSpeaker, color: line.speaker === 'A' ? '#93c5fd' : '#fcd34d'}}>
                            {characters[line.speaker]?.name || line.speaker}:
                        </span>
                        <span style={styles.transcriptHanzi}>{line.hanzi}</span>
                    </div>
                ))}
            </div>

            {currentLine && (
                <div style={styles.mainBubbleArea} className="fade-in">
                    <div 
                        style={{...styles.bubble, ...(currentLine.speaker === 'B' ? styles.bubbleB : styles.bubbleA)}}
                        onClick={handleBubbleClick}
                    >
                        <p style={styles.pinyin}>{currentLine.pinyin}</p>
                        <p style={styles.hanzi}>{currentLine.hanzi}</p>
                    </div>
                </div>
            )}

            <div style={styles.footer}>
                <button onClick={handlePlayPause} style={styles.playButton} aria-label="Play/Pause">
                    {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                <div style={styles.translationArea}>
                    <p style={styles.translationText}>
                        {currentLine?.myanmar || '點擊 ▶️ 開始對話'}
                    </p>
                </div>
            </div>
        </div>
        </>
    );
};

// --- Styles ---
const styles = {
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    container: { position: 'relative', width: '100%', maxWidth: '960px', margin: '1rem auto', aspectRatio: '16 / 9', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.4)', backgroundColor: '#111' },
    backgroundImage: { width: '100%', height: '100%', objectFit: 'cover' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.7) 100%)' },
    transcriptContainer: { position: 'absolute', top: 0, left: 0, right: 0, padding: '16px', maxHeight: '40%', overflowY: 'auto', pointerEvents: 'auto' },
    transcriptLine: { color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)', marginBottom: '8px', cursor: 'pointer', opacity: 0.8, transition: 'opacity 0.2s' },
    transcriptSpeaker: { fontWeight: 'bold', marginRight: '8px' },
    transcriptHanzi: { opacity: 0.9 },
    mainBubbleArea: { position: 'absolute', top: '0', bottom: '100px', left: '0', right: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    bubble: { position: 'relative', maxWidth: '70%', padding: '12px 20px', borderRadius: '18px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', cursor: 'pointer', pointerEvents: 'auto' },
    bubbleA: { alignSelf: 'center', marginRight: '20%', backgroundColor: '#3b82f6', color: 'white' },
    bubbleB: { alignSelf: 'center', marginLeft: '20%', backgroundColor: '#f9fafb', color: '#1f2937' },
    'bubbleA::after': { content: '""', position: 'absolute', bottom: '0px', left: '-10px', width: '0', height: '0', border: '15px solid transparent', borderRightColor: '#3b82f6', borderLeft: 0, borderBottom: 0, marginTop: '-10px', marginBottom: '-20px' }, // Dummy for planning, handled by CSS
    'bubbleB::after': { content: '""', position: 'absolute', bottom: '0px', right: '-10px', width: '0', height: '0', border: '15px solid transparent', borderLeftColor: '#f9fafb', borderRight: 0, borderBottom: 0, marginTop: '-10px', marginBottom: '-20px' }, // Dummy for planning, handled by CSS
    pinyin: { margin: '0 0 4px 0', opacity: 0.7, fontSize: '1rem' },
    hanzi: { margin: 0, fontSize: '1.5rem', fontWeight: 'bold' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(255,255,255,0.1)' },
    playButton: { background: '#fff', color: '#333', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' },
    translationArea: { flex: 1, padding: '0 20px', textAlign: 'center' },
    translationText: { color: 'white', fontSize: '1.1rem', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.5)' },
};

export default DuiHua;
