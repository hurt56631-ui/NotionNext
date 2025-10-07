// components/Tixing/CombinedPhraseCard.js (整合优化版)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaLanguage, FaPlay } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal'; 

// =================================================================================
// ===== Utilities & Constants (音频播放、拼音解析等) =================================
// =================================================================================

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;
let _currentAudioBlobUrl = null; 
let _autoPlayTimer = null; 

// 停止所有音频活动
const stopAllAudio = () => {
    Object.values(sounds).forEach(sound => sound.stop());
    if (_howlInstance?.playing()) _howlInstance.stop();
    clearTimeout(_autoPlayTimer);
};

// 【优化】标准整句播放
const playTTS = (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; }
    
    stopAllAudio();
    
    const rateValue = Math.round(rate / 2);
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;
    _howlInstance = new Howl({ src: [ttsUrl], html5: true, onend: onEndCallback });
    _howlInstance.play();
};

// 【保留】分字播放，仅用于发音对比
const playSegmentedTTS = (text, voice, rate, onFinishCallback) => {
    const characters = text.replace(/[.,。，！？!?]/g, '').match(/[\u4e00-\u9fa5]/g) || [];
    let charIndex = 0;
    let segmentTimer = null;

    const playNext = () => {
        if (charIndex >= characters.length) {
            if (onFinishCallback) onFinishCallback();
            return;
        }
        const char = characters[charIndex];
        const rateValue = Math.round(rate / 2);
        const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(char)}&v=${voice}&r=${rateValue}`;
        
        if (_howlInstance?.playing()) _howlInstance.stop(); 
        
        _howlInstance = new Howl({ 
            src: [ttsUrl], 
            html5: true, 
            onend: () => {
                charIndex++;
                segmentTimer = setTimeout(playNext, 300); 
            }
        });
        _howlInstance.play();
    };
    
    stopAllAudio(); 
    clearTimeout(segmentTimer); // 清除可能存在的旧计时器
    playNext();
};

// ... (parsePinyin, PinyinVisualizer 等辅助组件和函数保持不变, 这里省略以节省篇幅) ...
// 您可以从 PhraseCard.js 文件中直接复制 parsePinyin, usePhraseCardSettings, PinyinVisualizer, PronunciationComparison, LazyImageWithSkeleton, PhraseCardSettingsPanel 这些不变的部分。
// 为保证代码完整性，下面将它们粘贴进来。

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

const PronunciationComparison = ({ correctWord, userText, audioBlobUrl, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        const cleanCorrectWord = correctWord.replace(/[.,。，！？!?]/g, '').match(/[\u4e00-\u9fa5]/g)?.join('') || '';
        const cleanUserText = userText.replace(/[.,。，！？!?]/g, '').match(/[\u4e00-\u9fa5]/g)?.join('') || '';
        const correctPinyin = pinyinConverter(cleanCorrectWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(cleanUserText, { toneType: 'num', type: 'array', removeNonHan: true });
        const effectiveLength = Math.min(correctPinyin.length, userPinyin.length);
        const results = Array.from({ length: effectiveLength }).map((_, index) => {
            const correctPy = correctPinyin[index]; const userPy = userPinyin[index];
            if (!correctPy || !userPy) return { char: cleanCorrectWord[index] || '?', pinyinMatch: false, user: { errors: { initial: true, final: true, tone: true } } };
            const correctParts = parsePinyin(correctPy); const userParts = parsePinyin(userPy);
            const errors = { initial: (correctParts.initial || userParts.initial) && (correctParts.initial !== userParts.initial), final: correctParts.final !== userParts.final, tone: correctParts.tone !== userParts.tone, };
            const pinyinMatch = !errors.initial && !errors.final && !errors.tone;
            return { char: cleanCorrectWord[index], pinyinMatch, correct: { parts: correctParts, errors: { initial: false, final: false, tone: false } }, user: { parts: userParts, errors: errors } };
        });
        const correctCount = results.filter(r => r.pinyinMatch).length;
        const accuracy = (cleanCorrectWord.length > 0) ? (correctCount / cleanCorrectWord.length * 100).toFixed(0) : 0;
        const isPerfect = cleanCorrectWord.length === correctCount && cleanCorrectWord.length === cleanUserText.length;
        return { isCorrect: isPerfect, results, accuracy, cleanCorrectWord, cleanUserText, hasLengthMismatch: correctPinyin.length !== userPinyin.length };
    }, [correctWord, userText]);
    useEffect(() => { if (!analysis) return; const isSuccess = analysis.isCorrect && analysis.accuracy > 0; playSoundEffect(isSuccess ? 'correct' : 'incorrect'); }, [analysis]);
    const playUserRecording = useCallback(() => { if (audioBlobUrl) { if (_howlInstance?.playing()) _howlInstance.stop(); _howlInstance = new Howl({ src: [audioBlobUrl], html5: true }); _howlInstance.play(); } }, [audioBlobUrl]);
    const playStandard = useCallback((e) => { if (e && e.stopPropagation) e.stopPropagation(); playSegmentedTTS(analysis.cleanCorrectWord, 'zh-CN-XiaoyouNeural', 0); }, [analysis.cleanCorrectWord]);
    if (!analysis) return null;
    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #16a34a, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🌟' : '💪'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '恭喜！发音完美' : '再接再厉'}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>准确率: {analysis.accuracy}%</div>
                </div>
                <div style={styles.audioControls}>
                    <button style={styles.audioButton} onClick={playStandard}><FaPlay size={16}/> 标准发音</button>
                    {audioBlobUrl && <button style={styles.audioButton} onClick={playUserRecording}><FaPlay size={16}/> 你的录音</button>}
                </div>
                <div style={styles.errorDetailsContainer}>
                    {analysis.hasLengthMismatch && (<div style={styles.lengthError}><h3>字数不符！</h3><p>目标: <strong>{analysis.cleanCorrectWord.length} 字</strong> &bull; 你读: <strong>{analysis.cleanUserText.length} 字</strong></p></div>)}
                    <div style={styles.comparisonGrid}>{analysis.results.map((result, index) => (<div key={index} style={styles.comparisonCell}><div style={styles.comparisonChar}>{result.char}</div><div style={styles.comparisonPinyinSide}><div style={{...styles.pinyinText, color: '#000000'}}>{pinyinConverter(result.char, { toneType: 'mark', type: 'string' })}</div><span style={styles.pinyinLabel}>标准</span></div><div style={styles.comparisonPinyinSide}><div style={{...styles.pinyinText, color: result.pinyinMatch ? '#16a34a' : '#dc2626'}}>{result.user.parts.pinyinMark || '?' }</div><span style={styles.pinyinLabel}>你的发音</span></div>{!result.pinyinMatch && (<div style={styles.errorHint}>{result.user.errors.initial && <span style={styles.hintTag}>声母错</span>}{result.user.errors.final && <span style={styles.hintTag}>韵母错</span>}{result.user.errors.tone && <span style={styles.hintTag}>声调错</span>}</div>)}</div>))}</div>
                </div>
                <div style={styles.comparisonActions}>
                    {analysis.isCorrect ? (<button style={{...styles.actionButton, ...styles.continueButton}} onClick={onContinue}>继续下一个 <FaArrowRight /></button>) : (<button style={{...styles.actionButton, ...styles.retryButton}} onClick={onClose}>再试一次</button>)}
                </div>
            </div>
        </div>
    );
};

const LazyImageWithSkeleton = React.memo(({ src, alt }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const optimizedSrc = useMemo(() => {
      if (!src) return null;
      let baseSrc = src;
      if (!src.startsWith('http') && src.match(/^\d+\.jpe?g$/i)) { baseSrc = `/images/${src}`; }
      return `${baseSrc}?quality=30`;
  }, [src]);
  useEffect(() => { 
      setImageLoaded(false); 
      if (!optimizedSrc) return;
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => { setImageLoaded(true); console.error(`Image failed to load: ${optimizedSrc}`); };
      img.src = optimizedSrc;
  }, [optimizedSrc]);
  return (
    <div style={styles.imageWrapper}>
      {!imageLoaded && optimizedSrc && (<div style={styles.skeleton}><div style={styles.shimmer} /></div>)}
      {optimizedSrc && (<img src={optimizedSrc} alt={alt} style={{...styles.cardImage, opacity: imageLoaded ? 1 : 0}} loading="lazy" decoding="async"/>)}
    </div>
  );
});

const PhraseCardSettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> 6秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>);
});


// =================================================================================
// ===== 主组件: CombinedPhraseCard (入口) =========================================
// =================================================================================
const CombinedPhraseCard = ({ flashcards = [] }) => {
  const [settings, setSettings] = usePhraseCardSettings();
  
  const processedCards = useMemo(() => {
    try { 
        if (!Array.isArray(flashcards)) return []; 
        const validCards = flashcards.filter(card => card && card.chinese && card.burmese); 
        if (settings.order === 'random') { /* 随机排序逻辑 */ for (let i = validCards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [validCards[i], validCards[j]] = [validCards[j], validCards[i]]; } } 
        return validCards; 
    } catch (error) { console.error("处理 'flashcards' 出错:", error, flashcards); return []; }
  }, [flashcards, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ chinese: "示例短语", pinyin: "shì lì duǎn yǔ", burmese: "နမူနာစကားစု", burmesePhonetic: "နမူနာ", imageUrl: null }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [audioBlobUrl, setAudioBlobUrl] = useState(null);
  const [writerChar, setWriterChar] = useState(null); 
  
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const recognitionRef = useRef(null);
  
  const currentCard = cards[currentIndex]; 

  const navigate = useCallback((direction) => { 
      lastDirection.current = direction; 
      setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);
  
  const resetAutoBrowseTimer = useCallback(() => { 
      clearTimeout(autoBrowseTimerRef.current); 
      if (settings.autoBrowse && !writerChar && !isListening) { 
          autoBrowseTimerRef.current = setTimeout(() => navigate(1), 6000); 
      } 
  }, [settings.autoBrowse, writerChar, isListening, navigate]);
  
  const playBurmeseAfterChinese = useCallback(() => {
        if (settings.autoPlayBurmese && currentCard?.burmese) {
            _autoPlayTimer = setTimeout(() => {
                playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese);
            }, 300); 
        }
  }, [settings.autoPlayBurmese, currentCard, settings.voiceBurmese, settings.speechRateBurmese]);


  useEffect(() => {
      stopAllAudio(); // 切换卡片时，停止所有之前的音频
      if (settings.autoPlayChinese && currentCard?.chinese) { 
          const ttsTimer = setTimeout(() => {
            // 【核心修改】使用标准语速播放
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, playBurmeseAfterChinese);
          }, 600);
          return () => clearTimeout(ttsTimer);
      }
  }, [currentIndex, currentCard, settings.autoPlayChinese, settings.voiceChinese, settings.speechRateChinese, playBurmeseAfterChinese]);

  useEffect(() => {
    resetAutoBrowseTimer();
    return () => clearTimeout(autoBrowseTimerRef.current);
  }, [currentIndex, resetAutoBrowseTimer]);

  const cardTransitions = useTransition(currentIndex, { 
      key: currentIndex, 
      from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, 
      enter: { opacity: 1, transform: 'translateY(0%)' }, 
      leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, 
      config: { mass: 1, tension: 280, friction: 30 }, 
      onStart: () => { playSoundEffect('switch'); }, 
  });
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleListen = (e) => { 
      e.stopPropagation(); 
      stopAllAudio();

      if (isListening) { 
          mediaRecorderRef.current?.stop();
          recognitionRef.current?.stop();
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
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // 使用webm更通用
              if (_currentAudioBlobUrl) URL.revokeObjectURL(_currentAudioBlobUrl);
              _currentAudioBlobUrl = URL.createObjectURL(audioBlob); 
              setAudioBlobUrl(_currentAudioBlobUrl);
          };
          
          const recognition = new SpeechRecognition(); 
          recognition.lang = 'zh-CN'; 
          recognition.interimResults = false; 
          
          recognition.onstart = () => { setIsListening(true); setRecognizedText(''); setAudioBlobUrl(null); mediaRecorderRef.current.start(); }; 
          recognition.onresult = (event) => { 
              const transcript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，！？!?]/g, ''); 
              if (transcript) { setRecognizedText(transcript); }
              if(mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
          }; 
          
          recognition.onerror = (event) => { 
              console.error('Speech Recognition Error:', event.error);
              // 【核心修改】增加用户错误提示
              alert(`语音识别出错，请稍后再试。\n错误类型: ${event.error}`);
              setRecognizedText(''); 
              if(mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); 
          }; 
          
          recognition.onend = () => { recognitionRef.current = null; if(mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); }; 
          
          recognition.start(); 
          recognitionRef.current = recognition; 

      }).catch(err => {
          console.error("无法获取麦克风:", err);
          alert('无法启动麦克风。请检查浏览器权限设置，并确保您的网站是通过 HTTPS 访问。');
          setIsListening(false);
      });
  };

  const handleCloseComparison = useCallback(() => { setRecognizedText(''); if (_currentAudioBlobUrl) { URL.revokeObjectURL(_currentAudioBlobUrl); _currentAudioBlobUrl = null; setAudioBlobUrl(null); } }, []);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);
  
  const phoneticDisplay = useMemo(() => currentCard?.burmesePhonetic?.replace(/\s*\(.*?\)\s*/g, ''), [currentCard]);
  

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />} 
      {isSettingsOpen && <PhraseCardSettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
      
      <div style={styles.gestureArea} {...useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], event }) => { if (event.target.closest('[data-no-gesture]')) return; if (!down) { const isSignificantDrag = Math.abs(my) > 60 || (Math.abs(vy) > 0.4 && Math.abs(my) > 30); if (isSignificantDrag) { navigate(yDir < 0 ? 1 : -1); } } }, { axis: 'y' })()} />
      
      {cardTransitions((style, i) => {
        const cardData = cards[i];
        if (!cardData) return null;
        return (
          <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
            <div style={styles.cardContainer}>
              {cardData.imageUrl && <LazyImageWithSkeleton src={cardData.imageUrl} alt={cardData.chinese} />}
              <div style={styles.contentBox}>
                  {/* 中文区域 */}
                  <div style={styles.languageSection} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                      <div style={styles.pinyin}>{cardData.pinyin || pinyinConverter(cardData.chinese, { toneType: 'mark', separator: ' ' })}</div>
                      <div style={styles.textChinese}>{cardData.chinese}</div>
                      <button style={styles.playButton}><FaVolumeUp size={22} /></button>
                  </div>

                  {/* 缅文区域 */}
                  <div style={styles.languageSection} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                      {phoneticDisplay && <div style={styles.burmesePhonetic}>{phoneticDisplay}</div>}
                      <div style={styles.textBurmese}>{cardData.burmese}</div>
                      <button style={styles.playButton}><FaLanguage size={22} /></button>
                  </div>
              </div>
            </div>
          </animated.div>
        );
      })}

      {!!recognizedText && currentCard && (
          <PronunciationComparison 
              correctWord={currentCard.chinese} 
              userText={recognizedText} 
              audioBlobUrl={audioBlobUrl}
              onContinue={handleNavigateToNext} 
              onClose={handleCloseComparison} 
          />
      )}

      {currentCard && (
          <div style={styles.rightControls} data-no-gesture="true">
            <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={24} /></button>
            <button style={styles.rightIconButton} onClick={handleListen} title="发音练习"> 
                <FaMicrophone size={24} color={isListening ? '#dc2626' : '#4a5568'} /> 
            </button>
            {/* 【核心修改】唯一的笔顺按钮 */}
            <button style={styles.rightIconButton} onClick={(e) => { e.stopPropagation(); setWriterChar(currentCard.chinese); }} title="笔顺">
                <FaPenFancy size={24} />
            </button>
          </div>
      )}
    </div>
  );
};

// =================================================================================
// ===== Styles: 样式表 (采用简洁布局) ===============================================
// =================================================================================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: '#f8fafc' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: '25px' },
    imageWrapper: { width: '90%', maxWidth: '450px', height: '30vh', position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 25px rgba(0,0,0,0.1)' },
    cardImage: { width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s ease-in-out' },
    skeleton: { position: 'absolute', inset: 0, background: '#e2e8f0', overflow: 'hidden' },
    shimmer: { position: 'absolute', inset: 0, transform: 'translateX(-100%)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'shimmer 2s infinite' },
    contentBox: { width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '20px' },
    languageSection: { background: 'white', borderRadius: '16px', padding: '20px', position: 'relative', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', transition: 'transform 0.2s', textAlign: 'center' },
    pinyin: { fontSize: '1.2rem', color: '#64748b', marginBottom: '8px' },
    textChinese: { fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937', textShadow: '1px 1px 3px rgba(0,0,0,0.1)' },
    burmesePhonetic: { fontSize: '1.2rem', color: '#64748b', marginBottom: '8px', fontFamily: 'sans-serif' },
    textBurmese: { fontSize: '2.2rem', color: '#1f2937', textShadow: '1px 1px 3px rgba(0,0,0,0.1)', fontFamily: '"Padauk", "Myanmar Text", sans-serif' },
    playButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' },
    rightControls: { position: 'fixed', bottom: '15%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' },
    rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s', color: '#4a5568' },
    // ... 从 PhraseCard 复制 PronunciationComparison 和 SettingsPanel 的所有相关样式 ...
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
    comparisonPanel: { width: '90%', maxWidth: '500px', maxHeight: '90vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
    resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
    audioControls: { display: 'flex', justifyContent: 'space-around', padding: '15px 20px', borderBottom: '1px solid #e2e8f0' },
    audioButton: { padding: '10px 15px', borderRadius: '10px', background: '#f0f4f8', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' },
    lengthError: { textAlign: 'center', color: '#b91c1c', padding: '10px 0' },
    comparisonGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' },
    comparisonCell: { flex: '1 1 120px', padding: '12px', borderRadius: '12px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    comparisonChar: { fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937' },
    comparisonPinyinSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    pinyinText: { fontSize: '1.2rem', fontWeight: 500 },
    pinyinLabel: { fontSize: '0.75rem', color: '#6b7280' },
    errorHint: { display: 'flex', gap: '5px', marginTop: '5px' },
    hintTag: { fontSize: '0.65rem', padding: '2px 6px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' },
    comparisonActions: { padding: '20px', borderTop: '1px solid #e2e8f0' },
    actionButton: { width: '100%', padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    continueButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    retryButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
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

export default CombinedPhraseCard;
