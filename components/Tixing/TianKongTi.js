// components/Tixing/TianKongTi.js
import React, { useState, useEffect } from 'react';
import { pinyin } from 'pinyin-pro';

// --- Mock implementations for demonstration purposes ---
// You should replace these with your actual hooks and assets.
const useTTS = () => ({ speak: (text) => {
    console.log(`Speaking: ${text}`);
    if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        // Cancel any previous speech to avoid overlap
        window.speechSynthesis.cancel(); 
        window.speechSynthesis.speak(utterance);
    }
}, isSpeaking: false });
const useSound = (sound) => [() => { console.log(`Playing sound: ${sound}`); }];
const FaVolumeUp = () => '🔊';
// ---------------------------------------------------------

const TianKongTiImage = ({
    id,
    title,
    words, // CHANGED: Renamed from sentenceSegments for clarity. Expects a simple array of strings.
    imageOptions,
    correctAnswers,
    onCorrect,
    onNext
}) => {
    // FIXED: The number of blanks is now simply the length of the words array.
    const totalBlanks = words.length;

    // --- State Management ---
    const [userAnswers, setUserAnswers] = useState(Array(totalBlanks).fill(null));
    const [activeBlankIndex, setActiveBlankIndex] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [feedback, setFeedback] = useState([]);

    // --- Hooks for Sound and TTS ---
    const { speak, isSpeaking } = useTTS();
    const [playError] = useSound('/sounds/error.mp3', { volume: 0.5 });
    const [playSuccess] = useSound('/sounds/success.mp3', { volume: 0.5 });

    const imageLabels = Array.from({ length: imageOptions.length }, (_, i) => String.fromCharCode(65 + i));

    // --- Reset state and read words when question changes ---
    useEffect(() => {
        setUserAnswers(Array(totalBlanks).fill(null));
        setActiveBlankIndex(null);
        setIsSubmitted(false);
        setFeedback([]);
        
        const allWordsText = words.map(word => word.replace(/[0-9\s岁]/g, '')).join('，');
        if (allWordsText) {
            const speakTimeout = setTimeout(() => speak(allWordsText), 300);
            return () => clearTimeout(speakTimeout);
        }

    }, [id, words]); // FIXED: Added `words` to dependency array

    // --- Interaction Logic ---
    const handleBlankClick = (blankIndex) => {
        if (isSubmitted) return;
        setActiveBlankIndex(blankIndex);
    };

    const handleImageLabelClick = (imageIndex) => {
        if (isSubmitted || activeBlankIndex === null) return;

        const imageId = imageOptions[imageIndex].id;
        const newUserAnswers = [...userAnswers];
        
        const existingIndex = newUserAnswers.indexOf(imageId);
        if (existingIndex > -1) {
            newUserAnswers[existingIndex] = null;
        }

        newUserAnswers[activeBlankIndex] = imageId;
        setUserAnswers(newUserAnswers);
        setActiveBlankIndex(null);
    };

    const handleSubmit = () => {
        if (userAnswers.some(answer => answer === null)) {
            alert('请完成所有填空！');
            return;
        }

        const newFeedback = userAnswers.map((answer, index) => 
            answer === correctAnswers[index] ? 'correct' : 'incorrect'
        );
        setFeedback(newFeedback);
        setIsSubmitted(true);

        const isAllCorrect = newFeedback.every(f => f === 'correct');
        if (isAllCorrect) {
            playSuccess();
            if (onCorrect) onCorrect();
        } else {
            playError();
        }

        setTimeout(() => { if (onNext) onNext(); }, 2000);
    };
    
    // --- Utility Functions ---
    const getPinyin = (text) => {
        const chineseText = text.replace(/[0-9\s]/g, '');
        return pinyin(chineseText, { toneType: 'symbol' });
    };

    const getPureText = (text) => {
        return text.replace(/[0-9\s岁]/g, '').trim();
    };

    // Return null or a loading state if words aren't ready, preventing crashes.
    if (!words || words.length === 0) {
        return <div>Loading question...</div>;
    }

    return (
        <>
            <style>{`...` /* Styles remain the same */}</style>
            <div style={styles.container}>
                <h3 style={styles.title}>{title}</h3>

                {/* Images Section */}
                <div style={styles.imageGrid}>
                    {imageOptions.map((opt, index) => (
                        <div key={opt.id} style={styles.imageItem}>
                            <img src={opt.src} alt={opt.word} style={styles.image} />
                            <div style={styles.imageLabel}>{imageLabels[index]}</div>
                        </div>
                    ))}
                </div>

                {/* Blanks Section */}
                <div style={styles.blanksGrid}>
                    {words.map((segment, index) => {
                        const blankIndex = index;
                        const answerId = userAnswers[blankIndex];
                        const imageIndex = imageOptions.findIndex(opt => opt.id === answerId);
                        const feedbackClass = feedback[blankIndex];
                        const pureText = getPureText(segment);

                        return (
                            <div key={index} style={styles.blankItem}>
                                <div style={styles.wordWithPinyin}>
                                    <div style={styles.pinyinText}>{getPinyin(segment)}</div>
                                    <div style={styles.chineseTextContainer}>
                                        <div style={styles.chineseText}>{segment}</div>
                                        <button 
                                            style={styles.ttsButton}
                                            onClick={(e) => { e.stopPropagation(); speak(pureText); }}
                                            disabled={isSpeaking}
                                            aria-label={`Read ${pureText}`}
                                        >
                                            <FaVolumeUp />
                                        </button>
                                    </div>
                                </div>
                                <div 
                                    style={{
                                        ...styles.underlineContainer,
                                        ...(isSubmitted ? (feedbackClass === 'correct' ? styles.underlineCorrect : styles.underlineIncorrect) : {})
                                    }}
                                    onClick={() => handleBlankClick(blankIndex)}
                                >
                                    {answerId !== null && (
                                        <span style={styles.answerLabel}>{imageLabels[imageIndex]}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* Image Label Selector (Modal) */}
                {activeBlankIndex !== null && (
                    <div style={styles.labelSelector}>
                        <div style={styles.selectorTitle}>请为 "{words[activeBlankIndex]}" 选择图片</div>
                        <div style={styles.labelsGrid}>
                            {imageLabels.map((label, index) => {
                                const isUsed = userAnswers.includes(imageOptions[index].id);
                                return (
                                    <button
                                        key={label}
                                        style={{...styles.labelButton, ...(isUsed ? styles.labelButtonUsed : {})}}
                                        onClick={() => handleImageLabelClick(index)}
                                        disabled={isUsed && userAnswers[activeBlankIndex] !== imageOptions[index].id}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                         <button style={styles.closeSelectorButton} onClick={() => setActiveBlankIndex(null)}>关闭</button>
                    </div>
                )}


                <div style={styles.buttonContainer}>
                    {!isSubmitted ? (
                        <button style={{...styles.submitButton, ...(userAnswers.some(a => a === null) ? styles.submitButtonDisabled : {})}} onClick={handleSubmit} disabled={userAnswers.some(a => a === null)}>
                            检查答案
                        </button>
                    ) : (
                        <button style={{...styles.submitButton, ...styles.nextButton}} onClick={onNext}>
                            下一题 →
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

// --- Inline Styles (same as before) ---
const styles = {
    container: { 
        backgroundColor: '#faf5ff', borderRadius: '16px', padding: '24px', 
        fontFamily: 'system-ui, sans-serif', maxWidth: '900px', margin: '1rem auto', 
        border: '1px solid #e9d5ff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', gap: '24px'
    },
    title: { 
        fontSize: '1.5rem', fontWeight: 'bold', color: '#7e22ce', 
        textAlign: 'center', margin: '0', paddingBottom: '10px'
    },
    imageGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px'
    },
    imageItem: {
        position: 'relative', borderRadius: '12px', overflow: 'hidden',
        aspectRatio: '4/3', backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    image: { width: '100%', height: '100%', objectFit: 'cover' },
    imageLabel: {
        position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(139, 92, 246, 0.9)',
        color: 'white', borderRadius: '6px', width: '28px', height: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 'bold', fontSize: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    },
    blanksGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px', justifyContent: 'center'
    },
    blankItem: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.8)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)', minHeight: '120px', justifyContent: 'space-between'
    },
    wordWithPinyin: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
    },
    pinyinText: {
        fontSize: '0.9rem', color: '#6b7280', marginBottom: '4px',
        fontFamily: 'Arial, sans-serif', lineHeight: '1.2'
    },
    chineseTextContainer: { display: 'flex', alignItems: 'center', gap: '8px' },
    chineseText: { fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', lineHeight: '1.2' },
    ttsButton: {
        background: 'none', border: 'none', cursor: 'pointer', color: '#a855f7',
        fontSize: '1.2rem', padding: '0', display: 'flex', alignItems: 'center'
    },
    underlineContainer: {
        width: '100%', maxWidth: '120px', height: '40px', borderBottom: '2px solid #9ca3af',
        cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
        position: 'relative', transition: 'all 0.2s ease', borderRadius: '4px 4px 0 0'
    },
    underlineCorrect: {
        borderBottom: '2px solid #10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)'
    },
    underlineIncorrect: {
        borderBottom: '2px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)'
    },
    answerLabel: {
        backgroundColor: '#8b5cf6', color: 'white', borderRadius: '6px',
        padding: '4px 12px', fontSize: '1rem', fontWeight: 'bold'
    },
    labelSelector: {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        backgroundColor: 'white', borderRadius: '16px', padding: '24px',
        border: '2px solid #8b5cf6', zIndex: 100, boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        width: 'clamp(300px, 90vw, 400px)', display: 'flex', flexDirection: 'column', gap: '16px'
    },
    selectorTitle: { fontSize: '1.1rem', fontWeight: '600', color: '#7e22ce', textAlign: 'center' },
    labelsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
    labelButton: {
        padding: '12px', backgroundColor: '#8b5cf6', color: 'white', border: 'none',
        borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold',
        cursor: 'pointer', transition: 'all 0.2s ease'
    },
    labelButtonUsed: { backgroundColor: '#d8b4fe', cursor: 'not-allowed', color: '#a78bfa' },
    closeSelectorButton: {
        marginTop: '10px', padding: '10px', backgroundColor: '#f3f4f6', color: '#4b5563',
        border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem',
        fontWeight: '500', cursor: 'pointer'
    },
    buttonContainer: { display: 'flex', justifyContent: 'center' },
    submitButton: { 
        width: '200px', padding: '14px 28px', borderRadius: '10px', border: 'none', 
        backgroundColor: '#8b5cf6', color: 'white', fontSize: '1.1rem', fontWeight: '600', 
        cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
    },
    submitButtonDisabled: { backgroundColor: '#c4b5fd', cursor: 'not-allowed' },
    nextButton: { backgroundColor: '#10b981' }
};

export default TianKongTiImage;
