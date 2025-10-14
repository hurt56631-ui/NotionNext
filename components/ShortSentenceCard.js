// components/ShortSentenceCard.js (最终稳定版 - 全屏播放器)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaVolumeUp, FaTimes } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';

// --- 音频播放工具 ---
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
    // 确保只在浏览器环境中创建 Howl 实例，避免水合错误
    if (typeof window !== 'undefined') {
        const sounds = {
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
        };
        if (sounds[type]) sounds[type].play();
    }
};

const ShortSentenceCard = ({ sentences = [], onClose }) => {
    const cards = useMemo(() => {
        return Array.isArray(sentences) && sentences.length > 0
            ? sentences
            : [{ id: 'fallback', sentence: "暂无卡片", translation: "...", pinyin: "zàn wú kǎ piàn" }];
    }, [sentences]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastDirection = useRef(0);
    const currentCard = cards[currentIndex];

    const navigate = useCallback((direction) => {
        lastDirection.current = direction;
        setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
    }, [cards.length]);

    useEffect(() => {
        const autoPlayTimer = setTimeout(() => {
            if (currentCard?.sentence) {
                playTTS(currentCard.sentence, 'zh');
            }
        }, 500);
        return () => clearTimeout(autoPlayTimer);
    }, [currentIndex, currentCard]);

    const cardTransitions = useTransition(currentIndex, {
        key: currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '80%' : '-80%'}) scale(0.8)` },
        enter: { opacity: 1, transform: 'translateY(0%) scale(1)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-80%' : '80%'}) scale(0.8)`, position: 'absolute' },
        config: { mass: 1, tension: 280, friction: 25 },
        onStart: () => playSoundEffect('switch'),
    });

    const bind = useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], event }) => {
        if (event.target.closest('[data-no-gesture]')) return;
        if (!down) {
            const isSignificantDrag = Math.abs(my) > 60 || (Math.abs(vy) > 0.5 && Math.abs(my) > 30);
            if (isSignificantDrag) {
                navigate(yDir < 0 ? 1 : -1);
            }
        }
    }, { axis: 'y' });

    return (
        <div style={styles.fullScreen}>
            <button style={styles.closeButton} onClick={onClose} data-no-gesture="true">
                <FaTimes size={24} />
            </button>
            <div style={styles.counter} data-no-gesture="true">
                {currentIndex + 1} / {cards.length}
            </div>
            <div style={styles.gestureArea} {...bind()} />

            {cardTransitions((style, i) => {
                const cardData = cards[i];
                if (!cardData) return null;
                const pinyinText = cardData.pinyin || pinyinConverter(cardData.sentence, { toneType: 'mark', separator: ' ' });

                return (
                    <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
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
        </div>
    );
};

// --- 样式表 ---
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
