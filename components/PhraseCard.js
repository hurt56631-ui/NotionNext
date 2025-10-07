// components/Tixing/PhraseCard.js (最终修复优化版)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaStar, FaRegStar, FaArrowRight, FaLanguage, FaPlay } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
// 假设 HanziModal 存在并可以处理多个字
import HanziModal from '@/components/HanziModal'; 

// =================================================================================
// ===== Utilities & Constants (不变) ===============================================
// =================================================================================

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
  type: new Howl({ src: ['/sounds/typewriter.mp3'], volume: 0.05 }), // 降低音量
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;
let _currentAudioBlobUrl = null; 

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
            if (initial === 'y' && final.startsWith('i')) final = final.slice(1);
            if (initial === 'w' && final.startsWith('u')) final = final.slice(1);
            break;
        }
    }
    if (pinyinPlain === 'er') { initial = ''; final = 'er'; }
    if (initial === '' && initials.some(i => pinyinPlain.startsWith(i))) { initial = pinyinPlain; final = ''; } 
    return { initial, final, tone, pinyinMark, rawPinyin };
};

// =================================================================================
// ===== Custom Hooks: 用户设置 (不变) ===============================================
// =================================================================================
const usePhraseCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('phraseCardSettings');
      const defaultSettings = { 
        order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false,
        voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0,
      };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) { 
        console.error("Failed to load settings", error);
        return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0 };
    }
  });
  useEffect(() => { try { localStorage.setItem('phraseCardSettings', JSON.stringify(settings)); } catch (error) { console.error("Failed to save settings", error); } }, [settings]);
  return [settings, setSettings];
};

// =================================================================================
// ===== Component: 打字机效果文本 (新增) =============================================
// =================================================================================
const TypewriterText = React.memo(({ text, speed = 80, onFinished }) => {
    const [displayedText, setDisplayedText] = useState('');
    const indexRef = useRef(0);

    useEffect(() => {
        setDisplayedText('');
        indexRef.current = 0;
        if (!text) return;

        const intervalId = setInterval(() => {
            if (indexRef.current < text.length) {
                setDisplayedText(prev => prev + text[indexRef.current]);
                indexRef.current += 1;
                playSoundEffect('type'); // 每次打字播放音效
            } else {
                clearInterval(intervalId);
                if (onFinished) onFinished();
            }
        }, speed);

        return () => clearInterval(intervalId);
    }, [text, speed, onFinished]);

    return <span>{displayedText}</span>;
});


// =================================================================================
// ===== Component: 笔顺展示 (修改：显示短语中的所有汉字) ==============================
// =================================================================================
const HanziWriterDisplay = React.memo(({ chineseText, setWriterChar }) => {
    const hanziList = useMemo(() => {
        // 筛选出所有汉字
        return chineseText.match(/[\u4e00-\u9fa5]/g) || [];
    }, [chineseText]);

    if (hanziList.length === 0) return null;
    
    // 假设 HanziModal 可以处理整个短语
    const handlePhraseClick = useCallback((e) => {
        e.stopPropagation();
        setWriterChar(chineseText); // 传递整个短语
    }, [chineseText, setWriterChar]);

    return (
        <div style={styles.writerDisplayWrapper}>
            <div style={styles.hanziWriterContainer} onClick={handlePhraseClick}>
                {/* 使用小字体、横排显示短语 */}
                {hanziList.map((char, index) => (
                    <span key={index} style={styles.writerCharText}>{char}</span>
                ))}
                <FaPenFancy size={14} color="#4299e1" style={{ marginLeft: '8px' }}/>
            </div>
        </div>
    );
});


// =================================================================================
// ===== Component: 发音对比面板 (略，逻辑与 CiDianKa 保持一致) ========================
// =================================================================================
const PinyinVisualizer = React.memo(({ analysis }) => {
    const { parts, errors } = analysis;
    const hasInitial = !!parts.initial;
    const hasFinal = !!parts.final;
    const hasTone = parts.tone !== '0';
    const initialStyle = hasInitial && errors.initial ? styles.wrongPart : styles.correctPart;
    const finalStyle = hasFinal && errors.final ? styles.wrongPart : styles.correctPart;
    const toneStyle = hasTone && errors.tone ? styles.wrongPart : styles.correctPart;
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

const PronunciationComparison = ({ correctWord, userText, audioBlobUrl, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });
        if (correctPinyin.length !== userPinyin.length) { return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` }; }

        const results = correctPinyin.map((correctPy, index) => {
            const userPy = userPinyin[index];
            const correctParts = parsePinyin(correctPy);
            const userParts = parsePinyin(userPy);
            const errors = { initial: (correctParts.initial || userParts.initial) && (correctParts.initial !== userParts.initial), final: correctParts.final !== userParts.final, tone: correctParts.tone !== userParts.tone, };
            const pinyinMatch = !errors.initial && !errors.final && !errors.tone;
            return { char: correctWord[index], pinyinMatch, correct: { parts: correctParts, errors: { initial: false, final: false, tone: false } }, user: { parts: userParts, errors: errors } };
        });
        const isCorrect = results.every(r => r.pinyinMatch);
        const correctCount = results.filter(r => r.pinyinMatch).length;
        const accuracy = (correctCount / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText]);

    useEffect(() => {
        if (!analysis) return;
        const isSuccess = analysis.isCorrect && analysis.accuracy > 0;
        playSoundEffect(isSuccess ? 'correct' : 'incorrect');
    }, [analysis]);
    
    const playUserRecording = useCallback(() => {
        if (audioBlobUrl) {
            if (_howlInstance?.playing()) _howlInstance.stop();
            _howlInstance = new Howl({ src: [audioBlobUrl], html5: true });
            _howlInstance.play();
        }
    }, [audioBlobUrl]);
    
    const playStandard = useCallback((e) => {
        playTTS(correctWord, 'zh-CN-XiaoyouNeural', 0, null, e);
    }, [correctWord]);
    

    if (!analysis) return null;

    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '发音完美！' : '再接再厉！'}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>准确率: {analysis.accuracy}%</div>
                </div>
                
                <div style={styles.audioControls}>
                    <button style={styles.audioButton} onClick={playStandard}><FaPlay size={16}/> 标准发音</button>
                    {audioBlobUrl && <button style={styles.audioButton} onClick={playUserRecording}><FaPlay size={16}/> 你的录音</button>}
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
                                    <div style={styles.comparisonPinyinSide}><PinyinVisualizer analysis={result.correct} /><span style={styles.pinyinLabel}>标准</span></div>
                                    <div style={{...styles.comparisonPinyinSide, opacity: result.pinyinMatch ? 0.6 : 1, transition: 'opacity 0.3s'}}><PinyinVisualizer analysis={result.user} /><span style={styles.pinyinLabel}>你的发音</span></div>
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
// ===== Component: 图片加载器 (修复 & 压缩) =========================================
// =================================================================================
const LazyImageWithSkeleton = React.memo(({ src, alt }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // 强制 30% 压缩，并处理本地图片路径
  const optimizedSrc = useMemo(() => {
      if (!src) return null;
      if (src.startsWith('http')) {
          return `${src}?quality=30`; // 远程图片
      }
      // 假设本地图片放在 /images/ 目录下 (处理 1.jpg, 2.jpg 格式)
      if (src.match(/^\d+\.jpe?g$/i)) {
          return `/images/${src}`; 
      }
      return src; 
  }, [src]);

  // 使用一个 Image 对象来处理加载，并缓存状态
  useEffect(() => { 
      setImageLoaded(false); 
      if (!optimizedSrc) return;
      
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => {
          setImageLoaded(true); // 即使失败也要标记为“已尝试加载”
          console.error(`Image failed to load: ${optimizedSrc}`);
      };
      img.src = optimizedSrc;
      
  }, [optimizedSrc]);
  
  return (
    <div style={styles.imageWrapper}>
      {!imageLoaded && optimizedSrc && (<div style={styles.skeleton}><div style={styles.shimmer} /></div>)}
      {optimizedSrc && (
          <img 
              src={optimizedSrc} 
              alt={alt} 
              // 注意：onLoad 和 onError 现在主要由 useEffect 里的 Image 对象处理
              style={{...styles.cardImage, opacity: imageLoaded ? 1 : 0}} 
              loading="lazy" 
              decoding="async"
          />
      )}
    </div>
  );
});

// =================================================================================
// ===== Component: 设置面板 (略，逻辑不变) ==========================================
// =================================================================================
const PhraseCardSettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> 6秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>);
});


// =================================================================================
// ===== 主组件: PhraseCard (入口文件) ==============================================
// =================================================================================
const PhraseCard = ({ flashcards = [] }) => {
  const [settings, setSettings] = usePhraseCardSettings();
  
  const processedCards = useMemo(() => {
    try { 
        if (!Array.isArray(flashcards)) return []; 
        const validCards = flashcards.filter(card => card && typeof card.chinese === 'string' && card.chinese && typeof card.burmese === 'string' && card.burmese); 
        if (settings.order === 'random') { for (let i = validCards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [validCards[i], validCards[j]] = [validCards[j], validCards[i]]; } } 
        return validCards; 
    } catch (error) { console.error("CRITICAL ERROR processing 'flashcards':", error, flashcards); return []; }
  }, [flashcards, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ chinese: "你好，世界", burmese: "မင်္ဂလာပါကမ္ဘာလောကကြီး", burmesePhonetic: "敏格拉巴，卡玛罗吉吉", imageUrl: null }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [audioBlobUrl, setAudioBlobUrl] = useState(null);
  
  // 笔顺状态：现在存储整个短语
  const [writerChar, setWriterChar] = useState(null); 
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  
  // 打字机状态
  const [textToDisplay, setTextToDisplay] = useState(cards[0]?.chinese || '');
  const [isTypewriterFinished, setIsTypewriterFinished] = useState(true);

  const navigate = useCallback((direction) => { 
      lastDirection.current = direction; 
      setCurrentIndex(prev => {
          const newIndex = (prev + direction + cards.length) % cards.length;
          // 重置打字机
          if (cards[newIndex]?.chinese) {
             setTextToDisplay(cards[newIndex].chinese);
             setIsTypewriterFinished(false);
          }
          // 预加载下一个图片
          const nextNextIndex = (newIndex + 1) % cards.length;
          const nextNextCard = cards[nextNextIndex];
          if (nextNextCard?.imageUrl) {
              const nextOptimizedSrc = `${nextNextCard.imageUrl.startsWith('http') ? nextNextCard.imageUrl : `/images/${nextNextCard.imageUrl}`}?quality=30`;
              const img = new Image();
              img.src = nextOptimizedSrc;
          }
          return newIndex;
      });
  }, [cards.length, cards]);
  
  const resetAutoBrowseTimer = useCallback(() => { 
      clearTimeout(autoBrowseTimerRef.current); 
      if (settings.autoBrowse && isTypewriterFinished && !writerChar && !isListening) { 
          autoBrowseTimerRef.current = setTimeout(() => navigate(1), 6000); 
      } 
  }, [settings.autoBrowse, isTypewriterFinished, writerChar, isListening, navigate]);
  
  const handleTypewriterFinished = useCallback(() => {
      setIsTypewriterFinished(true);
      const currentCard = cards[currentIndex]; 
      // 避免重复朗读：只在自动播放开启且打字机完成时，才触发朗读
      if (settings.autoPlayChinese && currentCard?.chinese) { 
          playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese); 
      }
      resetAutoBrowseTimer();
  }, [cards, currentIndex, settings.autoPlayChinese, settings.voiceChinese, settings.speechRateChinese, resetAutoBrowseTimer]);

  useEffect(() => { 
      resetAutoBrowseTimer(); 
      return () => clearTimeout(autoBrowseTimerRef.current); 
  }, [currentIndex, isTypewriterFinished, isListening, resetAutoBrowseTimer]);

  // 初始化打字机文本
  useEffect(() => {
      if (cards[currentIndex]?.chinese !== textToDisplay) {
         setTextToDisplay(cards[currentIndex]?.chinese || '');
         setIsTypewriterFinished(false);
      }
  }, [currentIndex, cards]);


  const cardTransitions = useTransition(currentIndex, { 
      key: currentIndex, 
      from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, 
      enter: { opacity: 1, transform: 'translateY(0%)' }, 
      leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, 
      config: { mass: 1, tension: 280, friction: 30 }, 
      onStart: () => { playSoundEffect('switch'); }, 
      onRest: () => { /* Card transition finished */ }, 
  });
  
  // --- 录音和发音对比逻辑 ---
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleListen = (e) => { 
      e.stopPropagation(); 
      if (isListening) { 
          // 停止录音
          mediaRecorderRef.current?.stop();
          return; 
      } 
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; 
      if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; } 
      
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          mediaRecorderRef.current = new MediaRecorder(stream);
          audioChunksRef.current = [];
          
          mediaRecorderRef.current.ondataavailable = event => { audioChunksRef.current.push(event.data); };
          mediaRecorderRef.current.onstop = () => {
              setIsListening(false);
              stream.getTracks().forEach(track => track.stop());
              
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
              if (_currentAudioBlobUrl) URL.revokeObjectURL(_currentAudioBlobUrl);
              _currentAudioBlobUrl = URL.createObjectURL(audioBlob); 
              setAudioBlobUrl(_currentAudioBlobUrl);
              // 此时 SpeechRecognition onresult/onerror/onend 应该会触发后续操作
          };
          
          // 启动 SpeechRecognition 识别
          const recognition = new SpeechRecognition(); 
          recognition.lang = 'zh-CN'; 
          recognition.interimResults = false; 
          
          recognition.onstart = () => { 
              setIsListening(true); 
              setRecognizedText(''); 
              setAudioBlobUrl(null);
              mediaRecorderRef.current.start();
          }; 
          
          recognition.onresult = (event) => { 
              const transcript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，]/g, ''); 
              if (transcript) { setRecognizedText(transcript); }
              if(mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
          }; 
          
          recognition.onerror = (event) => { 
              console.error('Speech Recognition Error:', event.error); 
              setRecognizedText(''); 
              if(mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); // 识别失败也要停止录音
          }; 
          
          recognition.onend = () => { 
              recognitionRef.current = null; 
              // 确保录音停止
              if(mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
          }; 
          
          recognition.start(); 
          recognitionRef.current = recognition; 

      }).catch(err => {
          console.error("Failed to get audio stream:", err);
          alert('无法启动麦克风。请检查浏览器权限设置，并确保是 HTTPS 连接。错误信息: ' + (err.name || err.message));
          setIsListening(false);
      });
  };
  // --- 录音和发音对比逻辑结束 ---

  const handleCloseComparison = useCallback(() => { 
      setRecognizedText(''); 
      if (_currentAudioBlobUrl) {
          URL.revokeObjectURL(_currentAudioBlobUrl);
          _currentAudioBlobUrl = null;
          setAudioBlobUrl(null);
      }
  }, []);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);
  
  
  return (
    <div style={styles.fullScreen}>
      {/* writerChar 现在是一个字符串， HanziModal 必须能处理它 */}
      {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />} 
      {isSettingsOpen && <PhraseCardSettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}

      <div style={styles.gestureArea} {...bind()} />
      {cardTransitions((style, i) => {
        const cardData = cards[i];
        if (!cardData) return null;
        return (
          <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
            <div style={styles.cardContainer}>
              <div style={styles.mainContent}>
                
                {/* 1. 拼音 & 中文 & 缅文谐音 */}
                <div style={styles.phraseHeader}>
                    <div style={styles.phrasePinyin}>{pinyinConverter(cardData.chinese, { toneType: 'mark', separator: ' ' })}</div>
                    {/* 点击中文文本时，触发笔顺功能 */}
                    <div style={styles.phraseHanzi} onClick={(e) => { e.stopPropagation(); setWriterChar(cardData.chinese); }}>
                        <TypewriterText text={textToDisplay} speed={80} onFinished={handleTypewriterFinished} />
                    </div>
                    {/* 缅文谐音 (不朗读) */}
                    {cardData.burmesePhonetic && <div style={styles.burmesePhonetic}>{cardData.burmesePhonetic}</div>}
                </div>
                
                {/* 2. 缅甸语翻译 (同时显示, 无背景色) */}
                <div style={styles.burmeseContainer}>
                    <div style={styles.burmeseText}>{cardData.burmese}</div>
                </div>

                {/* 3. 图片 */}
                {cardData.imageUrl && <LazyImageWithSkeleton src={cardData.imageUrl} alt={cardData.chinese} />}
              </div>
            </div>
            
            {/* 笔顺显示：在主内容下方，点击整个短语文字时触发 */}
            {/* <HanziWriterDisplay chineseText={currentCard.chinese} setWriterChar={setWriterChar} /> */}
          </animated.div>
        );
      })}

      {!!recognizedText && (
          <animated.div style={{ position: 'absolute', inset: 0, zIndex: 200, opacity: 1 }}>
             <PronunciationComparison 
                 correctWord={currentCard.chinese} 
                 userText={recognizedText} 
                 audioBlobUrl={audioBlobUrl}
                 onContinue={handleNavigateToNext} 
                 onClose={handleCloseComparison} 
             />
          </animated.div>
      )}

      <div style={styles.rightControls} data-no-gesture="true">
        <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={28} color="#4a5568"/></button>
        <button style={styles.rightIconButton} onClick={handleListen} title="发音练习"> 
            <FaMicrophone size={28} color={isListening ? '#dc2626' : '#4a5568'} /> 
        </button>
        <button style={styles.rightIconButton} onClick={(e) => playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)} title="朗读中文"><FaVolumeUp size={28} color="#000000"/></button>
        <button style={styles.rightIconButton} onClick={(e) => playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)} title="朗读缅甸语">
            <FaLanguage size={28} color="#4299e1"/>
        </button>
      </div>
    </div>
  );
};


// =================================================================================
// ===== Styles: 样式表 (修复后的样式) ==============================================
// =================================================================================
const styles = {
  // --- 主布局 ---
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: '#f8fafc' },
  gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', padding: '60px 20px 20px' },
  
  // --- PhraseCard 核心内容样式 ---
  phraseContentContainer: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '25px', width: '90%', maxWidth: '600px', marginBottom: '15%' },
  
  phraseHeader: { textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' },
  // 拼音颜色更深
  phrasePinyin: { fontSize: '1.2rem', color: '#475569', marginBottom: '5px' }, 
  // 中文短语/句子样式: 字体更小
  phraseHanzi: { fontSize: '1.8rem', fontWeight: 700, color: '#1f2937', lineHeight: 1.5, wordBreak: 'break-word', minHeight: '1.8rem', cursor: 'pointer' }, 
  // 缅文谐音 (紫色)
  burmesePhonetic: { fontSize: '1.0rem', fontWeight: 400, color: '#9333ea' },

  // 缅甸语翻译样式: (移除背景色, 蓝色字体)
  burmeseContainer: { 
    // background: '#e0f2f1', // 移除背景色
    padding: '15px 0', 
    width: '100%', 
    textAlign: 'center'
  },
  burmeseText: {
    fontSize: '1.4rem',
    fontWeight: 500,
    color: '#005a9c', 
    lineHeight: 1.8,
  },
  
  // 笔顺显示样式 (改为只显示一个可点击区域)
  writerDisplayWrapper: { position: 'absolute', bottom: '80px', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 10 },
  hanziWriterContainer: { 
      display: 'flex', 
      alignItems: 'center',
      gap: '5px', 
      padding: '8px 15px', 
      background: 'white', 
      borderRadius: '12px',
      boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
      cursor: 'pointer'
  },
  writerCharText: { fontSize: '1.2rem', fontWeight: 'bold', color: '#1f2937' },
  
  // --- 图片样式 (复用) ---
  imageWrapper: { width: '90%', maxHeight: '30vh', position: 'relative', marginTop: '20px' },
  cardImage: { maxWidth: '100%', maxHeight: '30vh', objectFit: 'contain', borderRadius: '12px', transition: 'opacity 0.3s ease-in-out' }, 
  skeleton: { position: 'absolute', inset: 0, background: '#e2e8f0', borderRadius: '12px', overflow: 'hidden' },
  shimmer: { position: 'absolute', inset: 0, transform: 'translateX(-100%)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'shimmer 2s infinite' },
  
  // --- 右侧控制按钮 (复用) ---
  rightControls: { position: 'absolute', bottom: '15%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' },
  rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s' },
  
  // --- 发音对比模态框样式 ---
  comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
  comparisonPanel: { width: '90%', maxWidth: '500px', maxHeight: '90vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
  resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
  audioControls: { display: 'flex', justifyContent: 'space-around', padding: '15px 20px', borderBottom: '1px solid #e2e8f0' },
  audioButton: { padding: '10px 15px', borderRadius: '10px', background: '#f0f4f8', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
  errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' },
  lengthError: { textAlign: 'center', color: '#b91c1c', padding: '20px 0' },
  comparisonGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-start' },
  comparisonCell: { minWidth: '130px', padding: '12px', borderRadius: '12px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
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

  // --- 设置面板 (复用) ---
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

export default PhraseCard;
