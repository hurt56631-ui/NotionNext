// components/Tixing/CiDianKa.js (V17 - 终极修复版：重构交互、修复UI、增加广告同步)

import React, { useState, useEffect, useMemo, useRef } from 'react'; // <<<< 关键修复：导入 useRef
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent'; // <<<< 新功能：导入广告组件

// ... (样式和辅助函数)
// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1500px' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
  cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center' },
  backFace: { transform: 'rotateY(180deg)', background: '#ffffff' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab' },
  header: { textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  pinyin: { fontSize: '1.4rem', color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: 'white' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', margin: '0 -28px -28px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
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
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [adKey, setAdKey] = useState(0); // <<<< 新功能：广告 key
    
    // 动画切换逻辑
    const transitions = useTransition(currentIndex, {
        from: { opacity: 0, transform: `translateX(100%) scale(0.8)` },
        enter: { opacity: 1, transform: `translateX(0%) scale(1)` },
        leave: { opacity: 0, transform: `translateX(-100%) scale(0.8)` },
        config: { tension: 280, friction: 25 },
        onRest: () => setIsFlipped(false), // 切换后自动翻回正面
    });
    
    // 手势绑定
    const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap }) => {
        if (tap) {
            setIsFlipped(prev => !prev);
            return;
        }
        if (isFlipped) return;

        const trigger = vx > 0.2;
        if (!down && trigger) {
            const dir = xDir < 0 ? 1 : -1; // 左滑 dir=1 (下一张), 右滑 dir=-1 (上一张)
            setCurrentIndex(prev => (prev + dir + cards.length) % cards.length);
        }
    });

    // 播放语音 & 刷新广告
    useEffect(() => {
        const currentCard = cards[currentIndex];
        if (currentCard && !isFlipped) {
            const timer = setTimeout(() => playTTS(currentCard.word), 400);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, isFlipped, cards]);

    // <<<< 新功能：每次切换或翻面都刷新广告
    useEffect(() => {
        setAdKey(k => k + 1);
    }, [currentIndex, isFlipped]);

    return (
        <div style={styles.fullScreen}>
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            <div style={styles.container}>
                {transitions((style, i) => {
                    const cardData = cards[i];
                    const backgroundStyle = { backgroundImage: `linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)` };

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
                                                <AdComponent key={adKey + '_back'} /> {/* 背面广告 */}
                                            </div>
                                        </div>
                                    </div>
                                </animated.div>
                                {/* 关键修复：Footer 在手势区域之外 */}
                                <div style={styles.footer}>
                                    <button style={styles.button} onClick={() => alert('语音识别功能待集成')}>
                                        <FaMicrophone /> 发音练习
                                    </button>
                                    <button style={styles.button} onClick={() => setWriterChar(cardData.word)}>
                                        <FaPenFancy /> 笔顺
                                    </button>
                                    <button style={styles.button} onClick={() => playTTS(cardData.word)}><FaVolumeUp /></button>
                                </div>
                                <AdComponent key={adKey + '_front'} /> {/* 正面广告 */}
                            </div>
                        </animated.div>
                    )
                })}
            </div>
        </div>
    );
};

export default CiDianKa;
