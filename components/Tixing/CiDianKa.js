// components/Tixing/CiDianKa.js (V27 - Fully Upgraded)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaUpload, FaRandom, FaSortAmountDown } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 音效资源 (复用 Howl 实例) =====================
const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.6 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;
const playTTS = (text, onEndCallback, e) => {
  if (e && e.stopPropagation) e.stopPropagation();
  if (!text) {
    if (onEndCallback) onEndCallback();
    return;
  }
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (err) {}
  _howlInstance = new Howl({
    src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`],
    html5: true,
    onend: onEndCallback, // 在朗读结束后调用回调
  });
  _howlInstance.play();
};

// ===================== 预设背景图 =====================
const predefinedBackgrounds = [
  '/images/dancibeijingtu-1.jpg',
  '/images/dancibeijingtu-2.jpg',
  '/images/dancibeijingtu-3.jpg',
  '/images/dancibeijingtu-4.jpg',
  '/images/dancibeijingtu-5.jpg',
  '/images/dancibeijingtu-6.jpg',
];

// ===================== 样式 (部分样式将在组件内联处理以支持动态设置) =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2500px' }, // 增加 perspective
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
  cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 1s cubic-bezier(0.6, -0.28, 0.74, 1.55)' }, // 优化翻页动画
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
  glassOverlay: { position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px) brightness(1.1)', WebkitBackdropFilter: 'blur(8px) brightness(1.1)', zIndex: 0 },
  backFace: { transform: 'rotateY(180deg)', background: '#f0f2f5', justifyContent: 'center' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab', padding: '10px', zIndex: 1 },
  header: { textAlign: 'center' },
  // 字体大小、颜色、描边等将通过 props 动态设置
  pinyin: { marginBottom: 6 },
  hanzi: { fontWeight: 800, lineHeight: 1.1 },
  footer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', margin: '0 -28px -28px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  iconButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px' },
  settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)' },
  settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto' },
  closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
  listeningText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.2rem', marginTop: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' },
  pronunciationChecker: { width: 'calc(100% - 20px)', padding: '20px', marginTop: '16px', borderTop: '4px solid #3b82f6', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', color: '#1a202c', zIndex: 2 },
  // 设置面板内部样式
  settingGroup: { marginBottom: '20px' },
  settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
  settingControl: { display: 'flex', gap: '10px', alignItems: 'center' },
  settingInput: { flex: 1, padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
};

// ===================== 辅助函数 (拼音解析等) - 无改动 =====================
const INITIALS = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s','y','w'];
function splitSyllable(pinyinWithToneNumeric) { if (!pinyinWithToneNumeric) return { initial: '', final: '', tone: null, raw: '' }; const raw = pinyinWithToneNumeric.trim(); const toneMatch = raw.match(/([1-5])$/); const tone = toneMatch ? Number(toneMatch[1]) : null; const base = toneMatch ? raw.slice(0, -1) : raw; let initial = ''; for (const init of INITIALS.sort((a,b)=>b.length - a.length)) { if (base.startsWith(init)) { initial = init; break; } } const final = initial ? base.slice(initial.length) : base; return { initial, final, tone, raw }; }
function toPinyinNumberArray(chineseText) { if (!chineseText || typeof chineseText !== 'string') return []; try { const pinyinStr = pinyinConverter(chineseText, { toneType: 'num', heteronym: false, separator: ' ' }); return pinyinStr.split(/\s+/).filter(Boolean); } catch (err) { console.error('toPinyinNumberArray error', err); return []; } }
function analyzePronunciation(correctWord, userText) { try { if (!correctWord) return null; const correctPys = toPinyinNumberArray(correctWord); const userPys = toPinyinNumberArray(userText); if (userPys.length === 0 && userText && userText.length > 0) { return { error: '无法解析您的发音为可比拼音，请尝试更清晰朗读或检查识别结果', userRaw: userText }; } const length = Math.max(correctPys.length, userPys.length); let overallCorrect = true; const details = []; for (let i = 0; i < length; i++) { const correctPy = correctPys[i] || ''; const userPy = userPys[i] || ''; const c = splitSyllable(correctPy); const u = splitSyllable(userPy); const initialCorrect = c.initial === u.initial; const finalCorrect = c.final === u.final; const toneCorrect = (c.tone === u.tone); if (!(initialCorrect && finalCorrect && toneCorrect)) overallCorrect = false; details.push({ correct: { raw: c.raw, initial: c.initial, final: c.final, tone: c.tone }, user: { raw: u.raw, initial: u.initial, final: u.final, tone: u.tone }, flags: { initialCorrect, finalCorrect, toneCorrect } }); } return { details, overallCorrect, correctRaw: correctPys.join(' '), userRaw: userPys.join(' ') }; } catch (err) { console.error('analyzePronunciation error', err); return { error: '发音分析时发生错误' }; } }


// ===================== 自定义 Hook: 管理设置并同步到 localStorage =====================
const useCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('ciDianKaSettings');
      return savedSettings ? JSON.parse(savedSettings) : {
        order: 'sequential', // 'sequential' or 'random'
        autoPlayFront: true,
        autoPlayBack: true,
        frontFontSize: '6rem',
        frontColor: '#ffffff',
        frontShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 5px 5px 10px rgba(0,0,0,0.5)',
        backFontSize: '1.2rem',
        backColor: '#2d3748',
        backShadow: 'none',
      };
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
      // 返回默认值
      return { order: 'sequential', autoPlayFront: true, autoPlayBack: true, frontFontSize: '6rem', frontColor: '#ffffff', frontShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 5px 5px 10px rgba(0,0,0,0.5)', backFontSize: '1.2rem', backColor: '#2d3748', backShadow: 'none' };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ciDianKaSettings', JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  }, [settings]);

  return [settings, setSettings];
};


// ===================== 发音分析组件 (V2) =====================
const DetailedPronunciationChecker = ({ correctWord, userText, onCorrect }) => {
  const result = useMemo(() => analyzePronunciation(correctWord, userText), [correctWord, userText]);

  useEffect(() => {
    if (!result || result.error) return;
    
    if (result.overallCorrect) {
      sounds.correct.play();
      // 发音正确，延迟后触发回调
      const timer = setTimeout(() => {
        onCorrect();
      }, 800);
      return () => clearTimeout(timer);
    } else {
      sounds.incorrect.play();
    }
  }, [result, onCorrect]);

  if (!result) return null;

  return (
    <div style={styles.pronunciationChecker} onClick={(e)=>e.stopPropagation()} data-no-flip="true">
       {/* ... 组件内容无改动 ... */}
       <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#1a202c' }}>发音分析</h3>
      {result.error ? (
        <p style={{ marginTop: 8, color: '#dc2626' }}>{result.error}</p>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={{ fontWeight: 600, width: 90, color: '#4a5568', display: 'inline-block' }}>标准发音:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', color: '#16a34a', wordBreak: 'break-all' }}>{result.correctRaw}</span>
          </div>
          <div>
            <span style={{ fontWeight: 600, width: 90, color: '#4a5568', display: 'inline-block' }}>你的发音:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', wordBreak: 'break-all' }}>
              {result.details.map((d, idx) => {
                const initialColor = d.flags.initialCorrect ? '#1a202c' : '#dc2626'; const finalColor = d.flags.finalCorrect ? '#1a202c' : '#dc2626'; const toneColor = d.flags.toneCorrect ? '#1a202c' : '#dc2626';
                return (<span key={idx} style={{ display: 'inline-block', marginRight: 10 }}><span style={{ color: initialColor }}>{d.user.initial}</span><span style={{ color: finalColor }}>{d.user.final}</span><sup style={{ marginLeft: 4, color: toneColor }}>{d.user.tone ?? ''}</sup></span>);
              })}
            </span>
          </div>
          {!result.overallCorrect && (<p style={{ paddingTop: 8, color: '#ca8a04', borderTop: '1px solid #e2e8f0', marginTop: 8 }}>提示：红色为不匹配项（声母/韵母/声调），请对比标准发音并重试。</p>)}
        </div>
      )}
    </div>
  );
};


// ===================== 带拼音的文本组件 (V2) =====================
const TextWithPinyin = ({ text, style }) => {
  const pinyinResult = useMemo(() => {
    try {
      if (typeof text !== 'string' || !text) return text ? [{ surface: text, pinyin: null }] : [];
      const resultFromLib = pinyinConverter(text, { toneType: 'mark', segment: true, group: true });
      if (!Array.isArray(resultFromLib)) { const whole = pinyinConverter(text, { toneType: 'mark', separator: ' ' }); return [{ surface: text, pinyin: whole }]; }
      return resultFromLib.map(segment => (segment.type === 'other') ? { surface: segment.surface, pinyin: null } : { surface: segment.surface, pinyin: segment.pinyin.join(' ') });
    } catch (error) { console.error("TextWithPinyin Error:", error, { text }); return [{ surface: text, pinyin: null }]; }
  }, [text]);

  return (
    <span style={{ lineHeight: 2.2, ...style }}>
      {pinyinResult.map((item, index) => (item.pinyin ? (
        <ruby key={index} style={{ margin: '0 2px' }}>
          <rt style={{ fontSize: '0.8em', userSelect: 'none' }}>{item.pinyin}</rt>
          {item.surface}
        </ruby>
      ) : (
        <span key={index}>{item.surface}</span>
      )))}
    </span>
  );
};

// ===================== 设置面板组件 =====================
const SettingsPanel = ({ settings, setSettings, onBgUpload, onClose }) => {
  const fileInputRef = useRef(null);
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onBgUpload(files);
      onClose(); // 上传后自动关闭
    }
  };
  
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({...prev, [key]: value}));
  };

  return (
    <div style={styles.settingsModal} onClick={onClose}>
      <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
        <h2 style={{marginTop: 0}}>设置</h2>

        {/* 学习顺序 */}
        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>学习顺序</label>
          <div style={styles.settingControl}>
            <button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.button, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button>
            <button onClick={() => handleSettingChange('order', 'random')} style={{...styles.button, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button>
          </div>
        </div>

        {/* 自动朗读 */}
        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>自动朗读</label>
          <div style={styles.settingControl}>
             <label><input type="checkbox" checked={settings.autoPlayFront} onChange={(e) => handleSettingChange('autoPlayFront', e.target.checked)} /> 正面</label>
             <label><input type="checkbox" checked={settings.autoPlayBack} onChange={(e) => handleSettingChange('autoPlayBack', e.target.checked)} /> 背面</label>
          </div>
        </div>

        {/* 背景图片 */}
        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>卡片背景</label>
          <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
          <button style={{...styles.button, width: '100%', justifyContent: 'center'}} onClick={() => fileInputRef.current?.click()}><FaUpload /> 从本地上传图片</button>
        </div>

        {/* 正面样式 */}
        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>正面样式</label>
          <div style={{...styles.settingControl, flexDirection: 'column', alignItems: 'stretch'}}>
             <input type="text" value={settings.frontFontSize} onChange={e => handleSettingChange('frontFontSize', e.target.value)} placeholder="字体大小 (e.g., 6rem)" style={styles.settingInput} />
             <input type="text" value={settings.frontColor} onChange={e => handleSettingChange('frontColor', e.target.value)} placeholder="颜色 (e.g., #ffffff)" style={styles.settingInput} />
             <input type="text" value={settings.frontShadow} onChange={e => handleSettingChange('frontShadow', e.target.value)} placeholder="文字描边/阴影" style={styles.settingInput} />
          </div>
        </div>

        {/* 背面样式 */}
        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>背面样式</label>
          <div style={{...styles.settingControl, flexDirection: 'column', alignItems: 'stretch'}}>
             <input type="text" value={settings.backFontSize} onChange={e => handleSettingChange('backFontSize', e.target.value)} placeholder="字体大小 (e.g., 1.2rem)" style={styles.settingInput} />
             <input type="text" value={settings.backColor} onChange={e => handleSettingChange('backColor', e.target.value)} placeholder="颜色 (e.g., #2d3748)" style={styles.settingInput} />
             <input type="text" value={settings.backShadow} onChange={e => handleSettingChange('backShadow', e.target.value)} placeholder="文字描边/阴影" style={styles.settingInput} />
          </div>
        </div>

      </div>
    </div>
  );
};


// ===================== 主组件 CiDianKa (V27) =====================
const CiDianKa = ({ flashcards = [] }) => {
  const [settings, setSettings] = useCardSettings();

  const processedCards = useMemo(() => {
    try {
      if (!Array.isArray(flashcards)) return [];
      const validCards = flashcards
        .filter(card => card && typeof card === 'object' && typeof card.word === 'string' && card.word)
        .map(card => ({ ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' }) }));
      
      if (settings.order === 'random') {
        // Fisher-Yates shuffle algorithm
        for (let i = validCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [validCards[i], validCards[j]] = [validCards[j], validCards[i]];
        }
      }
      return validCards;
    } catch (error) {
      console.error("CRITICAL ERROR processing 'flashcards':", error, flashcards);
      return [];
    }
  }, [flashcards, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "数据加载中或为空...", example: "请检查数据源或稍后再试。" }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [adKey, setAdKey] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backgroundImages, setBackgroundImages] = useState(predefinedBackgrounds);
  const [currentBg, setCurrentBg] = useState(() => predefinedBackgrounds[Math.floor(Math.random() * predefinedBackgrounds.length)]);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const recognitionRef = useRef(null);
  const [swipeDirection, setSwipeDirection] = useState(1);

  const navigate = useCallback((direction) => {
    setSwipeDirection(direction);
    setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);

  const transitions = useTransition(currentIndex, {
    from: { opacity: 0, transform: `translateX(${swipeDirection * 60}%) scale(0.8) rotateY(${-swipeDirection * 45}deg)` },
    enter: { opacity: 1, transform: `translateX(0%) scale(1) rotateY(0deg)` },
    leave: { opacity: 0, transform: `translateX(${-swipeDirection * 60}%) scale(0.8) rotateY(${swipeDirection * 45}deg)` },
    config: { mass: 1, tension: 210, friction: 20 },
    onStart: () => { if (currentIndex !== 0 || swipeDirection !== 1) { sounds.switch.play(); } },
    onRest: () => { setIsFlipped(false); setRecognizedText(''); },
  });

  const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
    if (tap) {
      if (event?.target?.closest('[data-no-flip="true"]')) return;
      if (recognizedText) return; // 发音分析结果显示时，不翻转
      setIsFlipped(prev => !prev);
      return;
    }

    // 切换灵敏度调整
    const trigger = vx > 0.4 && Math.abs(mx) > 60;
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

  // 正面自动朗读
  useEffect(() => {
    const currentCard = cards[currentIndex];
    if (settings.autoPlayFront && currentCard && !isFlipped) {
      const timer = setTimeout(() => playTTS(currentCard.word), 600);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isFlipped, cards, settings.autoPlayFront]);

  // 背面自动朗读 (释义 + 例句)
  useEffect(() => {
    if (settings.autoPlayBack && isFlipped) {
      const currentCard = cards[currentIndex];
      if (currentCard) {
        // 先读释义，读完后回调再读例句
        const playExample = () => {
          if (currentCard.example) {
            playTTS(currentCard.example);
          }
        };
        const timer = setTimeout(() => playTTS(currentCard.meaning, playExample), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [isFlipped, currentIndex, cards, settings.autoPlayBack]);

  // 切换背景
  useEffect(() => {
    setAdKey(k => k + 1);
    if (backgroundImages.length > 0) {
      setCurrentBg(backgroundImages[Math.floor(Math.random() * backgroundImages.length)]);
    }
  }, [currentIndex, backgroundImages]);

  // 语音识别
  useEffect(() => {
    return () => { if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e){}; recognitionRef.current = null; } };
  }, []);

  const handleListen = (e) => {
    e.stopPropagation();
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.onstart = () => { setIsListening(true); setRecognizedText(''); };
    recognition.onresult = (event) => { setRecognizedText(event.results[0][0].transcript.trim().replace(/[.,。，]/g, '')); };
    recognition.onerror = (event) => { setRecognizedText(`[错误: ${event.error}]`); };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const handleImageUpload = (files) => {
    const imageUrls = files.map(file => URL.createObjectURL(file));
    setBackgroundImages(prev => [...prev, ...imageUrls]);
    setCurrentBg(imageUrls[0]); // 立即使用新上传的图片
  };

  const handleCorrectPronunciation = useCallback(() => {
    setTimeout(() => navigate(1), 300); // 延迟一小会再切换
  }, [navigate]);

  const getBgStyle = (bgValue) => ({ backgroundImage: `url(${bgValue})` });

  // 动态样式
  const pinyinStyle = { ...styles.pinyin, fontSize: settings.frontFontSize.replace(/\d+/g, n => n/4), color: settings.frontColor, textShadow: settings.frontShadow };
  const hanziStyle = { ...styles.hanzi, fontSize: settings.frontFontSize, color: settings.frontColor, textShadow: settings.frontShadow };
  const backTextStyle = { fontSize: settings.backFontSize, color: settings.backColor, textShadow: settings.backShadow };

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
      {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onBgUpload={handleImageUpload} onClose={() => setIsSettingsOpen(false)} />}
      
      <div style={styles.container}>
        {transitions((style, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          const backgroundStyle = getBgStyle(currentBg);
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...style, zIndex: cards.length - i }}>
              <div style={styles.cardContainer}>
                <div style={{ width: '100%', height: '100%', flex: 1 }} {...bind()} onClickCapture={e => recognizedText && setRecognizedText('')}>
                  <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                    {/* 正面 */}
                    <div style={{ ...styles.face, ...backgroundStyle }}>
                      <div style={styles.glassOverlay}></div>
                      <div style={styles.mainContent}>
                        <div style={styles.header}>
                          <div style={pinyinStyle}>{cardData.pinyin}</div>
                          <div style={hanziStyle}>{cardData.word}</div>
                        </div>
                        {isListening && <div style={styles.listeningText}>正在听...</div>}
                        {recognizedText && <DetailedPronunciationChecker correctWord={cardData.word} userText={recognizedText} onCorrect={handleCorrectPronunciation} />}
                      </div>
                    </div>

                    {/* 背面 */}
                    <div style={{ ...styles.face, ...styles.backFace }}>
                      <div style={styles.mainContent}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div style={{ flex: 1, paddingRight: 10 }}>
                              <TextWithPinyin text={cardData.meaning} style={backTextStyle} />
                            </div>
                            <FaVolumeUp data-no-flip="true" style={{ cursor: 'pointer', color: '#667eea', flexShrink: 0 }} size={24} onClick={(e) => playTTS(cardData.meaning, null, e)} title="朗读释义" />
                          </div>

                          {cardData.example && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', borderTop: '1px solid #ddd', paddingTop: 20 }}>
                              <div style={{ flex: 1, paddingRight: 10 }}>
                                <TextWithPinyin text={cardData.example} style={backTextStyle} />
                              </div>
                              <FaVolumeUp data-no-flip="true" style={{ cursor: 'pointer', color: '#667eea', flexShrink: 0 }} size={24} onClick={(e) => playTTS(cardData.example, null, e)} title="朗读例句" />
                            </div>
                          )}
                        </div>
                        <AdComponent key={adKey + '_back'} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 底部控制 */}
                <div style={styles.footer} data-no-flip="true">
                  <button style={styles.iconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={20} /></button>
                  <button style={{ ...styles.button, background: isListening ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,0,0.1)' }} onClick={handleListen}><FaMicrophone /> {isListening ? '停止' : '发音练习'}</button>
                  <button style={styles.iconButton} onClick={() => setWriterChar(cardData.word)} title="笔顺"><FaPenFancy size={20} /></button>
                  <button style={styles.iconButton} onClick={(e) => playTTS(cardData.word, null, e)} title="朗读"><FaVolumeUp size={20} /></button>
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
