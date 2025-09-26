// components/Tixing/CiDianKa.js (V17 - 终极修复版：重构交互、修复UI、增加自定义背景)

import React, { useState, useEffect, useMemo } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaImages } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// ... (样式和辅助函数)
// ===================== 美化：渐变色背景 =====================
const gradients = [
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
];

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  container: { position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deck: { position: 'absolute', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
  cardInner: { position: 'relative', width: '100%', height: '100%', flex: 1, transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center' },
  backFace: { transform: 'rotateY(180deg)', background: '#ffffff' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab' },
  header: { textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  pinyin: { fontSize: '1.4rem', color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: 'white' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: 12, flexShrink: 0 },
  button: { background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  settingsModal: { position: 'absolute', bottom: '110px', right: '20px', background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 100 },
};

// ===================== TTS 管理 =====================
let _howlInstance = null;
const playTTS = (text) => {
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (e) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};


// ===================== 主组件 CiDianKa (V17 重构版) =====================
const CiDianKa = ({ flashcards = [] }) => {
    const processedCards = useMemo(() => flashcards.map(card => ({
        ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' })
    })), [flashcards]);

    const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "Example" }];
    
    // 状态管理
    const [gone] = useState(() => new Set());
    const [isFlipped, setIsFlipped] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [customBgs, setCustomBgs] = useState([]);
    const fileInputRef = useRef(null);

    // 动画配置
    const to = (i) => ({ x: 0, y: -i * 4, scale: 1 - i * 0.05, rot: 0 });
    const from = (_i) => ({ x: 0, rot: 0, scale: 1.5, y: -1000 });
    const [props, api] = useSprings(cards.length, i => ({ ...to(i), from: from(i) }));
    
    // 手势绑定
    const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx], tap }) => {
        if (tap) {
            setIsFlipped(prev => !prev);
            return;
        }
        if (isFlipped) return;

        const trigger = vx > 0.2;
        const dir = xDir < 0 ? -1 : 1;
        if (!down && trigger) gone.add(index);
        
        api.start(i => {
            if (index !== i) return;
            const isGone = gone.has(index);
            if (isGone) setIsFlipped(false); // 划走时自动翻回正面
            const x = isGone ? (200 + window.innerWidth) * dir : down ? mx : 0;
            const rot = mx / 100 + (isGone ? dir * 10 * vx : 0);
            const scale = down ? 1.1 : 1;
            return { x, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } };
        });

        if (!down && gone.size === cards.length) {
            setTimeout(() => { gone.clear(); api.start(i => to(i)); }, 600);
        }
    });

    // 播放当前卡片语音
    useEffect(() => {
        const currentCard = cards[gone.size];
        if (currentCard && !isFlipped) {
            const timer = setTimeout(() => playTTS(currentCard.word), 400);
            return () => clearTimeout(timer);
        }
    }, [gone.size, isFlipped, cards]);

    const handleBgUpload = (event) => {
        const files = Array.from(event.target.files);
        const imageUrls = files.map(file => URL.createObjectURL(file));
        setCustomBgs(imageUrls);
        setShowSettings(false);
    };

    return (
        <div style={styles.fullScreen}>
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            <div style={styles.container}>
                {props.map(({ x, y, rot, scale }, i) => {
                    // 虚拟化渲染：只渲染顶部的几张卡片
                    if (i < gone.size - 1 || i > gone.size + 2) return null;
                    
                    const cardData = cards[i];
                    const isCurrent = i === gone.size;
                    const backgroundStyle = {
                        backgroundImage: customBgs.length > 0 
                            ? `url(${customBgs[i % customBgs.length]})` 
                            : gradients[i % gradients.length],
                        boxShadow: customBgs.length > 0 ? 'inset 0 0 0 2000px rgba(0,0,0,0.3)' : '', // 如果是图片，加一层蒙版
                    };

                    return (
                        <animated.div style={{ ...styles.deck, x, y, zIndex: cards.length - i }} key={i}>
                            <div style={styles.cardContainer}>
                                <animated.div 
                                    {...(isCurrent ? bind(i) : {})} // 只给最顶层的卡片绑定手势
                                    style={{ 
                                        transform: scale.to(s => `scale(${s}) rotateZ(${rot}deg)`),
                                        width: '100%',
                                        height: '100%',
                                        flex: 1, // 关键：让手势区域占据主要空间
                                    }}
                                >
                                    <div style={{...styles.cardInner, transform: isFlipped && isCurrent ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                                        {/* 正面 */}
                                        <div style={{...styles.face, ...backgroundStyle}}>
                                            <div style={styles.mainContent}>
                                                <div style={styles.header}>
                                                    <div style={styles.pinyin}>{cardData.pinyin}</div>
                                                    <div style={styles.hanzi}>{cardData.word}</div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* 背面 */}
                                        <div style={{...styles.face, ...styles.backFace}}>
                                            <div style={styles.mainContent}>
                                                <div style={{...styles.header, marginBottom: '20px'}}>
                                                    <div style={{...styles.pinyin, color: '#4a5568'}}>{cardData.pinyin}</div>
                                                    <div style={{...styles.hanzi, color: '#1a202c'}}>{cardData.word}</div>
                                                </div>
                                                <div style={{...styles.meaning, color: '#2d3748'}}>
                                                    {cardData.meaning}
                                                    <FaVolumeUp style={{cursor: 'pointer'}} onClick={(e)=>{e.stopPropagation(); playTTS(cardData.meaning)}}/>
                                                </div>
                                                {cardData.example && <div style={{...styles.example, marginTop: '20px'}}>
                                                    <FaVolumeUp style={{cursor: 'pointer'}} onClick={(e)=>{e.stopPropagation(); playTTS(cardData.example)}}/> {cardData.example}
                                                </div>}
                                            </div>
                                        </div>
                                    </div>
                                </animated.div>
                                {/* 关键修复：Footer 在手势区域之外 */}
                                {isCurrent && (
                                    <div style={{...styles.footer, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', margin: '0 -28px -28px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)'}}>
                                        <button style={{...styles.button, background: 'rgba(0,0,0,0.1)', color: '#4a5568'}} onClick={() => alert('语音识别功能待集成')}>
                                            <FaMicrophone /> 发音练习
                                        </button>
                                        <button style={{...styles.button, background: 'rgba(0,0,0,0.1)', color: '#4a5568'}} onClick={() => setWriterChar(cardData.word)}>
                                            <FaPenFancy /> 笔顺
                                        </button>
                                        <button style={{...styles.button, background: 'rgba(0,0,0,0.1)', color: '#4a5568'}} onClick={() => playTTS(cardData.word)}><FaVolumeUp /></button>
                                        <button style={{...styles.button, background: 'rgba(0,0,0,0.1)', color: '#4a5568'}} onClick={() => setShowSettings(s => !s)}><FaCog /></button>
                                    </div>
                                )}
                            </div>
                        </animated.div>
                    )
                })}
            </div>
            {/* 设置面板 */}
            {showSettings && (
                <div style={styles.settingsModal}>
                    <input type="file" ref={fileInputRef} onChange={handleBgUpload} multiple accept="image/*" style={{display: 'none'}} />
                    <button style={{...styles.button, background: '#e2e8f0', color: '#2d3748'}} onClick={() => fileInputRef.current.click()}>
                        <FaImages /> 上传背景图
                    </button>
                </div>
            )}
        </div>
    );
};

export default CiDianKa;
