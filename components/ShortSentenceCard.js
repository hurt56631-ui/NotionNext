// components/ShortSentenceCard.js (视觉和UI优化最终版)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal'; // 确保您项目中存在此汉字笔顺组件

// =================================================================================
// ===== 辅助工具 & 常量 ===========================================================
// =================================================================================

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];
const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;

const playTTS = (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; }
    if (_howlInstance?.playing()) _howlInstance.stop();
    const rateValue = Math.round(rate / 2);
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;
    _howlInstance = new Howl({ src: [ttsUrl], html5: true, onend: onEndCallback });
    _howlInstance.play();
};
const playSoundEffect = (type) => {
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (sounds[type]) sounds[type].play();
};
const parsePinyin = (pinyinNum) => {
    if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' };
    const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, '');
    let pinyinPlain = rawPinyin.replace(/[1-5]$/, '');
    const toneMatch = rawPinyin.match(/[1-5]$/);
    const tone = toneMatch ? toneMatch[0] : '0';
    const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' });
    const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
    let initial = '';
    let final = pinyinPlain;
    for (const init of initials) {
        if (pinyinPlain.startsWith(init)) {
            initial = init;
            final = pinyinPlain.slice(init.length);
            break;
        }
    }
    return { initial, final, tone, pinyinMark, rawPinyin };
};


// =================================================================================
// ===== 自定义 Hook & 子组件 ======================================================
// =================================================================================

// --- 设置管理的 Hook ---
const useCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('learningCardSettings');
      const defaultSettings = {
        order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, autoBrowseDelay: 6000,
        voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0,
      };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) {
        console.error("加载设置失败", error);
        return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0 };
    }
  });
  useEffect(() => { try { localStorage.setItem('learningCardSettings', JSON.stringify(settings)); } catch (error) { console.error("保存设置失败", error); } }, [settings]);
  return [settings, setSettings];
};

// --- 拼音可视化组件 ---
const PinyinVisualizer = React.memo(({ analysis }) => {
    const { parts, errors } = analysis;
    const initialStyle = parts.initial && errors.initial ? styles.wrongPart : styles.correctPart;
    const finalStyle = parts.final && errors.final ? styles.wrongPart : styles.correctPart;
    const toneStyle = parts.tone !== '0' && errors.tone ? styles.wrongPart : styles.correctPart;
    let finalDisplay = parts.pinyinMark.replace(parts.initial, '').replace(' ', '');
    if (!finalDisplay || parts.pinyinMark === parts.rawPinyin) { finalDisplay = parts.final; }
    finalDisplay = finalDisplay.replace(/[1-5]$/, '');
    return (
        <div style={styles.pinyinVisualizerContainer}>
            <span style={{...styles.pinyinPart, ...initialStyle}}>{parts.initial || '' }</span>
            <span style={{...styles.pinyinPart, ...finalStyle}}>{finalDisplay}</span>
            <span style={{...styles.pinyinPart, ...styles.toneNumber, ...toneStyle}}>{parts.tone}</span>
        </div>
    );
});

// --- 发音对比面板 ---
const PronunciationComparison = ({ correctWord, userText, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });
        if (correctPinyin.length === 0 || userPinyin.length === 0) {
            return { isCorrect: false, error: 'NO_PINYIN', message: '无法识别有效发音' };
        }
        if (correctPinyin.length !== userPinyin.length) {
            return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
        }
        const results = correctPinyin.map((correctPy, index) => {
            const userPy = userPinyin[index];
            const correctParts = parsePinyin(correctPy);
            const userParts = parsePinyin(userPy);
            const errors = {
                initial: (correctParts.initial || userParts.initial) && (correctParts.initial !== userParts.initial),
                final: correctParts.final !== userParts.final,
                tone: correctParts.tone !== userParts.tone,
            };
            const pinyinMatch = !errors.initial && !errors.final && !errors.tone;
            return { char: correctWord[index], pinyinMatch, correct: { parts: correctParts, errors: {} }, user: { parts: userParts, errors: errors } };
        });
        const isCorrect = results.every(r => r.pinyinMatch);
        const accuracy = (results.filter(r => r.pinyinMatch).length / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText]);

    useEffect(() => { if (analysis) playSoundEffect(analysis.isCorrect ? 'correct' : 'incorrect'); }, [analysis]);

    if (!analysis) return null;

    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '发音完美！' : `准确率: ${analysis.accuracy}%`}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>{analysis.isCorrect ? '太棒了！' : '再接再厉！'}</div>
                </div>
                <div style={styles.errorDetailsContainer}>
                    {analysis.error ? (
                        <div style={styles.lengthError}><h3>{analysis.message}</h3></div>
                    ) : (
                        <div style={styles.comparisonGrid}>
                            {analysis.results.map((result, index) => (
                                <div key={index} style={styles.comparisonCell}>
                                    <div style={styles.comparisonChar}>{result.char}</div>
                                    <div style={styles.comparisonPinyinSide}><PinyinVisualizer analysis={result.correct} /><span style={styles.pinyinLabel}>标准</span></div>
                                    <div style={{...styles.comparisonPinyinSide, opacity: result.pinyinMatch ? 0.6 : 1}}><PinyinVisualizer analysis={result.user} /><span style={styles.pinyinLabel}>你的发音</span></div>
                                    {!result.pinyinMatch && (<div style={styles.errorHint}>{result.user.errors.initial && <span style={styles.hintTag}>声母错</span>}{result.user.errors.final && <span style={styles.hintTag}>韵母错</span>}{result.user.errors.tone && <span style={styles.hintTag}>声调错</span>}</div>)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={styles.comparisonActions}>
                    {analysis.isCorrect ? (<button style={{...styles.actionButton, ...styles.continueButton}} onClick={onContinue}>继续下一个 <FaArrowRight /></button>) : (<button style={{...styles.actionButton, ...styles.retryButton}} onClick={onClose}>再试一次</button>)}
                </div>
            </div>
        </div>
    );
};

// --- 设置面板 ---
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>);
});


// =================================================================================
// ===== 主组件: ShortSentenceCard =================================================
// =================================================================================
const ShortSentenceCard = ({ sentences = [], isOpen, onClose }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();

  const processedCards = useMemo(() => {
    try {
        const mapped = sentences.map(s => ({
            id: s.id,
            chinese: s.sentence,
            burmese: s.translation,
            pinyin: s.pinyin,
            imageUrl: s.imageUrl,
        }));
        if (settings.order === 'random') {
            for (let i = mapped.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
            }
        }
        return mapped;
    } catch (error) { console.error("处理卡片数据出错:", error, sentences); return []; }
  }, [sentences, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "暂无卡片", pinyin: "zàn wú kǎ piàn", burmese: "..." }];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [writerChar, setWriterChar] = useState(null);

  const recognitionRef = useRef(null);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const currentCard = cards[currentIndex];

  const navigate = useCallback((direction) => {
      lastDirection.current = direction;
      setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);

  useEffect(() => {
    if (!isOpen) return;
    clearTimeout(autoBrowseTimerRef.current);
    const playSequence = () => {
        if (settings.autoPlayChinese && currentCard?.chinese) {
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => {
                if (settings.autoPlayBurmese && currentCard?.burmese) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer);
                } else {
                    startAutoBrowseTimer();
                }
            });
        } else if (settings.autoPlayBurmese && currentCard?.burmese) {
            playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer);
        } else {
            startAutoBrowseTimer();
        }
    };
    const startAutoBrowseTimer = () => {
        if (settings.autoBrowse) {
            autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay);
        }
    };
    const initialPlayTimer = setTimeout(playSequence, 600);
    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate]);
  
  const handleListen = useCallback((e) => {
      e.stopPropagation();
      if (_howlInstance?.playing()) _howlInstance.stop();
      if (isListening) { recognitionRef.current?.stop(); return; }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; }
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      recognition.onstart = () => { setIsListening(true); setRecognizedText(''); };
      recognition.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，]/g, '');
          if (transcript) setRecognizedText(transcript);
      };
      recognition.onerror = (event) => { alert(`语音识别出错: ${event.error}`); setRecognizedText(''); };
      recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
      recognition.start();
      recognitionRef.current = recognition;
  }, [isListening]);

  const handleCloseComparison = useCallback(() => setRecognizedText(''), []);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);
  
  useEffect(() => { return () => { if (recognitionRef.current) recognitionRef.current.stop(); }; }, []);
  
  const pageTransitions = useTransition(isOpen, {
    from: { opacity: 0, transform: 'translateY(100%)' },
    enter: { opacity: 1, transform: 'translateY(0%)' },
    leave: { opacity: 0, transform: 'translateY(100%)' },
    config: { tension: 220, friction: 25 },
  });

  const cardTransitions = useTransition(currentIndex, {
      key: currentIndex,
      from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` },
      enter: { opacity: 1, transform: 'translateY(0%)' },
      leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
      config: { mass: 1, tension: 280, friction: 30 },
      onStart: () => playSoundEffect('switch'),
  });
  
  const bind = useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], event }) => {
      if (event.target.closest('[data-no-gesture]')) return;
      if (!down) {
          const isSignificantDrag = Math.abs(my) > 60 || (Math.abs(vy) > 0.4 && Math.abs(my) > 30);
          if (isSignificantDrag) navigate(yDir < 0 ? 1 : -1);
      }
  }, { axis: 'y' });

  const cardContent = pageTransitions((style, item) =>
    item && (
      <animated.div style={{ ...styles.fullScreen, ...style }}>
        <div style={styles.gestureArea} {...bind()} />
        
        <div style={styles.headerControls} data-no-gesture="true">
            <div style={styles.counter}>{currentIndex + 1} / {cards.length}</div>
        </div>

        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {!!recognizedText && currentCard && (<PronunciationComparison correctWord={currentCard.chinese} userText={recognizedText} onContinue={handleNavigateToNext} onClose={handleCloseComparison} />)}
        
        {cardTransitions((cardStyle, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...cardStyle }}>
              <div style={styles.cardContainer}>
                  <div style={styles.mainContent} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                      <div style={styles.pinyin}>{cardData.pinyin || pinyinConverter(cardData.chinese, { toneType: 'mark', separator: ' ' })}</div>
                      <div style={styles.textChinese}>{cardData.chinese}</div>
                  </div>
                  <div style={styles.translationContent} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                      <div style={styles.textBurmese}>{cardData.burmese}</div>
                  </div>
              </div>
            </animated.div>
          );
        })}

        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={20} /></button>
                <button style={styles.rightIconButton} onClick={handleListen} title="发音练习">
                    <FaMicrophone size={20} color={isListening ? '#dc2626' : '#4a5568'} />
                </button>
                <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺">
                    <FaPenFancy size={20} />
                </button>
            </div>
        )}
      </animated.div>
    )
  );

  if (isMounted) {
      return createPortal(cardContent, document.body);
  }
  return null;
};

// =================================================================================
// ===== 样式表 =====================================================================
// =================================================================================
const styles = {
    // --- 核心布局 ---
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: 'url(/background.jpg) center/cover no-repeat', backgroundAttachment: 'fixed' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    
    // --- 卡片内容 ---
    mainContent: { flex: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center', cursor: 'pointer' },
    translationContent: { flex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', cursor: 'pointer', textAlign: 'center' },
    pinyin: { fontSize: '1.3rem', color: '#f1f5f9', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1rem', letterSpacing: '0.05em' },
    textChinese: { fontSize: '2.8rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.4, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' },
    textBurmese: { fontSize: '2.2rem', color: '#e0e7ff', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },

    // --- 控件 ---
    headerControls: { position: 'fixed', top: '25px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' },
    counter: { background: 'rgba(0, 0, 0, 0.5)', color: 'white', padding: '5px 15px', borderRadius: '15px', fontSize: '1rem', fontWeight: 'bold' },
    rightControls: { position: 'fixed', bottom: '20%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' },
    rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s', color: '#4a5568' },

    // --- 发音对比面板 ---
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '15px' },
    comparisonPanel: { width: '100%', maxWidth: '500px', maxHeight: '90vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
    resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
    errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: 1 },
    lengthError: { textAlign: 'center', color: '#b91c1c', padding: '10px 0' },
    comparisonGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' },
    comparisonCell: { flex: '1 1 120px', padding: '12px', borderRadius: '12px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    comparisonChar: { fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937' },
    comparisonPinyinSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    pinyinVisualizerContainer: { display: 'flex', alignItems: 'baseline', fontSize: '1.6rem', height: '2.0rem' },
    pinyinPart: { transition: 'color 0.3s', fontWeight: 500 },
    toneNumber: { fontSize: '1.2rem', fontWeight: 'bold', marginLeft: '2px' },
    correctPart: { color: '#16a34a' },
    wrongPart: { color: '#dc2626' },
    pinyinLabel: { fontSize: '0.75rem', color: '#6b7280' },
    errorHint: { display: 'flex', gap: '5px', marginTop: '5px' },
    hintTag: { fontSize: '0.65rem', padding: '2px 6px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' },
    comparisonActions: { padding: '20px', borderTop: '1px solid #e2e8f0' },
    actionButton: { width: '100%', padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    continueButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    retryButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    
    // --- 设置面板 ---
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)', padding: '15px' },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto', position: 'relative' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#aaa', lineHeight: 1 },
    settingGroup: { marginBottom: '20px' },
    settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
    settingControl: { display: 'flex', gap: '10px', alignItems: 'center' },
    settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
};

export default ShortSentenceCard;
