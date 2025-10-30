// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaUser, FaUserFriends } from 'react-icons/fa';

// --- TTS Logic (Adapted from your TingLiZhuJu.js) ---
let ttsCache = new Map();

// MODIFIED: Now accepts a 'voice' parameter
const getTTSAudio = async (text, voice) => {
    const cacheKey = `${text}|${voice}`;
    if (ttsCache.has(cacheKey)) {
        return ttsCache.get(cacheKey);
    }
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('TTS API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(cacheKey, audio);
        return audio;
    } catch (e) {
        console.error(`Failed to get TTS for "${text}" with voice "${voice}":`, e);
        return null;
    }
};

const playTTS = async (text, voice) => {
    const audio = await getTTSAudio(text, voice);
    audio?.play();
    return audio;
};
// -----------------------------------------------------------

const DuiHua = ({ data }) => {
    const { title, imageSrc, characters, dialogue } = data;
    
    const [currentLine, setCurrentLine] = useState(null);
    const [isPlayingAll, setIsPlayingAll] = useState(false);
    const [rolePlayMode, setRolePlayMode] = useState(null);
    
    const currentAudio = useRef(null);
    const lineRefs = useRef([]);

    // Preload all TTS audio when component mounts or data changes
    useEffect(() => {
        dialogue.forEach(line => {
            const voice = characters[line.speaker]?.voice;
            if (voice) {
                getTTSAudio(line.hanzi, voice);
            }
        });
    }, [data]);

    const playLine = async (index) => {
        if (currentAudio.current) {
            currentAudio.current.pause();
            currentAudio.current.currentTime = 0;
        }

        const line = dialogue[index];
        const speakerInfo = characters[line.speaker];
        
        // Skip playing audio if in role-play mode for this character
        if (rolePlayMode && line.speaker === rolePlayMode) {
            setCurrentLine(index);
            if (isPlayingAll) handleAudioEnd(index); // Move to next line automatically
            return;
        }

        setCurrentLine(index);
        const audio = await playTTS(line.hanzi, speakerInfo.voice);
        currentAudio.current = audio;
        if (audio) {
            audio.onended = () => handleAudioEnd(index);
        }
    };
    
    const handleAudioEnd = (playedIndex) => {
        if (isPlayingAll) {
            const nextIndex = playedIndex + 1;
            if (nextIndex < dialogue.length) {
                // Add a slight delay for natural pacing
                setTimeout(() => playLine(nextIndex), 400); 
            } else {
                setIsPlayingAll(false);
                setCurrentLine(null);
            }
        } else {
            setCurrentLine(null);
        }
    };

    const handlePlayAll = () => {
        if (isPlayingAll) {
            currentAudio.current?.pause();
            setIsPlayingAll(false);
            setCurrentLine(null);
        } else {
            setIsPlayingAll(true);
            playLine(0);
        }
    };
    
    useEffect(() => {
        if (currentLine !== null && lineRefs.current[currentLine]) {
            lineRefs.current[currentLine].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentLine]);

    const getSpeaker = (line) => characters[line.speaker];
    const activeSpeaker = currentLine !== null ? dialogue[currentLine].speaker : null;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>{title}</h3>
                {imageSrc && <img src={imageSrc} alt={title} style={styles.sceneImage} />}
            </div>

            <div style={styles.mainContent}>
                {/* Speaker A Avatar */}
                <div style={styles.characterPanel}>
                    <img
                        src={characters.A.imageSrc}
                        alt={characters.A.name}
                        style={{...styles.avatar, ...(activeSpeaker === 'A' ? styles.avatarActive : {})}}
                    />
                    <div style={styles.characterName}>{characters.A.name}</div>
                </div>

                {/* Dialogue Area */}
                <div style={styles.dialogueArea}>
                     <div style={styles.controls}>
                        <button onClick={handlePlayAll} style={styles.playAllButton}>
                            {isPlayingAll ? <FaPause /> : <FaPlay />} {isPlayingAll ? '暂停' : '全部播放'}
                        </button>
                        <div style={styles.rolePlayControls}>
                            <span>角色扮演:</span>
                            <button onClick={() => setRolePlayMode(null)} style={{...styles.roleButton, ...(rolePlayMode === null ? styles.roleButtonActive : {})}}><FaUserFriends /> 旁听</button>
                            <button onClick={() => setRolePlayMode('B')} style={{...styles.roleButton, ...(rolePlayMode === 'B' ? styles.roleButtonActive : {})}}>我是 {characters.A.name}</button>
                            <button onClick={() => setRolePlayMode('A')} style={{...styles.roleButton, ...(rolePlayMode === 'A' ? styles.roleButtonActive : {})}}>我是 {characters.B.name}</button>
                        </div>
                    </div>
                    <div style={styles.dialogueLines}>
                        {dialogue.map((line, index) => {
                            const speaker = getSpeaker(line);
                            const isSpeakerA = line.speaker === 'A';
                            return (
                                <div
                                    key={index}
                                    ref={el => lineRefs.current[index] = el}
                                    style={{...styles.lineWrapper, ...(isSpeakerA ? styles.lineWrapperA : styles.lineWrapperB)}}
                                    onClick={() => playLine(index)}
                                >
                                    <div style={{...styles.lineBubble, ...(isSpeakerA ? styles.lineBubbleA : styles.lineBubbleB), ...(currentLine === index ? styles.lineBubbleActive : {})}}>
                                        <p style={styles.pinyin}>{line.pinyin}</p>
                                        <p style={styles.hanzi}>{line.hanzi}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Speaker B Avatar */}
                <div style={styles.characterPanel}>
                    <img
                        src={characters.B.imageSrc}
                        alt={characters.B.name}
                        style={{...styles.avatar, ...(activeSpeaker === 'B' ? styles.avatarActive : {})}}
                    />
                    <div style={styles.characterName}>{characters.B.name}</div>
                </div>
            </div>
        </div>
    );
};

// --- Styles ---
const styles = {
    container: { backgroundColor: '#f8fafc', borderRadius: '24px', padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '1100px', margin: '2rem auto', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' },
    header: { textAlign: 'center', marginBottom: '24px' },
    title: { fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b', margin: '0 0 16px 0' },
    sceneImage: { maxWidth: '100%', maxHeight: '200px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
    mainContent: { display: 'grid', gridTemplateColumns: '150px 1fr 150px', gap: '24px', alignItems: 'flex-start' },
    characterPanel: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingTop: '20px' },
    avatar: { width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #e2e8f0', transition: 'all 0.3s ease', filter: 'grayscale(50%)' },
    avatarActive: { transform: 'scale(1.15)', boxShadow: '0 0 20px 5px rgba(59, 130, 246, 0.5)', borderColor: '#3b82f6', filter: 'grayscale(0%)' },
    characterName: { fontWeight: '600', color: '#475569' },
    dialogueArea: { display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0' },
    controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' },
    playAllButton: { padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    rolePlayControls: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' },
    roleButton: { padding: '8px 12px', borderRadius: '20px', border: '1px solid #cbd5e0', backgroundColor: 'white', cursor: 'pointer' },
    roleButtonActive: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' },
    dialogueLines: { maxHeight: '450px', overflowY: 'auto', padding: '10px 5px' },
    lineWrapper: { display: 'flex', marginBottom: '12px', maxWidth: '85%' },
    lineWrapperA: { justifyContent: 'flex-start' },
    lineWrapperB: { justifyContent: 'flex-end', marginLeft: 'auto' },
    lineBubble: { padding: '10px 16px', borderRadius: '18px', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    lineBubbleA: { backgroundColor: '#eef2ff', borderTopLeftRadius: '4px' },
    lineBubbleB: { backgroundColor: '#f0f9ff', color: '#0c4a6e', borderTopRightRadius: '4px' },
    lineBubbleActive: { transform: 'scale(1.03)', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)' },
    pinyin: { margin: '0 0 4px 0', color: '#64748b', fontSize: '0.9rem' },
    hanzi: { margin: 0, color: '#1e293b', fontSize: '1.2rem', fontWeight: '500' },
};

export default DuiHua;
