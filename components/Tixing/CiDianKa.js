// components/Tixing/CiDianKa.js (Upgraded with Visual Pinyin Feedback, Better Spacing & Code Structure)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaStar, FaRegStar, FaArrowRight } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// ===== Utilities: 音频播放, 拼音解析 (建议拆分到 utils.js) =========================
// =================================================================================

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'zh-CN-YunjianNeural', label: '中文男声 (云间)' }, { value: 'zh-CN-YunxiNeural', label: '中文男声 (云希)' },
    { value: 'vi-VN-HoaiMyNeural', label: '越南语女声' }, { value: 'vi-VN-NamMinhNeural', label: '越南语男声' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
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
    Object.values(sounds).forEach(sound => sound.stop());
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

// 修正后的拼音解析逻辑：更精准地分离声母、韵母、声调
const parsePinyin = (pinyinNum) => {
    if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' };
    const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, '');
    let pinyinPlain = rawPinyin.replace(/[1-5]$/, '');
    const toneMatch = rawPinyin.match(/[1-5]$/);
    const tone = toneMatch ? toneMatch[0] : '0';
    const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' });

    // 声母列表 (包括 y/w)
    const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
    let initial = '';
    let final = pinyinPlain;
    
    // 寻找声母
    for (const init of initials) {
        if (pinyinPlain.startsWith(init)) {
            initial = init;
            final = pinyinPlain.slice(init.length);
            // 处理 y/w 导致的韵母变化，例如 'ya' -> 'ia', 'wu' -> 'u'
            if (initial === 'y' && final.startsWith('i')) final = final.slice(1);
            if (initial === 'w' && final.startsWith('u')) final = final.slice(1);
            break;
        }
    }
    
    // 特殊处理 'er' 和只有韵母的情况
    if (pinyinPlain === 'er') { initial = ''; final = 'er'; }
    if (initial === '' && initials.some(i => pinyinPlain.startsWith(i))) { initial = pinyinPlain; final = ''; } // 兜底，防止完全失败

    return { initial, final, tone, pinyinMark, rawPinyin };
};


// =================================================================================
// ===== Custom Hooks: 用户设置 (建议拆分到 hooks.js) ===============================
// =================================================================================
const useCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('ciDianKaSettings');
      const defaultSettings = { 
        order: 'sequential', autoPlayWord: true, autoBrowse: false, autoPlayDetails: true,
        voiceWord: 'zh-CN-XiaoyouNeural', voiceMeaning: 'zh-CN-XiaoxiaoNeural', voiceExample: 'zh-CN-XiaoxiaoNeural', speechRate: 0,
      };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) { 
        console.error("Failed to load settings", error);
        return { order: 'sequential', autoPlayWord: true, autoBrowse: false, autoPlayDetails: true, voiceWord: 'zh-CN-XiaoyouNeural', voiceMeaning: 'zh-CN-XiaoxiaoNeural', voiceExample: 'zh-CN-XiaoxiaoNeural', speechRate: 0 };
    }
  });
  useEffect(() => { try { localStorage.setItem('ciDianKaSettings', JSON.stringify(settings)); } catch (error) { console.error("Failed to save settings", error); } }, [settings]);
  return [settings, setSettings];
};

// =================================================================================
// ===== Component: 视觉化拼音分析器 (核心升级) =====================================
// =================================================================================
const PinyinVisualizer = React.memo(({ analysis }) => {
    const { parts, errors } = analysis;
    
    // 确保有值，否则不渲染颜色
    const hasInitial = !!parts.initial;
    const hasFinal = !!parts.final;
    const hasTone = parts.tone !== '0';

    // 根据错误状态决定样式，如果没有对应的部分，则不渲染错误色
    const initialStyle = hasInitial && errors.initial ? styles.wrongPart : styles.correctPart;
    const finalStyle = hasFinal && errors.final ? styles.wrongPart : styles.correctPart;
    const toneStyle = hasTone && errors.tone ? styles.wrongPart : styles.correctPart;

    // 找到带声调的字母 (使用 pinyin-pro 的声调符号版本)
    let finalDisplay = parts.pinyinMark.replace(parts.initial, '').replace(' ', '');
    // 如果是无声调的纯拼音，直接显示 final
    if (!finalDisplay || parts.pinyinMark === parts.rawPinyin) {
        finalDisplay = parts.final;
    }
    
    // 分离出声调数字，以避免在韵母中显示多余的数字
    finalDisplay = finalDisplay.replace(/[1-5]$/, '');


    return (
        <div style={styles.pinyinVisualizerContainer}>
            <span style={{...styles.pinyinPart, ...initialStyle}}>{parts.initial || '' }</span>
            <span style={{...styles.pinyinPart, ...finalStyle}}>{finalDisplay}</span>
            <span style={{...styles.pinyinPart, ...styles.toneNumber, ...toneStyle}}>{parts.tone}</span>
        </div>
    );
});

// =================================================================================
// ===== Component: 发音对比面板 (核心升级) =========================================
// =================================================================================
const PronunciationComparison = ({ correctWord, userText, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        // 使用 pinyin-pro 将汉字转为带数字声调的拼音数组
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });

        // 1. 字数不匹配检测
        if (correctPinyin.length !== userPinyin.length) {
            return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
        }

        // 2. 逐字对比
        const results = correctPinyin.map((correctPy, index) => {
            const userPy = userPinyin[index];
            
            // 使用修正后的 parsePinyin 分离声母、韵母、声调
            const correctParts = parsePinyin(correctPy);
            const userParts = parsePinyin(userPy);
            
            // 细致的错误对比
            const errors = {
                // 如果声母都是空，则不报错；否则对比是否一致
                initial: (correctParts.initial || userParts.initial) && (correctParts.initial !== userParts.initial),
                final: correctParts.final !== userParts.final,
                tone: correctParts.tone !== userParts.tone,
            };
            const pinyinMatch = !errors.initial && !errors.final && !errors.tone;
            
            return {
                char: correctWord[index],
                pinyinMatch,
                correct: { parts: correctParts, errors: { initial: false, final: false, tone: false } }, // 标准答案永远没错误
                user: { parts: userParts, errors: errors }
            };
        });

        const isCorrect = results.every(r => r.pinyinMatch);
        const correctCount = results.filter(r => r.pinyinMatch).length;
        const accuracy = (correctCount / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText]);

    useEffect(() => {
        if (!analysis) return;
        // 只有当有结果且准确率不是 0% 时才播放成功音
        const isSuccess = analysis.isCorrect && analysis.accuracy > 0;
        playSoundEffect(isSuccess ? 'correct' : 'incorrect');
    }, [analysis]);

    if (!analysis) return null;

    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '发音完美！' : '再接再厉！'}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>准确率: {analysis.accuracy}%</div>
                </div>

                <div style={styles.errorDetailsContainer}>
                    {analysis.error === 'LENGTH_MISMATCH' ? (
                        <div style={styles.lengthError}>
                            <h3>{analysis.message}</h3>
                            <p>标准答案：<strong>{correctWord}</strong></p>
                            <p>你的朗读：<strong>{userText}</strong></p>
                        </div>
                    ) : (
                        <div style={styles.comparisonGrid}>
                            {analysis.results.map((result, index) => (
                                <div key={index} style={styles.comparisonCell}>
                                    <div style={styles.comparisonChar}>{result.char}</div>
                                    
                                    <div style={styles.comparisonPinyinSide}>
                                        <PinyinVisualizer analysis={result.correct} />
                                        <span style={styles.pinyinLabel}>标准</span>
                                    </div>
                                    
                                    <div style={{...styles.comparisonPinyinSide, opacity: result.pinyinMatch ? 0.6 : 1, transition: 'opacity 0.3s'}}>
                                        <PinyinVisualizer analysis={result.user} />
                                         <span style={styles.pinyinLabel}>你的发音</span>
                                    </div>
                                    
                                    {/* 错误的简短提示 */}
                                    {!result.pinyinMatch && (
                                        <div style={styles.errorHint}>
                                            {result.user.errors.initial && <span style={styles.hintTag}>声母错</span>}
                                            {result.user.errors.final && <span style={styles.hintTag}>韵母错</span>}
                                            {result.user.errors.tone && <span style={styles.hintTag}>声调错</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={styles.comparisonActions}>
                    {analysis.isCorrect ? (
                        <button style={{...styles.actionButton, ...styles.continueButton}} onClick={onContinue}>继续下一个 <FaArrowRight /></button>
                    ) : (
                        <button style={{...styles.actionButton, ...styles.retryButton}} onClick={onClose}>再试一次</button>
                    )}
                </div>
            </div>
        </div>
    );
};

// =================================================================================
// ===== Component: 其他子组件 (建议拆分到 SubComponents.js) ========================
// =================================================================================
const PinyinSeparatedText = React.memo(({ text }) => {
    const pinyinData = useMemo(() => {
        try { if (typeof text !== 'string' || !text || !/[\u4e00-\u9fa5]/.test(text)) { return { pinyin: '', hanzi: text }; } const pinyinString = pinyinConverter(text, { toneType: 'mark' }); return { pinyin: pinyinString, hanzi: text }; } catch (error) { console.error("PinyinSeparatedText Error:", error, { text }); return { pinyin: '', hanzi: text }; }
    }, [text]);
    return ( <div style={{ lineHeight: 1.4 }}> <div style={{ fontSize: '1.0rem', color: '#64748b', marginBottom: '4px' }}>{pinyinData.pinyin}</div> <div style={{ fontSize: '1.2rem', color: '#1f2937' }}>{pinyinData.hanzi}</div> </div> );
});

// 加入图片画质参数
const LazyImageWithSkeleton = React.memo(({ src, alt }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  // **图片画质压缩优化：** 假设图片服务支持 quality 参数
  const optimizedSrc = useMemo(() => src ? `${src}?quality=70` : null, [src]);

  useEffect(() => { setImageLoaded(false); }, [src]);
  
  // 使用 useTransition 实现图片渐显
  const transition = useTransition(imageLoaded, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    config: { duration: 500 } // 渐显动画时长 0.5s
  });

  return (
    <div style={styles.imageWrapper}>
      {!imageLoaded && (<div style={styles.skeleton}><div style={styles.shimmer} /></div>)}
      {transition((style, item) => item ? (
        <animated.img 
            src={optimizedSrc} 
            alt={alt} 
            onLoad={() => setImageLoaded(true)} 
            style={{...styles.cardImage, ...style}} 
            loading="lazy" 
            decoding="async"
        />
      ) : (
          // 确保在加载前也渲染，以便触发 onload
          <img 
              src={optimizedSrc} 
              alt={alt} 
              onLoad={() => setImageLoaded(true)} 
              style={{ display: 'none' }} 
              loading="lazy" 
              decoding="async"
          />
      ))}
    </div>
  );
});

// =================================================================================
// ===== Component: 设置面板 (建议拆分到 SettingsPanel.js) =========================
// =================================================================================
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayWord} onChange={(e) => handleSettingChange('autoPlayWord', e.target.checked)} /> 自动朗读单词</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayDetails} onChange={(e) => handleSettingChange('autoPlayDetails', e.target.checked)} /> 自动朗读释义</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> 6秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>单词发音人</label><select style={styles.settingSelect} value={settings.voiceWord} onChange={(e) => handleSettingChange('voiceWord', e.target.value)}>{TTS_VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>释义发音人</label><select style={styles.settingSelect} value={settings.voiceMeaning} onChange={(e) => handleSettingChange('voiceMeaning', e.target.value)}>{TTS_VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>例句发音人</label><select style={styles.settingSelect} value={settings.voiceExample} onChange={(e) => handleSettingChange('voiceExample', e.target.value)}>{TTS_VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>全局语速: {settings.speechRate}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRate} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRate', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>);
});


// =================================================================================
// ===== 主组件: CiDianKa (入口文件) =================================================
// =================================================================================
const CiDianKa = ({ flashcards = [], user = null, isFavorite = false, onToggleFavorite = () => {} }) => {
  const [settings, setSettings] = useCardSettings();
  
  const processedCards = useMemo(() => {
    try { 
        if (!Array.isArray(flashcards)) return []; 
        const validCards = flashcards.filter(card => card && typeof card.word === 'string' && card.word).map(card => ({ ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' }) })); 
        if (settings.order === 'random') { for (let i = validCards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [validCards[i], validCards[j]] = [validCards[j], validCards[i]]; } } 
        return validCards; 
    } catch (error) { console.error("CRITICAL ERROR processing 'flashcards':", error, flashcards); return []; }
  }, [flashcards, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "数据加载中或为空...", example: "请检查数据源或稍后再试。", imageUrl: null }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  
  const recognitionRef = useRef(null);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  
  const navigate = useCallback((direction) => { lastDirection.current = direction; setCurrentIndex(prev => (prev + direction + cards.length) % cards.length); }, [cards.length]);
  const resetAutoBrowseTimer = useCallback(() => { clearTimeout(autoBrowseTimerRef.current); if (settings.autoBrowse && !isRevealed && !isListening && !writerChar) { autoBrowseTimerRef.current = setTimeout(() => navigate(1), 6000); } }, [settings.autoBrowse, isRevealed, isListening, writerChar, navigate]);
  
  const cardTransitions = useTransition(currentIndex, { key: currentIndex, from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, config: { mass: 1, tension: 280, friction: 30 }, onStart: () => { playSoundEffect('switch'); }, onRest: () => { setIsRevealed(false); }, });
  const detailsTransitions = useTransition(isRevealed, { from: { opacity: 0, transform: 'translateY(20px)' }, enter: { opacity: 1, transform: 'translateY(0px)' }, leave: { opacity: 0, transform: 'translateY(20px)' }, });
  const comparisonTransitions = useTransition(!!recognizedText, { from: { opacity: 0 }, enter: { opacity: 1 }, leave: { opacity: 0 } });

  const bind = useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], tap, event }) => { if (event.target.closest('[data-no-gesture]')) return; if (tap) { setIsRevealed(r => !r); return; } if (!down) { const isSignificantDrag = Math.abs(my) > 60 || (Math.abs(vy) > 0.4 && Math.abs(my) > 30); if (isSignificantDrag) { navigate(yDir < 0 ? 1 : -1); } } }, { axis: 'y', filterTaps: true, taps: true });
  
  useEffect(() => { const currentCard = cards[currentIndex]; if (settings.autoPlayWord && currentCard) { const ttsTimer = setTimeout(() => playTTS(currentCard.word, settings.voiceWord, settings.speechRate), 600); return () => clearTimeout(ttsTimer); } }, [currentIndex, cards, settings.autoPlayWord, settings.voiceWord, settings.speechRate]);
  
  useEffect(() => { if (isRevealed && settings.autoPlayDetails) { const currentCard = cards[currentIndex]; if (currentCard?.meaning) { const playExample = currentCard.example ? () => playTTS(currentCard.example, settings.voiceExample, settings.speechRate) : null; playTTS(currentCard.meaning, settings.voiceMeaning, settings.speechRate, playExample); } } }, [isRevealed, currentIndex, cards, settings.autoPlayDetails, settings.voiceMeaning, settings.voiceExample, settings.speechRate]);

  useEffect(() => { resetAutoBrowseTimer(); return () => clearTimeout(autoBrowseTimerRef.current); }, [currentIndex, resetAutoBrowseTimer]);

  useEffect(() => { const enterFullscreen = () => { const elem = document.documentElement; if (elem.requestFullscreen) { elem.requestFullscreen().catch(err => {}); } else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); } }; document.addEventListener('click', enterFullscreen, { once: true }); return () => document.removeEventListener('click', enterFullscreen); }, []);

  useEffect(() => { return () => { if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e){}; recognitionRef.current = null; } }; }, []);

  const handleListen = (e) => { e.stopPropagation(); if (isListening) { recognitionRef.current?.stop(); return; } const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; } const recognition = new SpeechRecognition(); recognition.lang = 'zh-CN'; recognition.interimResults = false; recognition.onstart = () => { setIsListening(true); setRecognizedText(''); setIsRevealed(false); }; recognition.onresult = (event) => { const transcript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，]/g, ''); if (transcript) { setRecognizedText(transcript); }}; recognition.onerror = (event) => { console.error('Speech Recognition Error:', event.error); setRecognizedText(''); }; recognition.onend = () => { setIsListening(false); recognitionRef.current = null; }; recognition.start(); recognitionRef.current = recognition; };
  
  const handleCloseComparison = useCallback(() => { setRecognizedText(''); }, []);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);
  const handleFavoriteClick = (e) => { e.stopPropagation(); onToggleFavorite(cards[currentIndex]); };

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
      {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}

      <div style={styles.gestureArea} {...bind()} />
      {cardTransitions((style, i) => {
        const cardData = cards[i];
        if (!cardData) return null;
        return (
          <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
            <div style={styles.cardContainer}>
              <div style={styles.mainContent}>
                <div style={styles.header}>
                  <div style={styles.pinyin}>{cardData.pinyin}</div>
                  <div style={styles.hanzi}>{cardData.word}</div>
                </div>
                {/* 仅在未显示详情时显示图片 */}
                {!isRevealed && cardData.imageUrl && <LazyImageWithSkeleton src={cardData.imageUrl} alt={cardData.word} />}
                {detailsTransitions((detailsStyle, item) => item && ( <animated.div style={{...detailsStyle, ...styles.detailsContainer}}> <div style={{ flex: 1 }}> <div style={styles.meaningSection}> <PinyinSeparatedText text={cardData.meaning} /> </div> {cardData.example && ( <div style={styles.exampleSection}> <PinyinSeparatedText text={cardData.example} /> </div> )} </div> </animated.div> ))}
              </div>
              {isListening && <div style={styles.listeningText}>正在听...</div>}
            </div>
          </animated.div>
        );
      })}

      {comparisonTransitions((style, item) => item && (
          <animated.div style={{...style, position: 'absolute', inset: 0, zIndex: 200}}>
             <PronunciationComparison correctWord={cards[currentIndex].word} userText={recognizedText} onContinue={handleNavigateToNext} onClose={handleCloseComparison} />
          </animated.div>
      ))}

      <div style={styles.rightControls} data-no-gesture="true">
        {user && (<button style={styles.rightIconButton} onClick={handleFavoriteClick} title={isFavorite ? '取消收藏' : '收藏单词'}>{isFavorite ? <FaStar size={28} color="#f59e0b" /> : <FaRegStar size={28} color="#4a5568"/>}</button>)}
        <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={28} color="#4a5568"/></button>
        <button style={styles.rightIconButton} onClick={handleListen} title="发音练习"> <FaMicrophone size={28} color={isListening ? '#dc2626' : '#4a5568'} /> </button>
        <button style={styles.rightIconButton} onClick={() => setWriterChar(cards[currentIndex]?.word)} title="笔顺"><FaPenFancy size={28} color="#4a5568"/></button>
        <button style={styles.rightIconButton} onClick={(e) => playTTS(cards[currentIndex]?.word, settings.voiceWord, settings.speechRate, null, e)} title="朗读"><FaVolumeUp size={28} color="#4a5568"/></button>
      </div>
    </div>
  );
};

// =================================================================================
// ===== Styles: 样式表 (建议拆分到 styles.js) =====================================
// =================================================================================
const styles = {
  // --- 主布局 ---
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: '#f8fafc' },
  gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', padding: '60px 20px 20px' },
  // 调整 marginBottom 让内容下移
  mainContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '40px', width: '100%', marginBottom: '20%' }, 
  header: { textAlign: 'center' },
  pinyin: { fontSize: '1.6rem', color: '#64748b', marginBottom: '8px' },
  // **修改点 1:** 卡片主汉字大小：从 5.0rem 调整到 4.0rem
  hanzi: { fontSize: '4.0rem', fontWeight: 900, color: '#000000' },
  listeningText: { position: 'absolute', bottom: '25%', color: '#3b82f6', fontSize: '1.2rem', fontWeight: 'bold' },
  
  // --- 详情与图片 ---
  detailsContainer: { background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', padding: '20px', borderRadius: '24px', width: '90%', maxWidth: '600px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' },
  meaningSection: { paddingBottom: '15px' },
  exampleSection: { borderTop: '1px solid #e2e8f0', paddingTop: '15px' },
  imageWrapper: { width: '90%', maxHeight: '30vh', position: 'relative' },
  cardImage: { maxWidth: '100%', maxHeight: '30vh', objectFit: 'contain', borderRadius: '12px', transition: 'opacity 0.5s ease-in-out' }, 
  skeleton: { position: 'absolute', inset: 0, background: '#e2e8f0', borderRadius: '12px', overflow: 'hidden' },
  shimmer: { position: 'absolute', inset: 0, transform: 'translateX(-100%)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'shimmer 2s infinite' },
  
  // --- 右侧控制按钮 ---
  rightControls: { position: 'absolute', bottom: '15%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' },
  rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s' },
  
  // --- 发音对比模态框 ---
  comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
  comparisonPanel: { width: '90%', maxWidth: '500px', maxHeight: '90vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
  resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
  errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' },
  lengthError: { textAlign: 'center', color: '#b91c1c', padding: '20px 0' },
  
  // 解决多字放不下的问题，使用 flex-wrap 实现流式布局
  comparisonGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-start' },
  comparisonCell: { 
      minWidth: '130px', 
      padding: '12px', 
      borderRadius: '12px',
      background: '#f8f9fa',
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '8px' 
  },
  
  // **修改点 2:** 对比面板汉字大小：从 2.0rem 调整到 1.8rem
  comparisonChar: { fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', textAlign: 'center' },
  comparisonPinyinSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }, 
  pinyinLabel: { fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 },
  pinyinVisualizerContainer: { display: 'flex', alignItems: 'baseline', fontSize: '1.6rem', height: '2.0rem' },
  pinyinPart: { transition: 'color 0.3s', fontWeight: 500, margin: '0 1px' }, 
  toneNumber: { fontSize: '1.2rem', fontWeight: 'bold', marginLeft: '2px' },
  correctPart: { color: '#16a34a' },
  wrongPart: { color: '#dc2626' },
  errorHint: { display: 'flex', gap: '5px', marginTop: '5px' },
  hintTag: { fontSize: '0.65rem', padding: '2px 6px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' },
  
  comparisonActions: { padding: '20px', borderTop: '1px solid #e2e8f0' },
  actionButton: { width: '100%', padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  continueButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  retryButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },

  // --- 设置面板 ---
  settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)' },
  settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto' },
  closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
  settingGroup: { marginBottom: '20px' },
  settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
  settingControl: { display: 'flex', gap: '10px', alignItems: 'center' },
  settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
  settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
  settingSlider: { flex: 1 },
};

const shimmerAnimation = `@keyframes shimmer { 100% { transform: translateX(100%); } }`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = shimmerAnimation;
document.head.appendChild(styleSheet);

export default CiDianKa;
