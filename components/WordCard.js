// components/WordCard.js (最终稳定版 - 已修复资源冲突和生命周期问题)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaHeart, FaRegHeart, FaPlayCircle } from 'react-icons/fa';
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
    return false; // 已取消收藏
  } else {
    const wordToStore = {
      id: word.id,
      chinese: word.chinese,
      burmese: word.burmese,
      pinyin: word.pinyin,
      imageUrl: word.imageUrl,
    };
    store.put(wordToStore);
    return true; // 收藏成功
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
// ===== 辅助工具 & 常量 (保持不变) ================================================
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
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const audioBlob = await response.blob();
        if (!audioBlob.type.startsWith('audio/')) throw new Error('Invalid audio type');
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
// ===== 自定义 Hook & 子组件 (保持不变) ===========================================
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

const PinyinVisualizer = React.memo(({ analysis, isCorrect }) => {
    const { parts, errors } = analysis;
    const initialStyle = !isCorrect && parts.initial && errors.initial ? styles.wrongPart : {};
    const finalStyle = !isCorrect && parts.final && errors.final ? styles.wrongPart : {};
    const toneStyle = !isCorrect && parts.tone !== '0' && errors.tone ? styles.wrongPart : {};
    
    let finalDisplay = parts.pinyinMark.replace(parts.initial, '').replace(' ', '');
    if (!finalDisplay || parts.pinyinMark === parts.rawPinyin) { finalDisplay = parts.final; }
    finalDisplay = finalDisplay.replace(/[1-5]$/, '');

    return (
        <div style={styles.pinyinVisualizerContainer}>
            <span style={{...styles.pinyinPart, ...initialStyle}}>{parts.initial || ''}</span>
            <span style={{...styles.pinyinPart, ...finalStyle}}>{finalDisplay}</span>
            <span style={{...styles.pinyinPart, ...styles.toneNumber, ...toneStyle}}>{parts.tone}</span>
        </div>
    );
});

const PronunciationComparison = ({ correctWord, userText, userAudioURL, settings, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });
        if (correctPinyin.length === 0 || userPinyin.length === 0) return { isCorrect: false, error: 'NO_PINYIN', message: '无法识别有效发音' };
        if (correctPinyin.length !== userPinyin.length) return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
        
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
            return { char: correctWord[index], pinyinMatch, correct: { parts: correctParts }, user: { parts: userParts, errors } };
        });
        const isCorrect = results.every(r => r.pinyinMatch);
        const accuracy = (results.filter(r => r.pinyinMatch).length / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText]);

    useEffect(() => { if (analysis) playSoundEffect(analysis.isCorrect ? 'correct' : 'incorrect'); }, [analysis]);

    const playUserAudio = useCallback(() => {
        if (userAudioURL) {
            if (_howlInstance?.playing()) _howlInstance.stop();
            const sound = new Howl({ src: [userAudioURL], html5: true });
            sound.play();
        }
    }, [userAudioURL]);

    const playCorrectTTS = useCallback(() => {
        playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese);
    }, [correctWord, settings]);

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
                                    <div style={styles.comparisonPinyinGroup}>
                                        <div style={styles.pinyinLabel}>标准</div>
                                        <PinyinVisualizer analysis={result.correct} isCorrect={true} />
                                    </div>
                                    <div style={styles.comparisonPinyinGroup}>
                                        <div style={styles.pinyinLabel}>你的发音</div>
                                        <PinyinVisualizer analysis={result.user} isCorrect={result.pinyinMatch} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={styles.audioComparisonSection}>
                    <button style={styles.audioPlayerButton} onClick={playCorrectTTS}><FaPlayCircle size={18} /> 标准发音</button>
                    {userAudioURL && <button style={styles.audioPlayerButton} onClick={playUserAudio}><FaPlayCircle size={18} /> 你的录音</button>}
                </div>

                <div style={styles.comparisonActions}>
                    {analysis.isCorrect ? (<button style={{...styles.actionButton, ...styles.continueButton}} onClick={onContinue}>继续下一个 <FaArrowRight /></button>) : (<button style={{...styles.actionButton, ...styles.retryButton}} onClick={onClose}>再试一次</button>)}
                </div>
            </div>
        </div>
    );
};


const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>);
});

const JumpModal = ({ max, current, onJump, onClose }) => {
    const [inputValue, setInputValue] = useState(current + 1);
    const inputRef = useRef(null);
    
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleJump = () => {
        const num = parseInt(inputValue, 10);
        if (num >= 1 && num <= max) {
            onJump(num - 1);
        } else {
            alert(`请输入 1 到 ${max} 之间的数字`);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleJump();
    };

    return (
        <div style={styles.jumpModalOverlay} onClick={onClose}>
            <div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}>
                <h3 style={styles.jumpModalTitle}>跳转到卡片</h3>
                <input
                    ref={inputRef}
                    type="number"
                    style={styles.jumpModalInput}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    min="1"
                    max={max}
                />
                <button style={styles.jumpModalButton} onClick={handleJump}>跳转</button>
            </div>
        </div>
    );
};


// =================================================================================
// ===== 主组件: WordCard ==========================================================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  const storageKey = `wordCardProgress_${progressKey}`;

  const processedCards = useMemo(() => {
    try {
        const mapped = words.map(w => ({
            id: w.id, chinese: w.chinese, burmese: w.burmese, pinyin: w.pinyin, imageUrl: w.imageUrl,
        }));
        if (settings.order === 'random') {
            for (let i = mapped.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
            }
        }
        return mapped;
    } catch (error) { console.error("处理卡片数据出错:", error); return []; }
  }, [words, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "暂无单词", burmese: "..." }];
  
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window !== 'undefined') {
        try {
            const savedIndex = localStorage.getItem(storageKey);
            const index = savedIndex ? parseInt(savedIndex, 10) : 0;
            return index < cards.length ? index : 0;
        } catch (error) { console.error("读取进度失败", error); return 0; }
    }
    return 0;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [userAudioURL, setUserAudioURL] = useState(null);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  
  const lastDirection = useRef(0);
  const autoBrowseTimerRef = useRef(null);

  // Refs for managing API instances and the audio stream
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  const currentCard = cards[currentIndex];

  useEffect(() => { if (typeof window !== 'undefined') { localStorage.setItem(storageKey, currentIndex); } }, [currentIndex, storageKey]);
  useEffect(() => { if (currentCard?.id && currentCard.id !== 'fallback') { isFavorite(currentCard.id).then(setIsFavoriteCard); } }, [currentCard]);
  
  const handleToggleFavorite = async () => {
    if (!currentCard || currentCard.id === 'fallback') return;
    setIsFavoriteCard(await toggleFavorite(currentCard));
  };

  const navigate = useCallback((direction) => {
      lastDirection.current = direction;
      setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);

  const handleJumpToCard = (index) => {
    if (index >= 0 && index < cards.length) {
        lastDirection.current = index > currentIndex ? 1 : -1;
        setCurrentIndex(index);
    }
    setIsJumping(false);
  };

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
  
  // ✅ [核心修复] 重写后的、健壮的语音识别与录音处理函数
  const handleListen = useCallback(async (e) => {
      e.stopPropagation();
      if (_howlInstance?.playing()) _howlInstance.stop();

      // 如果正在监听，则停止。让 onend 事件处理所有清理工作。
      if (isListening) {
          recognitionRef.current?.stop();
          return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert('抱歉，您的浏览器不支持语音识别。');
          return;
      }
      
      try {
          // 1. 获取麦克风音频流
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = stream;

          // 2. 初始化 SpeechRecognition
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          recognition.lang = 'zh-CN';
          recognition.interimResults = false;
          
          // 3. 初始化 MediaRecorder
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          // 4. 定义事件处理器
          
          // 当录音机数据可用时，收集数据块
          recorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          // 当录音机停止时，创建并设置音频URL
          recorder.onstop = () => {
              if (audioChunksRef.current.length > 0) {
                  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                  const audioUrl = URL.createObjectURL(audioBlob);
                  setUserAudioURL(audioUrl);
              }
          };
          
          // 当语音识别开始时
          recognition.onstart = () => {
              // 清理上一次的录音URL
              if (userAudioURL) URL.revokeObjectURL(userAudioURL);
              // 重置状态
              setRecognizedText('');
              setUserAudioURL(null);
              setIsListening(true);
              // 同步启动录音机
              recorder.start();
          };

          // 当有识别结果时
          recognition.onresult = (event) => {
              const transcript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，]/g, '');
              if (transcript) {
                  setRecognizedText(transcript);
              }
          };

          // 当识别过程结束时（无论是正常结束、手动停止还是出错）
          // 这是最关键的统一清理点！
          recognition.onend = () => {
              // 确保录音机一定停止
              if (recorder.state === 'recording') {
                  recorder.stop();
              }
              // 确保麦克风轨道一定关闭
              if (audioStreamRef.current) {
                  audioStreamRef.current.getTracks().forEach(track => track.stop());
              }
              // 清理引用并重置UI状态
              recognitionRef.current = null;
              mediaRecorderRef.current = null;
              audioStreamRef.current = null;
              setIsListening(false);
          };

          // 当发生错误时
          recognition.onerror = (event) => {
              console.error('语音识别错误:', event.error);
              let errorMessage = `语音识别出错: ${event.error}`;
              if (event.error === 'no-speech') errorMessage = '没有检测到语音，请靠近麦克风再说一次。';
              else if (event.error === 'not-allowed') errorMessage = '无法使用麦克风，请检查浏览器权限。';
              alert(errorMessage);
              // onerror 后通常会自动触发 onend，所以清理工作会由 onend 完成
          };
          
          // 5. 启动语音识别
          recognition.start();

      } catch (err) {
          console.error("无法获取麦克风权限:", err);
          alert("无法获取麦克风权限，请检查您的浏览器设置。");
          setIsListening(false);
      }
  }, [isListening, userAudioURL]); // 移除了不必要的依赖，仅保留isListening和userAudioURL（用于清理）

  const handleCloseComparison = useCallback(() => {
      if (userAudioURL) URL.revokeObjectURL(userAudioURL);
      setRecognizedText('');
      setUserAudioURL(null);
  }, [userAudioURL]);

  const handleNavigateToNext = useCallback(() => { 
      handleCloseComparison(); 
      setTimeout(() => navigate(1), 100); 
  }, [handleCloseComparison, navigate]);
  
  // 组件卸载时，确保所有资源都被释放
  useEffect(() => {
      return () => {
          if (recognitionRef.current) recognitionRef.current.stop();
          if (audioStreamRef.current) {
              audioStreamRef.current.getTracks().forEach(track => track.stop());
          }
      };
  }, []);
  
  const pageTransitions = useTransition(isOpen, {
    from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 },
  });

  const cardTransitions = useTransition(currentIndex, {
      key: currentIndex, from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, config: { mass: 1, tension: 280, friction: 30 }, onStart: () => playSoundEffect('switch'),
  });
  
  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
      if (event.target.closest('[data-no-gesture]')) return;
      if (down) return;
      event.stopPropagation(); 
      const isHorizontal = Math.abs(mx) > Math.abs(my);
      if (isHorizontal) { if (Math.abs(mx) > 80 || (vel > 0.5 && Math.abs(mx) > 40)) onClose(); } 
      else { if (Math.abs(my) > 60 || (vel > 0.4 && Math.abs(my) > 30)) navigate(yDir < 0 ? 1 : -1); }
  }, { filterTaps: true, preventDefault: true, threshold: 10 });

  const cardContent = pageTransitions((style, item) =>
    item && (
      <animated.div style={{ ...styles.fullScreen, ...style }}>
        <div style={styles.gestureArea} {...bind()} />
        
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {!!recognizedText && currentCard && (<PronunciationComparison correctWord={currentCard.chinese} userText={recognizedText} userAudioURL={userAudioURL} settings={settings} onContinue={handleNavigateToNext} onClose={handleCloseComparison} />)}
        {isJumping && <JumpModal max={cards.length} current={currentIndex} onJump={handleJumpToCard} onClose={() => setIsJumping(false)} />}
        
        {cardTransitions((cardStyle, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...cardStyle }}>
              <div style={styles.cardContainer}>
                  <div style={{ textAlign: 'center' }}>
                      <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                          <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
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
                <button style={styles.rightIconButton} onClick={handleListen} title="发音练习"><FaMicrophone size={20} color={isListening ? '#dc2626' : '#4a5568'} /></button>
                {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( 
                    <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺"><FaPenFancy size={20} /></button>
                )}
                <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>
                  {isFavoriteCard ? <FaHeart size={20} color="#f87171" /> : <FaRegHeart size={20} />}
                </button>
            </div>
        )}
        
        {cards.length > 0 && (
            <div style={styles.bottomCenterCounter} data-no-gesture="true" onClick={() => setIsJumping(true)}>
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
// ===== 样式表 (保持不变) ==========================================================
// =================================================================================
const styles = {
    // --- 核心布局 ---
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: 'url(/background.jpg) center/cover no-repeat', backgroundAttachment: 'fixed', backgroundColor: '#004d40' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    
    // --- 卡片内容 ---
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '4.5rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    textWordBurmese: { fontSize: '2.2rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    
    // --- 控件与计数器 ---
    rightControls: { position: 'fixed', bottom: '50%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', transform: 'translateY(50%)' },
    rightIconButton: { background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'transform 0.2s, background 0.2s', color: '#4a5568', backdropFilter: 'blur(4px)' },
    bottomCenterCounter: { position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(0, 0, 0, 0.3)', color: 'white', padding: '8px 18px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(5px)', cursor: 'pointer', userSelect: 'none' },
    
    // --- 发音对比面板 ---
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '15px' },
    comparisonPanel: { width: '100%', maxWidth: '500px', maxHeight: '90vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
    resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
    errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: 1 },
    lengthError: { textAlign: 'center', color: '#b91c1c', padding: '10px 0' },
    comparisonGrid: { display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' },
    comparisonCell: { flex: '1 1 120px', padding: '12px', borderRadius: '12px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' },
    comparisonChar: { fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' },
    comparisonPinyinGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' },
    pinyinVisualizerContainer: { display: 'flex', alignItems: 'baseline', fontSize: '1.5rem', height: '1.8rem', color: '#333' },
    pinyinPart: { transition: 'color 0.3s', fontWeight: 500 },
    toneNumber: { fontSize: '1.1rem', fontWeight: 'bold', marginLeft: '2px' },
    wrongPart: { color: '#dc2626', fontWeight: 'bold' },
    pinyinLabel: { fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' },
    audioComparisonSection: { display: 'flex', gap: '15px', justifyContent: 'center', padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8f9fa' },
    audioPlayerButton: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderRadius: '12px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151', fontWeight: 600 },
    comparisonActions: { padding: '20px' },
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

    // --- 跳转弹窗 ---
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002 },
    jumpModalContent: { background: 'white', padding: '25px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    jumpModalTitle: { marginTop: 0, marginBottom: '15px', color: '#333' },
    jumpModalInput: { width: '100px', padding: '10px', fontSize: '1.2rem', textAlign: 'center', border: '2px solid #ccc', borderRadius: '8px', marginBottom: '15px' },
    jumpModalButton: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#4299e1', color: 'white', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};

export default WordCard;
