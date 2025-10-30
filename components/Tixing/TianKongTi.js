// components/Tixing/TianKongTi.js
import React, { useState, useEffect, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';

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

    // 生成图片标签 A-F
    const imageLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

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

    // --- 生成拼音 ---
    const getPinyin = (text) => {
        return pinyin(text, { toneType: 'symbol' });
    };

    // --- Rendering ---
    const renderBlanks = () => {
        let blankCounter = -1;
        return sentenceSegments.map((segment, index) => {
            if (segment === null) {
                blankCounter++;
                const currentBlankIndex = blankCounter;
                const answerId = userAnswers[currentBlankIndex];
                const image = imageOptions.find(opt => opt.id === answerId);
                const feedbackClass = feedback[currentBlankIndex];

                let blankStyle = { ...styles.blank };
                if(currentBlankIndex === activeBlankIndex && !isSubmitted) {
                    blankStyle = {...blankStyle, ...styles.blankActive};
                }
                if(isSubmitted) {
                    blankStyle = {...blankStyle, ...(feedbackClass === 'correct' ? styles.blankCorrect : styles.blankIncorrect)};
                }

                return (
                    <div key={index} style={blankStyle} onClick={() => handleBlankClick(currentBlankIndex)}>
                        {image && (
                            <div style={styles.filledContent}>
                                <div style={styles.imageLabel}>{imageLabels[imageOptions.findIndex(opt => opt.id === image.id)]}</div>
                                <img src={image.src} alt={image.word} style={styles.filledImage} />
                            </div>
                        )}
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

                {/* 图片网格 - 2行3列 */}
                <div style={styles.imageGrid}>
                    {imageOptions.map((opt, index) => (
                        <div 
                            key={opt.id} 
                            style={{
                                ...styles.imageContainer, 
                                ...(userAnswers.includes(opt.id) ? styles.imageUsed : {})
                            }}
                            onClick={() => handleImageClick(opt)}
                        >
                            <div style={styles.imageLabel}>{imageLabels[index]}</div>
                            <img src={opt.src} alt={opt.word} style={styles.image} />
                        </div>
                    ))}
                </div>

                {/* 填空区域 - 2行3列 */}
                <div style={styles.blanksGrid}>
                    {sentenceSegments.filter(seg => seg !== null).map((segment, index) => {
                        const blankIndex = Math.floor(index / 2) * 3 + (index % 2);
                        const answerId = userAnswers[blankIndex];
                        const image = imageOptions.find(opt => opt.id === answerId);
                        const feedbackClass = feedback[blankIndex];

                        let blankStyle = { ...styles.blank };
                        if(blankIndex === activeBlankIndex && !isSubmitted) {
                            blankStyle = {...blankStyle, ...styles.blankActive};
                        }
                        if(isSubmitted) {
                            blankStyle = {...blankStyle, ...(feedbackClass === 'correct' ? styles.blankCorrect : styles.blankIncorrect)};
                        }

                        return (
                            <div key={index} style={styles.blanksItem}>
                                <div style={styles.wordWithPinyin}>
                                    <div style={styles.chineseText}>{segment}</div>
                                    <div style={styles.pinyinText}>{getPinyin(segment.replace(/\d+\s*/g, ''))}</div>
                                </div>
                                <div 
                                    style={blankStyle} 
                                    onClick={() => handleBlankClick(blankIndex)}
                                >
                                    {image && (
                                        <div style={styles.filledContent}>
                                            <div style={styles.filledLabel}>{imageLabels[imageOptions.findIndex(opt => opt.id === image.id)]}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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
    container: { 
        backgroundColor: '#f8fafc', 
        borderRadius: '16px', 
        padding: '24px', 
        fontFamily: 'system-ui, sans-serif', 
        maxWidth: '800px', 
        margin: '2rem auto', 
        border: '1px solid #e2e8f0' 
    },
    title: { 
        fontSize: '1.5rem', 
        fontWeight: 'bold', 
        color: '#334155', 
        textAlign: 'center', 
        margin: '0 0 24px 0' 
    },
    titleSpeaking: { color: '#3b82f6' },
    
    // 图片网格样式
    imageGrid: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '12px', 
        marginBottom: '32px' 
    },
    imageContainer: { 
        position: 'relative',
        border: '2px solid #cbd5e1', 
        borderRadius: '12px', 
        padding: '12px', 
        cursor: 'pointer', 
        transition: 'all 0.2s ease', 
        backgroundColor: 'white',
        textAlign: 'center',
        minHeight: '180px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    },
    imageLabel: {
        position: 'absolute',
        top: '8px',
        left: '8px',
        backgroundColor: '#3b82f6',
        color: 'white',
        borderRadius: '50%',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '14px'
    },
    image: { 
        width: '100%', 
        height: '140px', 
        objectFit: 'cover',
        borderRadius: '8px'
    },
    imageUsed: { 
        opacity: 0.4, 
        pointerEvents: 'none', 
        filter: 'grayscale(80%)' 
    },
    
    // 填空网格样式
    blanksGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        marginBottom: '24px'
    },
    blanksItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
    },
    wordWithPinyin: {
        textAlign: 'center'
    },
    chineseText: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: '4px'
    },
    pinyinText: {
        fontSize: '0.9rem',
        color: '#64748b',
        fontStyle: 'italic'
    },
    blank: { 
        width: '60px', 
        height: '60px', 
        border: '2px dashed #94a3b8', 
        borderRadius: '8px', 
        cursor: 'pointer', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        transition: 'all 0.2s ease',
        backgroundColor: 'white'
    },
    blankActive: { 
        borderColor: '#3b82f6', 
        animation: 'pulse-active-blank 1.5s infinite' 
    },
    blankCorrect: { 
        borderColor: '#22c55e', 
        backgroundColor: '#f0fdf4' 
    },
    blankIncorrect: { 
        borderColor: '#ef4444', 
        backgroundColor: '#fef2f2' 
    },
    filledContent: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    filledLabel: {
        backgroundColor: '#3b82f6',
        color: 'white',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '14px'
    },
    
    buttonContainer: { 
        display: 'flex', 
        justifyContent: 'center' 
    },
    submitButton: { 
        width: '80%', 
        padding: '14px', 
        borderRadius: '10px', 
        border: 'none', 
        backgroundColor: '#3b82f6', 
        color: 'white', 
        fontSize: '1.2rem', 
        fontWeight: 'bold', 
        cursor: 'pointer', 
        transition: 'background-color 0.2s ease' 
    },
};

export default TianKongTiImage;
