// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaRedo } from 'react-icons/fa';

// --- TTS 引擎 ---
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
    } catch (e) {
        console.error(`Failed to get TTS for "${text}"`, e);
        return null;
    }
};

const playTTS = async (text, voice) => {
    const audio = await getTTSAudio(text, voice);
    // 停止其他音频
    ttsCache.forEach(a => {
        if (a && !a.paused) {
            a.pause();
            a.currentTime = 0;
        }
    });
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

    // 自动滚动
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

        // 更新历史
        if (!transcript.some(t => t.index === index)) {
            setTranscript(prev => [...prev, { ...dialogue[index], index }]);
        }

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

    const handlePlayPause = () => {
        clearTimeout(timeoutRef.current);
        if (isPlaying) {
            setIsPlaying(false);
            audioRef.current?.pause();
        } else {
            setIsPlaying(true);
            let nextIndex = currentLineIndex;
            if (nextIndex === null || nextIndex >= dialogue.length - 1) {
                nextIndex = 0;
                setTranscript([]);
            } else if (audioRef.current?.paused) {
                audioRef.current.play();
                return;
            } else {
                nextIndex++;
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
        setCurrentLineIndex(null);
    };

    const handleTranscriptClick = (index) => {
        setCurrentLineIndex(index);
        playLine(index, true);
    };

    useEffect(() => {
        dialogue.forEach(line => getTTSAudio(line.hanzi, characters[line.speaker]?.voice));
        timeoutRef.current = setTimeout(() => {
            if (!isPlaying) handlePlayPause();
        }, 1000);
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
                @keyframes fadeInUp { 
                    0% { opacity: 0; transform: translateY(15px); } 
                    100% { opacity: 1; transform: translateY(0); } 
                }
                .bubble { 
                    animation: fadeInUp 0.4s ease-out; 
                }
                .transcript-item.active { 
                    background-color: rgba(59, 130, 246, 0.4); 
                }
            `}</style>

            <div style={styles.fullScreenContainer}>
                <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                <div style={styles.overlay}></div>

                {/* 顶部历史区 */}
                <div style={styles.topArea}>
                    <div style={styles.transcriptContainer} ref={transcriptRef}>
                        {transcript.map(line => (
                            <div
                                key={line.index}
                                className={`transcript-item ${currentLineIndex === line.index ? 'active' : ''}`}
                                style={{
                                    ...styles.transcriptLine,
                                    textAlign: line.speaker === speakerAKey ? 'left' : 'right',
                                }}
                                onClick={() => handleTranscriptClick(line.index)}
                            >
                                <div style={{
                                    ...styles.transcriptBubble,
                                    backgroundColor: line.speaker === speakerAKey ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.15)',
                                    borderRadius: '12px',
                                    padding: '8px 14px',
                                }}>
                                    <span style={styles.transcriptHanzi}>{line.hanzi}</span>
                                    <span style={{
                                        ...styles.speakerName,
                                        color: line.speaker === speakerAKey ? '#60a5fa' : '#fcd34d'
                                    }}>
                                        {characters[line.speaker]?.name}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 中部气泡显示 */}
                {currentLine && (
                    <div style={styles.middleArea}>
                        <div
                            className="bubble"
                            style={{
                                ...styles.currentBubble,
                                backgroundColor: currentLine.speaker === speakerAKey ? '#3b82f6' : '#f9fafb',
                                color: currentLine.speaker === speakerAKey ? '#fff' : '#1f2937',
                                alignSelf: currentLine.speaker === speakerAKey ? 'flex-start' : 'flex-end'
                            }}
                            onClick={handleRepeat}
                        >
                            <p style={styles.pinyin}>{currentLine.pinyin}</p>
                            <p style={styles.hanzi}>{currentLine.hanzi}</p>
                        </div>
                    </div>
                )}

                {/* 新增：字幕区（位于历史区下方） */}
                <div style={styles.subtitleArea}>
                    <p style={styles.translationText}>
                        {currentLine?.myanmar || '点击播放开始学习...'}
                    </p>
                </div>

                {/* 底部控制区 */}
                <div style={styles.controlsArea}>
                    <button onClick={handlePlayPause} style={styles.controlButton}>
                        {isPlaying ? <FaPause /> : <FaPlay />}
                    </button>
                    <button onClick={handleRepeat} style={styles.controlButton}>
                        <FaRedo />
                    </button>
                </div>
            </div>
        </>
    );
};

// --- 样式 ---
const styles = {
    loadingOrError: {
        textAlign: 'center',
        padding: '40px',
        color: '#7f1d1d',
        backgroundColor: '#fef2f2',
        borderRadius: '12px'
    },
    fullScreenContainer: {
        position: 'relative',
        width: '100%',
        maxWidth: '960px',
        aspectRatio: '16 / 9',
        margin: '1rem auto',
        borderRadius: '18px',
        overflow: 'hidden',
        backgroundColor: '#111',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column'
    },
    backgroundImage: {
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        objectFit: 'cover',
        zIndex: 0
    },
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.8) 100%)',
        zIndex: 1
    },
    topArea: {
        position: 'relative',
        zIndex: 2,
        flex: '0 0 40%',
        padding: '12px 18px',
        overflowY: 'auto',
        backdropFilter: 'blur(6px)',
    },
    transcriptContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        color: 'white'
    },
    transcriptLine: {
        display: 'flex',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'background 0.3s ease'
    },
    transcriptBubble: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px'
    },
    transcriptHanzi: {
        fontSize: '1rem',
        fontWeight: '500'
    },
    speakerName: {
        fontSize: '0.8rem',
        opacity: 0.8
    },
    middleArea: {
        zIndex: 3,
        flex: '1 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    currentBubble: {
        padding: '16px 22px',
        borderRadius: '18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        maxWidth: '80%',
        textAlign: 'center'
    },
    subtitleArea: {
        zIndex: 3,
        flex: '0 0 auto',
        padding: '10px',
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        textAlign: 'center'
    },
    translationText: {
        color: 'white',
        fontSize: '1.2rem',
        margin: 0
    },
    controlsArea: {
        zIndex: 3,
        flex: '0 0 auto',
        padding: '14px',
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)'
    },
    controlButton: {
        background: 'rgba(255,255,255,0.2)',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '50%',
        width: '50px',
        height: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '1.2rem',
        transition: 'all 0.3s ease'
    },
    pinyin: { margin: '0 0 5px 0', fontSize: '1rem', opacity: 0.8 },
    hanzi: { margin: 0, fontSize: '1.6rem', fontWeight: 'bold' }
};

export default DuiHua;
