// components/Tixing/TianKongTi.js
import React, { useState, useEffect, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';

const TianKongTiImage = ({
    id,
    title,
    sentenceSegments,
    imageOptions,
    correctAnswers,
    onCorrect,
    onNext // 新增：下一题回调
}) => {
    const totalBlanks = sentenceSegments.filter(seg => seg === null).length;

    // --- State Management ---
    const [userAnswers, setUserAnswers] = useState(Array(totalBlanks).fill(null));
    const [activeBlankIndex, setActiveBlankIndex] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [feedback, setFeedback] = useState([]);

    // 生成图片标签 A-F
    const imageLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

    // --- Reset state when question changes ---
    useEffect(() => {
        setUserAnswers(Array(totalBlanks).fill(null));
        setActiveBlankIndex(null);
        setIsSubmitted(false);
        setFeedback([]);
    }, [id, totalBlanks]);

    // --- Interaction Logic ---
    const handleBlankClick = (blankIndex) => {
        if (isSubmitted) return;
        setActiveBlankIndex(blankIndex);
    };

    const handleImageLabelClick = (imageIndex) => {
        if (isSubmitted || activeBlankIndex === null) return;

        const imageId = imageOptions[imageIndex].id;
        const newUserAnswers = [...userAnswers];
        
        // 如果图片已被其他空位使用，则清空那个空位
        const existingIndex = newUserAnswers.indexOf(imageId);
        if (existingIndex > -1) {
            newUserAnswers[existingIndex] = null;
        }

        newUserAnswers[activeBlankIndex] = imageId;
        setUserAnswers(newUserAnswers);
        setActiveBlankIndex(null); // 选择后取消激活状态
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
        if (isAllCorrect && onCorrect) {
            onCorrect();
        }

        // 2秒后自动下一题
        setTimeout(() => {
            if (onNext) {
                onNext();
            }
        }, 2000);
    };
    
    const handleReset = () => {
        setUserAnswers(Array(totalBlanks).fill(null));
        setActiveBlankIndex(null);
        setIsSubmitted(false);
        setFeedback([]);
    }

    // --- 生成拼音 ---
    const getPinyin = (text) => {
        // 移除数字和空格，只提取汉字
        const chineseText = text.replace(/[0-9\s]/g, '');
        return pinyin(chineseText, { toneType: 'symbol' });
    };

    // 提取纯文本（去掉数字）
    const getPureText = (text) => {
        return text.replace(/[0-9]/g, '').trim();
    };

    return (
        <>
            <style>{`
                @keyframes pulse-active { 
                    0%, 100% { background-color: rgba(168, 85, 247, 0.1); } 
                    50% { background-color: rgba(168, 85, 247, 0.2); } 
                }
            `}</style>
            <div style={styles.container}>
                <h3 style={styles.title}>{title}</h3>

                {/* 主内容区域 - 左右布局 */}
                <div style={styles.mainContent}>
                    {/* 左侧：图片区域 */}
                    <div style={styles.imagesSection}>
                        <div style={styles.imageGrid}>
                            {imageOptions.map((opt, index) => (
                                <div key={opt.id} style={styles.imageItem}>
                                    <img 
                                        src={opt.src} 
                                        alt={opt.word} 
                                        style={styles.image}
                                    />
                                    <div style={styles.imageLabel}>
                                        {imageLabels[index]}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 右侧：填空区域 */}
                    <div style={styles.blanksSection}>
                        <div style={styles.blanksGrid}>
                            {sentenceSegments.filter(seg => seg !== null).map((segment, index) => {
                                const blankIndex = index;
                                const answerId = userAnswers[blankIndex];
                                const imageIndex = imageOptions.findIndex(opt => opt.id === answerId);
                                const feedbackClass = feedback[blankIndex];
                                const pureText = getPureText(segment);

                                return (
                                    <div key={index} style={styles.blankRow}>
                                        <div style={styles.wordWithPinyin}>
                                            <div style={styles.pinyinText}>
                                                {getPinyin(segment)}
                                            </div>
                                            <div style={styles.chineseText}>
                                                {pureText}
                                            </div>
                                        </div>
                                        <div 
                                            style={{
                                                ...styles.underlineContainer,
                                                ...(blankIndex === activeBlankIndex ? styles.underlineActive : {}),
                                                ...(isSubmitted ? (
                                                    feedbackClass === 'correct' ? styles.underlineCorrect : styles.underlineIncorrect
                                                ) : {})
                                            }}
                                            onClick={() => handleBlankClick(blankIndex)}
                                        >
                                            {answerId && (
                                                <span style={styles.answerLabel}>
                                                    {imageLabels[imageIndex]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 图片标签选择器 */}
                        {activeBlankIndex !== null && (
                            <div style={styles.labelSelector}>
                                <div style={styles.selectorTitle}>选择图片标签：</div>
                                <div style={styles.labelsGrid}>
                                    {imageLabels.map((label, index) => (
                                        <button
                                            key={label}
                                            style={styles.labelButton}
                                            onClick={() => handleImageLabelClick(index)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={styles.buttonContainer}>
                    {!isSubmitted ? (
                        <button style={styles.submitButton} onClick={handleSubmit}>
                            检查答案
                        </button>
                    ) : (
                        <button 
                            style={{...styles.submitButton, ...styles.nextButton}} 
                            onClick={onNext}
                        >
                            下一题 →
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

// --- 内联样式 ---
const styles = {
    container: { 
        backgroundColor: '#faf5ff', // 浅紫色背景
        borderRadius: '16px', 
        padding: '24px', 
        fontFamily: 'system-ui, sans-serif', 
        maxWidth: '900px', 
        margin: '1rem auto', 
        border: '1px solid #e9d5ff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
    },
    title: { 
        fontSize: '1.5rem', 
        fontWeight: 'bold', 
        color: '#7e22ce', 
        textAlign: 'center', 
        margin: '0 0 30px 0',
        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    
    // 主内容布局
    mainContent: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '30px',
        alignItems: 'start'
    },
    
    // 图片区域
    imagesSection: {
        display: 'flex',
        flexDirection: 'column'
    },
    imageGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px'
    },
    imageItem: {
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        aspectRatio: '4/3',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    image: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    imageLabel: {
        position: 'absolute',
        top: '8px',
        left: '8px',
        backgroundColor: '#8b5cf6',
        color: 'white',
        borderRadius: '6px',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    },
    
    // 填空区域
    blanksSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    blanksGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    blankRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        padding: '8px 12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(255,255,255,0.7)'
    },
    wordWithPinyin: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        minWidth: '100px'
    },
    pinyinText: {
        fontSize: '0.8rem',
        color: '#dc2626',
        marginBottom: '1px', // 减小拼音和汉字的间距
        fontFamily: 'Arial, sans-serif',
        lineHeight: '1.2'
    },
    chineseText: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#1f2937',
        lineHeight: '1.2'
    },
    underlineContainer: {
        flex: 1,
        minWidth: '80px',
        height: '36px',
        borderBottom: '2px solid #6b7280',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        transition: 'all 0.2s ease'
    },
    underlineActive: {
        animation: 'pulse-active 1.5s infinite',
        borderBottomColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)'
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
        backgroundColor: '#8b5cf6',
        color: 'white',
        borderRadius: '6px',
        padding: '4px 12px',
        fontSize: '1rem',
        fontWeight: 'bold',
        minWidth: '32px',
        textAlign: 'center'
    },
    
    // 标签选择器
    labelSelector: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: '12px',
        padding: '16px',
        border: '2px solid #8b5cf6'
    },
    selectorTitle: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#7e22ce',
        marginBottom: '12px',
        textAlign: 'center'
    },
    labelsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px'
    },
    labelButton: {
        padding: '10px',
        backgroundColor: '#8b5cf6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    
    // 按钮区域
    buttonContainer: { 
        display: 'flex', 
        justifyContent: 'center',
        marginTop: '24px'
    },
    submitButton: { 
        width: '200px', 
        padding: '14px 28px', 
        borderRadius: '10px', 
        border: 'none', 
        backgroundColor: '#8b5cf6', 
        color: 'white', 
        fontSize: '1.1rem', 
        fontWeight: '600', 
        cursor: 'pointer', 
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
    },
    nextButton: {
        backgroundColor: '#10b981'
    }
};

export default TianKongTiImage;
