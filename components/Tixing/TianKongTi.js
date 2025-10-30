// components/Tixing/TianKongTi.js
import React, { useState, useEffect, useMemo } from 'react';
import { pinyin } from 'pinyin-pro';
import confetti from 'canvas-confetti';
import { Howl } from 'howler';

// --- Sound & TTS Engine ---
let sounds = {
    correct: new Howl({ src: ['/sounds/correct.mp3'] }),
    incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 })
};
let ttsCache = new Map();
const playSound = (name) => sounds[name]?.play();

const getTTSAudio = async (text, voice = 'zh-CN-XiaoyouNeural') => {
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
    ttsCache.forEach(cachedAudio => {
        if (!cachedAudio.paused) {
            cachedAudio.pause();
            cachedAudio.currentTime = 0;
        }
    });
    audio?.play();
};
// -----------------------------------------------------------

// FIXED: Added default value `= {}` to props for robustness
const TianKongTi = ({
    id,
    title,
    words = [],
    imageOptions = [],
    correctAnswers = [],
    onCorrect,
    onNext
} = {}) => {
    const totalBlanks = words.length;

    const [userAnswers, setUserAnswers] = useState(Array(totalBlanks).fill(null));
    const [activeBlankIndex, setActiveBlankIndex] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [feedback, setFeedback] = useState([]);

    const imageLabels = useMemo(() =>
        Array.from({ length: imageOptions.length }, (_, i) => String.fromCharCode(65 + i)),
        [imageOptions.length]
    );

    const getPureText = (text) => text.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').trim();

    useEffect(() => {
        // Guard clause for when data is not ready
        if (!words || words.length === 0) return;

        setUserAnswers(Array(totalBlanks).fill(null));
        setActiveBlankIndex(null);
        setIsSubmitted(false);
        setFeedback([]);
        
        const allWordsText = words.map(getPureText).filter(Boolean);
        
        allWordsText.forEach(text => getTTSAudio(text));

        let currentIndex = 0;
        const playNext = async () => {
            if (currentIndex < allWordsText.length) {
                const audio = await getTTSAudio(allWordsText[currentIndex]);
                if (audio) {
                    audio.onended = playNext;
                    audio.play();
                    currentIndex++;
                } else {
                    // if audio fails, still move on
                    currentIndex++;
                    playNext();
                }
            }
        };
        
        const autoPlayTimeout = setTimeout(playNext, 500);
        return () => clearTimeout(autoPlayTimeout);

    }, [id, words]);

    const handleBlankClick = (blankIndex) => { if (!isSubmitted) setActiveBlankIndex(blankIndex); };
    const handleImageLabelClick = (imageIndex) => {
        if (isSubmitted || activeBlankIndex === null) return;
        const imageId = imageOptions[imageIndex].id;
        const newUserAnswers = [...userAnswers];
        const existingIndex = newUserAnswers.indexOf(imageId);
        if (existingIndex > -1) newUserAnswers[existingIndex] = null;
        newUserAnswers[activeBlankIndex] = imageId;
        setUserAnswers(newUserAnswers);
        setActiveBlankIndex(null);
    };

    const handleSubmit = () => {
        if (userAnswers.some(answer => answer === null)) return;
        const newFeedback = userAnswers.map((answer, index) => answer === correctAnswers[index] ? 'correct' : 'incorrect');
        setFeedback(newFeedback);
        setIsSubmitted(true);
        const isAllCorrect = newFeedback.every(f => f === 'correct');
        if (isAllCorrect) {
            playSound('correct');
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            if (onCorrect) onCorrect();
        } else {
            playSound('incorrect');
        }
        if (onNext) setTimeout(onNext, 2500);
    };

    // Render a loading state if essential data is missing
    if (!words || words.length === 0) {
        return <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>正在加载题目...</div>;
    }

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>{title}</h3>
            {/* ... rest of the JSX is identical to the previous version ... */}
            <div style={styles.imageGrid}>
                {imageOptions.map((opt, index) => (
                    <div key={opt.id} style={styles.imageItem}>
                        <img src={opt.src} alt={opt.word} style={styles.image} />
                        <div style={styles.imageLabel}>{imageLabels[index]}</div>
                    </div>
                ))}
            </div>
            <div style={styles.blanksGrid}>
                {words.map((segment, index) => {
                    const answerId = userAnswers[index];
                    const imageIndex = imageOptions.findIndex(opt => opt.id === answerId);
                    const feedbackClass = feedback[index];
                    const pinyinText = pinyin(getPureText(segment), { toneType: 'symbol' });

                    return (
                        <div key={index} style={styles.blankItem}>
                            <div style={styles.wordClickableArea} onClick={() => playTTS(getPureText(segment))}>
                                <div style={styles.pinyinText}>{pinyinText}</div>
                                <div style={styles.chineseText}>{segment}</div>
                            </div>
                            <div 
                                style={{ ...styles.underlineContainer, ...(isSubmitted ? styles[feedbackClass] : {}) }}
                                onClick={() => handleBlankClick(index)}
                            >
                                {answerId !== null && <span style={styles.answerLabel}>{imageLabels[imageIndex]}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
            {activeBlankIndex !== null && (
                <div style={styles.labelSelectorOverlay} onClick={() => setActiveBlankIndex(null)}>
                    <div style={styles.labelSelector} onClick={e => e.stopPropagation()}>
                        <div style={styles.selectorTitle}>为 "{words[activeBlankIndex]}" 选择图片</div>
                        <div style={styles.labelsGrid}>
                            {imageLabels.map((label, index) => {
                                const isUsed = userAnswers.includes(imageOptions[index].id);
                                return (
                                    <button
                                        key={label}
                                        style={{...styles.labelButton, ...(isUsed && userAnswers[activeBlankIndex] !== imageOptions[index].id ? styles.labelButtonUsed : {})}}
                                        onClick={() => handleImageLabelClick(index)}
                                        disabled={isUsed && userAnswers[activeBlankIndex] !== imageOptions[index].id}
                                    >{label}</button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            <div style={styles.buttonContainer}>
                {!isSubmitted ? (
                    <button 
                        style={{...styles.submitButton, ...(userAnswers.some(a => a === null) ? styles.submitButtonDisabled : {})}} 
                        onClick={handleSubmit} 
                        disabled={userAnswers.some(a => a === null)}
                    >检查答案</button>
                ) : (
                    <button style={{...styles.submitButton, ...styles.nextButton}} onClick={onNext}>下一题 →</button>
                )}
            </div>
        </div>
    );
};

// --- Styles ---
const styles = {
    container: { backgroundColor: '#f8fafc', borderRadius: '16px', padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '1rem auto', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '20px' },
    title: { fontSize: '1.3rem', fontWeight: '600', color: '#334155', textAlign: 'center', margin: 0 },
    imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
    imageItem: { position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '1 / 1', backgroundColor: '#e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
    image: { width: '100%', height: '100%', objectFit: 'cover' },
    imageLabel: { position: 'absolute', top: '6px', left: '6px', backgroundColor: 'rgba(0, 0, 0, 0.5)', color: 'white', borderRadius: '4px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', backdropFilter: 'blur(2px)' },
    blanksGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
    blankItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 8px', borderRadius: '12px', backgroundColor: 'white', border: '1px solid #e2e8f0' },
    wordClickableArea: { cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    pinyinText: { fontSize: '0.8rem', color: '#64748b', marginBottom: '2px', fontFamily: 'Arial, sans-serif' },
    chineseText: { fontSize: '1.2rem', fontWeight: '500', color: '#1e293b' },
    underlineContainer: { width: '80%', height: '30px', borderBottom: '2px solid #9ca3af', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s ease', marginTop: '4px' },
    correct: { borderBottomColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)' },
    incorrect: { borderBottomColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    answerLabel: { backgroundColor: '#3b82f6', color: 'white', borderRadius: '6px', padding: '2px 10px', fontSize: '0.9rem', fontWeight: 'bold' },
    labelSelectorOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    labelSelector: { backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', width: 'clamp(280px, 80vw, 360px)', display: 'flex', flexDirection: 'column', gap: '16px' },
    selectorTitle: { fontSize: '1.1rem', fontWeight: '600', color: '#1e293b', textAlign: 'center' },
    labelsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
    labelButton: { padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease' },
    labelButtonUsed: { backgroundColor: '#9ca3af', cursor: 'not-allowed' },
    buttonContainer: { display: 'flex', justifyContent: 'center', marginTop: '10px' },
    submitButton: { width: '180px', padding: '12px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s ease' },
    submitButtonDisabled: { backgroundColor: '#93c5fd', cursor: 'not-allowed' },
    nextButton: { backgroundColor: '#16a34a' }
};

// FIXED: Changed component name to match your file structure.
export default TianKongTi;
