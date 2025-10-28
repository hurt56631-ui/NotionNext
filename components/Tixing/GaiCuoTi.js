// components/Tixing/GaiCuoTiV2.js
import React, { useState, useEffect, useReducer, useCallback } from 'react';

// --- 自定义 Hook: 管理音效 ---
const useSoundEffects = (volume = 0.5) => {
    const [audioContext, setAudioContext] = useState(null);
    const [sounds, setSounds] = useState({});

    useEffect(() => {
        // 创建 AudioContext，需要用户交互才能激活
        const initAudio = () => {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            setAudioContext(context);
            window.removeEventListener('click', initAudio);
        };
        window.addEventListener('click', initAudio, { once: true });

        // 加载音效文件
        const soundSources = {
            click: '/sounds/click.mp3',
            correct: '/sounds/correct.mp3',
            incorrect: '/sounds/incorrect.mp3',
        };

        const loadSounds = async () => {
            if (!audioContext) return;
            const loadedSounds = {};
            for (const key in soundSources) {
                try {
                    const response = await fetch(soundSources[key]);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    loadedSounds[key] = audioBuffer;
                } catch (error) {
                    console.error(`加载音效'${key}'失败:`, error);
                }
            }
            setSounds(loadedSounds);
        };

        if (audioContext) {
            loadSounds();
        }

        return () => {
            audioContext?.close();
        };
    }, [audioContext]);

    const playSound = useCallback((name) => {
        if (audioContext && sounds[name] && audioContext.state === 'running') {
            const source = audioContext.createBufferSource();
            source.buffer = sounds[name];
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
            source.connect(gainNode).connect(audioContext.destination);
            source.start(0);
        }
    }, [audioContext, sounds, volume]);

    return playSound;
};

// --- 状态管理 Reducer ---
const initialState = {
    selectedIndices: new Set(),
    isSubmitted: false,
    isCorrect: false,
};

function reducer(state, action) {
    switch (action.type) {
        case 'TOGGLE_SELECTION': {
            if (state.isSubmitted) return state;
            const newSelection = new Set(state.selectedIndices);
            if (newSelection.has(action.index)) {
                newSelection.delete(action.index);
            } else {
                newSelection.add(action.index);
            }
            return { ...state, selectedIndices: newSelection };
        }
        case 'SUBMIT': {
            const { correctAnswers } = action;
            const isCorrect = state.selectedIndices.size === correctAnswers.size &&
                [...state.selectedIndices].every(index => correctAnswers.has(index));
            return { ...state, isSubmitted: true, isCorrect };
        }
        case 'RESET':
            return initialState;
        default:
            throw new Error('未知的 action 类型');
    }
}

// --- SVG 图标 ---
const SpeakerIcon = ({ isSpeaking }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '8px', color: '#475569', transition: 'color 0.2s' }}>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        {isSpeaking ? (
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" style={{ animation: 'pulse-wave 1.5s infinite ease-out' }}></path>
        ) : (
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        )}
    </svg>
);


const GaiCuoTi = ({
    title = '改错题',
    sentence,
    correctAnswers = [],
    explanation = '',
    corrections = [],
    onCorrect = () => { }
}) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { selectedIndices, isSubmitted, isCorrect } = state;

    const [isSpeaking, setIsSpeaking] = useState(false);
    const playSound = useSoundEffects();

    const segments = sentence.split('');
    const correctAnswersSet = new Set(correctAnswers);

    // 题目变化时重置状态
    useEffect(() => {
        dispatch({ type: 'RESET' });
        // 停止任何正在进行的语音合成
        window.speechSynthesis.cancel();
    }, [sentence]);

    const handleTitleClick = useCallback(() => {
        if (!title || typeof window.speechSynthesis === 'undefined') return;

        // 如果正在朗读，则停止
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(title);
        utterance.lang = 'zh-CN';
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    }, [title, isSpeaking]);

    const handleWordClick = (index) => {
        playSound('click');
        dispatch({ type: 'TOGGLE_SELECTION', index });
    };

    const handleSubmit = () => {
        if (selectedIndices.size === 0) {
            alert('请选择你认为是错误的部分！');
            return;
        }
        dispatch({ type: 'SUBMIT', correctAnswers: correctAnswersSet });

        // 判断答案是否正确并播放相应音效
        const answerIsCorrect = selectedIndices.size === correctAnswersSet.size &&
            [...selectedIndices].every(index => correctAnswersSet.has(index));

        if (answerIsCorrect) {
            playSound('correct');
            onCorrect();
        } else {
            playSound('incorrect');
        }
    };

    const handleReset = () => {
        dispatch({ type: 'RESET' });
    };


    const getWordStyle = (index) => {
        const baseStyle = { ...styles.wordBox };
        const isSelected = selectedIndices.has(index);
        const isCorrectAnswer = correctAnswersSet.has(index);

        if (isSubmitted) {
            if (isSelected && isCorrectAnswer) return { ...baseStyle, ...styles.wordBoxCorrect };
            if (isSelected && !isCorrectAnswer) return { ...baseStyle, ...styles.wordBoxIncorrect };
            if (!isSelected && isCorrectAnswer) return { ...baseStyle, ...styles.wordBoxSolution };
        } else if (isSelected) {
            return { ...baseStyle, ...styles.wordBoxSelected };
        }
        return baseStyle;
    };


    // --- 渲染函数 ---
    const renderFeedback = () => (
        <>
            <div style={{ ...styles.feedback, ...(isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
                {isCorrect ? '🎉 完全正确！' : '🤔 再想想看！'}
            </div>
            {!isCorrect && corrections.length > 0 && (
                <div style={styles.correctionBox}>
                    <strong>修改建议：</strong>
                    {corrections.map((c, i) => (
                        <span key={i}>
                            {i > 0 && '；'} 第 {c.index + 1} 个字应为 “<strong>{c.correct}</strong>”
                        </span>
                    ))}
                </div>
            )}
            {explanation && (
                <div style={styles.explanationBox}>
                    <strong>解析：</strong> {explanation}
                </div>
            )}
            <button style={{ ...styles.submitButton, backgroundColor: '#64748b' }} onClick={handleReset}>
                再试一次
            </button>
        </>
    );

    return (
        <>
            <style>{`
                @keyframes pulse-wave { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
                .title-clickable { cursor: pointer; transition: color 0.3s; }
                .title-clickable:hover { color: #2563eb; }
            `}</style>
            <div style={styles.container}>
                <h3
                    style={{...styles.title, ...(isSpeaking && styles.titleSpeaking)}}
                    className="title-clickable"
                    onClick={handleTitleClick}
                >
                    <SpeakerIcon isSpeaking={isSpeaking} />
                    {title}
                </h3>

                <div style={styles.sentenceContainer}>
                    {segments.map((char, index) => (
                        <span
                            key={index}
                            style={getWordStyle(index)}
                            onClick={() => handleWordClick(index)}
                        >
                            {char}
                        </span>
                    ))}
                </div>

                <div style={styles.buttonContainer}>
                    {isSubmitted ? renderFeedback() : (
                        <button
                            style={styles.submitButton}
                            onClick={handleSubmit}
                            disabled={selectedIndices.size === 0}
                        >
                            检查答案
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};


// --- 内联样式 ---
const styles = {
    container: { backgroundColor: '#f1f5f9', borderRadius: '16px', padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '2rem auto', border: '1px solid #e2e8f0' },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#334155', textAlign: 'center', margin: '0 0 20px 0' },
    titleSpeaking: { color: '#3b82f6' },
    sentenceContainer: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', padding: '16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1' },
    wordBox: { padding: '8px 12px', fontSize: '1.6rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', userSelect: 'none', color: '#1e293b', border: '2px solid transparent' },
    wordBoxSelected: { backgroundColor: '#dbeafe', color: '#1e40af', transform: 'translateY(-2px) scale(1.05)', borderColor: '#93c5fd' },
    wordBoxCorrect: { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#4ade80' },
    wordBoxIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b', textDecoration: 'line-through', borderColor: '#f87171' },
    wordBoxSolution: { outline: '2px dashed #60a5fa', borderRadius: '8px' },
    buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' },
    submitButton: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease' },
    feedback: { padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' },
    feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
    feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
    explanationBox: { backgroundColor: '#fffbeb', color: '#b45309', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', marginTop: '8px', fontSize: '1rem' },
    correctionBox: { backgroundColor: '#e0f2fe', color: '#0c4a6e', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #38bdf8', marginTop: '8px', fontSize: '1rem' },
};


export default GaiCuoTi;
