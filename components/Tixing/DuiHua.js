// components/Tixing/DuiHua.js
import React, 'react';
import { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaTimes } from 'react-icons/fa';

// --- TTS 引擎 (无需改动) ---
let ttsCache = new Map();
const getTTSAudio = async (text, voice) => { /* ... TTS 获取逻辑 ... */ };
const playTTS = async (text, voice) => { /* ... TTS 播放逻辑 ... */ };

const DuiHua = (props) => {
    // 智能数据处理，兼容两种数据传入方式，防止崩溃
    const data = props.data && props.data.dialogue ? props.data : props;

    // 增加一个状态来控制全屏显示
    const [isFullScreen, setIsFullScreen] = useState(false);

    // 如果没有数据，不渲染任何东西
    if (!data || !data.dialogue || !data.characters) {
        return null; // 或者可以返回一个错误提示
    }

    // 主组件逻辑
    const FullScreenDialogue = ({ onClose }) => {
        const { id, title, imageSrc, characters, dialogue } = data;

        const [currentLineIndex, setCurrentLineIndex] = useState(null);
        const [isPlaying, setIsPlaying] = useState(false);
        const [transcript, setTranscript] = useState([]);
        const audioRef = useRef(null);
        const timeoutRef = useRef(null);

        // 重置并预加载音频
        useEffect(() => {
            dialogue.forEach(line => {
                const voice = characters[line.speaker]?.voice;
                getTTSAudio(line.hanzi, voice);
            });
            // 组件加载后自动播放
            handlePlayPause();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [id]);

        // 清理函数
        useEffect(() => {
            return () => {
                clearTimeout(timeoutRef.current);
                audioRef.current?.pause();
            }
        }, []);

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

        const handlePlayPause = () => {
            clearTimeout(timeoutRef.current);
            if (isPlaying) {
                setIsPlaying(false);
                audioRef.current?.pause();
            } else {
                setIsPlaying(true);
                // 如果是暂停后继续，从当前行播放；否则从头或下一行开始
                let nextIndex = currentLineIndex;
                if (nextIndex === null || nextIndex >= dialogue.length - 1) {
                    nextIndex = 0; // 从头开始
                    setTranscript([]); // 重置历史记录
                } else if (!audioRef.current || audioRef.current.paused) {
                    // 如果是暂停状态，就从当前行继续
                } else {
                    nextIndex++; // 否则播放下一行
                }
                playLine(nextIndex);
            }
        };

        const handleBubbleClick = () => {
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
                    @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
                    @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                    .fade-in { animation: fadeIn 0.5s ease-out forwards; }
                    .fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
                    .bubble { position: relative; }
                    .bubble.bubble-a::after { content: ''; position: absolute; left: -10px; bottom: 8px; width: 0; height: 0; border: 12px solid transparent; border-right-color: #3b82f6; border-left: 0; }
                    .bubble.bubble-b::after { content: ''; position: absolute; right: -10px; bottom: 8px; width: 0; height: 0; border: 12px solid transparent; border-left-color: #f9fafb; border-right: 0; }
                `}</style>
                <div style={styles.fullScreenContainer} className="fade-in">
                    <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                    <div style={styles.overlay}></div>
                    <button onClick={onClose} style={styles.closeButton} aria-label="关闭"><FaTimes /></button>

                    <div style={styles.transcriptContainer}>
                        {transcript.map((line, tIndex) => (
                            <div key={tIndex} style={styles.transcriptLine}>
                                <span style={{color: line.speaker === 'A' ? '#93c5fd' : '#fcd34d'}}>
                                    {characters[line.speaker]?.name || line.speaker}:
                                </span>
                                <span>{line.hanzi}</span>
                            </div>
                        ))}
                    </div>

                    {currentLine && (
                        <div style={styles.mainBubbleArea} className="fade-in-up">
                            <div 
                                className={`bubble ${currentLine.speaker === 'B' ? 'bubble-b' : 'bubble-a'}`}
                                style={{...styles.bubble, ...(currentLine.speaker === 'B' ? styles.bubbleB : styles.bubbleA)}}
                                onClick={handleBubbleClick}
                            >
                                <p style={styles.pinyin}>{currentLine.pinyin}</p>
                                <p style={styles.hanzi}>{currentLine.hanzi}</p>
                            </div>
                        </div>
                    )}

                    <div style={styles.footer}>
                        <button onClick={handlePlayPause} style={styles.playButton} aria-label="播放/暂停">
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
    // 触发按钮样式
    triggerButton: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
        padding: '16px', borderRadius: '12px', border: 'none',
        backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold',
        cursor: 'pointer', transition: 'all 0.2s ease',
    },
    // 全屏容器
    fullScreenContainer: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#000', zIndex: 1000,
        display: 'flex', flexDirection: 'column',
    },
    // 加载或错误提示
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    // 背景与遮罩
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.7) 100%)' },
    // 关闭按钮
    closeButton: { position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, fontSize: '1.2rem' },
    // 顶部历史记录
    transcriptContainer: { position: 'absolute', top: '20px', left: '20px', right: '20px', padding: '16px', maxHeight: '35%', overflowY: 'auto', zIndex: 5, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)' },
    transcriptLine: { marginBottom: '8px', opacity: 0.9 },
    // 中间气泡区域
    mainBubbleArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, padding: '0 5%' },
    bubble: { maxWidth: '60%', minWidth: '200px', padding: '16px 24px', borderRadius: '24px', boxShadow: '0 5px 20px rgba(0,0,0,0.4)', cursor: 'pointer' },
    bubbleA: { backgroundColor: '#3b82f6', color: 'white', borderBottomLeftRadius: '4px' },
    bubbleB: { backgroundColor: '#f9fafb', color: '#1f2937', borderBottomRightRadius: '4px' },
    pinyin: { margin: '0 0 4px 0', opacity: 0.7, fontSize: '1rem' },
    hanzi: { margin: 0, fontSize: '1.6rem', fontWeight: 'bold' },
    // 底部控制栏
    footer: { position: 'relative', display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 5 },
    playButton: { background: '#fff', color: '#333', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' },
    translationArea: { flex: 1, padding: '0 20px', textAlign: 'center' },
    translationText: { color: 'white', fontSize: '1.2rem', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.5)' },
};

// 完整的TTS函数定义
// (将您之前代码中的 getTTSAudio 和 playTTS 函数完整地粘贴到这里)
getTTSAudio = async (text, voice) => {
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

playTTS = async (text, voice) => {
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


export default DuiHua;
