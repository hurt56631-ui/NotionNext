// components/Tixing/CiDianKa.js (V20 - 新发音分析版 by Gemini)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaUpload, FaArrowRight } from 'react-icons/fa'; // 引入新图标
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 音效资源 =====================
// 切换卡片音效
const switchSound = new Howl({
    src: ['/sounds/switch-card.mp3'], // 请将音效文件放置在 public/sounds/ 目录下
    volume: 0.7
});

// ===================== 样式 (部分新增) =====================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
    container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2000px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
    cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)' },
    face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
    glassOverlay: { position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(15px) brightness(1.1)', WebkitBackdropFilter: 'blur(15px) brightness(1.1)', zIndex: 0 },
    backFace: { transform: 'rotateY(180deg)', background: '#f0f2f5' },
    mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab', padding: '10px', zIndex: 1 },
    header: { textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    pinyin: { fontSize: '1.4rem', color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
    hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: 'white' },
    footer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', margin: '0 -28px -28px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
    button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
    iconButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px' },
    nextButton: { position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(0,0,0,0.08)', color: '#4a5568', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
    uploadButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' },
    listeningText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.2rem', marginTop: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' },
    // >>> 新增：发音分析器样式
    pronunciationChecker: {
        width: 'calc(100% - 20px)',
        padding: '20px',
        marginTop: '16px',
        borderTop: '4px solid #3b82f6',
        borderRadius: '12px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
        color: '#1a202c',
        zIndex: 2,
    },
};

// ===================== TTS 管理 =====================
let _howlInstance = null;
const playTTS = (text, e) => {
    if (e) e.stopPropagation();
    if (!text) return;
    try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (err) {}
    _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
    _howlInstance.play();
};

// ===================== 新的发音分析组件 =====================
const PronunciationChecker = ({ correctWord, userText }) => {
    const result = useMemo(() => {
        if (!userText || !correctWord) return null;
        
        if (userText.startsWith('[错误:')) {
            return { error: userText.replace(/\[错误: |\]/g, '') };
        }

        const correctPinyin = pinyinConverter(correctWord, { toneType: 'symbol' });
        const userPinyin = pinyinConverter(userText, { toneType: 'symbol' });

        return {
            isCorrect: correctPinyin === userPinyin,
            correctPinyin,
            userPinyin,
        };
    }, [correctWord, userText]);

    if (!result) return null;

    if (result.error) {
        return (
            <div style={styles.pronunciationChecker}>
                 <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#dc2626' }}>识别错误</h3>
                 <p style={{ marginTop: '8px', color: '#4a5568' }}>{result.error}</p>
            </div>
        )
    }

    return (
        <div style={styles.pronunciationChecker}>
            <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#1a202c' }}>发音分析</h3>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '600', width: '90px', color: '#4a5568' }}>标准发音:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a', wordBreak: 'break-all' }}>{result.correctPinyin}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '600', width: '90px', color: '#4a5568' }}>你的发音:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 'bold', color: result.isCorrect ? '#16a34a' : '#dc2626', wordBreak: 'break-all' }}>
                        {result.userPinyin}
                    </span>
                </div>
                {!result.isCorrect && (
                    <p style={{ paddingTop: '8px', color: '#ca8a04', borderTop: '1px solid #e2e8f0', marginTop: '8px' }}>
                        提示：请注意发音差异，并尝试模仿标准发音。
                    </p>
                )}
            </div>
        </div>
    );
};

// ===================== 带拼音的文本组件 (保持不变) =====================
const TextWithPinyin = ({ text }) => {
    const pinyinResult = useMemo(() => {
        if (!text) return [];
        return pinyinConverter(text, { segment: true, group: true }).map(segment => {
            if (segment.type === 'other') {
                return { surface: segment.surface, pinyin: null };
            }
            return {
                surface: segment.surface,
                pinyin: segment.pinyin.join(' '),
            };
        });
    }, [text]);

    return (
        <span style={{ lineHeight: 2.2 }}>
            {pinyinResult.map((item, index) => (
                item.pinyin ? (
                    <ruby key={index} style={{ margin: '0 2px' }}>
                        {item.surface}
                        <rt style={{ fontSize: '0.8em', userSelect: 'none' }}>{item.pinyin}</rt>
                    </ruby>
                ) : (
                    <span key={index}>{item.surface}</span>
                )
            ))}
        </span>
    );
};


// ===================== 主组件 CiDianKa (V20) =====================
const CiDianKa = ({ flashcards = [] }) => {
    const processedCards = useMemo(() => (Array.isArray(flashcards) ? flashcards : []).map(card => ({
        ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' })
    })), [flashcards]);

    const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "这是一个示例卡片。", example: "请点击左下角的设置按钮上传自定义背景图片。" }];

    // --- 状态管理 ---
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [adKey, setAdKey] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [backgroundImages, setBackgroundImages] = useState([]);
    const [currentBg, setCurrentBg] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [recognizedText, setRecognizedText] = useState(''); // <<< 修改：新的状态
    const recognitionRef = useRef(null);

    // --- 动画与手势 ---
    const transitions = useTransition(currentIndex, {
        from: { opacity: 0, transform: `translateX(50%) scale(0.8) rotateY(-90deg)` },
        enter: { opacity: 1, transform: `translateX(0%) scale(1) rotateY(0deg)` },
        leave: { opacity: 0, transform: `translateX(-50%) scale(0.8) rotateY(90deg)` },
        config: { mass: 1, tension: 210, friction: 20 },
        onStart: () => {
             if (currentIndex !== 0) {
                switchSound.play();
            }
        },
        onRest: () => {
            setIsFlipped(false);
            setRecognizedText(''); // <<< 修改：重置新状态
        },
    });
    
    const navigate = (direction) => {
        setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
    };

    const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
        if (tap && event.target.closest('button, svg, a, rt')) {
            return;
        }
        if (tap) {
            setIsFlipped(prev => !prev);
            return;
        }
        if (isFlipped) return;

        const trigger = vx > 0.2;
        if (!down && trigger) {
            navigate(xDir < 0 ? 1 : -1);
        }
    });

    // --- 副作用 Hooks ---
    useEffect(() => {
        const currentCard = cards[currentIndex];
        if (currentCard && !isFlipped) {
            const timer = setTimeout(() => playTTS(currentCard.word), 600);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, isFlipped, cards]);
    
    useEffect(() => {
        setAdKey(k => k + 1);
        if (backgroundImages.length > 0) {
            const randomIndex = Math.floor(Math.random() * backgroundImages.length);
            setCurrentBg(backgroundImages[randomIndex]);
        } else {
            setCurrentBg(null);
        }
    }, [currentIndex, backgroundImages]);

    // 添加清理函数，以防组件卸载时语音识别仍在运行
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
        };
    }, []);

    // --- 功能函数 ---
    const handleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('抱歉，您的浏览器不支持语音识别。请尝试使用Chrome浏览器。');
            return;
        }

        const recognition 
