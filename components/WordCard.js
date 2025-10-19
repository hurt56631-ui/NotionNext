import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaHeart, FaRegHeart, FaPlayCircle, FaUser, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal'; // 确保您项目中存在此汉字笔顺组件

// =================================================================================
// ===== IndexedDB 收藏管理模块 (保持不变) =========================================
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject('数据库打开失败');
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function toggleFavorite(word) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const existing = await new Promise((resolve) => {
    const getReq = store.get(word.id);
    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => resolve(null);
  });
  if (existing) {
    store.delete(word.id);
    return false;
  } else {
    const wordToStore = {
      id: word.id,
      chinese: word.chinese,
      burmese: word.burmese,
      pinyin: word.pinyin,
      imageUrl: word.imageUrl,
    };
    store.put(wordToStore);
    return true;
  }
}

async function isFavorite(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => resolve(!!getReq.result);
    getReq.onerror = () => resolve(false);
  });
}

// =================================================================================
// ===== 辅助工具 & 常量 (TTS 函数保持不变) ==========================================
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
  recordStart: new Howl({ src: ['/sounds/record-start.mp3'], volume: 0.7 }),
  recordStop: new Howl({ src: ['/sounds/record-stop.mp3'], volume: 0.7 }),
};
let _howlInstance = null;

const playTTS = async (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) {
        if (onEndCallback) onEndCallback();
        return;
    }
    if (_howlInstance?.playing()) _howlInstance.stop();
    const apiUrl = 'https://libretts.is-an.org/api/tts';
    const rateValue = Math.round(rate / 2);
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }),
        });
        if (!response.ok) throw new Error(`TTS API request failed: ${response.status}`);
        const audioBlob = await response.blob();
        if (!audioBlob.type.startsWith('audio/')) throw new Error(`Invalid audio type: ${audioBlob.type}`);
        const audioUrl = URL.createObjectURL(audioBlob);
        _howlInstance = new Howl({
            src: [audioUrl], format: ['mpeg'], html5: true,
            onend: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); },
            onloaderror: (id, err) => { console.error('Howler load error:', err); URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); },
            onplayerror: (id, err) => { console.error('Howler play error:', err); URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); }
        });
        _howlInstance.play();
    } catch (error) {
        console.error('TTS fetch error:', error);
        if (onEndCallback) onEndCallback();
    }
};

const playSoundEffect = (type) => {
    if (sounds[type]) sounds[type].play();
};

const formatPinyin = (rawPinyinNum) => {
    if (!rawPinyinNum) return '';
    if (/[āēīōūǖáéíóúǘǎěǐǒǔǚàèìòùǜ]/.test(rawPinyinNum)) return rawPinyinNum;
    try {
        return pinyinConverter(rawPinyinNum, { toneType: 'symbol', separator: ' ' });
    } catch (e) {
        return rawPinyinNum;
    }
};

// =================================================================================
// ===== 自定义 Hook (保持不变) ======================================================
// =================================================================================

const useCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('learningWordCardSettings');
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
  useEffect(() => { try { localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) { console.error("保存设置失败", error); } }, [settings]);
  return [settings, setSettings];
};


// =================================================================================
// ===== [全新] 简洁版发音对比组件 =================================================
// =================================================================================
const PronunciationComparison = React.memo(({ correctWord, userText, userAudioUrl, onContinue, onClose, onPlayStandard }) => {
    const analysis = useMemo(() => {
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });

        if (correctPinyin.length === 0 || userPinyin.length === 0) {
            return { isCorrect: false, message: '无法识别有效发音' };
        }
        if (correctPinyin.length !== userPinyin.length) {
            return { isCorrect: false, message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
        }

        const results = correctPinyin.map((correctPy, index) => {
            const userPy = userPinyin[index];
            const isMatch = correctPy === userPy;
            return {
                char: correctWord[index],
                isMatch,
                correctPinyin: formatPinyin(correctPy),
                userPinyin: formatPinyin(userPy),
            };
        });

        const isCorrect = results.every(r => r.isMatch);
        const accuracy = (results.filter(r => r.isMatch).length / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText]);

    const playUserAudio = useCallback(() => {
        if (userAudioUrl) {
            const audio = new Audio(userAudioUrl);
            audio.play();
        }
    }, [userAudioUrl]);

    useEffect(() => {
        playSoundEffect(analysis.isCorrect ? 'correct' : 'incorrect');
    }, [analysis.isCorrect]);

    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '发音完美！' : `准确率: ${analysis.accuracy}%`}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>{analysis.isCorrect ? '太棒了！' : '再接再厉！'}</div>
                </div>

                <div style={styles.errorDetailsContainer}>
                    {analysis.message ? (
                        <div style={styles.lengthError}><h3>{analysis.message}</h3></div>
                    ) : (
                        <div style={styles.comparisonGrid}>
                            {analysis.results.map((result, index) => (
                                <div key={index} style={{...styles.comparisonCell, borderColor: result.isMatch ? '#34d399' : '#f87171'}}>
                                    <div style={styles.comparisonChar}>{result.char}</div>
                                    <div style={styles.comparisonPinyinRow}>
                                        <span style={styles.pinyinLabel}>标准:</span>
                                        <span style={{...styles.pinyinText, color: '#10b981'}}>{result.correctPinyin}</span>
                                        {result.isMatch ? <FaCheckCircle color="#10b981" /> : <FaTimesCircle color="#ef4444"/>}
                                    </div>
                                    {!result.isMatch && (
                                        <div style={styles.comparisonPinyinRow}>
                                            <span style={styles.pinyinLabel}>你的:</span>
                                            <span style={{...styles.pinyinText, color: '#ef4444'}}>{result.userPinyin}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={styles.audioPlaybackSection}>
                    <button onClick={onPlayStandard} style={{...styles.playbackButton, ...styles.standardButton}}><FaPlayCircle /> 听标准发音</button>
                    {userAudioUrl && <button onClick={playUserAudio} style={{...styles.playbackButton, ...styles.userButton}}><FaUser /> 听我的录音</button>}
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
});


// =================================================================================
// ===== 设置组件 (保持不变) ========================================================
// =================================================================================
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>);
});


// =================================================================================
// ===== 主组件: WordCard (已集成录音功能) =========================================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  
  const storageKey = `wordCardProgress_${progressKey}`;

  const processedCards = useMemo(() => {
    const mapped = words.map(w => ({ id: w.id, chinese: w.chinese, burmese: w.burmese, pinyin: w.pinyin, imageUrl: w.imageUrl }));
    if (settings.order === 'random') {
        for (let i = mapped.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
        }
    }
    return mapped.length > 0 ? mapped : [{ id: 'fallback', chinese: "暂无单词", pinyin: "zàn wú dān cí", burmese: "..." }];
  }, [words, settings.order]);

  const cards = processedCards;
  
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
        const savedIndex = localStorage.getItem(storageKey);
        return savedIndex ? parseInt(savedIndex, 10) : 0;
    } catch (error) { return 0; }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [userAudioUrl, setUserAudioUrl] = useState(null);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const currentCard = cards[currentIndex];

  useEffect(() => {
    if (currentIndex >= cards.length && cards.length > 0) {
        setCurrentIndex(0);
        localStorage.setItem(storageKey, '0');
    } else {
        localStorage.setItem(storageKey, currentIndex);
    }
  }, [currentIndex, cards.length, storageKey]);

  useEffect(() => {
    if (currentCard?.id && currentCard.id !== 'fallback') {
      isFavorite(currentCard.id).then(setIsFavoriteCard);
    }
  }, [currentCard]);
  
  const handleToggleFavorite = async () => {
    if (!currentCard || currentCard.id === 'fallback') return;
    const result = await toggleFavorite(currentCard);
    setIsFavoriteCard(result);
  };

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
                } else { startAutoBrowseTimer(); }
            });
        } else if (settings.autoPlayBurmese && currentCard?.burmese) {
            playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer);
        } else { startAutoBrowseTimer(); }
    };
    const startAutoBrowseTimer = () => {
        if (settings.autoBrowse) {
            autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay);
        }
    };
    const initialPlayTimer = setTimeout(playSequence, 600);
    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate]);
  
  const handlePronunciationPractice = useCallback(async (e) => {
      e.stopPropagation();
      if (_howlInstance?.playing()) _howlInstance.stop();

      if (isRecording) {
          mediaRecorderRef.current?.stop();
          recognitionRef.current?.stop();
          playSoundEffect('recordStop');
          return;
      }
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition || !navigator.mediaDevices?.getUserMedia) {
          alert('抱歉，您的浏览器不支持录音或语音识别功能。');
          return;
      }

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          playSoundEffect('recordStart');
          
          // --- Speech Recognition Setup ---
          const recognition = new SpeechRecognition();
          recognition.lang = 'zh-CN';
          recognition.interimResults = false;
          recognition.onresult = (event) => {
              const transcript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，]/g, '');
              if (transcript) setRecognizedText(transcript);
          };
          recognition.onerror = (event) => console.error(`语音识别出错: ${event.error}`);
          recognition.onend = () => { recognitionRef.current = null; };
          
          // --- Media Recorder Setup ---
          mediaRecorderRef.current = new MediaRecorder(stream);
          audioChunksRef.current = [];
          mediaRecorderRef.current.ondataavailable = (event) => {
              audioChunksRef.current.push(event.data);
          };
          mediaRecorderRef.current.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const audioUrl = URL.createObjectURL(audioBlob);
              setUserAudioUrl(audioUrl); // 保存录音URL
              stream.getTracks().forEach(track => track.stop()); // 关闭麦克风
              setIsRecording(false);
          };

          // Start both
          mediaRecorderRef.current.start();
          recognition.start();
          recognitionRef.current = recognition;
          setIsRecording(true);

      } catch (err) {
          alert(`无法访问麦克风: ${err.message}`);
          console.error("麦克风权限错误: ", err);
      }
  }, [isRecording]);

  const handleCloseComparison = useCallback(() => {
      setRecognizedText('');
      if (userAudioUrl) {
          URL.revokeObjectURL(userAudioUrl);
          setUserAudioUrl(null);
      }
  }, [userAudioUrl]);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);
  
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (recognitionRef.current) recognitionRef.current.stop();
      if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
    };
  }, [userAudioUrl]);

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
  
  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
      if (event.target.closest('[data-no-gesture]')) return;
      if (down) return;
      event.stopPropagation(); 
      const isHorizontal = Math.abs(mx) > Math.abs(my);
      if (isHorizontal) {
          if (Math.abs(mx) > 80 || (vel > 0.5 && Math.abs(mx) > 40)) { onClose(); }
      } else {
          if (Math.abs(my) > 60 || (vel > 0.4 && Math.abs(my) > 30)) { navigate(yDir < 0 ? 1 : -1); }
      }
  }, { filterTaps: true, preventDefault: true, threshold: 10 });

  const cardContent = pageTransitions((style, item) =>
    item && (
      <animated.div style={{ ...styles.fullScreen, ...style }}>
        <div style={styles.gestureArea} {...bind()} />
        
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {!!recognizedText && currentCard && (
            <PronunciationComparison 
                correctWord={currentCard.chinese} 
                userText={recognizedText} 
                userAudioUrl={userAudioUrl}
                onContinue={handleNavigateToNext} 
                onClose={handleCloseComparison}
                onPlayStandard={() => playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese)}
            />
        )}
        
        {cardTransitions((cardStyle, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...cardStyle }}>
              <div style={styles.cardContainer}>
                  <div style={{ textAlign: 'center' }}>
                      <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                          <div style={styles.pinyin}>{formatPinyin(cardData.pinyin)}</div>
                          <div style={styles.textWordChinese}>{cardData.chinese}</div> 
                      </div>
                      <div style={{ cursor: 'pointer', marginTop: '2.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                          <div style={styles.textWordBurmese}>{cardData.burmese}</div>
                      </div>
                  </div>
              </div>
            </animated.div>
          );
        })}

        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={20} /></button>
                <button style={styles.rightIconButton} onClick={handlePronunciationPractice} title="发音练习">
                    <div style={isRecording ? styles.recordingIndicator : {}}>
                        <FaMicrophone size={20} color={isRecording ? '#fff' : '#4a5568'} />
                    </div>
                </button>
                {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( 
                    <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺"><FaPenFancy size={20} /></button>
                )}
                <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>
                  {isFavoriteCard ? <FaHeart size={20} color="#f87171" /> : <FaRegHeart size={20} />}
                </button>
                <button style={styles.exitButtonInControls} onClick={onClose} title="关闭"><FaTimes size={22} color='#4a5568'/></button>
            </div>
        )}
        
        {cards.length > 0 && (
            <div style={styles.bottomCenterCounter} data-no-gesture="true">
                {currentIndex + 1} / {cards.length}
            </div>
        )}
      </animated.div>
    )
  );

  if (isMounted) return createPortal(cardContent, document.body);
  return null;
};

// =================================================================================
// ===== [更新] 样式表 =============================================================
// =================================================================================
const styles = {
    // --- 核心布局样式 (无变化) ---
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: 'url(/background.jpg) center/cover no-repeat', backgroundAttachment: 'fixed', backgroundColor: '#004d40' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '4.5rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    textWordBurmese: { fontSize: '3.5rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    // --- 控件样式 (新增录音指示器) ---
    rightControls: { position: 'fixed', bottom: '20px', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' },
    rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s, background-color 0.3s', color: '#4a5568' },
    recordingIndicator: { width: '100%', height: '100%', borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' },
    exitButtonInControls: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '15px' },
    bottomCenterCounter: { position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(255, 255, 255, 0.2)', color: 'white', padding: '5px 15px', borderRadius: '15px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(3px)' },
    // --- [全新] 简洁版对比界面样式 ---
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '15px' },
    comparisonPanel: { width: '100%', maxWidth: '500px', maxHeight: '90vh', background: '#f8fafc', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
    resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
    errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: '1' },
    lengthError: { textAlign: 'center', color: '#b91c1c', padding: '10px 0' },
    comparisonGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', justifyContent: 'center' },
    comparisonCell: { padding: '15px', borderRadius: '12px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', border: '2px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    comparisonChar: { fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' },
    comparisonPinyinRow: { display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' },
    pinyinLabel: { fontSize: '0.8rem', color: '#64748b' },
    pinyinText: { fontSize: '1.2rem', fontWeight: 500 },
    // --- [新增] 录音播放部分样式 ---
    audioPlaybackSection: { display: 'flex', gap: '10px', padding: '0 20px 20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' },
    playbackButton: { flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.2s' },
    standardButton: { background: '#e0f2fe', color: '#0369a1' },
    userButton: { background: '#fef3c7', color: '#b45309' },
    // --- 按钮与设置样式 (无变化) ---
    comparisonActions: { padding: '20px', borderTop: '1px solid #e2e8f0' },
    actionButton: { width: '100%', padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    continueButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    retryButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
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

export default WordCard;
