// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaRedo, FaTimes } from 'react-icons/fa';

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
    ttsCache.forEach(a => { if (a && !a.paused) { a.pause(); a.currentTime = 0; } });
    audio?.play();
    return audio;
};
// ========================================================================

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
    const transcriptRef = useRef(null);

    const speakerKeys = Object.keys(characters);
    const speakerAKey = speakerKeys[0];

    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [transcript]);

    const playLine = async (index, isRepeating = false) => {
        if (index >= dialogue.length) {
            handleStoryEnd();
            return;
        }
        setCurrentLineIndex(index);
        if (!transcript.some(t => t.index === index)) {
            setTranscript(prev => [...prev, { ...dialogue[index], index }]);
        }
        const line = dialogue[index];
        const voice = characters[line.speaker]?.voice;
        audioRef.current = await playTTS(line.hanzi, voice);
        if (audioRef.current) {
            audioRef.current.onended = () => {
                if (isPlaying && !isRepeating) {
                    timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
                }
            };
        } else if (isPlaying && !isRepeating) {
            timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
        }
    };

    // **关键修复**: 使用useEffect来响应isPlaying状态的变化，确保自动播放流畅
    useEffect(() => {
        clearTimeout(timeoutRef.current);
        if (isPlaying) {
            if (audioRef.current && audioRef.current.paused) {
                audioRef.current.play(); // 从暂停状态恢复
            } else {
                // 开始新的播放流程
                const nextIndex = currentLineIndex === null || currentLineIndex >= dialogue.length - 1 ? 0 : currentLineIndex + 1;
                if (nextIndex === 0) setTranscript([]);
                playLine(nextIndex);
            }
        } else {
            audioRef.current?.pause(); // 暂停
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    const handlePlayPause = () => {
        setIsPlaying(prev => !prev);
    };
    const handleRepeat = () => {
        if (currentLineIndex === null) return;
        playLine(currentLineIndex, true);
    };
    const handleStoryEnd = () => {
        setIsPlaying(false);
    };
     const handleTranscriptClick = (index) => {
        setIsPlaying(false); // 点击历史记录时，暂停自动播放
        playLine(index, true);
    };

    // 自动播放与清理
    useEffect(() => {
        dialogue.forEach(line => getTTSAudio(line.hanzi, characters[line.speaker]?.voice));
        timeoutRef.current = setTimeout(() => setIsPlaying(true), 1000);
        return () => {
            clearTimeout(timeoutRef.current);
            if (audioRef.current) audioRef.current.pause();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const currentLine = currentLineIndex !== null ? dialogue[currentLineIndex] : null;

    return (
        <>
            <style>{`
                @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
                @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(15px); } 100% { opacity: 1; transform: translateY(0); } }
                .bubble { animation: fadeInUp 0.4s ease-out; position: relative; }
                .transcript-item.active { background-color: rgba(59, 130, 246, 0.4) !important; border-radius: 12px; }
                .bubble-a::after { content: ''; position: absolute; left: -10px; bottom: 8px; width: 0; height: 0; border: 12px solid transparent; border-right-color: #3b82f6; border-left: 0; }
                .bubble-b::after { content: ''; position: absolute; right: -10px; bottom: 8px; width: 0; height: 0; border: 12px solid transparent; border-left-color: #f9fafb; border-right: 0; }
            `}</style>
            <div style={styles.fullScreenContainer} className="fade-in">
                <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                <div style={styles.overlay}></div>

                <div style={styles.topArea} ref={transcriptRef}>
                    {transcript.map(line => (
                        <div key={line.index} className={`transcript-item ${currentLineIndex === line.index ? 'active' : ''}`}
                            style={{ ...styles.transcriptLine, justifyContent: line.speaker === speakerAKey ? 'flex-start' : 'flex-end' }}
                            onClick={() => handleTranscriptClick(line.index)}>
                            <div style={{...styles.transcriptBubble, backgroundColor: line.speaker === speakerAKey ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.15)'}}>
                                <span style={styles.transcriptHanzi}>{line.hanzi}</span>
                                <span style={{...styles.speakerName, color: line.speaker === speakerAKey ? '#60a5fa' : '#fcd34d'}}>{characters[line.speaker]?.name}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {currentLine && (
                    <div style={styles.middleArea}>
                        <div className={`bubble ${currentLine.speaker === speakerAKey ? 'bubble-a' : 'bubble-b'}`}
                             style={{...styles.currentBubble, backgroundColor: currentLine.speaker === speakerAKey ? '#3b82f6' : '#f9fafb', color: currentLine.speaker === speakerAKey ? '#fff' : '#1f2937' }}
                             onClick={handleRepeat}>
                            <p style={styles.pinyin}>{currentLine.pinyin}</p>
                            <p style={styles.hanzi}>{currentLine.hanzi}</p>
                        </div>
                    </div>
                )}

                <div style={styles.footer}>
                    <p style={styles.translationText}>{currentLine?.myanmar || '...'}</p>
                    <div style={styles.controls}>
                        <button onClick={handlePlayPause} style={styles.controlButton}>{isPlaying ? <FaPause /> : <FaPlay />}</button>
                        <button onClick={handleRepeat} style={styles.controlButton}><FaRedo /></button>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- 样式表 ---
const styles = {
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    fullScreenContainer: { position: 'relative', width: '100%', maxWidth: '960px', aspectRatio: '16 / 9', margin: '1rem auto', borderRadius: '18px', overflow: 'hidden', backgroundColor: '#111', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' },
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.8) 100%)', zIndex: 1 },
    topArea: { position: 'relative', zIndex: 2, padding: '18px', maxHeight: '45%', overflowY: 'auto' },
    transcriptContainer: { display: 'flex', flexDirection: 'column', gap: '10px', color: 'white' },
    transcriptLine: { display: 'flex', cursor: 'pointer', padding: '2px', borderRadius: '12px', transition: 'background-color 0.3s ease' },
    transcriptBubble: { display: 'inline-flex', alignItems: 'center', gap: '10px', borderRadius: '12px', padding: '8px 14px' },
    transcriptHanzi: { fontSize: '1rem', fontWeight: '500' },
    speakerName: { fontSize: '0.8rem', opacity: 0.8 },
    middleArea: { position: 'relative', zIndex: 3, flex: '1 1 auto', display: 'flex', alignItems: 'center', padding: '0 20px' },
    currentBubble: { padding: '16px 22px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: '80%', textAlign: 'center' },
    pinyin: { margin: '0 0 5px 0', fontSize: '1rem', opacity: 0.8 },
    hanzi: { margin: 0, fontSize: '1.6rem', fontWeight: 'bold' },
    footer: { position: 'relative', zIndex: 2, padding: '16px 24px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)' },
    translationText: { color: 'white', fontSize: '1.2rem', margin: 0, textAlign: 'center', marginBottom: '16px' },
    controls: { display: 'flex', justifyContent: 'center', gap: '20px' },
    controlButton: { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.3s ease' },
};

export default DuiHua;
