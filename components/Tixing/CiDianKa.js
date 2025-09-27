// components/Tixing/CiDianKa.js (V19 - 全面优化版 by Gemini)

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

// ===================== 样式 =====================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
    container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2000px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
    cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)' },
    face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
    // >>> 新增：玻璃背景效果的叠加层
    glassOverlay: { position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(15px) brightness(1.1)', WebkitBackdropFilter: 'blur(15px) brightness(1.1)', zIndex: 0 },
    backFace: { transform: 'rotateY(180deg)', background: '#f0f2f5' }, // <<< 修改：背面背景为浅灰色
    mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab', padding: '10px', zIndex: 1 },
    header: { textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    pinyin: { fontSize: '1.4rem', color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
    hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: 'white' },
    footer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', margin: '0 -28px -28px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
    // <<< 修改：按钮样式，特别是图标按钮
    button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
    iconButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px' },
    // >>> 新增：背面切换按钮样式
    nextButton: { position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(0,0,0,0.08)', color: '#4a5568', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    
    // --- 设置弹窗样式 (保持不变) ---
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
    uploadButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' },
    
    // --- 语音识别结果样式 ---
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


// ===================== 语音识别与对比辅助函数 =====================
// ... (此部分逻辑不变，保持原样)
const comparePinyin = (correctWord, userText) => {
    if (!userText) return [{ type: 'error', text: '未识别到语音' }];

    const correctPinyin = pinyinConverter(correctWord, { type: 'array', toneType: 'num' });
    const userPinyin = pinyinConverter(userText, { type: 'array', toneType: 'num' });

    return correctPinyin.map((correctSyl, index) => {
        const userSyl = userPinyin[index];
        if (!userSyl) return { original: pinyinConverter(correctSyl, { toneType: 'mark' }), parts: [] };

        const correctParts = pinyinConverter(correctSyl, { pattern: 'all' });
        const userParts = pinyinConverter(userSyl, { pattern: 'all' });

        return {
            original: pinyinConverter(correctSyl, { toneType: 'mark' }),
            parts: [
                { type: 'initial', text: correctParts.initial || '', correct: correctParts.initial === userParts.initial },
                { type: 'final', text: correctParts.final, correct: correctParts.final === userParts.final },
                { type: 'tone', text: String(correctParts.num), correct: correctParts.num === userParts.num }
            ],
            userPronunciation: pinyinConverter(userSyl, { toneType: 'mark' }),
        };
    });
};

const RecognitionResult = ({ result }) => {
    if (!result || result.length === 0) return null;
    if (result[0].type === 'error') return <div style={{...styles.recognitionResult, color: '#ff6b6b'}}>{result[0].text}</div>;

    return (
        <div style={styles.recognitionResult}>
            {result.map((syl, i) => (
                <span key={i} style={{ marginRight: '15px' }}>
                    {syl.parts.map((part, j) => {
                        if (part.type === 'tone') return null;
                        const tonePart = syl.parts.find(p => p.type === 'tone');
                        const isCorrect = part.correct && (part.type === 'initial' || tonePart.correct); // 声母正确性不依赖声调
                        return <span key={j} style={{ color: isCorrect ? '#a7f3d0' : '#ffc0cb' }}>{part.text}</span>;
                    })}
                </span>
            ))}
        </div>
    );
};

// ===================== 新增：带拼音的文本组件 =====================
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


// ===================== 主组件 CiDianKa (V19) =====================
const CiDianKa = ({ flashcards = [] }) => {
    const processedCards = useMemo(() => flashcards.map(card => ({
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
    const [recognitionResult, setRecognitionResult] = useState(null);
    const recognitionRef = useRef(null);

    // --- 动画与手势 ---
    // <<< 修改：更高级的切换动画
    const transitions = useTransition(currentIndex, {
        from: { opacity: 0, transform: `translateX(50%) scale(0.8) rotateY(-90deg)` },
        enter: { opacity: 1, transform: `translateX(0%) scale(1) rotateY(0deg)` },
        leave: { opacity: 0, transform: `translateX(-50%) scale(0.8) rotateY(90deg)` },
        config: { mass: 1, tension: 210, friction: 20 },
        onStart: () => {
             // 播放切换音效
            if (currentIndex !== 0) { // 初始加载时不播放
                switchSound.play();
            }
        },
        onRest: () => {
            setIsFlipped(false);
            setRecognitionResult(null);
        },
    });
    
    const navigate = (direction) => {
        setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
    };

    const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
        if (tap && event.target.closest('button, svg, a, rt')) { // 防止点击按钮和拼音时翻转
            return;
        }
        if (tap) {
            setIsFlipped(prev => !prev);
            return;
        }
        if (isFlipped) return; // 反面不允许拖动切换

        const trigger = vx > 0.2;
        if (!down && trigger) {
            navigate(xDir < 0 ? 1 : -1);
        }
    });

    // --- 副作用 Hooks ---
    useEffect(() => {
        const currentCard = cards[currentIndex];
        if (currentCard && !isFlipped) {
            const timer = setTimeout(() => playTTS(currentCard.word), 600); // 延迟以匹配动画
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

    // --- 功能函数 ---
    const handleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('抱歉，您的浏览器不支持语音识别。请尝试使用Chrome浏览器。');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;

        recognition.onstart = () => { setIsListening(true); setRecognitionResult(null); };
        recognition.onresult = (event) => {
            const userText = event.results[0][0].transcript;
            const result = comparePinyin(cards[currentIndex].word, userText);
            setRecognitionResult(result);
        };
        recognition.onerror = (event) => {
            // <<< 修改：处理 network 错误
            let errorMessage = `识别出错: ${event.error}`;
            if (event.error === 'network') {
                errorMessage = '网络错误，请检查连接';
            } else if (event.error === 'no-speech') {
                errorMessage = '没有检测到语音';
            }
            setRecognitionResult([{ type: 'error', text: errorMessage }]);
        };
        recognition.onend = () => { setIsListening(false); };
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
    
    const handleNextOnBack = (e) => {
        e.stopPropagation();
        setIsFlipped(false);
        // 延迟切换，等待翻转动画开始
        setTimeout(() => navigate(1), 200);
    }

    // --- 渲染 ---
    return (
        <div style={styles.fullScreen}>
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}

            {isSettingsOpen && (
                <div style={styles.settingsModal} onClick={() => setIsSettingsOpen(false)}>
                    <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.closeButton} onClick={() => setIsSettingsOpen(false)}><FaTimes /></button>
                        <h3>自定义卡片背景</h3>
                        <p>上传的图片仅在您的浏览器中生效，不会上传到服务器。</p>
                        <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                        <button style={styles.uploadButton} onClick={() => fileInputRef.current.click()}>
                            <FaUpload /> 选择图片
                        </button>
                    </div>
                </div>
            )}

            <div style={styles.container}>
                {transitions((style, i) => {
                    const cardData = cards[i];
                    const backgroundStyle = currentBg 
                        ? { backgroundImage: `url(${currentBg})` }
                        : { backgroundImage: `linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)` };

                    return (
                        <animated.div style={{ ...styles.animatedCardShell, ...style, zIndex: cards.length - i }}>
                            <div style={styles.cardContainer}>
                                <div style={{ width: '100%', height: '100%', flex: 1 }} {...bind()}>
                                    <div style={{...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                                        {/* 正面 */}
                                        <div style={{...styles.face, ...backgroundStyle}}>
                                            <div style={styles.glassOverlay}></div> {/* <<< 新增：玻璃效果叠加层 */}
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
                                                    <TextWithPinyin text={cardData.meaning} /> {/* <<< 修改：使用带拼音组件 */}
                                                </div>
                                                {cardData.example && <div style={{marginTop: '20px', fontSize: '1.1rem', color: '#4a5568', lineHeight: 1.6, textAlign: 'left', width: '100%'}}>
                                                    <FaVolumeUp style={{cursor: 'pointer', marginRight: '8px', color: '#667eea'}} onClick={(e)=>playTTS(cardData.example, e)}/> 
                                                    <TextWithPinyin text={cardData.example} /> {/* <<< 修改：使用带拼音组件 */}
                                                </div>}
                                                <AdComponent key={adKey + '_back'} />
                                                {/* <<< 新增：背面切换下一个单词的按钮 */}
                                                <button style={styles.nextButton} onClick={handleNextOnBack} title="下一个">
                                                    <FaArrowRight size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* <<< 修改：底部操作栏布局 */}
                                <div style={styles.footer}>
                                    <button style={styles.iconButton} onClick={() => setIsSettingsOpen(true)} title="设置">
                                        <FaCog size={20} />
                                    </button>
                                    <button style={{...styles.button, background: isListening ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,0,0.1)'}} onClick={handleListen}>
                                        <FaMicrophone /> {isListening ? '停止' : '发音练习'}
                                    </button>
                                    <button style={styles.iconButton} onClick={() => setWriterChar(cardData.word)} title="笔顺">
                                        <FaPenFancy size={20} />
                                    </button>
                                    <button style={styles.iconButton} onClick={(e) => playTTS(cardData.word, e)} title="朗读">
                                        <FaVolumeUp size={20} />
                                    </button>
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
