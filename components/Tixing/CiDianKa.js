// components/Tixing/CiDianKa.js (V28 - User Request Refined)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaUpload, FaTrash } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 音效资源 =====================
const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.6 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
  flip: new Howl({ src: ['/sounds/flip.mp3'], volume: 0.7 }),
};
let _howlInstance = null;
const playTTS = (text, e) => {
  if (e && e.stopPropagation) e.stopPropagation();
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (err) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};

// ===================== 背景图与渐变色 =====================
const defaultBackgrounds = [
  'dancibeijingtu-1.jpg', 'dancibeijingtu-2.jpg', 'dancibeijingtu-3.jpg', 
  'dancibeijingtu-4.jpg', 'dancibeijingtu-5.jpg'
].map(name => `/backgrounds/${name}`); // Assuming they are in public/backgrounds

const gradients = [
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
];
const getRandomGradient = () => gradients[Math.floor(Math.random() * gradients.length)];

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2000px' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
  cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
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
  settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', position: 'relative' },
  closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' },
  uploadButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' },
  pronunciationChecker: { width: 'calc(100% - 20px)', padding: '20px', marginTop: '16px', borderTop: '4px solid #3b82f6', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', color: '#1a202c', zIndex: 2 },
  settingsGroup: { marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' },
  settingLabel: { fontWeight: 'bold', marginBottom: '10px', display: 'block' },
  radioGroup: { display: 'flex', gap: '10px' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer' },
};

// ===================== 拼音/发音分析辅助函数... (无变动, 为简洁省略) =====================
const INITIALS = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s','y','w'];
function splitSyllable(pinyin) { if (!pinyin) return { initial: '', final: '', tone: null, raw: '' }; const raw = pinyin.trim(); const toneMatch = raw.match(/([1-5])$/); const tone = toneMatch ? Number(toneMatch[1]) : null; const base = toneMatch ? raw.slice(0, -1) : raw; let initial = ''; for (const init of INITIALS.sort((a,b)=>b.length - a.length)) { if (base.startsWith(init)) { initial = init; break; } } const final = initial ? base.slice(initial.length) : base; return { initial, final, tone, raw }; }
function toPinyinNumberArray(text) { if (!text) return []; try { const pinyinStr = pinyinConverter(text, { toneType: 'num', separator: ' ' }); return pinyinStr.split(/\s+/).filter(Boolean); } catch (err) { return []; } }
function analyzePronunciation(correctWord, userText) { try { if (!correctWord) return null; const correctPys = toPinyinNumberArray(correctWord); const userPys = toPinyinNumberArray(userText); if (userPys.length === 0 && userText) { return { error: '无法解析您的发音', userRaw: userText }; } const length = Math.max(correctPys.length, userPys.length); let overallCorrect = true; const details = []; for (let i = 0; i < length; i++) { const c = splitSyllable(correctPys[i] || ''); const u = splitSyllable(userPys[i] || ''); const initialCorrect = c.initial === u.initial; const finalCorrect = c.final === u.final; const toneCorrect = c.tone === u.tone; if (!(initialCorrect && finalCorrect && toneCorrect)) overallCorrect = false; details.push({ correct: c, user: u, flags: { initialCorrect, finalCorrect, toneCorrect } }); } return { details, overallCorrect, correctRaw: correctPys.join(' '), userRaw: userPys.join(' ') }; } catch (err) { return { error: '发音分析时发生错误' }; } }
const DetailedPronunciationChecker = ({ correctWord, userText, onCorrect }) => {
  const result = useMemo(() => analyzePronunciation(correctWord, userText), [correctWord, userText]);
  useEffect(() => { if (!result || result.error) return; (result.overallCorrect ? sounds.correct : sounds.incorrect).play(); if (result.overallCorrect && onCorrect) { const timer = setTimeout(() => onCorrect(), 1500); return () => clearTimeout(timer); } }, [result, onCorrect]);
  if (!result) return null;
  return (<div style={styles.pronunciationChecker} onClick={(e)=>e.stopPropagation()} data-no-flip="true"><h3 style={{fontWeight:'bold',fontSize:'1.25rem'}}>发音分析</h3>{result.error?(<p style={{color:'#dc2626'}}>{result.error}</p>):(<div><div><span style={{fontWeight:600}}>标准:</span><span style={{fontWeight:'bold',color:'#16a34a'}}>{result.correctRaw}</span></div><div><span style={{fontWeight:600}}>你的:</span><span>{result.details.map((d,idx)=>(<span key={idx} style={{marginRight:10}}><span style={{color:d.flags.initialCorrect?'inherit':'#dc2626'}}>{d.user.initial}</span><span style={{color:d.flags.finalCorrect?'inherit':'#dc2626'}}>{d.user.final}</span><sup style={{color:d.flags.toneCorrect?'inherit':'#dc2626'}}>{d.user.tone??''}</sup></span>))}</span></div></div>)}</div>);
};
const TextWithPinyin = ({ text }) => { const pinyinResult = useMemo(() => { try { if (!text) return []; const resultFromLib = pinyinConverter(text, { segment: true, group: true }); if (!Array.isArray(resultFromLib)) { const whole = pinyinConverter(text, { separator: ' ' }); return [{ surface: text, pinyin: whole }]; } return resultFromLib.map(seg => (seg.type === 'other') ? { surface: seg.surface, pinyin: null } : { surface: seg.surface, pinyin: seg.pinyin.join(' ') }); } catch (error) { return [{ surface: text, pinyin: null }]; } }, [text]); return (<span>{pinyinResult.map((item, index) => (item.pinyin ? (<ruby key={index}><rt style={{fontSize:'0.8em'}}>{item.pinyin}</rt>{item.surface}</ruby>) : (<span key={index}>{item.surface}</span>)))}</span>);};


// ===================== 主组件 CiDianKa =====================
const CiDianKa = ({ flashcards = [] }) => {
  const processedCards = useMemo(() => {
    try {
      if (!Array.isArray(flashcards)) return [];
      return flashcards
        .filter(card => card && typeof card === 'object' && card.word)
        .map(card => ({ ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' }) }));
    } catch (error) {
      console.error("Error processing flashcards:", error);
      return [];
    }
  }, [flashcards]);

  const [playOrder, setPlayOrder] = useState(() => localStorage.getItem('cidianka_playOrder') || 'sequential');
  const [displayedCards, setDisplayedCards] = useState([]);
  
  useEffect(() => {
    let cardsToDisplay = [...processedCards];
    if (playOrder === 'random') {
      for (let i = cardsToDisplay.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardsToDisplay[i], cardsToDisplay[j]] = [cardsToDisplay[j], cardsToDisplay[i]];
      }
    }
    setDisplayedCards(cardsToDisplay);
    setCurrentIndex(0);
    localStorage.setItem('cidianka_playOrder', playOrder);
  }, [processedCards, playOrder]);
  
  const cards = displayedCards.length > 0 ? displayedCards : [{ word: "示例", pinyin: "shì lì", meaning: "数据加载中...", example: "请检查数据源。" }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [adKey, setAdKey] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userBackgrounds, setUserBackgrounds] = useState([]);
  const [currentBg, setCurrentBg] = useState(() => getRandomGradient());
  const allBackgrounds = useMemo(() => [...defaultBackgrounds, ...userBackgrounds], [userBackgrounds]);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const recognitionRef = useRef(null);
  const [swipeDirection, setSwipeDirection] = useState(1);

  useEffect(() => {
    try {
      const cachedImages = JSON.parse(localStorage.getItem('cidianka_userBackgrounds') || '[]');
      setUserBackgrounds(cachedImages);
    } catch(e) {
      localStorage.removeItem('cidianka_userBackgrounds');
    }
  }, []);

  const transitions = useTransition(currentIndex, {
    from: { opacity: 0, transform: `translateX(${swipeDirection * 50}%) scale(0.8)` },
    enter: { opacity: 1, transform: `translateX(0%) scale(1)` },
    leave: { opacity: 0, transform: `translateX(${-swipeDirection * 50}%) scale(0.8)` },
    config: { mass: 1, tension: 210, friction: 20 },
    onStart: () => { if (currentIndex !== 0) sounds.switch.play(); },
    onRest: () => { setIsFlipped(false); setRecognizedText(''); },
  });

  const navigate = useCallback((direction) => {
    setSwipeDirection(direction);
    setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);

  const handleCorrectPronunciation = useCallback(() => {
    navigate(1);
  }, [navigate]);

  // 手势绑定
  const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
    // 1. 处理点击翻转
    if (tap) {
      if (event.target.closest('[data-no-flip="true"]')) return;
      if (recognizedText) {
        setRecognizedText('');
        return;
      }
      sounds.flip.play();
      setIsFlipped(prev => !prev);
      return;
    }

    // 2. 处理滑动切换 (更高灵敏度)
    // 当滑动速度 > 0.4 或 滑动距离 > 60px 时触发
    const trigger = (vx > 0.4) || (Math.abs(mx) > 60);
    if (!down && trigger) {
      const dir = xDir < 0 ? 1 : -1; // 向左滑 (xDir为负) -> 下一张 (dir=1)
      if (isFlipped) {
        setIsFlipped(false);
        setTimeout(() => navigate(dir), 150); // 先翻回去再切换
      } else {
        navigate(dir);
      }
    }
  });

  // 自动朗读
  useEffect(() => {
    const currentCard = cards[currentIndex];
    if (currentCard && !isFlipped && !isListening) {
      const timer = setTimeout(() => playTTS(currentCard.word), 600);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isFlipped, cards, isListening]);
  
  useEffect(() => {
    setAdKey(k => k + 1);
    if (allBackgrounds.length > 0) {
      setCurrentBg(allBackgrounds[currentIndex % allBackgrounds.length]); // Use sequential bg for predictability
    } else {
      setCurrentBg(getRandomGradient());
    }
  }, [currentIndex, allBackgrounds]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const handleListen = (e) => {
    e.stopPropagation();
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
      const confidence = event.results[0][0].confidence;
      if (confidence < 0.4) {
        setRecognizedText(`[识别不清: ${transcript}]`);
        return;
      }
      setRecognizedText(transcript);
    };
    recognition.onerror = (event) => setRecognizedText(`[错误: ${event.error}]`);
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.start();
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const newImages = [];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newImages.push(e.target.result); // base64 string
        if (newImages.length === files.length) {
          const updatedImages = [...userBackgrounds, ...newImages];
          setUserBackgrounds(updatedImages);
          localStorage.setItem('cidianka_userBackgrounds', JSON.stringify(updatedImages));
          setCurrentBg(newImages[0]);
        }
      };
      reader.readAsDataURL(file);
    });
    setIsSettingsOpen(false);
  };
  const fileInputRef = useRef(null);

  const clearCachedImages = () => {
    if (window.confirm('确定要清除所有您上传的背景图片吗？')) {
      setUserBackgrounds([]);
      localStorage.removeItem('cidianka_userBackgrounds');
    }
  };

  const getBgStyle = (bgValue) => {
    if (!bgValue) return {};
    if (bgValue.startsWith('linear-gradient')) return { backgroundImage: bgValue };
    return { backgroundImage: `url(${bgValue})` };
  };

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
      {isSettingsOpen && (
        <div style={styles.settingsModal} onClick={() => setIsSettingsOpen(false)}>
          <div style={styles.settingsContent} onClick={(e)=>e.stopPropagation()}>
            <button style={styles.closeButton} onClick={() => setIsSettingsOpen(false)}><FaTimes /></button>
            <h3>设置</h3>
            <div style={styles.settingsGroup}>
              <label style={styles.settingLabel}>单词顺序</label>
              <div style={styles.radioGroup}>
                <label style={{...styles.radioLabel, background: playOrder === 'sequential' ? '#eef2ff' : 'transparent'}}><input type="radio" name="playOrder" value="sequential" checked={playOrder === 'sequential'} onChange={(e) => setPlayOrder(e.target.value)} /> 按顺序</label>
                <label style={{...styles.radioLabel, background: playOrder === 'random' ? '#eef2ff' : 'transparent'}}><input type="radio" name="playOrder" value="random" checked={playOrder === 'random'} onChange={(e) => setPlayOrder(e.target.value)} /> 随机单词</label>
              </div>
            </div>
            <div style={styles.settingsGroup}>
               <label style={styles.settingLabel}>自定义卡片背景</label>
               <p style={{fontSize: '0.9rem', color: '#6b7280', margin: '0 0 10px'}}>上传的图片会缓存在您的浏览器中。</p>
               <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
               <button style={styles.uploadButton} onClick={() => fileInputRef.current?.click()}><FaUpload /> 上传图片</button>
               {userBackgrounds.length > 0 && <button style={{...styles.uploadButton, background: '#ef4444', marginTop: 10}} onClick={clearCachedImages}><FaTrash /> 清除缓存图片</button>}
            </div>
          </div>
        </div>
      )}
      <div style={styles.container}>
        {transitions((style, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          const backgroundStyle = getBgStyle(currentBg);
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...style, zIndex: cards.length - i }}>
              <div style={styles.cardContainer}>
                <div style={{ width: '100%', height: '100%', flex: 1 }} {...bind()}>
                  <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                    {/* 正面 */}
                    <div style={{ ...styles.face, ...backgroundStyle }}>
                      <div style={styles.glassOverlay}></div>
                      <div style={styles.mainContent}>
                        <div>
                          <div style={styles.pinyin}>{cardData.pinyin}</div>
                          <div style={styles.hanzi}>{cardData.word}</div>
                        </div>
                        {isListening && <div style={{color:'white', marginTop:10}}>正在听...</div>}
                        {recognizedText && <DetailedPronunciationChecker correctWord={cardData.word} userText={recognizedText} onCorrect={handleCorrectPronunciation} />}
                      </div>
                    </div>
                    {/* 背面 */}
                    <div style={{ ...styles.face, ...styles.backFace }}>
                      <div style={styles.mainContent}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
                          <div style={{fontSize: '1.4rem', textAlign: 'center'}}><TextWithPinyin text={cardData.meaning} /></div>
                          {cardData.example && <div style={{fontSize: '1.2rem', color: '#4a5568', borderTop: '1px solid #ddd', paddingTop: 20, textAlign: 'center'}}><TextWithPinyin text={cardData.example} /></div>}
                        </div>
                        <AdComponent key={adKey + '_back'} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 底部控制 */}
                <div style={styles.footer}>
                  <button style={styles.iconButton} onClick={(e) => {e.stopPropagation(); setIsSettingsOpen(true)}} title="设置" data-no-flip="true"><FaCog size={20} /></button>
                  <button style={{ ...styles.button, background: isListening ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,0,0.1)' }} onClick={handleListen} data-no-flip="true"><FaMicrophone /> {isListening ? '停止' : '发音练习'}</button>
                  <button style={styles.iconButton} onClick={(e) => { e.stopPropagation(); setWriterChar(cardData.word); }} title="笔顺" data-no-flip="true"><FaPenFancy size={20} /></button>
                  <button style={styles.iconButton} onClick={(e) => {e.stopPropagation(); playTTS(isFlipped ? (cardData.example || cardData.meaning) : cardData.word, e);}} title="朗读" data-no-flip="true"><FaVolumeUp size={20} /></button>
                </div>

                <AdComponent key={adKey + '_front'} />
              </div>
            </animated.div>
          );
        })}
      </div>
    </div>
  );
};

export default CiDianKa;
