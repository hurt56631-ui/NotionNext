// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaRedo } from 'react-icons/fa';

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
        // 延迟一小段时间再将当前行加入历史，避免闪烁
        setTimeout(() => {
            if (!transcript.some(t => t.index === index)) {
                setTranscript(prev => [...prev, { ...dialogue[index], index }]);
            }
        }, 100);

        const line = dialogue[index];
        const voice = characters[line.speaker]?.voice;
        audioRef.current = await playTTS(line.hanzi, voice);

        if (audioRef.current) {
            audioRef.current.onended = () => {
                if (isPlaying && !isRepeating) {
                    timeoutRef.current = setTimeout(() => playLine(index + 1), 700);
                }
            };
        } else if (isPlaying && !isRepeating) {
            timeoutRef.current = setTimeout(() => playLine(index + 1), 700);
        }
    };

    const handlePlayPause = () => { setIsPlaying(prev => !prev); };
    const handleRepeat = () => { if (currentLineIndex !== null) playLine(currentLineIndex, true); };
    const handleStoryEnd = () => { setIsPlaying(false); };
    const handleTranscriptClick = (index) => {
        setIsPlaying(false);
        playLine(index, true);
    };

    useEffect(() => {
        clearTimeout(timeoutRef.current);
        if (isPlaying) {
            if (audioRef.current && audioRef.current.paused) {
                audioRef.current.play();
            } else {
                const nextIndex = currentLineIndex === null || currentLineIndex >= dialogue.length - 1 ? 0 : currentLineIndex + 1;
                if (nextIndex === 0) setTranscript([]);
                playLine(nextIndex);
            }
        } else {
            audioRef.current?.pause();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    useEffect(() => {
        dialogue.forEach(line => getTTSAudio(line.hanzi, characters[line.speaker]?.voice));
        timeoutRef.current = setTimeout(() => setIsPlaying(true), 1000);
        return () => { clearTimeout(timeoutRef.current); audioRef.current?.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const currentLine = currentLineIndex !== null ? dialogue[currentLineIndex] : null;

    return (
        <>
            <style>{`
                /* CSS动画和气泡尾巴样式 */
                @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(15px); } 100% { opacity: 1; transform: translateY(0); } }
                .bubble { position: relative; animation: fadeInUp 0.4s ease-out; }
                .bubble-a::after { content: ''; position: absolute; left: -10px; top: 12px; width: 0; height: 0; border: 12px solid transparent; border-right-color: #f9fafb; border-left: 0; }
                .bubble-b::after { content: ''; position: absolute; right: -10px; top: 12px; width: 0; height: 0; border: 12px solid transparent; border-left-color: #3b82f6; border-right: 0; }
            `}</style>
            <div style={styles.chatContainer}>
                <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                <div style={styles.overlay}></div>

                <div style={styles.transcriptContainer} ref={transcriptRef}>
                    {transcript.map(line => {
                        const isSpeakerA = line.speaker === speakerAKey;
                        const character = characters[line.speaker];
                        return (
                            <div key={line.index} style={{...styles.transcriptLine, justifyContent: isSpeakerA ? 'flex-start' : 'flex-end'}}>
                                {isSpeakerA && <img src={character?.avatarSrc} style={styles.avatar} alt={character?.name} />}
                                <div className={`bubble ${isSpeakerA ? 'bubble-a' : 'bubble-b'}`} style={{...styles.transcriptBubble, ...(isSpeakerA ? styles.transcriptBubbleA : styles.transcriptBubbleB)}} onClick={() => handleTranscriptClick(line.index)}>
                                    <p style={styles.transcriptHanzi}>{line.hanzi}</p>
                                    {line.myanmar && <p style={styles.myanmarText}>{line.myanmar}</p>}
                                </div>
                                {!isSpeakerA && <img src={character?.avatarSrc} style={styles.avatar} alt={character?.name} />}
                            </div>
                        );
                    })}
                </div>

                <div style={styles.controlsArea}>
                    <button onClick={handlePlayPause} style={styles.controlButton}>{isPlaying ? <FaPause /> : <FaPlay />}</button>
                    <button onClick={handleRepeat} style={styles.controlButton}><FaRedo /></button>
                </div>
            </div>
        </>
    );
};

// --- 样式表 ---
const styles = {
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    chatContainer: { position: 'relative', width: '100%', maxWidth: '960px', minHeight: '75vh', margin: '1rem auto', borderRadius: '18px', overflow: 'hidden', backgroundColor: '#111', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' },
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 1 },
    transcriptContainer: { position: 'relative', zIndex: 2, flex: '1 1 auto', padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' },
    transcriptLine: { display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '75%' },
    avatar: { width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)' },
    transcriptBubble: { padding: '10px 16px', borderRadius: '18px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', cursor: 'pointer' },
    transcriptBubbleA: { backgroundColor: '#f9fafb', color: '#1f2937', borderTopLeftRadius: '5px' },
    transcriptBubbleB: { backgroundColor: '#3b82f6', color: '#fff', borderTopRightRadius: '5px' },
    transcriptHanzi: { margin: 0, fontSize: '1.2rem', fontWeight: '500' },
    myanmarText: { margin: '8px 0 0 0', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '8px', fontSize: '1rem', opacity: 0.8 },
    controlsArea: { position: 'relative', zIndex: 3, flex: '0 0 auto', padding: '14px', display: 'flex', justifyContent: 'center', gap: '20px', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(255,255,255,0.1)' },
    controlButton: { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.3s ease' },
};

export default DuiHua;
