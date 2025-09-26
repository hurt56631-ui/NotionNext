// components/Tixing/PaiXuTi.js (V7 - 修复标点符号显示问题)

import React, { useState, useMemo, useEffect } from 'react';
// ... (所有顶部的 import 保持不变)
import { pinyin } from 'pinyin-pro';

// --- 样式定义 ---
const styles = {
    // ... (大部分样式不变)
    pinyinText: {
        fontSize: '0.9rem',
        color: '#64748b',
        marginBottom: '4px',
        height: '1.2em', // 保证即使没拼音也占位
        fontFamily: 'sans-serif'
    },
    characterText: {
        fontSize: '1.4rem',
        color: '#334155',
        fontWeight: '500',
    },
    // 【新增】专门用于标点符号的样式
    punctuationCharacterText: {
        fontSize: '1.4rem',
        color: '#64748b', // 颜色变浅
        fontWeight: '500',
    }
};

// ... (音效和TTS函数不变)

// --- PaiXuKaPian 子组件 (核心修改) ---
const PaiXuKaPian = ({ id, content }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const [isTtsLoading, setIsTtsLoading] = useState(false);

    // 【核心修复】在这里判断是否是标点符号
    const isPunctuation = useMemo(() => {
        if (!content) return false;
        // 常见的中文和英文标点
        const punctuationRegex = /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/;
        return punctuationRegex.test(content.trim());
    }, [content]);

    const pinyinContent = useMemo(() => {
        if (!content || isPunctuation) return ''; // 如果是标点，不显示拼音
        return pinyin(content, { toneType: 'mark' }).toLowerCase();
    }, [content, isPunctuation]);

    const springStyles = useSpring({ /* ... */ });
    const style = { ...styles.paiXuKaPian, transition, zIndex: isDragging ? 100 : 1 };
    
    // 【优化】标点符号卡片禁用朗读按钮
    const handleTtsClick = (e) => {
        e.stopPropagation();
        if (isTtsLoading || isPunctuation) return;
        playTTS(content, () => setIsTtsLoading(true), () => setIsTtsLoading(false));
    };
    
    return (
        <animated.div ref={setNodeRef} style={{ ...style, ...springStyles }} {...attributes} {...listeners}>
            <div style={styles.textContentWrapper}>
                <div style={styles.pinyinText}>{pinyinContent}</div>
                {/* 根据是否是标点，应用不同样式 */}
                <div style={isPunctuation ? styles.punctuationCharacterText : styles.characterText}>
                    {content}
                </div>
            </div>
            {/* 标点符号不显示朗读按钮 */}
            {!isPunctuation && (
                 <button style={styles.ttsButton} onClick={handleTtsClick} title="朗读" disabled={isTtsLoading}>
                    {isTtsLoading ? <FaSpinner style={styles.spinner} /> : <FaVolumeUp />}
                </button>
            )}
        </animated.div>
    );
};

// ... (PaiXuTi 主组件和其他代码保持不变)
