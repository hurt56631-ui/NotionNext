// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';
import { useDrag } from '@use-gesture/react';

// --- TTS 引擎 ---
let ttsCache = new Map();
const getTTSAudio = async (text, voice, rate = 0) => {
    if (!text || !voice) return null;
    const cacheKey = `${text}|${voice}|${rate}`;
    if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey);
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('TTS API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(cacheKey, audio);
        return audio;
    } catch (e) { console.error(`Failed to get TTS for "${text}"`, e); return null; }
};
const playTTS = async (text, voice, rate) => {
    const audio = await getTTSAudio(text, voice, rate);
    ttsCache.forEach(a => { if (a && !a.paused) { a.pause(); a.currentTime = 0; } });
    audio?.play();
    return audio;
};

// ========================================================================
//                           单个手机场景组件
// ========================================================================
const PhoneInstance = ({ scene, isActive }) => {
    const { id, title, imageSrc, characters, dialogue } = scene;
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

    const playLine = async (index) => {
        if (index >= dialogue.length || !isActive) {
            setIsPlaying(false);
            return;
        }
        setTranscript(dialogue.slice(0, index + 1).map((line, i) => ({ ...line, index: i })));

        const line = dialogue[index];
        const character = characters[line.speaker];
        audioRef.current = await playTTS(line.hanzi, character?.voice, character?.rate);

        if (audioRef.current) {
            audioRef.current.onended = () => {
                if (isActive) {
                    setIsPlaying(currentIsPlaying => {
                        if (currentIsPlaying) {
                            timeoutRef.current = setTimeout(() => playLine(index + 1), 900);
                        }
                        return currentIsPlaying;
                    });
                }
            };
        } else if (isActive) {
             setIsPlaying(currentIsPlaying => {
                if (currentIsPlaying) {
                    timeoutRef.current = setTimeout(() => playLine(index + 1), 900);
                }
                return currentIsPlaying;
            });
        }
    };
    
    useEffect(() => {
        if (isActive) {
            dialogue.forEach(line => {
                const character = characters[line.speaker];
                getTTSAudio(line.hanzi, character?.voice, character?.rate);
            });
            timeoutRef.current = setTimeout(() => setIsPlaying(true), 500);
        } else {
            clearTimeout(timeoutRef.current);
            audioRef.current?.pause();
            setIsPlaying(false);
        }
        return () => { clearTimeout(timeoutRef.current); audioRef.current?.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, id]);

    useEffect(() => {
        clearTimeout(timeoutRef.current);
        if (isActive && isPlaying) {
            const currentIndex = transcript.length > 0 ? transcript[transcript.length - 1].index : -1;
            const nextIndex = currentIndex >= dialogue.length - 1 ? 0 : currentIndex + 1;
            if (nextIndex === 0) setTranscript([]);
            playLine(nextIndex);
        } else {
            audioRef.current?.pause();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    return (
        <div style={styles.phoneScreen}>
            <div style={styles.phoneHeader}><div style={styles.cameraNotch}></div></div>
            <div style={styles.chatContainer} className="chat-container">
                <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                <div style={styles.overlay}></div>
                <div style={styles.transcriptContainer} ref={transcriptRef}>
                    {transcript.map(line => {
                        const isSpeakerA = line.speaker === speakerAKey;
                        const character = characters[line.speaker];
                        return (
                            <div key={line.index} style={{...styles.transcriptLine, alignSelf: isSpeakerA ? 'flex-start' : 'flex-end'}}>
                                {isSpeakerA && <img src={character?.avatarSrc} style={styles.avatar} alt={character?.name} />}
                                <div className={`bubble ${isSpeakerA ? 'bubble-a' : 'bubble-b'}`} style={{...styles.transcriptBubble, ...(isSpeakerA ? styles.transcriptBubbleA : styles.transcriptBubbleB)}} onClick={() => playTTS(line.hanzi, character?.voice, character?.rate)}>
                                    <p style={styles.pinyin}>{pinyin(line.hanzi)}</p>
                                    <p style={styles.transcriptHanzi}>{line.hanzi}</p>
                                    {line.myanmar && <p style={styles.myanmarText}>{line.myanmar}</p>}
                                </div>
                                {!isSpeakerA && <img src={character?.avatarSrc} style={styles.avatar} alt={character?.name} />}
                            </div>
                        );
                    })}
                </div>
                <div style={styles.controlsArea}>
                    <button onClick={() => setIsPlaying(p => !p)} style={styles.controlButton}>{isPlaying ? <FaPause /> : <FaPlay />}</button>
                </div>
            </div>
        </div>
    );
};

// ========================================================================
//                           主容器与滑动逻辑
// ========================================================================
const DuiHua = (props) => {
    const scenes = props.scenes || (props.data ? [props.data] : null);
    if (!scenes || scenes.length === 0) {
        return <div style={styles.loadingOrError}>正在加载对话数据...</div>;
    }

    const [sceneIndex, setSceneIndex] = useState(0);
    const containerRef = useRef(null);

    const bind = useDrag(({ down, movement: [, my], velocity, direction: [, dy], distance, cancel }) => {
        if (!down && distance > (containerRef.current?.offsetHeight ?? 800) / 4) {
            const newIndex = sceneIndex + (dy > 0 ? -1 : 1);
            if (newIndex >= 0 && newIndex < scenes.length) {
                setSceneIndex(newIndex);
            }
            cancel();
        }
    }, { axis: 'y' });

    return (
        <>
            <style>{`
                .bubble-a::after { content: ''; position: absolute; left: -8px; top: 10px; width: 0; height: 0; border: 10px solid transparent; border-right-color: #f9fafb; border-left: 0; }
                .bubble-b::after { content: ''; position: absolute; right: -8px; top: 10px; width: 0; height: 0; border: 10px solid transparent; border-left-color: #3b82f6; border-right: 0; }
                .chat-container ::-webkit-scrollbar { width: 4px; }
                .chat-container ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.3); border-radius: 4px; }
            `}</style>
            <div {...bind()} style={styles.swipeContainer} ref={containerRef}>
                <div style={{ ...styles.sceneWrapper, transform: `translateY(-${sceneIndex * 100}%)` }}>
                    {scenes.map((scene, index) => (
                        <div key={scene.id || index} style={styles.phoneShell}>
                             <div style={styles.powerButton}></div>
                             <div style={styles.volumeUp}></div>
                             <div style={styles.volumeDown}></div>
                            <PhoneInstance scene={scene} isActive={index === sceneIndex} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

// --- 样式表 ---
const styles = {
    swipeContainer: { height: '88vh', minHeight: '650px', maxHeight: '900px', width: '100%', overflow: 'hidden', touchAction: 'pan-y' },
    sceneWrapper: { height: '100%', transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' },
    phoneShell: { position: 'relative', width: '100%', maxWidth: '420px', height: '100%', margin: '0 auto', backgroundColor: '#18181b', borderRadius: '44px', padding: '12px', boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)', border: '1px solid #3f3f46' },
    powerButton: { position: 'absolute', right: '-3px', top: '180px', width: '3px', height: '80px', backgroundColor: '#3f3f46', borderRadius: '0 2px 2px 0' },
    volumeUp: { position: 'absolute', left: '-3px', top: '120px', width: '3px', height: '50px', backgroundColor: '#3f3f46', borderRadius: '2px 0 0 2px' },
    volumeDown: { position: 'absolute', left: '-3px', top: '180px', width: '3px', height: '50px', backgroundColor: '#3f3f46', borderRadius: '2px 0 0 2px' },
    phoneScreen: { width: '100%', height: '100%', backgroundColor: '#000', borderRadius: '32px', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' },
    phoneHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: '28px', backgroundColor: 'black', zIndex: 10 },
    cameraNotch: { position: 'absolute', top: '0px', left: '50%', transform: 'translateX(-50%)', width: '120px', height: '28px', backgroundColor: '#18181b', borderRadius: '0 0 15px 15px' },
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    chatContainer: { flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', paddingTop: '28px' },
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 1 },
    transcriptContainer: { position: 'relative', zIndex: 2, flex: '1 1 auto', padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' },
    transcriptLine: { display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '80%' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' },
    transcriptBubble: { position: 'relative', padding: '8px 14px', borderRadius: '18px', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', cursor: 'pointer' },
    transcriptBubbleA: { backgroundColor: '#f9fafb', color: '#1f2937', borderTopLeftRadius: '5px' },
    transcriptBubbleB: { backgroundColor: '#3b82f6', color: '#fff', borderTopRightRadius: '5px' },
    pinyin: { margin: '0 0 1px 0', fontSize: '0.75rem', color: 'inherit', opacity: 0.6, letterSpacing: '-0.5px' },
    transcriptHanzi: { margin: 0, fontSize: '1rem', fontWeight: '500', lineHeight: 1.4 },
    myanmarText: { margin: '8px 0 0 0', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '8px', fontSize: '0.9rem', opacity: 0.8 },
    controlsArea: { position: 'relative', zIndex: 3, flex: '0 0 auto', padding: '12px', display: 'flex', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' },
    controlButton: { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.3s ease' },
};

export default DuiHua;
