import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';
import { useDrag } from '@use-gesture/react'; // 引入手势库

// --- TTS 引擎 (无变动) ---
const ttsCache = new Map();
const playTTS = async (text, voice, rate = 0) => {
    ttsCache.forEach(a => { if (a && !a.paused) { a.pause(); a.currentTime = 0; } });
    if (!text || !voice) return null;
    const cacheKey = `${text}|${voice}|${rate}`;
    if (ttsCache.has(cacheKey)) {
        const audio = ttsCache.get(cacheKey);
        audio.currentTime = 0;
        await audio.play();
        return audio;
    }
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('TTS API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(cacheKey, audio);
        await audio.play();
        return audio;
    } catch (e) { console.error(`Failed to get TTS for "${text}"`, e); return null; }
};

// ========================================================================
//                           主组件
// ========================================================================
const DuiHua = ({ data, onComplete, settings }) => {
    const { id, title, imageSrc, characters, dialogue } = data;
    const [currentLineIndex, setCurrentLineIndex] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const audioRef = useRef(null);
    const timeoutRef = useRef(null);
    const isExiting = useRef(false);

    // [核心修改] 定义上滑手势
    const bind = useDrag(({ swipe: [, swipeY], event, down }) => {
        // swipeY 为 -1 表示向上快速滑动
        if (!down && swipeY === -1) {
            handleNext();
        }
    }, { axis: 'y', filterTaps: true, preventDefault: true });

    const handleNext = () => {
        if (!isExiting.current) {
            isExiting.current = true;
            onComplete();
        }
    };

    useEffect(() => {
        document.body.style.overscrollBehaviorY = 'contain';
        const preventPullToRefresh = (e) => e.preventDefault();
        document.body.addEventListener('touchmove', preventPullToRefresh, { passive: false });
        
        dialogue.forEach(line => {
            const character = characters[line.speaker];
            playTTS(line.hanzi, character?.voice, character?.rate || 0).then(audio => audio?.pause());
        });
        
        const startTimer = setTimeout(() => setIsPlaying(true), 800);

        return () => {
            document.body.style.overscrollBehaviorY = 'auto';
            document.body.removeEventListener('touchmove', preventPullToRefresh);
            clearTimeout(startTimer);
            clearTimeout(timeoutRef.current);
            ttsCache.forEach(a => { if (a && !a.paused) a.pause(); });
        };
    }, [id, dialogue, characters]);

    const playLine = async (index, isRepeating = false) => {
        clearTimeout(timeoutRef.current);
        if (index >= dialogue.length) {
            setIsPlaying(false);
            setIsFinished(true);
            // [核心修改] 对话自动结束后，延迟一段时间自动进入下一环节
            timeoutRef.current = setTimeout(handleNext, 3000); // 延迟3秒
            return;
        }
        setIsFinished(false);
        setCurrentLineIndex(index);
        const line = dialogue[index];
        const character = characters[line.speaker];
        audioRef.current = await playTTS(line.hanzi, character?.voice, character?.rate || 0);
        if (audioRef.current) {
            audioRef.current.onended = () => {
                if (isPlaying && !isRepeating) {
                    timeoutRef.current = setTimeout(() => playLine(index + 1), 800);
                }
            };
        }
    };

    useEffect(() => {
        if (isPlaying) {
            const nextIndex = currentLineIndex === null || currentLineIndex >= dialogue.length - 1 ? 0 : currentLineIndex + 1;
            playLine(nextIndex);
        } else {
            audioRef.current?.pause();
        }
    }, [isPlaying]);

    const handleBubbleClick = () => {
        if (currentLineIndex !== null) playLine(currentLineIndex, true);
    };
    
    const currentLine = currentLineIndex !== null ? dialogue[currentLineIndex] : null;
    const speakerKeys = Object.keys(characters);
    const speakerAKey = speakerKeys[0];

    return (
        // [核心修改] 将手势绑定到主容器上
        <div style={styles.fullScreenContainer} {...bind()}>
            <style>{`
                @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                @keyframes bounce-up-light {
                    0%, 100% { transform: translateY(0); opacity: 1; }
                    50% { transform: translateY(-15px); opacity: 0.7; }
                }
                .bubble { animation: fadeInUp 0.5s ease-out; }
                .bubble-a::after { content: ''; position: absolute; left: 20px; bottom: -14px; width: 0; height: 0; border: 15px solid transparent; border-top-color: #f3f4f6; border-bottom: 0; border-left: 0; }
                .bubble-b::after { content: ''; position: absolute; right: 20px; bottom: -14px; width: 0; height: 0; border: 15px solid transparent; border-top-color: #3b82f6; border-bottom: 0; border-right: 0; }
                .animate-bounce-up-light { animation: bounce-up-light 2s infinite ease-in-out; }
            `}</style>
            <img src={imageSrc} alt={title} style={styles.backgroundImage} />
            <div style={styles.overlay}></div>
            {currentLine && (
                <div style={{...styles.bubbleArea, justifyContent: currentLine.speaker === speakerAKey ? 'flex-start' : 'flex-end'}}>
                    <div className={`bubble ${currentLine.speaker === speakerAKey ? 'bubble-a' : 'bubble-b'}`} style={{...styles.bubble, ...(currentLine.speaker === speakerAKey ? styles.bubbleA : styles.bubbleB)}} onClick={handleBubbleClick}>
                        <p style={styles.pinyin}>{pinyin(currentLine.hanzi)}</p>
                        <p style={styles.hanzi}>{currentLine.hanzi}</p>
                        {currentLine.myanmar && <p style={styles.myanmarText}>{currentLine.myanmar}</p>}
                    </div>
                </div>
            )}
            
            {/* [核心修改] 移除了丑陋的按钮，用优雅的提示替代 */}
            <div style={styles.controlsArea}>
                <button onClick={() => setIsPlaying(p => !p)} style={{...styles.controlButton, opacity: isFinished ? 0.5 : 1}} disabled={isFinished}>
                    {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
            </div>
            
            {isFinished && (
                 <div style={styles.swipeUpHint}>
                    <div className="animate-bounce-up-light">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '3rem', height: '3rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p style={styles.hintText}>上滑继续</p>
                 </div>
            )}
        </div>
    );
};

// --- 样式表 ---
const styles = {
    fullScreenContainer: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#000', zIndex: 100, touchAction: 'pan-y' }, // 允许垂直拖动
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)', zIndex: 1 },
    bubbleArea: { position: 'absolute', top: '15%', left: '0', right: '0', zIndex: 5, display: 'flex', padding: '0 5%' },
    bubble: { position: 'relative', maxWidth: '65%', padding: '12px 20px', borderRadius: '20px', boxShadow: '0 5px 20px rgba(0,0,0,0.3)', cursor: 'pointer' },
    bubbleA: { backgroundColor: '#f3f4f6', color: '#1f2937', marginRight: 'auto' },
    bubbleB: { backgroundColor: '#3b82f6', color: '#fff', marginLeft: 'auto' },
    pinyin: { margin: '0 0 2px 0', opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.2, letterSpacing: '-0.5px' },
    hanzi: { margin: '0', fontSize: '1.4rem', fontWeight: '500', lineHeight: 1.4 },
    myanmarText: { margin: '10px 0 0 0', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '10px', fontSize: '1rem', opacity: 0.9, lineHeight: 1.5 },
    controlsArea: { position: 'absolute', bottom: '5vh', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: '20px' },
    controlButton: { background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.5rem', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease' },
    // [核心修改] 新增上滑提示的样式
    swipeUpHint: {
        position: 'absolute',
        bottom: '20vh',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        color: 'white',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'none', // 确保提示不会阻挡手势
    },
    hintText: {
        fontSize: '1rem',
        fontWeight: '600',
    },
};

export default DuiHua;
