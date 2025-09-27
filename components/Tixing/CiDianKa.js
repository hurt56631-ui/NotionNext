// components/Tixing/CiDianKa.js (V21 - 终极稳定版 by Gemini)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaUpload } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 音效资源 =====================
const switchSound = new Howl({
    src: ['/sounds/switch-card.mp3'], // 请确保音效文件存在
    volume: 0.7
});

// ===================== 样式 (保持不变) =====================
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
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
    uploadButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' },
    recognitionResult: { marginTop: '15px', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', color: '#fff', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' },
    listeningText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.2rem', marginTop: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' },
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

// ===================== 辅助组件与函数 =====================

// (RecognitionResult and comparePinyin remain unchanged)
const comparePinyin = (correctWord, userText) => { /* ... no changes ... */ };
const RecognitionResult = ({ result }) => { /* ... no changes ... */ };

// <<< 关键修复：为 TextWithPinyin 组件增加对 pinyinConverter 库返回值的健壮性检查
const TextWithPinyin = ({ text }) => {
    const pinyinResult = useMemo(() => {
        if (!text) return [];

        const resultFromLib = pinyinConverter(text, { segment: true, group: true });

        // --- 安全检查 ---
        if (!Array.isArray(resultFromLib)) {
            console.error("pinyin-pro did not return an array for text:", text, "Received:", resultFromLib);
            // 返回一个安全的回退值，直接显示原文，避免程序崩溃
            return [{ surface: text, pinyin: null }];
        }

        return resultFromLib.map(segment => (
            segment.type === 'other'
                ? { surface: segment.surface, pinyin: null }
                : { surface: segment.surface, pinyin: segment.pinyin.join(' ') }
        ));
    }, [text]);

    return (
        <span style={{ lineHeight: 2.2 }}>
            {pinyinResult.map((item, index) => (
                item.pinyin ? (
                    <ruby key={index} style={{ margin: '0 2px' }}>
                        {item.surface}<rt style={{ fontSize: '0.8em', userSelect: 'none' }}>{item.pinyin}</rt>
                    </ruby>
                ) : (
                    <span key={index}>{item.surface}</span>
                )
            ))}
        </span>
    );
};

// ===================== 主组件 CiDianKa (V21) =====================
const CiDianKa = ({ flashcards = [] }) => { // 默认值设为 []，增加一层保护
    
    // <<< 关键修复：在处理 prop 的最开始就进行严格的数组验证
    const processedCards = useMemo(() => {
        if (!Array.isArray(flashcards)) {
            // 在控制台打印错误，帮助追溯问题源头（例如API）
            console.error("CiDianKa component received a non-array prop for 'flashcards'. Received:", flashcards);
            return []; // 返回一个空数组，确保后续代码不会因 .map() 而崩溃
        }
        return flashcards.map(card => ({
            ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' })
        }));
    }, [flashcards]);

    const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "这是一个示例卡片。", example: "如果看到此卡片，说明数据加载失败或为空。" }];

    // --- 状态和 Hooks (大部分保持不变) ---
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    // ... 其他状态 ...
    const [writerChar, setWriterChar] = useState(null);
    const [adKey, setAdKey] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [backgroundImages, setBackgroundImages] = useState([]);
    const [currentBg, setCurrentBg] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [recognitionResult, setRecognitionResult] = useState(null);
    const recognitionRef = useRef(null);

    const navigate = (direction) => {
        setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
    };
    
    const transitions = useTransition(currentIndex, {
        from: { opacity: 0, transform: `translateX(50%) scale(0.8) rotateY(-90deg)` },
        enter: { opacity: 1, transform: `translateX(0%) scale(1) rotateY(0deg)` },
        leave: { opacity: 0, transform: `translateX(-50%) scale(0.8) rotateY(90deg)` },
        config: { mass: 1, tension: 210, friction: 20 },
        onStart: () => { if (currentIndex !== 0) { switchSound.play(); } },
        onRest: () => { setIsFlipped(false); setRecognitionResult(null); },
    });

    const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
        if (tap && event.target.closest('button, svg, a, rt')) return;
        if (tap) { setIsFlipped(prev => !prev); return; }
        const trigger = vx > 0.2;
        if (!down && trigger) {
            const dir = xDir < 0 ? 1 : -1;
            if (isFlipped) {
                setIsFlipped(false);
                setTimeout(() => navigate(dir), 150);
            } else {
                navigate(dir);
            }
        }
    });

    useEffect(() => {
        const currentCard = cards[currentIndex];
        if (currentCard) {
            const timer = setTimeout(() => playTTS(currentCard.word), 600);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, cards]);
    
    useEffect(() => {
        setAdKey(k => k + 1);
        if (backgroundImages.length > 0) {
            setCurrentBg(backgroundImages[Math.floor(Math.random() * backgroundImages.length)]);
        } else {
            setCurrentBg(null);
        }
    }, [currentIndex, backgroundImages]);

    // --- 功能函数 (保持不变) ---
    const handleListen = () => { /* ... no changes ... */ };
    const handleImageUpload = (event) => { /* ... no changes ... */ };
    const fileInputRef = useRef(null);

    // --- 渲染 ---
    // (渲染部分的 JSX 保持不变)
    return (
        <div style={styles.fullScreen}>
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            {isSettingsOpen && (
                <div style={styles.settingsModal} onClick={() => setIsSettingsOpen(false)}>
                    {/* ... settings modal content ... */}
                </div>
            )}
            <div style={styles.container}>
                {transitions((style, i) => {
                    const cardData = cards[i];
                    if (!cardData) return null; // 增加一道额外的安全防线
                    const backgroundStyle = currentBg 
                        ? { backgroundImage: `url(${currentBg})` }
                        : { backgroundImage: `linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)` };

                    return (
                        <animated.div style={{ ...styles.animatedCardShell, ...style, zIndex: cards.length - i }}>
                           {/* ... card structure ... */}
                            <div style={styles.cardContainer}>
                                <div style={{ width: '100%', height: '100%', flex: 1 }} {...bind()}>
                                    <div style={{...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                                        {/* 正面 */}
                                        <div style={{...styles.face, ...backgroundStyle}}>
                                            <div style={styles.glassOverlay}></div>
                                            <div style={styles.mainContent}>
                                                <div style={styles.header}>
                                                    <div style={styles.pinyin}>{cardData.pinyin}</div>
                                                    <div style={styles.hanzi}>{cardData.word}</div>
                                                </div>
                                                {isListening && <div style={styles.listeningText}>正在听...</div>}
                                                <RecognitionResult result={recognitionResult} />
                                            </div>
                                        </div>
                                        {/* 背面 */}
                                        <div style={{...styles.face, ...styles.backFace}}>
                                            <div style={styles.mainContent}>
                                                <div style={{...styles.header, marginBottom: '20px'}}>
                                                    <div style={{...styles.pinyin, color: '#4a5568'}}>{cardData.pinyin}</div>
                                                    <div style={{...styles.hanzi, color: '#1a202c'}}>{cardData.word}</div>
                                                </div>
                                                <div style={{color: '#2d3748', fontSize: '1.2rem', lineHeight: 1.6, textAlign: 'left', width: '100%'}}>
                                                    <FaVolumeUp style={{cursor: 'pointer', marginRight: '8px', color: '#667eea'}} onClick={(e)=>playTTS(cardData.meaning, e)}/>
                                                    <TextWithPinyin text={cardData.meaning} />
                                                </div>
                                                {cardData.example && <div style={{marginTop: '20px', fontSize: '1.1rem', color: '#4a5568', lineHeight: 1.6, textAlign: 'left', width: '100%'}}>
                                                    <FaVolumeUp style={{cursor: 'pointer', marginRight: '8px', color: '#667eea'}} onClick={(e)=>playTTS(cardData.example, e)}/> 
                                                    <TextWithPinyin text={cardData.example} />
                                                </div>}
                                                <AdComponent key={adKey + '_back'} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={styles.footer}>
                                    <button style={styles.iconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={20} /></button>
                                    <button style={{...styles.button, background: isListening ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,0,0.1)'}} onClick={handleListen}>
                                        <FaMicrophone /> {isListening ? '停止' : '发音练习'}
                                    </button>
                                    <button style={styles.iconButton} onClick={() => setWriterChar(cardData.word)} title="笔顺"><FaPenFancy size={20} /></button>
                                    <button style={styles.iconButton} onClick={(e) => playTTS(cardData.word, e)} title="朗读"><FaVolumeUp size={20} /></button>
                                </div>
                                <AdComponent key={adKey + '_front'} />
                            </div>
                        </animated.div>
                    )
                })}
            </div>
        </div>
    );
};

export default CiDianKa;
