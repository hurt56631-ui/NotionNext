// components/Tixing/CiDianKa.js (V33 - Immersive Fullscreen & Click-to-Reveal)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated, AnimatePresence } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaRandom, FaSortAmountDown } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';

// ===================== 音效资源 (复用 Howl 实例) =====================
const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.6 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;
const playTTS = (text, onEndCallback, e) => {
  if (e && e.stopPropagation) e.stopPropagation();
  if (!text) { if (onEndCallback) onEndCallback(); return; }
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (err) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true, onend: onEndCallback });
  _howlInstance.play();
};

// ===================== 预设背景图 =====================
const predefinedBackgrounds = ['/images/dancibeijingtu-1.jpg', '/images/dancibeijingtu-2.jpg', '/images/dancibeijingtu-3.jpg', '/images/dancibeijingtu-4.jpg', '/images/dancibeijingtu-5.jpg', '/images/dancibeijingtu-6.jpg', '/images/dancibeijingtu-7.jpg', '/images/dancibeijingtu-8.jpg', '/images/dancibeijingtu-9.jpg'];

// ===================== 样式 (重构为单面布局) =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
  face: { position: 'absolute', inset: 0, color: '#1a202c', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
  glassOverlay: { position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(8px) brightness(1.1)', WebkitBackdropFilter: 'blur(8px) brightness(1.1)', zIndex: 0 },
  mainContent: { flex: 1, display: 'flex', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', padding: '20px 10px', zIndex: 1, width: '100%', alignItems: 'center' },
  header: { textAlign: 'center', marginBottom: '20px' },
  pinyin: { marginBottom: 6 },
  hanzi: { fontWeight: 800, lineHeight: 1.1 },
  detailsContainer: { background: 'rgba(0,0,0,0.35)', color: '#fff', padding: '20px', borderRadius: '15px', marginTop: '25px', width: 'calc(100% - 40px)', maxWidth: '600px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)' },
  meaningSection: { paddingBottom: '15px' },
  exampleSection: { borderTop: '1px solid rgba(255, 255, 255, 0.3)', paddingTop: '15px' },
  settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)' },
  settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto' },
  closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
  listeningText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.2rem', marginTop: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' },
  pronunciationChecker: { width: 'calc(100% - 48px)', padding: '20px', margin: '16px auto', borderTop: '4px solid #3b82f6', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', color: '#1a202c', zIndex: 2 },
  settingGroup: { marginBottom: '20px' },
  settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
  settingControl: { display: 'flex', gap: '10px', alignItems: 'center' },
  settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
  rightControls: { position: 'absolute', bottom: '12%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '25px', alignItems: 'center' },
  rightIconButton: { background: 'rgba(0, 0, 0, 0.3)', color: 'white', border: 'none', padding: '15px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }
};

// ===================== 辅助函数 (拼音解析等) - 无改动 =====================
const INITIALS = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s','y','w'];
function splitSyllable(pinyinWithToneNumeric) { if (!pinyinWithToneNumeric) return { initial: '', final: '', tone: null, raw: '' }; const raw = pinyinWithToneNumeric.trim(); const toneMatch = raw.match(/([1-5])$/); const tone = toneMatch ? Number(toneMatch[1]) : null; const base = toneMatch ? raw.slice(0, -1) : raw; let initial = ''; for (const init of INITIALS.sort((a,b)=>b.length - a.length)) { if (base.startsWith(init)) { initial = init; break; } } const final = initial ? base.slice(initial.length) : base; return { initial, final, tone, raw }; }
function toPinyinNumberArray(chineseText) { if (!chineseText || typeof chineseText !== 'string') return []; try { const pinyinStr = pinyinConverter(chineseText, { toneType: 'num', heteronym: false, separator: ' ' }); return pinyinStr.split(/\s+/).filter(Boolean); } catch (err) { console.error('toPinyinNumberArray error', err); return []; } }
function analyzePronunciation(correctWord, userText) { try { if (!correctWord) return null; const correctPys = toPinyinNumberArray(correctWord); const userPys = toPinyinNumberArray(userText); if (userPys.length === 0 && userText && userText.length > 0) { return { error: '无法解析您的发音为可比拼音', userRaw: userText }; } const length = Math.max(correctPys.length, userPys.length); let overallCorrect = true; const details = []; for (let i = 0; i < length; i++) { const correctPy = correctPys[i] || ''; const userPy = userPys[i] || ''; const c = splitSyllable(correctPy); const u = splitSyllable(userPy); const initialCorrect = c.initial === u.initial; const finalCorrect = c.final === u.final; const toneCorrect = (c.tone === u.tone); if (!(initialCorrect && finalCorrect && toneCorrect)) overallCorrect = false; details.push({ correct: { raw: c.raw, initial: c.initial, final: c.final, tone: c.tone }, user: { raw: u.raw, initial: u.initial, final: u.final, tone: u.tone }, flags: { initialCorrect, finalCorrect, toneCorrect } }); } return { details, overallCorrect, correctRaw: correctPys.join(' '), userRaw: userPys.join(' ') }; } catch (err) { console.error('analyzePronunciation error', err); return { error: '发音分析时发生错误' }; } }

// ===================== 自定义 Hook: 管理设置 (恢复背面朗读选项) =====================
const useCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('ciDianKaSettings');
      const defaultSettings = { order: 'sequential', autoPlayFront: true, autoPlayOnReveal: true, autoSwitchNext: true, frontFontSize: '6rem', frontColor: '#ffffff', frontShadow: '1px 1px 3px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.7)', backFontSize: '1.2rem', backColor: '#2d3748', backShadow: 'none' };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) { console.error("Failed to load settings", error); return { order: 'sequential', autoPlayFront: true, autoPlayOnReveal: true, autoSwitchNext: true, frontFontSize: '6rem', frontColor: '#ffffff', frontShadow: '1px 1px 3px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.7)', backFontSize: '1.2rem', backColor: '#2d3748', backShadow: 'none' }; }
  });
  useEffect(() => { try { localStorage.setItem('ciDianKaSettings', JSON.stringify(settings)); } catch (error) { console.error("Failed to save settings", error); } }, [settings]);
  return [settings, setSettings];
};

// ===================== 发音分析组件 (BUG 修复) =====================
const DetailedPronunciationChecker = ({ correctWord, userText, onCorrect }) => {
  const result = useMemo(() => analyzePronunciation(correctWord, userText), [correctWord, userText]);
  const hasBeenHandled = useRef(false);

  useEffect(() => {
    if (!result || result.error || !userText || hasBeenHandled.current) return;
    if (result.overallCorrect) {
      hasBeenHandled.current = true;
      sounds.correct.play();
      const timer = setTimeout(() => { onCorrect(); }, 1200);
      return () => clearTimeout(timer);
    } else {
      sounds.incorrect.play();
    }
  }, [result, onCorrect, userText]);
  if (!result) return null;
  return (<div style={styles.pronunciationChecker} data-no-gesture="true"><h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#1a202c', marginTop: 0 }}>发音分析</h3>{result.error?(<p style={{ marginTop: 8, color: '#dc2626' }}>{result.error}</p>):(<div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}><div><span style={{ fontWeight: 600, width: 90, color: '#4a5568', display: 'inline-block' }}>标准发音:</span><span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', color: '#16a34a', wordBreak: 'break-all' }}>{result.correctRaw}</span></div><div><span style={{ fontWeight: 600, width: 90, color: '#4a5568', display: 'inline-block' }}>你的发音:</span><span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', wordBreak: 'break-all' }}>{result.details.map((d, idx) => { const iColor = d.flags.initialCorrect ? '#1a202c' : '#dc2626'; const fColor = d.flags.finalCorrect ? '#1a202c' : '#dc2626'; const tColor = d.flags.toneCorrect ? '#1a202c' : '#dc2626'; return (<span key={idx} style={{ display: 'inline-block', marginRight: 10 }}><span style={{ color: iColor }}>{d.user.initial}</span><span style={{ color: fColor }}>{d.user.final}</span><sup style={{ marginLeft: 4, color: tColor }}>{d.user.tone ?? ''}</sup></span>); })}</span></div>{!result.overallCorrect && (<p style={{ paddingTop: 8, color: '#ca8a04', borderTop: '1px solid #e2e8f0', marginTop: 8 }}>提示：红色为不匹配项，请重试。</p>)}</div>)}</div>);
};

// ===================== 带拼音的文本组件 - 无改动 =====================
const TextWithPinyin = ({ text, style }) => {
  const pinyinResult = useMemo(() => {
    try { if (typeof text !== 'string' || !text) return text ? [{ surface: text, pinyin: null }] : []; const resultFromLib = pinyinConverter(text, { toneType: 'mark', segment: true, group: true }); if (!Array.isArray(resultFromLib)) { const whole = pinyinConverter(text, { toneType: 'mark', separator: ' ' }); return [{ surface: text, pinyin: whole }]; } return resultFromLib.map(segment => (segment.type === 'other') ? { surface: segment.surface, pinyin: null } : { surface: segment.surface, pinyin: segment.pinyin.join(' ') }); } catch (error) { console.error("TextWithPinyin Error:", error, { text }); return [{ surface: text, pinyin: null }]; }
  }, [text]);
  return (<span style={{ lineHeight: 2.2, ...style }}>{pinyinResult.map((item, index) => (item.pinyin ? (<ruby key={index} style={{ margin: '0 2px' }}><rt style={{ fontSize: '0.8em', userSelect: 'none' }}>{item.pinyin}</rt>{item.surface}</ruby>) : (<span key={index}>{item.surface}</span>)))}</span>);
};

// ===================== 智能文本渲染器 - 无改动 =====================
const SmartTextRenderer = ({ text, style }) => {
  if (typeof text !== 'string' || !text) return null;
  const containsChinese = /[\u4e00-\u9fa5]/.test(text);
  if (containsChinese) { return <TextWithPinyin text={text} style={style} />; }
  return <span style={{...style, lineHeight: 1.6 }}>{text}</span>;
};

// ===================== 笔顺显示组件 (占位符) =====================
const StrokeOrderDisplay = ({ word, isVisible }) => {
    const containerRef = useRef(null);
    useEffect(() => {
        if (isVisible && word && word.length === 1 && containerRef.current) {
            // Placeholder for HanziWriter logic
        }
    }, [word, isVisible]);
    if (!isVisible || !word || word.length > 1) return null;
    return (<div style={{ width: '150px', height: '150px', marginTop: '20px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '10px' }} ref={containerRef} data-no-gesture="true"><svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1024 1024" style={{border: '1px solid rgba(255,255,255,0.3)'}}><line x1="0" y1="0" x2="1024" y2="1024" stroke="#DDD" strokeDasharray="5,5" /><line x1="1024" y1="0" x2="0" y2="1024" stroke="#DDD" strokeDasharray="5,5" /><line x1="512" y1="0" x2="512" y2="1024" stroke="#DDD" strokeDasharray="5,5" /><line x1="0" y1="512" x2="1024" y2="512" stroke="#DDD" strokeDasharray="5,5" /><text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="400">{word}</text></svg></div>);
};

// ===================== 设置面板组件 (恢复背面选项) =====================
const SettingsPanel = ({ settings, setSettings, onClose }) => {
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动朗读</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayFront} onChange={(e) => handleSettingChange('autoPlayFront', e.target.checked)} /> 自动朗读单词</label><label><input type="checkbox" checked={settings.autoPlayOnReveal} onChange={(e) => handleSettingChange('autoPlayOnReveal', e.target.checked)} /> 点击时朗读释义</label></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动切换下一个单词</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoSwitchNext} onChange={(e) => handleSettingChange('autoSwitchNext', e.target.checked)} /> 5秒后自动切换</label></div></div></div></div>);
};

// ===================== 主组件 CiDianKa (V33) =====================
const CiDianKa = ({ flashcards = [] }) => {
  const [settings, setSettings] = useCardSettings();
  
  const processedCards = useMemo(() => {
    try { if (!Array.isArray(flashcards)) return []; const validCards = flashcards.filter(card => card && typeof card.word === 'string' && card.word).map(card => ({ ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' }) })); if (settings.order === 'random') { for (let i = validCards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [validCards[i], validCards[j]] = [validCards[j], validCards[i]]; } } return validCards; } catch (error) { console.error("CRITICAL ERROR processing 'flashcards':", error, flashcards); return []; }
  }, [flashcards, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "数据加载中或为空...", example: "请检查数据源或稍后再试。" }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentBg, setCurrentBg] = useState(() => predefinedBackgrounds[Math.floor(Math.random() * predefinedBackgrounds.length)]);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [showStrokeOrder, setShowStrokeOrder] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false); // ✅ 新增: 控制释义显示
  
  const recognitionRef = useRef(null);
  const autoSwitchTimerRef = useRef(null);
  
  const pauseAutoSwitch = useCallback(() => clearTimeout(autoSwitchTimerRef.current), []);
  
  const navigate = useCallback((direction) => {
    const newIndex = (currentIndex + direction + cards.length) % cards.length;
    if (newIndex !== currentIndex) { setCurrentIndex(newIndex); }
  }, [cards.length, currentIndex]);
  
  const resetAutoSwitchTimer = useCallback(() => {
    pauseAutoSwitch();
    if (settings.autoSwitchNext) {
      autoSwitchTimerRef.current = setTimeout(() => navigate(1), 5000);
    }
  }, [settings.autoSwitchNext, navigate, pauseAutoSwitch]);

  const transitions = useTransition(currentIndex, {
    from: (direction) => ({ opacity: 0, transform: `translateY(${direction > 0 ? '100%' : '-100%'}) scale(0.95)` }),
    enter: { opacity: 1, transform: 'translateY(0%) scale(1)' },
    leave: (direction) => ({ opacity: 0, transform: `translateY(${direction < 0 ? '100%' : '-100%'}) scale(0.95)`, position: 'absolute' }),
    config: { mass: 1, tension: 280, friction: 30 },
    onStart: () => { sounds.switch.play(); },
    onRest: () => { setRecognizedText(''); setShowStrokeOrder(false); setIsRevealed(false); },
  });

  const bind = useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], tap, event }) => {
    if (event.target.closest('[data-no-gesture]')) return;
    
    // ✅ 单击事件，用于显示/隐藏释义
    if (tap) {
      setIsRevealed(r => !r);
      return;
    }
    
    // ✅ 滑动事件，用于切换单词
    if (!down) {
      const isSignificantDrag = Math.abs(my) > 60 || (Math.abs(vy) > 0.4 && Math.abs(my) > 20);
      if (isSignificantDrag) {
        navigate(yDir < 0 ? 1 : -1);
      }
    }
  }, { axis: 'y', filterTaps: true, taps: true });

  // ✅ 自动朗读单词
  useEffect(() => {
    const currentCard = cards[currentIndex];
    if (settings.autoPlayFront && currentCard) {
      const ttsTimer = setTimeout(() => playTTS(currentCard.word), 600);
      return () => clearTimeout(ttsTimer);
    }
  }, [currentIndex, cards, settings.autoPlayFront]);

  // ✅ 点击显示释义时，朗读释义
  useEffect(() => {
    if (isRevealed && settings.autoPlayOnReveal) {
        const currentCard = cards[currentIndex];
        if (currentCard) {
            const playExample = () => {
                if (currentCard.example) { playTTS(currentCard.example); }
            };
            playTTS(currentCard.meaning, playExample);
        }
    }
  }, [isRevealed, currentIndex, cards, settings.autoPlayOnReveal]);


  useEffect(() => {
    resetAutoSwitchTimer();
    return pauseAutoSwitch;
  }, [currentIndex, resetAutoSwitchTimer, pauseAutoSwitch]);
  
  // ✅ 新增: 沉浸式全屏
  useEffect(() => {
    const elem = document.documentElement;
    const enterFullscreen = () => {
      if (elem.requestFullscreen) { elem.requestFullscreen().catch(err => console.error(err)); } 
      else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
    };
    const exitFullscreen = () => {
      if (document.exitFullscreen) { document.exitFullscreen(); } 
      else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
    };
    enterFullscreen();
    return () => exitFullscreen();
  }, []);

  useEffect(() => { setCurrentBg(predefinedBackgrounds[Math.floor(Math.random() * predefinedBackgrounds.length)]); }, [currentIndex]);
  useEffect(() => { return () => { if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e){}; recognitionRef.current = null; } }; }, []);

  const handleListen = (e) => {
    e.stopPropagation();
    pauseAutoSwitch();
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.onstart = () => { setIsListening(true); setRecognizedText(''); };
    recognition.onresult = (event) => { const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, ''); if (transcript) { setRecognizedText(transcript); }};
    recognition.onerror = (event) => { setRecognizedText(`[错误: ${event.error}]`); };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; if(!recognizedText) resetAutoSwitchTimer(); };
    recognition.start();
    recognitionRef.current = recognition;
  };
  
  const handleManualPlay = (text, e) => {
    e.stopPropagation();
    pauseAutoSwitch();
    playTTS(text, resetAutoSwitchTimer);
  };

  const handleToggleStrokeOrder = (e) => {
      e.stopPropagation();
      pauseAutoSwitch();
      setShowStrokeOrder(s => !s);
      if(showStrokeOrder) resetAutoSwitchTimer();
  }

  const handleCorrectPronunciation = useCallback(() => { setTimeout(() => navigate(1), 300); }, [navigate]);
  const getBgStyle = (bgValue) => ({ backgroundImage: `url(${bgValue})` });

  const pinyinStyle = { ...styles.pinyin, fontSize: settings.frontFontSize.replace(/\d+/g, n => n/4), color: settings.frontColor, textShadow: settings.frontShadow };
  const hanziStyle = { ...styles.hanzi, fontSize: settings.frontFontSize, color: settings.frontColor, textShadow: settings.frontShadow };
  const detailsTextStyle = { fontSize: '1.2rem', color: '#ffffff', textShadow: '1px 1px 2px rgba(0,0,0,0.7)', lineHeight: '1.8' };

  return (
    <div style={styles.fullScreen}>
      {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
      
      <div style={styles.gestureArea} {...bind()} />

      {transitions((style, i) => {
        const cardData = cards[i];
        if (!cardData) return null;
        const backgroundStyle = getBgStyle(currentBg);
        return (
          <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
            <div style={styles.cardContainer}>
                  <div style={{ ...styles.face, ...backgroundStyle }}>
                    <div style={styles.glassOverlay}></div>
                    <div style={styles.mainContent}>
                      <div style={styles.header}><div style={pinyinStyle}>{cardData.pinyin}</div><div style={hanziStyle}>{cardData.word}</div></div>
                      
                      {/* 释义和例句容器 */}
                      <AnimatePresence>
                        {isRevealed && (
                           <animated.div
                            style={styles.detailsContainer}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.4 }}
                           >
                                <div style={styles.meaningSection}>
                                    <SmartTextRenderer text={cardData.meaning} style={detailsTextStyle} />
                                </div>
                                {cardData.example && (
                                    <div style={styles.exampleSection}>
                                        <SmartTextRenderer text={cardData.example} style={{...detailsTextStyle, fontSize: '1.1rem'}} />
                                    </div>
                                )}
                           </animated.div>
                        )}
                      </AnimatePresence>

                      <StrokeOrderDisplay word={cardData.word} isVisible={showStrokeOrder} />
                      {isListening && <div style={styles.listeningText}>正在听...</div>}
                      {recognizedText && <DetailedPronunciationChecker correctWord={cardData.word} userText={recognizedText} onCorrect={handleCorrectPronunciation} />}
                    </div>
                  </div>
            </div>
          </animated.div>
        );
      })}

      {/* 右侧控制按钮 */}
      <div style={styles.rightControls} data-no-gesture="true">
        <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={24} /></button>
        <button style={{...styles.rightIconButton, background: isListening ? 'rgba(220, 38, 38, 0.7)' : 'rgba(0, 0, 0, 0.3)'}} onClick={handleListen} title="发音练习"><FaMicrophone size={24} /></button>
        <button style={styles.rightIconButton} onClick={handleToggleStrokeOrder} title="笔顺"><FaPenFancy size={24} /></button>
        <button style={styles.rightIconButton} onClick={(e) => handleManualPlay(cards[currentIndex]?.word, e)} title="朗读"><FaVolumeUp size={24} /></button>
      </div>
    </div>
  );
};

export default CiDianKa;
