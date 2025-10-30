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
    // 暂停所有其他正在播放的音频
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

const DuiHua = (props) => {
    // 智能数据处理，防止因数据加载延迟导致崩溃
    const data = props.data && props.data.dialogue ? props.data : props;

    // 如果数据无效，显示加载提示
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

    // 自动滚动到底部
    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [transcript]);

    // --- 核心播放逻辑 ---
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
                    // 自然停顿后播放下一句
                    timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
                }
            };
        } else if (isPlaying && !isRepeating) {
            // 如果音频加载失败，也继续流程
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
                // 如果是结尾或从未开始，则从头播放
                nextIndex = 0;
                setTranscript([]); // 重置历史
            } else if (audioRef.current?.paused) {
                // 如果是暂停状态，则继续播放当前音频
                audioRef.current.play();
                return;
            } else {
                nextIndex++; // 否则播放下一行
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

    // 点击历史对话项重新播放
    const handleTranscriptClick = (index) => {
        setCurrentLineIndex(index);
        playLine(index, true);
    };

    // 自动播放与清理
    useEffect(() => {
        // 预加载所有TTS音频
        dialogue.forEach(line => getTTSAudio(line.hanzi, characters[line.speaker]?.voice));
        
        // 延迟1秒自动开始播放
        timeoutRef.current = setTimeout(() => {
            if (!isPlaying) {
                handlePlayPause();
            }
        }, 1000);

        return () => {
            clearTimeout(timeoutRef.current);
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const currentLine = currentLineIndex !== null ? dialogue[currentLineLineIndex] : null;

    return (
        <>
            <style>{`
                /* CSS动画和气泡尾巴样式 */
                @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
                @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                .bubble-container { position: absolute; width: 100%; top: 50%; transform: translateY(-50%); display: flex; padding: 0 5%; box-sizing: border-box; animation: fadeInUp 0.5s ease-out forwards; }
                .bubble { position: relative; max-width: 65%; padding: 14px 22px; border-radius: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); cursor: pointer; transition: all 0.3s ease; }
                .bubble:hover { transform: scale(1.02); }
                .bubble-a { background-color: #3b82f6; color: white; border-bottom-left-radius: 5px; margin-right: auto; }
                .bubble-b { background-color: #f9fafb; color: #1f2937; border-bottom-right-radius: 5px; margin-left: auto; }
                .bubble-a::after { content: ''; position: absolute; left: -10px; bottom: 6px; width: 0; height: 0; border: 12px solid transparent; border-right-color: #3b82f6; border-left: 0; }
                .bubble-b::after { content: ''; position: absolute; right: -10px; bottom: 6px; width: 0; height: 0; border: 12px solid transparent; border-left-color: #f9fafb; border-right: 0; }
                
                .transcript-item { cursor: pointer; transition: all 0.2s ease; }
                .transcript-item:hover { background-color: rgba(255,255,255,0.1); }
                .transcript-item.active { background-color: rgba(59, 130, 246, 0.3); }
            `}</style>
            <div style={styles.fullScreenContainer} className="fade-in">
                <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                <div style={styles.overlay}></div>

                {/* 顶部历史对话区域 */}
                <div style={styles.topArea}>
                    <div style={styles.transcriptContainer} ref={transcriptRef}>
                        {transcript.map((line) => (
                            <div 
                                key={line.index} 
                                className={`transcript-item ${currentLineIndex === line.index ? 'active' : ''}`}
                                style={{
                                    ...styles.transcriptLine, 
                                    textAlign: line.speaker === speakerAKey ? 'left' : 'right',
                                    justifyContent: line.speaker === speakerAKey ? 'flex-start' : 'flex-end'
                                }}
                                onClick={() => handleTranscriptClick(line.index)}
                            >
                                <div style={styles.transcriptBubble}>
                                    <span style={styles.transcriptHanzi}>{line.hanzi}</span>
                                    <span style={{
                                        ...styles.speakerName,
                                        color: line.speaker === speakerAKey ? '#93c5fd' : '#fcd34d'
                                    }}>
                                        {characters[line.speaker]?.name}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 中部当前对话气泡 */}
                {currentLine && (
                    <div className="bubble-container">
                        <div className={`bubble ${currentLine.speaker === speakerAKey ? 'bubble-a' : 'bubble-b'}`} onClick={handleRepeat}>
                            <p style={styles.pinyin}>{currentLine.pinyin}</p>
                            <p style={styles.hanzi}>{currentLine.hanzi}</p>
                        </div>
                    </div>
                )}

                {/* 底部翻译和控制区域 */}
                <div style={styles.bottomArea}>
                    <div style={styles.translationArea}>
                        <p style={styles.translationText}>
                            {currentLine?.myanmar || '点击播放开始学习...'}
                        </p>
                    </div>
                    <div style={styles.controls}>
                        <button onClick={handlePlayPause} style={styles.controlButton} aria-label="播放/暂停">
                            {isPlaying ? <FaPause /> : <FaPlay />}
                        </button>
                        <button onClick={handleRepeat} style={styles.controlButton} aria-label="重复">
                            <FaRedo />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- 样式表 ---
const styles = {
    loadingOrError: { 
        textAlign: 'center', 
        padding: '40px', 
        fontFamily: 'system-ui, sans-serif', 
        color: '#7f1d1d', 
        backgroundColor: '#fef2f2', 
        borderRadius: '12px' 
    },
    fullScreenContainer: { 
        position: 'relative', 
        width: '100%', 
        maxWidth: '960px', 
        margin: '1rem auto', 
        aspectRatio: '16 / 9', 
        borderRadius: '20px', 
        overflow: 'hidden', 
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.4)', 
        backgroundColor: '#111' 
    },
    backgroundImage: { 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover' 
    },
    overlay: { 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.8) 100%)' 
    },
    topArea: { 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: '30%', 
        zIndex: 5, 
        padding: '15px', 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        backdropFilter: 'blur(8px)', 
        borderBottom: '1px solid rgba(255,255,255,0.1)' 
    },
    transcriptContainer: { 
        height: '100%', 
        overflowY: 'auto', 
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    transcriptLine: { 
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderRadius: '8px',
        margin: 0
    },
    transcriptBubble: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '80%'
    },
    transcriptHanzi: {
        fontSize: '1rem',
        fontWeight: '500'
    },
    speakerName: {
        fontSize: '0.8rem',
        opacity: 0.8
    },
    bottomArea: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        padding: '20px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255,255,255,0.1)'
    },
    translationArea: {
        marginBottom: '15px',
        textAlign: 'center'
    },
    translationText: { 
        color: 'white', 
        fontSize: '1.2rem', 
        margin: 0, 
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        minHeight: '1.5em'
    },
    controls: {
        display: 'flex',
        justifyContent: 'center',
        gap: '20px'
    },
    pinyin: { 
        margin: '0 0 4px 0', 
        opacity: 0.7, 
        fontSize: '1rem' 
    },
    hanzi: { 
        margin: 0, 
        fontSize: '1.6rem', 
        fontWeight: 'bold' 
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
        fontSize: '1.1rem', 
        backdropFilter: 'blur(5px)',
        transition: 'all 0.2s ease'
    }
};

export default DuiHua;
