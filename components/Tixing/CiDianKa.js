// components/Tixing/CiDianKa.js (V25 - Comprehensive Fix & Feature Update by Gemini)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaUpload } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 音效资源 =====================
const switchSound = new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.7 });
const correctSound = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 });
const incorrectSound = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 });

// ===================== 随机渐变色 =====================
const gradients = [
    'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
    'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
    'linear-gradient(135deg, #a3bded 0%, #6991c7 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
];
const getRandomGradient = () => gradients[Math.floor(Math.random() * gradients.length)];

// ===================== 样式 =====================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
    container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2000px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
    cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)' },
    face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
    glassOverlay: { position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px) brightness(1.1)', WebkitBackdropFilter: 'blur(8px) brightness(1.1)', zIndex: 0 },
    backFace: { transform: 'rotateY(180deg)', background: '#f0f2f5', justifyContent: 'center' },
    mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab', padding: '10px', zIndex: 1 },
    header: { textAlign: 'center' },
    pinyin: { fontSize: '1.6rem', color: 'white', marginBottom: 6, textShadow: '0 0 5px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)' },
    hanzi: { fontSize: '6rem', fontWeight: 800, lineHeight: 1.1, color: 'white', textShadow: '0 0 8px rgba(0,0,0,0.5), 0 0 3px rgba(0,0,0,0.8)' },
    footer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', margin: '0 -28px -28px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
    button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
    iconButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px' },
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
    uploadButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' },
    listeningText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.2rem', marginTop: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' },
    pronunciationChecker: { width: 'calc(100% - 20px)', padding: '20px', marginTop: '16px', borderTop: '4px solid #3b82f6', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', color: '#1a202c', zIndex: 2 },
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

// ===================== 【V25 全新】发音分析组件 =====================
const DetailedPronunciationChecker = ({ correctWord, userText }) => {
    const analysisResult = useMemo(() => {
        try {
            if (!userText || !correctWord) return null;
            if (userText.startsWith('[错误:')) return { error: userText.replace(/\[错误: |\]/g, '') };

            const correctParts = pinyinConverter(correctWord, { pattern: 'all', type: 'array' });
            const userParts = pinyinConverter(userText, { pattern: 'all', type: 'array' });
            
            // <<< 修复点：处理无法解析语音的情况
            if (userParts.length === 0 && userText.length > 0) {
                 return { error: '无法解析您的发音，请重试' };
            }

            let isOverallCorrect = true;
            const results = correctParts.map((correctSyllable, index) => {
                const userSyllable = userParts[index] || {};
                const initialCorrect = correctSyllable.initial === userSyllable.initial;
                const finalCorrect = correctSyllable.final === userSyllable.final;
                const toneCorrect = correctSyllable.num === userSyllable.num;
                if (!initialCorrect || !finalCorrect || !toneCorrect) isOverallCorrect = false;
                
                return {
                    correct: pinyinConverter(correctSyllable.pinyin, { toneType: 'mark'}),
                    user: { initial: userSyllable.initial || '', final: userSyllable.final || '' },
                    comparison: { initialCorrect, finalCorrect, toneCorrect }
                };
            });
            if (userParts.length !== correctParts.length) isOverallCorrect = false;
            
            return { details: results, isOverallCorrect };
        } catch (error) {
            console.error("Pronunciation Analysis Error:", error);
            return { error: '拼音分析时发生内部错误' };
        }
    }, [correctWord, userText]);

    useEffect(() => {
        if (!analysisResult || analysisResult.error) return;
        const soundToPlay = analysisResult.isOverallCorrect ? correctSound : incorrectSound;
        soundToPlay.play();
    }, [analysisResult]);

    if (!analysisResult) return null;

    return (
        <div style={styles.pronunciationChecker} onClick={(e) => e.stopPropagation()} data-no-flip="true">
            <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#1a202c' }}>发音分析</h3>
            {analysisResult.error ? (
                <p style={{ marginTop: '8px', color: '#dc2626' }}>{analysisResult.error}</p>
            ) : (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <span style={{ fontWeight: '600', width: '90px', color: '#4a5568', display: 'inline-block' }}>标准发音:</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a', wordBreak: 'break-all' }}>
                            {analysisResult.details.map(s => s.correct).join(' ')}
                        </span>
                    </div>
                    <div>
                        <span style={{ fontWeight: '600', width: '90px', color: '#4a5568', display: 'inline-block' }}>你的发音:</span>
                         <span style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 'bold', wordBreak: 'break-all' }}>
                            {analysisResult.details.map((syllable, index) => (
                                <span key={index} style={{marginRight: '8px'}}>
                                    <span style={{ color: syllable.comparison.initialCorrect ? '#1a202c' : '#dc2626' }}>{syllable.user.initial}</span>
                                    <span style={{ color: syllable.comparison.finalCorrect && syllable.comparison.toneCorrect ? '#1a202c' : '#dc2626' }}>{syllable.user.final}</span>
                                </span>
                            ))}
                        </span>
                    </div>
                    {!analysisResult.isOverallCorrect && (
                        <p style={{ paddingTop: '8px', color: '#ca8a04', borderTop: '1px solid #e2e8f0', marginTop: '8px' }}>
                            提示：请注意红色部分的差异。
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// ===================== 带拼音的文本组件 =====================
const TextWithPinyin = ({ text }) => {
    const pinyinResult = useMemo(() => {
        try {
            if (typeof text !== 'string' || !text) return text ? [{ surface: text, pinyin: null }] : [];
            const resultFromLib = pinyinConverter(text, { segment: true, group: true });
            if (!Array.isArray(resultFromLib)) return [{ surface: text, pinyin: null }];
            return resultFromLib.map(segment => (segment.type === 'other') ? { surface: segment.surface, pinyin: null } : { surface: segment.surface, pinyin: segment.pinyin.join(' ') });
        } catch (error) {
            console.error("TextWithPinyin Error:", error, { text });
            return [{ surface: text, pinyin: null }];
        }
    }, [text]);
    return ( <span style={{ lineHeight: 2.2 }}>{pinyinResult.map((item, index) => (item.pinyin ? ( <ruby key={index} style={{ margin: '0 2px' }}><rt style={{ fontSize: '0.8em', userSelect: 'none' }}>{item.pinyin}</rt>{item.surface}</ruby> ) : ( <span key={index}>{item.surface}</span> )))}</span> );
};

// ===================== 主组件 CiDianKa (V25) =====================
const CiDianKa = ({ flashcards = [] }) => {
    const processedCards = useMemo(() => {
        try {
            if (!Array.isArray(flashcards)) return [];
            return flashcards
                .filter(card => card && typeof card === 'object' && typeof card.word === 'string' && card.word)
                .map(card => ({ ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' }) }));
        } catch (error) {
            console.error("CRITICAL ERROR processing 'flashcards':", error, flashcards);
            return [];
        }
    }, [flashcards]);

    const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "数据加载中或为空...", example: "请检查数据源或稍后再试。" }];

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [adKey, setAdKey] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [backgroundImages, setBackgroundImages] = useState([]);
    const [currentBg, setCurrentBg] = useState(() => getRandomGradient());
    const [isListening, setIsListening] = useState(false);
    const [recognizedText, setRecognizedText] = useState('');
    const recognitionRef = useRef(null);
    const [swipeDirection, setSwipeDirection] = useState(1);

    const transitions = useTransition(currentIndex, {
        from: { opacity: 0, transform: `translateX(${swipeDirection * 50}%) scale(0.8) rotateY(${-swipeDirection * 90}deg)` },
        enter: { opacity: 1, transform: `translateX(0%) scale(1) rotateY(0deg)` },
        leave: { opacity: 0, transform: `translateX(${-swipeDirection * 50}%) scale(0.8) rotateY(${swipeDirection * 90}deg)` },
        config: { mass: 1, tension: 210, friction: 20 },
        onStart: () => { if (currentIndex !== 0) { switchSound.play(); } },
        onRest: () => { setIsFlipped(false); setRecognizedText(''); },
    });
    
    const navigate = (direction) => {
        setSwipeDirection(direction);
        setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
    };

    const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
        if (tap) {
            if(event.target.closest('[data-no-flip="true"], button, a, rt')) return;
            if(recognizedText) return;
            setIsFlipped(prev => !prev);
            return;
        }
        const trigger = vx > 0.5; // <<< 修改：进一步降低灵敏度
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

    // Front-face auto-read
    useEffect(() => {
        const currentCard = cards[currentIndex];
        if (currentCard && !isFlipped) {
            const timer = setTimeout(() => playTTS(currentCard.word), 600);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, isFlipped, cards]);
    
    // <<< 新增：Back-face auto-read
    useEffect(() => {
        if (isFlipped) {
            const currentCard = cards[currentIndex];
            if (currentCard && currentCard.meaning) {
                const timer = setTimeout(() => playTTS(currentCard.meaning), 400); // Shorter delay for flip
                return () => clearTimeout(timer);
            }
        }
    }, [isFlipped, currentIndex, cards]);

    useEffect(() => {
        setAdKey(k => k + 1);
        if (backgroundImages.length > 0) {
            setCurrentBg(backgroundImages[Math.floor(Math.random() * backgroundImages.length)]);
        } else { 
            setCurrentBg(getRandomGradient());
        }
    }, [currentIndex, backgroundImages]);

    useEffect(() => {
        return () => { if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; } };
    }, []);

    const handleListen = () => {
        if (isListening) { recognitionRef.current?.stop(); return; }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; }
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;
        recognition.onstart = () => { setIsListening(true); setRecognizedText(''); };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
            setRecognizedText(transcript);
        };
        recognition.onerror = (event) => {
            let errorMessage = `识别出错: ${event.error}`;
            if (event.error === 'network') errorMessage = '网络错误';
            else if (event.error === 'no-speech') errorMessage = '未检测到语音';
            setRecognizedText(`[错误: ${errorMessage}]`); 
        };
        recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
        recognition.start();
    };

    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            const imageUrls = files.map(file => URL.createObjectURL(file));
            setBackgroundImages(prev => [...prev, ...imageUrls]);
            setIsSettingsOpen(false);
        }
    };
    
    const fileInputRef = useRef(null);

    const handleScreenClick = (e) => {
        if (recognizedText) {
            e.stopPropagation();
            setRecognizedText('');
        }
    };

    return (
        <div style={styles.fullScreen}>
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            {isSettingsOpen && ( <div style={styles.settingsModal} onClick={() => setIsSettingsOpen(false)}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={() => setIsSettingsOpen(false)}><FaTimes /></button><h3>自定义卡片背景</h3><p>上传的图片仅在您的浏览器中生效。</p><input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} /><button style={styles.uploadButton} onClick={() => fileInputRef.current.click()}><FaUpload /> 选择图片</button></div></div> )}
            <div style={styles.container}>
                {transitions((style, i) => {
                    const cardData = cards[i];
                    if(!cardData) return null;
                    const backgroundStyle = { backgroundImage: currentBg };
                    return (
                        <animated.div style={{ ...styles.animatedCardShell, ...style, zIndex: cards.length - i }}>
                            <div style={styles.cardContainer}>
                                <div style={{ width: '100%', height: '100%', flex: 1 }} {...bind()} onClickCapture={handleScreenClick}>
                                    <div style={{...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                                        <div style={{...styles.face, ...backgroundStyle}}>
                                            <div style={styles.glassOverlay}></div>
                                            <div style={styles.mainContent}>
                                                <div style={styles.header}><div style={styles.pinyin}>{cardData.pinyin}</div><div style={styles.hanzi}>{cardData.word}</div></div>
                                                {isListening && <div style={styles.listeningText}>正在听...</div>}
                                                {recognizedText && <DetailedPronunciationChecker correctWord={cardData.word} userText={recognizedText} />}
                                            </div>
                                        </div>
                                        <div style={{...styles.face, ...styles.backFace}}>
                                            <div style={styles.mainContent}>
                                                {/* <<< 修改：移除背面单词 */}
                                                <div style={{display: 'flex', flexDirection: 'column', gap: '20px', width: '100%'}}>
                                                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#2d3748', fontSize: '1.2rem'}}>
                                                        <div style={{flex: 1, paddingRight: '10px'}}><TextWithPinyin text={cardData.meaning} /></div>
                                                        <FaVolumeUp data-no-flip="true" style={{cursor: 'pointer', color: '#667eea'}} size={24} onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>playTTS(cardData.meaning, e)}/>
                                                    </div>
                                                    {cardData.example && <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#4a5568', fontSize: '1.1rem', borderTop: '1px solid #ddd', paddingTop: '20px'}}>
                                                        <div style={{flex: 1, paddingRight: '10px'}}><TextWithPinyin text={cardData.example} /></div>
                                                        <FaVolumeUp data-no-flip="true" style={{cursor: 'pointer', color: '#667eea'}} size={24} onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>playTTS(cardData.example, e)}/> 
                                                    </div>}
                                                </div>
                                                <AdComponent key={adKey + '_back'} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={styles.footer}>
                                    <button style={styles.iconButton} onClick={() => setIsSettingsOpen(true)} title="设置" data-no-flip="true"><FaCog size={20} /></button>
                                    <button style={{...styles.button, background: isListening ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,0,0.1)'}} onClick={handleListen} data-no-flip="true"><FaMicrophone /> {isListening ? '停止' : '发音练习'}</button>
                                    <button style={styles.iconButton} onClick={() => setWriterChar(cardData.word)} title="笔顺" data-no-flip="true"><FaPenFancy size={20} /></button>
                                    <button style={styles.iconButton} onClick={(e) => playTTS(cardData.word, e)} title="朗读" data-no-flip="true"><FaVolumeUp size={20} /></button>
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
