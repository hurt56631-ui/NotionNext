// components/Tixing/TianKongTiImage.js
import React, { useState, useEffect, useCallback } from 'react';

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

const TianKongTiImage = ({
    id,
    title,
    sentenceSegments,
    imageOptions,
    correctAnswers,
    onCorrect
}) => {
    const totalBlanks = sentenceSegments.filter(seg => seg === null).length;

    // --- State Management ---
    const [userAnswers, setUserAnswers] = useState(Array(totalBlanks).fill(null));
    const [activeBlankIndex, setActiveBlankIndex] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [feedback, setFeedback] = useState([]);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // --- Reset state when question changes ---
    useEffect(() => {
        setUserAnswers(Array(totalBlanks).fill(null));
        setActiveBlankIndex(0);
        setIsSubmitted(false);
        setFeedback([]);
        window.speechSynthesis.cancel();
    }, [id, totalBlanks]);

    // --- TTS Title Reading ---
    const handleTitleClick = useCallback(() => {
        if (!title || typeof window.speechSynthesis === 'undefined') return;
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

    // --- Interaction Logic ---
    const handleBlankClick = (blankIndex) => {
        if (isSubmitted) return;
        setActiveBlankIndex(blankIndex);
    };

    const handleImageClick = (imageOption) => {
        if (isSubmitted || activeBlankIndex === null) return;

        const newUserAnswers = [...userAnswers];
        // 如果图片已被其他空位使用，则清空那个空位
        const existingIndex = newUserAnswers.indexOf(imageOption.id);
        if (existingIndex > -1) {
            newUserAnswers[existingIndex] = null;
        }

        newUserAnswers[activeBlankIndex] = imageOption.id;
        setUserAnswers(newUserAnswers);

        // 自动激活下一个空的空位
        const nextBlankIndex = newUserAnswers.findIndex(answer => answer === null);
        setActiveBlankIndex(nextBlankIndex !== -1 ? nextBlankIndex : null);
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
            onCorrect && onCorrect();
        }
    };
    
    const handleReset = () => {
         setUserAnswers(Array(totalBlanks).fill(null));
        setActiveBlankIndex(0);
        setIsSubmitted(false);
        setFeedback([]);
    }

    // --- Rendering ---
    const renderBlanks = () => {
        let blankCounter = -1;
        return sentenceSegments.map((segment, index) => {
            if (segment === null) {
                blankCounter++;
                const currentBlankIndex = blankCounter;
                const answerId = userAnswers[currentBlankIndex];
                const image = imageOptions.find(opt => opt.id === answerId);
                const feedbackClass = feedback[currentBlankIndex]; // 'correct' or 'incorrect'

                let blankStyle = { ...styles.blank };
                if(currentBlankIndex === activeBlankIndex && !isSubmitted) {
                    blankStyle = {...blankStyle, ...styles.blankActive};
                }
                if(isSubmitted) {
                    blankStyle = {...blankStyle, ...(feedbackClass === 'correct' ? styles.blankCorrect : styles.blankIncorrect)};
                }

                return (
                    <div key={index} style={blankStyle} onClick={() => handleBlankClick(currentBlankIndex)}>
                        {image && <img src={image.src} alt={image.word} style={styles.filledImage} />}
                    </div>
                );
            }
            return <span key={index} style={styles.sentenceText}>{segment}</span>;
        });
    };

    return (
        <>
            <style>{`
                @keyframes pulse-wave { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
                @keyframes pulse-active-blank { 0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); } }
                .title-clickable { cursor: pointer; transition: color 0.3s; }
                .title-clickable:hover { color: #2563eb; }
            `}</style>
            <div style={styles.container}>
                <h3 style={{ ...styles.title, ...(isSpeaking && styles.titleSpeaking) }} className="title-clickable" onClick={handleTitleClick}>
                    <SpeakerIcon isSpeaking={isSpeaking} />
                    {title}
                </h3>

                <div style={styles.sentenceContainer}>
                    {renderBlanks()}
                </div>

                <div style={styles.imageGrid}>
                    {imageOptions.map(opt => (
                        <div 
                            key={opt.id} 
                            style={{...styles.imageContainer, ...(userAnswers.includes(opt.id) ? styles.imageUsed : {})}}
                            onClick={() => handleImageClick(opt)}
                        >
                            <img src={opt.src} alt={opt.word} style={styles.image} />
                            <span style={styles.imageWord}>{opt.word}</span>
                        </div>
                    ))}
                </div>

                <div style={styles.buttonContainer}>
                    {!isSubmitted ? (
                        <button style={styles.submitButton} onClick={handleSubmit}>检查答案</button>
                    ) : (
                        <button style={{...styles.submitButton, backgroundColor: '#64748b'}} onClick={handleReset}>再试一次</button>
                    )}
                </div>
            </div>
        </>
    );
};

// --- 内联样式 ---
const styles = {
    container: { backgroundColor: '#f8fafc', borderRadius: '16px', padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '700px', margin: '2rem auto', border: '1px solid #e2e8f0' },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#334155', textAlign: 'center', margin: '0 0 24px 0' },
    titleSpeaking: { color: '#3b82f6' },
    sentenceContainer: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '24px', minHeight: '80px', fontSize: '1.8rem' },
    sentenceText: { lineHeight: '2' },
    blank: { width: '80px', height: '80px', border: '2px dashed #94a3b8', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s ease' },
    blankActive: { borderColor: '#3b82f6', animation: 'pulse-active-blank 1.5s infinite' },
    blankCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
    blankIncorrect: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
    filledImage: { width: '100%', height: '100%', objectFit: 'contain', padding: '5px' },
    imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' },
    imageContainer: { border: '2px solid #cbd5e1', borderRadius: '12px', padding: '8px', cursor: 'pointer', transition: 'all 0.2s ease', backgroundColor: 'white', textAlign: 'center' },
    imageContainerHover: { transform: 'scale(1.05)', borderColor: '#3b82f6' },
    imageUsed: { opacity: 0.4, pointerEvents: 'none', filter: 'grayscale(80%)' },
    image: { width: '100%', height: '100px', objectFit: 'contain' },
    imageWord: { marginTop: '4px', color: '#475569', fontWeight: '500' },
    buttonContainer: { display: 'flex', justifyContent: 'center' },
    submitButton: { width: '80%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease' },
};

export default TianKongTiImage;
