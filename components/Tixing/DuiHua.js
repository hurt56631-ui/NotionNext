// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaTimes } from 'react-icons/fa';

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

const DuiHua = (props) => {
    const data = props.data && props.data.dialogue ? props.data : props;
    const [isFullScreen, setIsFullScreen] = useState(false);

    if (!data || !data.dialogue || !data.characters) {
        return null;
    }

    // 内部全屏组件
    const FullScreenDialogue = ({ onClose }) => {
        const { id, title, imageSrc, characters, dialogue } = data;
        const [currentLineIndex, setCurrentLineIndex] = useState(null);
        const [isPlaying, setIsPlaying] = useState(false);
        const [transcript, setTranscript] = useState([]);
        const audioRef = useRef(null);
        const timeoutRef = useRef(null);
        
        // 定义说话者A和B的key
        const speakerKeys = Object.keys(characters);
        const speakerAKey = speakerKeys[0];
        const speakerBKey = speakerKeys[1];


        useEffect(() => {
            dialogue.forEach(line => {
                const voice = characters[line.speaker]?.voice;
                getTTSAudio(line.hanzi, voice);
            });
            handlePlayPause();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [id]);

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
                let nextIndex = currentLineIndex;
                if (nextIndex === null || nextIndex >= dialogue.length - 1) {
                    nextIndex = 0;
                    setTranscript([]);
                } else if (!audioRef.current || audioRef.current.paused) {
                    // Resume from current
                } else {
                    nextIndex++;
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
                    .bubble-a::after { content: ''; position: absolute; left: -10px; bottom: 8px; width: 0; height: 0; border: 12px solid transparent; border-right-color: #3b82f6; border-left: 0; }
                    .bubble-b::after { content: ''; position: absolute; right: -10px; bottom: 8px; width: 0; height: 0; border: 12px solid transparent; border-left-color: #f9fafb; border-right: 0; }
                `}</style>
                <div style={styles.fullScreenContainer} className="fade-in">
                    <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                    <div style={styles.overlay}></div>
                    <button onClick={onClose} style={styles.closeButton} aria-label="关闭"><FaTimes /></button>

                    <div style={styles.transcriptContainer}>
                        {transcript.map((line, tIndex) => (
                            <div key={tIndex} style={styles.transcriptLine}>
                                <span style={{color: line.speaker === speakerAKey ? '#93c5fd' : '#fcd34d'}}>
                                    {characters[line.speaker]?.name || line.speaker}:
                                </span>
                                <span>{line.hanzi}</span>
                            </div>
                        ))}
                    </div>

                    {currentLine && (
                        <div style={styles.mainBubbleArea} className="fade-in-up">
                            <div 
                                className={`bubble ${currentLine.speaker === speakerBKey ? 'bubble-b' : 'bubble-a'}`}
                                style={{...styles.bubble, ...(currentLine.speaker === speakerBKey ? styles.bubbleB : styles.bubbleA)}}
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

// --- 样式表 (无需改动) ---
const styles = { /* ... */ };
// (样式表代码与上一版完全相同，为简洁此处省略)
// ...

export default DuiHua;
