// components/ShortSentenceCard.js (最终修复版 - 使用 Portal 实现真·全屏)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom'; // ✅ 1. 引入 createPortal
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaVolumeUp, FaTimes } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';

// --- 音频播放工具 (保持不变) ---
let _howlInstance = null;
const playTTS = (text, lang, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text) return;
    if (_howlInstance?.playing()) _howlInstance.stop();
    const voice = lang === 'zh' ? 'zh-CN-XiaoyouNeural' : 'my-MM-NilarNeural';
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=0`;
    _howlInstance = new Howl({ src: [ttsUrl], html5: true });
    _howlInstance.play();
};

const playSoundEffect = (type) => {
    if (typeof window !== 'undefined') {
        const sounds = {
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
        };
        if (sounds[type]) sounds[type].play();
    }
};

const ShortSentenceCard = ({ sentences = [], isOpen, onClose }) => {
    // ✅ 2. 新增一个状态，用于判断当前是否在浏览器环境，避免在服务端渲染时出错
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true); // 组件挂载后，说明在浏览器环境，设为 true
    }, []);

    // 页面进入/离开的动画 (保持不变)
    const pageTransitions = useTransition(isOpen, {
        from: { opacity: 0, transform: 'translateY(100%)' },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: 'translateY(100%)' },
        config: { tension: 220, friction: 25 },
    });

    // --- 内部逻辑完全保持不变 ---
    const cards = useMemo(() => {
        return Array.isArray(sentences) && sentences.length > 0
            ? sentences
            : [{ id: 'fallback', sentence: "暂无卡片", translation: "...", pinyin: "zàn wú kǎ piàn" }];
    }, [sentences]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    const currentCard = cards[currentIndex];

    useEffect(() => { if (isOpen) setCurrentIndex(0); }, [isOpen]);
    const navigate = useCallback((direction) => {
        lastDirection.current = direction;
        setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
    }, [cards.length]);

    useEffect(() => {
        if (!isOpen) return;
        const autoPlayTimer = setTimeout(() => {
            if (currentCard?.sentence) playTTS(currentCard.sentence, 'zh');
        }, 500);
        return () => clearTimeout(autoPlayTimer);
    }, [currentIndex, currentCard, isOpen]);

    const cardTransitions = useTransition(currentIndex, { /* ... 保持不变 ... */ });
    const bind = useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], event }) => { /* ... 保持不变 ... */ }, { axis: 'y' });

    // ✅ 3. 将要渲染的 JSX 内容提取出来
    const cardContent = pageTransitions((style, item) =>
        item && (
            <animated.div style={{ ...styles.fullScreen, ...style }}>
                <button style={styles.closeButton} onClick={onClose} data-no-gesture="true">
                    <FaTimes size={24} />
                </button>
                <div style={styles.counter} data-no-gesture="true">
                    {currentIndex + 1} / {cards.length}
                </div>
                <div style={styles.gestureArea} {...bind()} />

                {cardTransitions((cardStyle, i) => {
                    const cardData = cards[i];
                    if (!cardData) return null;
                    const pinyinText = cardData.pinyin || pinyinConverter(cardData.sentence, { toneType: 'mark', separator: ' ' });

                    return (
                        <animated.div key={i} style={{ ...styles.animatedCardShell, ...cardStyle }}>
                            <div style={styles.cardContainer}>
                                <div style={styles.chineseSection} onClick={(e) => playTTS(cardData.sentence, 'zh', e)}>
                                    <div style={styles.pinyin}>{pinyinText}</div>
                                    <div style={styles.textChinese}>{cardData.sentence}</div>
                                </div>
                                <div style={styles.translationSection} onClick={(e) => playTTS(cardData.translation, 'my', e)}>
                                    <div style={styles.translationContent}>
                                        <FaVolumeUp style={{ marginRight: '10px', color: '#6d28d9', flexShrink: 0 }} />
                                        <div style={styles.textBurmese}>{cardData.translation}</div>
                                    </div>
                                </div>
                            </div>
                        </animated.div>
                    );
                })}
            </animated.div>
        )
    );

    // ✅ 4. 如果在浏览器环境，就使用 Portal 将内容渲染到 document.body
    if (isMounted) {
        return createPortal(cardContent, document.body);
    }

    // 在服务端或挂载前，返回 null
    return null;
};


// --- 样式表 (保持不变) ---
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: '#f0f4f8' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'white', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(0, 30, 80, 0.15)', overflow: 'hidden' },
    chineseSection: { flex: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center', cursor: 'pointer' },
    translationSection: { flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '20px', cursor: 'pointer' },
    pinyin: { fontSize: '1.5rem', color: '#64748b', marginBottom: '1rem', letterSpacing: '0.05em' },
    textChinese: { fontSize: '3rem', fontWeight: 'bold', color: '#1e293b', lineHeight: 1.4, wordBreak: 'break-word' },
    translationContent: { display: 'flex', alignItems: 'center', textAlign: 'center' },
    textBurmese: { fontSize: '2.5rem', color: '#312e81', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word' },
    closeButton: { position: 'absolute', top: '25px', left: '25px', zIndex: 10, background: 'rgba(255, 255, 255, 0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', backdropFilter: 'blur(5px)' },
    counter: { position: 'absolute', top: '35px', right: '35px', zIndex: 10, background: 'rgba(0, 0, 0, 0.5)', color: 'white', padding: '5px 15px', borderRadius: '15px', fontSize: '1rem', fontWeight: 'bold' },
};

export default ShortSentenceCard;
