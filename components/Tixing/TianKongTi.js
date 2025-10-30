// components/Tixing/TianKongTi.js
import React, { useState, useEffect, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';

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

    // 生成图片标签 A-F
    const imageLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

    // --- Reset state when question changes ---
    useEffect(() => {
        setUserAnswers(Array(totalBlanks).fill(null));
        setActiveBlankIndex(0);
        setIsSubmitted(false);
        setFeedback([]);
    }, [id, totalBlanks]);

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
        // 移除数字和空格，只提取汉字
        const chineseText = text.replace(/[0-9\s]/g, '');
        return pinyin(chineseText, { toneType: 'symbol' });
    };

    return (
        <>
            <style>{`
                @keyframes pulse-active-blank { 
                    0%, 100% { background-color: rgba(59, 130, 246, 0.1); } 
                    50% { background-color: rgba(59, 130, 246, 0.2); } 
                }
            `}</style>
            <div style={styles.container}>
                <h3 style={styles.title}>{title}</h3>

                {/* 图片网格 - 横屏2行3列 */}
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

                {/* 填空区域 - 真正的下划线样式 */}
                <div style={styles.blanksContainer}>
                    <div style={styles.blanksRow}>
                        {/* 第一行：1-3题 */}
                        {[0, 1, 2].map((index) => (
                            <div key={index} style={styles.blankItem}>
                                <div style={styles.wordWithPinyin}>
                                    <div style={styles.pinyinText}>
                                        {getPinyin(sentenceSegments[index * 2])}
                                    </div>
                                    <div style={styles.chineseText}>
                                        {sentenceSegments[index * 2]}
                                    </div>
                                </div>
                                <div 
                                    style={{
                                        ...styles.underline,
                                        ...(index === activeBlankIndex && !isSubmitted ? styles.underlineActive : {}),
                                        ...(isSubmitted ? (feedback[index] === 'correct' ? styles.underlineCorrect : styles.underlineIncorrect) : {})
                                    }} 
                                    onClick={() => handleBlankClick(index)}
                                >
                                    {userAnswers[index] && (
                                        <span style={styles.answerLabel}>
                                            {imageLabels[imageOptions.findIndex(opt => opt.id === userAnswers[index])]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div style={styles.blanksRow}>
                        {/* 第二行：4-6题 */}
                        {[3, 4, 5].map((index) => (
                            <div key={index} style={styles.blankItem}>
                                <div style={styles.wordWithPinyin}>
                                    <div style={styles.pinyinText}>
                                        {getPinyin(sentenceSegments[index * 2])}
                                    </div>
                                    <div style={styles.chineseText}>
                                        {sentenceSegments[index * 2]}
                                    </div>
                                </div>
                                <div 
                                    style={{
                                        ...styles.underline,
                                        ...(index === activeBlankIndex && !isSubmitted ? styles.underlineActive : {}),
                                        ...(isSubmitted ? (feedback[index] === 'correct' ? styles.underlineCorrect : styles.underlineIncorrect) : {})
                                    }} 
                                    onClick={() => handleBlankClick(index)}
                                >
                                    {userAnswers[index] && (
                                        <span style={styles.answerLabel}>
                                            {imageLabels[imageOptions.findIndex(opt => opt.id === userAnswers[index])]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
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
        backgroundColor: '#ffffff', 
        borderRadius: '12px', 
        padding: '20px', 
        fontFamily: 'system-ui, sans-serif', 
        maxWidth: '800px', 
        margin: '1rem auto', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    title: { 
        fontSize: '1.4rem', 
        fontWeight: 'bold', 
        color: '#1f2937', 
        textAlign: 'center', 
        margin: '0 0 24px 0' 
    },
    
    // 图片网格样式 - 横屏
    imageGrid: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '10px', 
        marginBottom: '30px' 
    },
    imageContainer: { 
        position: 'relative',
        border: '2px solid #d1d5db', 
        borderRadius: '10px', 
        padding: '8px', 
        cursor: 'pointer', 
        transition: 'all 0.2s ease', 
        backgroundColor: 'white',
        textAlign: 'center',
        aspectRatio: '4/3', // 横屏比例
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    imageLabel: {
        position: 'absolute',
        top: '6px',
        left: '6px',
        backgroundColor: '#3b82f6',
        color: 'white',
        borderRadius: '4px',
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '12px'
    },
    image: { 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover',
        borderRadius: '6px'
    },
    imageUsed: { 
        opacity: 0.4, 
        pointerEvents: 'none', 
        filter: 'grayscale(80%)' 
    },
    
    // 填空区域样式
    blanksContainer: {
        marginBottom: '24px'
    },
    blanksRow: {
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: '20px'
    },
    blankItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: '120px'
    },
    wordWithPinyin: {
        textAlign: 'center',
        marginBottom: '8px'
    },
    pinyinText: {
        fontSize: '0.85rem',
        color: '#6b7280',
        marginBottom: '2px', // 拼音和汉字间距小
        fontFamily: 'Arial, sans-serif'
    },
    chineseText: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#1f2937'
    },
    underline: {
        width: '60px',
        height: '32px',
        borderBottom: '2px solid #4b5563',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginTop: '4px'
    },
    underlineActive: {
        animation: 'pulse-active-blank 1.5s infinite',
        borderBottomColor: '#3b82f6'
    },
    underlineCorrect: {
        borderBottomColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)'
    },
    underlineIncorrect: {
        borderBottomColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)'
    },
    answerLabel: {
        backgroundColor: '#3b82f6',
        color: 'white',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '0.9rem',
        fontWeight: 'bold'
    },
    
    buttonContainer: { 
        display: 'flex', 
        justifyContent: 'center' 
    },
    submitButton: { 
        width: '200px', 
        padding: '12px 24px', 
        borderRadius: '8px', 
        border: 'none', 
        backgroundColor: '#3b82f6', 
        color: 'white', 
        fontSize: '1.1rem', 
        fontWeight: '600', 
        cursor: 'pointer', 
        transition: 'background-color 0.2s ease' 
    },
};

export default TianKongTiImage;
