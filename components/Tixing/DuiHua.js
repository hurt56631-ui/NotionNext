// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaWifi } from 'react-icons/fa';
import { FiBatteryCharging } from 'react-icons/fi';
import { pinyin } from 'pinyin-pro';

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
    // 停止所有其他正在播放的音频
    ttsCache.forEach(a => { if (a && !a.paused) { a.pause(); a.currentTime = 0; } });
    const audio = await getTTSAudio(text, voice, rate);
    audio?.play();
    return audio;
};

// ========================================================================
//                           主组件
// ========================================================================
const DuiHua = (props) => {
    // 智能数据处理，兼容 scenes 数组和单个 data 对象
    const scene = props.scenes ? props.scenes[0] : (props.data || null);

    if (!scene || !scene.dialogue || !scene.characters) {
        return <div style={styles.loadingOrError}>正在加载对话数据...</div>;
    }

    const { id, title, imageSrc, characters, dialogue } = scene;
    const [currentTime, setCurrentTime] = useState('');
    const [currentlyPlaying, setCurrentlyPlaying] = useState(null); // 记录正在播放的句子索引
    const audioRef = useRef(null);

    // 更新时间
    useEffect(() => {
        const update = () => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
        update();
        const timer = setInterval(update, 60000);
        return () => clearInterval(timer);
    }, []);
    
    // 预加载所有音频
    useEffect(() => {
        dialogue.forEach(line => {
            const character = characters[line.speaker];
            if (character) {
                getTTSAudio(line.hanzi, character.voice, character.rate);
            }
        });
    }, [id, dialogue, characters]);

    const handlePlayLine = async (line, index) => {
        const character = characters[line.speaker];
        if (!character) return;

        setCurrentlyPlaying(index); // 设置高亮
        audioRef.current = await playTTS(line.hanzi, character.voice, character.rate);

        if (audioRef.current) {
            // 播放结束后移除高亮
            audioRef.current.onended = () => setCurrentlyPlaying(null);
        } else {
            // 如果音频加载失败，也立即移除高亮
            setCurrentlyPlaying(null);
        }
    };

    const speakerKeys = Object.keys(characters);
    const speakerAKey = speakerKeys[0];

    return (
        <>
            <style>{`
                @keyframes breathe { 0%, 100% { opacity: 0.2; transform: scale(0.9); } 60% { opacity: 0.8; transform: scale(1); } }
                .bubble-a::after { content: ''; position: absolute; left: -8px; top: 10px; width: 0; height: 0; border: 10px solid transparent; border-right-color: #f3f4f6; border-left: 0; }
                .bubble-b::after { content: ''; position: absolute; right: -8px; top: 10px; width: 0; height: 0; border: 10px solid transparent; border-left-color: #3b82f6; border-right: 0; }
                .chat-container ::-webkit-scrollbar { width: 4px; }
                .chat-container ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.4); border-radius: 4px; }
            `}</style>
            <div style={styles.phoneShell}>
                <div style={styles.phoneScreen}>
                    <div style={styles.statusBar}>
                        <span>{currentTime}</span>
                        <div style={styles.cameraNotch}>
                            <div style={{...styles.breathingLight, animationDelay: '0s'}}></div>
                            <div style={{...styles.breathingLight, animationDelay: '0.6s'}}></div>
                            <div style={{...styles.breathingLight, animationDelay: '1.2s'}}></div>
                        </div>
                        <div style={styles.statusIcons}><FaWifi size={14} /><FiBatteryCharging size={16} /></div>
                    </div>
                    <div style={styles.chatContainer} className="chat-container">
                        <img src={imageSrc} alt={title} style={styles.backgroundImage} />
                        <div style={styles.overlay}></div>
                        <div style={styles.transcriptContainer}>
                            {dialogue.map((line, index) => {
                                const isSpeakerA = line.speaker === speakerAKey;
                                const character = characters[line.speaker];
                                const isActive = currentlyPlaying === index;
                                return (
                                    <div key={index} style={{...styles.transcriptLine, alignSelf: isSpeakerA ? 'flex-start' : 'flex-end'}}>
                                        {isSpeakerA && <img src={character?.avatarSrc} style={styles.avatar} alt={character?.name} />}
                                        <div className={`bubble ${isSpeakerA ? 'bubble-a' : 'bubble-b'}`} 
                                             style={{...styles.transcriptBubble, ...(isSpeakerA ? styles.transcriptBubbleA : styles.transcriptBubbleB), ...(isActive ? styles.activeBubble : {})}} 
                                             onClick={() => handlePlayLine(line, index)}>
                                            <p style={styles.pinyin}>{pinyin(line.hanzi)}</p>
                                            <p style={styles.transcriptHanzi}>{line.hanzi}</p>
                                            {line.myanmar && <p style={styles.myanmarText}>{line.myanmar}</p>}
                                        </div>
                                        {!isSpeakerA && <img src={character?.avatarSrc} style={styles.avatar} alt={character?.name} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- 样式表 ---
const styles = {
    // 外层手机壳
    phoneShell: { position: 'relative', width: '100%', maxWidth: '420px', height: '85vh', minHeight: '600px', margin: '2rem auto', backgroundColor: '#111', borderRadius: '40px', padding: '12px', boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)' },
    phoneScreen: { width: '100%', height: '100%', backgroundColor: '#000', borderRadius: '28px', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' },
    statusBar: { position: 'absolute', top: 0, left: 0, right: 0, height: '44px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', fontSize: '12px', fontWeight: '600', zIndex: 10, paddingTop: '12px' },
    cameraNotch: { position: 'absolute', top: '0px', left: '50%', transform: 'translateX(-50%)', width: '140px', height: '28px', backgroundColor: '#111', borderRadius: '0 0 18px 18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' },
    breathingLight: { width: '6px', height: '6px', backgroundColor: '#52525b', borderRadius: '50%', animation: 'breathe 2.5s infinite ease-in-out' },
    statusIcons: { display: 'flex', alignItems: 'center', gap: '6px' },
    // 聊天容器
    loadingOrError: { textAlign: 'center', padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#7f1d1d', backgroundColor: '#fef2f2', borderRadius: '12px' },
    chatContainer: { flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' },
    backgroundImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 1 },
    transcriptContainer: { position: 'relative', zIndex: 2, flex: '1 1 auto', paddingTop: '44px', paddingBottom: '16px', paddingLeft: '12px', paddingRight: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' },
    transcriptLine: { display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '80%' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' },
    transcriptBubble: { position: 'relative', padding: '8px 14px', borderRadius: '18px', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    activeBubble: { transform: 'scale(1.03)', boxShadow: '0 0 20px rgba(59, 130, 246, 0.7)' },
    transcriptBubbleA: { backgroundColor: '#f3f4f6', color: '#1f2937', borderTopLeftRadius: '5px' },
    transcriptBubbleB: { backgroundColor: '#3b82f6', color: '#fff', borderTopRightRadius: '5px' },
    pinyin: { margin: '0 0 1px 0', fontSize: '0.75rem', color: 'inherit', opacity: 0.7, letterSpacing: '-0.5px' },
    transcriptHanzi: { margin: 0, fontSize: '1rem', fontWeight: '500', lineHeight: 1.4 },
    myanmarText: { margin: '8px 0 0 0', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '8px', fontSize: '0.9rem', opacity: 0.8 },
};

export default DuiHua;
