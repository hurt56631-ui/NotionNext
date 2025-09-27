// components/Tixing/CiDianKa.js (V18 - 功能增强版：语音评测、自定义背景)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaUpload } from 'react-icons/fa'; // 引入新图标
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 样式 =====================
const styles = {
    // ... (大部分样式保持不变)
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
    container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1500px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
    cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' },
    face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center' },
    backFace: { transform: 'rotateY(180deg)', background: '#ffffff' },
    mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab', padding: '10px' },
    header: { textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    pinyin: { fontSize: '1.4rem', color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
    hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: 'white' },
    footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', margin: '0 -28px -28px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
    button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
    
    // ===================== 新增样式 =====================
    settingsButton: { position: 'fixed', left: '20px', bottom: '20px', zIndex: 10000, background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(5px)', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer' },
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
    uploadButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' },
    recognitionResult: { marginTop: '15px', fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' },
    listeningText: { color: '#4299e1', fontSize: '1.2rem', marginTop: '10px' },
};

// ===================== TTS 管理 =====================
let _howlInstance = null;
const playTTS = (text, e) => {
    // <<<< 修改：增加事件参数e，用于阻止事件冒泡
    if (e) e.stopPropagation();
    if (!text) return;
    try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (err) {}
    _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
    _howlInstance.play();
};

// ===================== 语音识别与对比辅助函数 =====================
const comparePinyin = (correctWord, userText) => {
    if (!userText) return [{ type: 'error', text: '未识别到语音' }];

    const correctPinyin = pinyinConverter(correctWord, { type: 'array', toneType: 'num' });
    const userPinyin = pinyinConverter(userText, { type: 'array', toneType: 'num' });

    // 简单对比，逐个拼音进行比较
    return correctPinyin.map((correctSyl, index) => {
        const userSyl = userPinyin[index];
        if (!userSyl) return { original: pinyinConverter(correctSyl, { toneType: 'mark' }), parts: [] };

        const correctParts = pinyinConverter(correctSyl, { toneType: 'num', pattern: 'all' });
        const userParts = pinyinConverter(userSyl, { toneType: 'num', pattern: 'all' });

        return {
            original: pinyinConverter(correctSyl, { toneType: 'mark' }),
            parts: [
                { type: 'initial', text: correctParts.initial, correct: correctParts.initial === userParts.initial },
                { type: 'final', text: correctParts.final, correct: correctParts.final === userParts.final },
                { type: 'tone', text: correctParts.num, correct: correctParts.num === userParts.num }
            ],
            userPronunciation: pinyinConverter(userSyl, { toneType: 'mark' }),
        };
    });
};

const RecognitionResult = ({ result }) => {
    if (!result || result.length === 0) return null;
    if (result[0].type === 'error') return <div style={{...styles.recognitionResult, color: 'red'}}>{result[0].text}</div>;

    const getPinyinWithToneMark = (initial, final, toneNum) => {
         // 使用 pinyin-pro 将声母、韵母、音调数字组合成带音标的完整拼音
         const pinyinStr = `${initial}${final}`;
         const fullPinyin = pinyinConverter(pinyinStr, { toneType: 'mark', toneSandhi: false });
         // 这是一个简化的实现，实际转换可能需要更复杂的逻辑库来保证100%准确
         // 这里我们直接用一个技巧，转换一个带音调的汉字来获取音标
         const tempMap = { 'a1':'ā', 'a2':'á', 'a3':'ǎ', 'a4':'à', 'e1':'ē', 'e2':'é', 'e3':'ě', 'e4':'è', 'i1':'ī', 'i2':'í', 'i3':'ǐ', 'i4':'ì', 'o1':'ō', 'o2':'ó', 'o3':'ǒ', 'o4':'ò', 'u1':'ū', 'u2':'ú', 'u3':'ǔ', 'u4':'ù', 'v1':'ǖ', 'v2':'ǘ', 'v3':'ǚ', 'v4':'ǜ' };
         let finalWithMark = final;
         for(const key in tempMap){
             if(final.includes(key[0]) && toneNum == key[1]){
                 finalWithMark = final.replace(key[0], tempMap[key]);
                 break;
             }
         }
         return {initial, finalWithMark};
    }
    
    return (
        <div style={styles.recognitionResult}>
            {result.map((syl, i) => (
                <span key={i} style={{ marginRight: '15px' }}>
                    {syl.parts.map((part, j) => {
                        if(part.type === 'tone') return null; // 声调不直接显示，颜色应用在韵母上
                        const tonePart = syl.parts.find(p => p.type === 'tone');
                        const color = part.correct && tonePart.correct ? 'green' : 'red';
                        return <span key={j} style={{ color: part.correct ? 'green' : 'red' }}>{part.text}</span>
                    })}
                </span>
            ))}
        </div>
    );
};


// ===================== 主组件 CiDianKa (V18 重构版) =====================
const CiDianKa = ({ flashcards = [] }) => {
    const processedCards = useMemo(() => flashcards.map(card => ({
        ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' })
    })), [flashcards]);

    const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "这是一个示例卡片。", example: "请点击设置按钮上传自定义背景图片。" }];

    // 状态管理
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [adKey, setAdKey] = useState(0);
    
    // ===================== 新增状态 =====================
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [backgroundImages, setBackgroundImages] = useState([]);
    const [currentBg, setCurrentBg] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [recognitionResult, setRecognitionResult] = useState(null);
    const recognitionRef = useRef(null);


    // 动画切换逻辑
    const transitions = useTransition(currentIndex, {
        from: { opacity: 0, transform: `translateX(100%) scale(0.8)` },
        enter: { opacity: 1, transform: `translateX(0%) scale(1)` },
        leave: { opacity: 0, transform: `translateX(-100%) scale(0.8)` },
        config: { tension: 280, friction: 25 },
        onRest: () => {
            setIsFlipped(false);
            setRecognitionResult(null); // 切换卡片时清空识别结果
        },
    });

    // 手势绑定
    const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
        // <<<< 修改：阻止在按钮上的点击事件触发翻转
        if (tap && event.target.closest('button, svg')) {
            return;
        }
        if (tap) {
            setIsFlipped(prev => !prev);
            return;
        }
        if (isFlipped) return;

        const trigger = vx > 0.2;
        if (!down && trigger) {
            const dir = xDir < 0 ? 1 : -1;
            setCurrentIndex(prev => (prev + dir + cards.length) % cards.length);
        }
    });

    // 播放语音 & 刷新广告 & 设置新背景
    useEffect(() => {
        const currentCard = cards[currentIndex];
        if (currentCard && !isFlipped) {
            const timer = setTimeout(() => playTTS(currentCard.word), 400);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, isFlipped, cards]);
    
    useEffect(() => {
        setAdKey(k => k + 1);
        // <<<< 新功能：切换卡片时，随机更换背景
        if (backgroundImages.length > 0) {
            const randomIndex = Math.floor(Math.random() * backgroundImages.length);
            setCurrentBg(backgroundImages[randomIndex]);
        } else {
            setCurrentBg(null); // 如果没有自定义背景，则使用默认
        }
    }, [currentIndex, isFlipped, backgroundImages]);

    // ===================== 新增功能：语音识别处理 =====================
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

        recognition.onstart = () => {
            setIsListening(true);
            setRecognitionResult(null);
        };

        recognition.onresult = (event) => {
            const userText = event.results[0][0].transcript;
            const currentCard = cards[currentIndex];
            const result = comparePinyin(currentCard.word, userText);
            setRecognitionResult(result);
        };

        recognition.onerror = (event) => {
            console.error('语音识别错误:', event.error);
            setRecognitionResult([{ type: 'error', text: `识别出错: ${event.error}` }]);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    // ===================== 新增功能：处理图片上传 =====================
    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            const imageUrls = files.map(file => URL.createObjectURL(file));
            setBackgroundImages(prev => [...prev, ...imageUrls]);
            setIsSettingsOpen(false); // 上传后自动关闭设置
        }
    };
    
    const fileInputRef = useRef(null);

    return (
        <div style={styles.fullScreen}>
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}

            {/* ===================== 新增：设置弹窗 ===================== */}
            {isSettingsOpen && (
                <div style={styles.settingsModal} onClick={() => setIsSettingsOpen(false)}>
                    <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.closeButton} onClick={() => setIsSettingsOpen(false)}><FaTimes /></button>
                        <h3>自定义卡片背景</h3>
                        <p>上传的图片仅在您的浏览器中生效，不会上传到服务器。</p>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                        />
                        <button style={styles.uploadButton} onClick={() => fileInputRef.current.click()}>
                            <FaUpload /> 选择图片
                        </button>
                    </div>
                </div>
            )}
            <button style={styles.settingsButton} onClick={() => setIsSettingsOpen(true)}>
                <FaCog size={24} />
            </button>


            <div style={styles.container}>
                {transitions((style, i) => {
                    const cardData = cards[i];
                    // <<<< 修改：动态背景
                    const backgroundStyle = currentBg 
                        ? { backgroundImage: `url(${currentBg})` }
                        : { backgroundImage: `linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)` };

                    return (
                        <animated.div style={{ ...styles.animatedCardShell, ...style, zIndex: cards.length - i }}>
                            <div style={styles.cardContainer}>
                                <animated.div 
                                    {...bind()}
                                    style={{ width: '100%', height: '100%', flex: 1 }}
                                >
                                    <div style={{...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                                        {/* 正面 */}
                                        <div style={{...styles.face, ...backgroundStyle}}>
                                            <div style={styles.mainContent}>
                                                <div style={styles.header}>
                                                    <div style={styles.pinyin}>{cardData.pinyin}</div>
                                                    <div style={styles.hanzi}>{cardData.word}</div>
                                                </div>
                                                {/* 新增：语音识别结果展示区 */}
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
                                                <div style={{...styles.meaning, color: '#2d3748', fontSize: '1.2rem', lineHeight: 1.6}}>
                                                    {/* <<<< 关键修复：给每个朗读按钮加上阻止冒泡 */}
                                                    <FaVolumeUp style={{cursor: 'pointer', marginRight: '8px'}} onClick={(e)=>playTTS(cardData.meaning, e)}/>
                                                    {cardData.meaning}
                                                </div>
                                                {cardData.example && <div style={{...styles.example, marginTop: '20px', fontSize: '1.1rem', color: '#4a5568', lineHeight: 1.6}}>
                                                    <FaVolumeUp style={{cursor: 'pointer', marginRight: '8px'}} onClick={(e)=>playTTS(cardData.example, e)}/> 
                                                    {cardData.example}
                                                </div>}
                                                <AdComponent key={adKey + '_back'} />
                                            </div>
                                        </div>
                                    </div>
                                </animated.div>
                                <div style={styles.footer}>
                                    {/* <<<< 修改：发音练习按钮功能 */}
                                    <button style={{...styles.button, background: isListening ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,0,0.1)'}} onClick={handleListen}>
                                        <FaMicrophone /> {isListening ? '停止' : '发音练习'}
                                    </button>
                                    <button style={styles.button} onClick={() => setWriterChar(cardData.word)}>
                                        <FaPenFancy /> 笔顺
                                    </button>
                                    <button style={styles.button} onClick={(e) => playTTS(cardData.word, e)}><FaVolumeUp /></button>
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
