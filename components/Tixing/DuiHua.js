// components/Tixing/DuiHua.js
import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaUserFriends } from 'react-icons/fa';

// --- TTS Logic ---
let ttsCache = new Map();
const getTTSAudio = async (text, voice) => { /* ... (TTS logic remains the same) ... */ };
const playTTS = async (text, voice) => { /* ... (TTS logic remains the same) ... */ };

// --- Main Component ---
const DuiHua = ({ data }) => {
    // ROBUSTNESS FIX #1: Guard clause for missing data
    if (!data || !data.dialogue || !data.characters) {
        return <div style={{textAlign: 'center', padding: '40px', color: '#dc2626', fontWeight: 'bold'}}>错误：对话数据未加载，请检查!include指令。</div>;
    }

    // ROBUSTNESS FIX #2: Destructure with default values
    const { 
        title = "对话", 
        imageSrc, 
        characters = {}, 
        dialogue = [] 
    } = data;
    
    const [currentLine, setCurrentLine] = useState(null);
    const [isPlayingAll, setIsPlayingAll] = useState(false);
    const [rolePlayMode, setRolePlayMode] = useState(null);
    
    const currentAudio = useRef(null);
    const lineRefs = useRef([]);

    // Preload all TTS audio
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
        if (rolePlayMode && line.speaker === rolePlayMode) {
            setCurrentLine(index);
            if (isPlayingAll) handleAudioEnd(index);
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

    const activeSpeaker = currentLine !== null ? dialogue[currentLine].speaker : null;

    // Ensure characters A and B exist before rendering
    const charA = characters.A || { name: 'A', imageSrc: '' };
    const charB = characters.B || { name: 'B', imageSrc: '' };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>{title}</h3>
                {imageSrc && <img src={imageSrc} alt={title} style={styles.sceneImage} />}
            </div>
            <div style={styles.mainContent}>
                <div style={styles.characterPanel}>
                    <img src={charA.imageSrc} alt={charA.name} style={{...styles.avatar, ...(activeSpeaker === 'A' ? styles.avatarActive : {})}} />
                    <div style={styles.characterName}>{charA.name}</div>
                </div>
                <div style={styles.dialogueArea}>
                    <div style={styles.controls}>
                        <button onClick={handlePlayAll} style={styles.playAllButton}>{isPlayingAll ? <FaPause /> : <FaPlay />} {isPlayingAll ? '暂停' : '全部播放'}</button>
                        <div style={styles.rolePlayControls}>
                            <span>角色扮演:</span>
                            <button onClick={() => setRolePlayMode(null)} style={{...styles.roleButton, ...(rolePlayMode === null ? styles.roleButtonActive : {})}}><FaUserFriends /> 旁听</button>
                            <button onClick={() => setRolePlayMode('B')} style={{...styles.roleButton, ...(rolePlayMode === 'B' ? styles.roleButtonActive : {})}}>我是 {charA.name}</button>
                            <button onClick={() => setRolePlayMode('A')} style={{...styles.roleButton, ...(rolePlayMode === 'A' ? styles.roleButtonActive : {})}}>我是 {charB.name}</button>
                        </div>
                    </div>
                    <div style={styles.dialogueLines}>
                        {dialogue.map((line, index) => {
                            const isSpeakerA = line.speaker === 'A';
                            return (
                                <div key={index} ref={el => lineRefs.current[index] = el} style={{...styles.lineWrapper, ...(isSpeakerA ? styles.lineWrapperA : styles.lineWrapperB)}} onClick={() => playLine(index)}>
                                    <div style={{...styles.lineBubble, ...(isSpeakerA ? styles.lineBubbleA : styles.lineBubbleB), ...(currentLine === index ? styles.lineBubbleActive : {})}}>
                                        <p style={styles.pinyin}>{line.pinyin}</p>
                                        <p style={styles.hanzi}>{line.hanzi}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div style={styles.characterPanel}>
                    <img src={charB.imageSrc} alt={charB.name} style={{...styles.avatar, ...(activeSpeaker === 'B' ? styles.avatarActive : {})}} />
                    <div style={styles.characterName}>{charB.name}</div>
                </div>
            </div>
        </div>
    );
};

// --- Styles (unchanged) ---
const styles = { /* ... your styles ... */ };

// --- TTS Logic Implementation (unchanged) ---
// (The full TTS functions go here)

export default DuiHua;
