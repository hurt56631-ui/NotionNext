// components/WordCard.js (Rewritten to include sentences, decomposition, and mnemonics for Burmese learners)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaHeart, FaRegHeart, FaPlayCircle, FaStop } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// ===== IndexedDB 收藏管理模块 (No changes) =======================================
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
    // Store all available data for favorites
    const wordToStore = { ...word };
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
// ===== 辅助工具 & 常量 (No changes) ===============================================
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
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; }
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
// ===== 子组件 (No changes) ========================================================
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
        <div style={styles.pinyinVisualizerContainer}><span style={{...styles.pinyinPart, ...initialStyle}}>{parts.initial || ''}</span><span style={{...styles.pinyinPart, ...finalStyle}}>{finalDisplay}</span><span style={{...styles.pinyinPart, ...styles.toneNumber, ...toneStyle}}>{parts.tone}</span></div>
    );
});

const PronunciationComparison = ({ correctWord, userText, settings, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        if (!userText) { return { isCorrect: false, error: 'NO_PINYIN', message: '未能识别有效发音' }; }
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });
        if (correctPinyin.length === 0 || userPinyin.length === 0) return { isCorrect: false, error: 'NO_PINYIN', message: '未能识别有效发音' };
        if (correctPinyin.length !== userPinyin.length) return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
        const results = correctPinyin.map((correctPy, index) => {
            const userPy = userPinyin[index];
            const correctParts = parsePinyin(correctPy);
            const userParts = parsePinyin(userPy);
            const errors = { initial: (correctParts.initial || userParts.initial) && (correctParts.initial !== userParts.initial), final: correctParts.final !== userParts.final, tone: correctParts.tone !== userParts.tone };
            const pinyinMatch = !errors.initial && !errors.final && !errors.tone;
            return { char: correctWord[index], pinyinMatch, correct: { parts: correctParts }, user: { parts: userParts, errors } };
        });
        const isCorrect = results.every(r => r.pinyinMatch);
        const accuracy = (results.filter(r => r.pinyinMatch).length / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText]);

    const [isRecording, setIsRecording] = useState(false);
    const [userRecordingUrl, setUserRecordingUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    useEffect(() => { if (analysis && analysis.results) playSoundEffect(analysis.isCorrect ? 'correct' : 'incorrect'); }, [analysis]);
    const handleRecord = useCallback(async () => {
        if (isRecording) { mediaRecorderRef.current?.stop(); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            const chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setUserRecordingUrl(url);
                streamRef.current?.getTracks().forEach(track => track.stop());
                setIsRecording(false);
            };
            recorder.start();
            setIsRecording(true);
        } catch (err) { console.error("录音初始化失败:", err); alert("请检查麦克风权限。"); }
    }, [isRecording]);
    const playUserAudio = useCallback(() => { if (userRecordingUrl) { if (_howlInstance?.playing()) _howlInstance.stop(); const sound = new Howl({ src: [userRecordingUrl], html5: true }); sound.play(); } }, [userRecordingUrl]);
    const playCorrectTTS = useCallback(() => { playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese); }, [correctWord, settings]);
    useEffect(() => { return () => { if (userRecordingUrl) { URL.revokeObjectURL(userRecordingUrl); } }; }, [userRecordingUrl]);
    if (!analysis) return null;
    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '发音完美！' : `准确率: ${analysis.accuracy}%`}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>{analysis.isCorrect ? '太棒了！' : '再接再厉！'}</div>
                </div>
                <div style={styles.errorDetailsContainer}>{analysis.error ? (<div style={styles.lengthError}><h3>{analysis.message}</h3></div>) : (<div style={styles.comparisonGrid}>{analysis.results.map((result, index) => (<div key={index} style={styles.comparisonCell}><div style={styles.comparisonChar}>{result.char}</div><div style={styles.comparisonPinyinGroup}><div style={styles.pinyinLabel}>标准</div><PinyinVisualizer analysis={result.correct} isCorrect={true} /></div><div style={styles.comparisonPinyinGroup}><div style={styles.pinyinLabel}>你的发音</div><PinyinVisualizer analysis={result.user} isCorrect={result.pinyinMatch} /></div></div>))}</div>)}</div>
                <div style={styles.audioComparisonSection}>
                    <button style={styles.audioPlayerButton} onClick={playCorrectTTS}><FaPlayCircle size={18} /> 标准发音</button>
                    <button style={{...styles.audioPlayerButton, ...(isRecording ? {color: '#dc2626'} : {})}} onClick={handleRecord}>{isRecording ? <FaStop size={18} /> : <FaMicrophone size={18} />} {isRecording ? '停止录音' : '录音对比'}</button>
                    {userRecordingUrl && <button style={styles.audioPlayerButton} onClick={playUserAudio}><FaPlayCircle size={18} /> 你的录音</button>}
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
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);
    const handleJump = () => {
        const num = parseInt(inputValue, 10);
        if (num >= 1 && num <= max) { onJump(num - 1); } 
        else { alert(`请输入 1 到 ${max} 之间的数字`); }
    };
    const handleKeyDown = (e) => { if (e.key === 'Enter') handleJump(); };
    return (
        <div style={styles.jumpModalOverlay} onClick={onClose}><div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}><h3 style={styles.jumpModalTitle}>跳转到卡片</h3><input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} min="1" max={max} /><button style={styles.jumpModalButton} onClick={handleJump}>跳转</button></div></div>
    );
};

// =================================================================================
// ===== 主组件: WordCard (✨ Rewritten with new features) ========================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  
  // ✨ [New] Augment incoming words data with detailed info for demonstration
  // In a real application, this data should come from your database/API.
  const augmentedWords = useMemo(() => {
    return words.map(word => {
      if (word.chinese === '好') {
        return {
          ...word,
          sentence_ch: '你好吗？',
          sentence_mm: 'နေကောင်းလား?',
          decomposition: [
            { char: '女', pinyin: 'nǚ', meaning: 'အမျိုးသမီး' },
            { char: '子', pinyin: 'zǐ', meaning: 'ကလေး' }
          ],
          mnemonic: 'အမျိုးသမီး (女) တစ်ယောက်နဲ့ ကလေး (子) တစ်ယောက် အတူတူရှိနေတာက ကောင်းတဲ့ (好) အရာတစ်ခုပါ။'
        };
      }
      if (word.chinese === '电脑') {
        return {
          ...word,
          sentence_ch: '我的电脑很新。',
          sentence_mm: 'ကျွန်တော့်ကွန်ပျူတာက အသစ်ကြီးပဲ။',
          decomposition: [
            { char: '电', pinyin: 'diàn', meaning: 'လျှပ်စစ်' },
            { char: '脑', pinyin: 'nǎo', meaning: 'ဦးနှောက်' }
          ],
          mnemonic: 'လျှပ်စစ် (电) နဲ့ အလုပ်လုပ်တဲ့ ဦးနှောက် (脑) က ကွန်ပျူတာ (电脑) ပါပဲ။'
        };
      }
      return word; // Return original word if no extra data is available
    });
  }, [words]);
  
  const knownWordsStorageKey = `knownWords_${progressKey}`;
  const [knownWords, setKnownWords] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(knownWordsStorageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const activeCards = useMemo(() => {
    // Use augmentedWords which contains the new fields
    const filtered = augmentedWords.filter(w => !knownWords.has(w.id));
    if (filtered.length === 0 && augmentedWords.length > 0) {
        return [{ id: 'finished', chinese: "太棒了!", burmese: "သင်ခန်းစာအားလုံးပြီးပါပြီ။", pinyin: 'tài bàng le' }];
    }
    // No need to map again, filtered already has all data
    if (settings.order === 'random') {
      for (let i = filtered.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [filtered[i], filtered[j]] = [filtered[j], filtered[i]]; }
    }
    return filtered.length > 0 ? filtered : [{ id: 'fallback', chinese: "暂无单词", burmese: "..." }];
  }, [augmentedWords, knownWords, settings.order]);

  const cards = activeCards;
  const storageKey = `wordCardProgress_${progressKey}`;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => { setCurrentIndex(0); }, [cards]);

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  
  const recognitionRef = useRef(null);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const currentCard = cards[currentIndex];

  useEffect(() => { localStorage.setItem(storageKey, currentIndex); }, [currentIndex, storageKey]);
  useEffect(() => { if (currentCard?.id && currentCard.id !== 'fallback' && currentCard.id !== 'finished') { isFavorite(currentCard.id).then(setIsFavoriteCard); } }, [currentCard]);
  
  const handleToggleFavorite = async () => { if (!currentCard || currentCard.id === 'fallback') return; setIsFavoriteCard(await toggleFavorite(currentCard)); };
  
  const navigate = useCallback((direction) => {
    lastDirection.current = direction;
    setDetailsVisible(false);
    setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);

  const handleJumpToCard = (index) => { if (index >= 0 && index < cards.length) { lastDirection.current = index > currentIndex ? 1 : -1; setDetailsVisible(false); setCurrentIndex(index); } setIsJumping(false); };

  const handleKnowWord = () => {
    if (!currentCard || currentCard.id === 'fallback' || currentCard.id === 'finished') return;
    playSoundEffect('correct');
    setKnownWords(prevKnownWords => {
        const newKnownWords = new Set(prevKnownWords).add(currentCard.id);
        localStorage.setItem(knownWordsStorageKey, JSON.stringify(Array.from(newKnownWords)));
        return newKnownWords;
    });
  };
  
  const handleDontKnowWord = () => {
    if (!currentCard || currentCard.id === 'fallback' || currentCard.id === 'finished') return;
    navigate(1);
  };

  useEffect(() => {
    if (!isOpen || !currentCard) return;
    clearTimeout(autoBrowseTimerRef.current);
    const playChinese = (callback) => { if (settings.autoPlayChinese && currentCard.chinese) { playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, callback); } else if (callback) { callback(); } };
    const playBurmese = (callback) => { if (settings.autoPlayBurmese && currentCard.burmese) { playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, callback); } else if (callback) { callback(); } };
    const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => navigate(1), settings.autoBrowseDelay); } };
    if (detailsVisible) { playBurmese(startAutoBrowseTimer); } 
    else { const initialPlayTimer = setTimeout(() => { playChinese(startAutoBrowseTimer); }, 500); return () => clearTimeout(initialPlayTimer); }
    return () => clearTimeout(autoBrowseTimerRef.current);
  }, [currentIndex, currentCard, settings, isOpen, navigate, detailsVisible]);
  
  const handleListen = useCallback((e) => {
    e.stopPropagation();
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("抱歉，您的浏览器不支持语音识别。"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.onstart = () => { setIsListening(true); setRecognizedText(""); };
    recognition.onresult = (event) => { const result = event.results[event.results.length - 1][0].transcript; setRecognizedText(result.trim().replace(/[.,。，]/g, '')); };
    recognition.onerror = (event) => { console.error("语音识别出错:", event.error); if (event.error !== 'aborted' && event.error !== 'no-speech') { alert(`语音识别错误: ${event.error}`); } };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; setIsComparisonOpen(true); };
    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  const handleCloseComparison = useCallback(() => { setIsComparisonOpen(false); setRecognizedText(''); }, []);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);
  
  useEffect(() => { return () => { if (recognitionRef.current) { recognitionRef.current.stop(); } }; }, []);
  
  const pageTransitions = useTransition(isOpen, {
    from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 },
  });

  const cardTransitions = useTransition(currentIndex, {
      key: cards[currentIndex]?.id || currentIndex,
      from: { opacity: 0, transform: `translateY(${lastDirection.current >= 0 ? '100%' : '-100%'})` }, 
      enter: { opacity: 1, transform: 'translateY(0%)' }, 
      leave: { opacity: 0, transform: `translateY(${lastDirection.current >= 0 ? '-100%' : '100%'})`, position: 'absolute' }, 
      config: { mass: 1, tension: 280, friction: 30 },
      onStart: () => { if (isOpen) playSoundEffect('switch'); }
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
        <div style={styles.gestureArea} {...bind()} onClick={() => setDetailsVisible(v => !v)} />

        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {isComparisonOpen && currentCard && (<PronunciationComparison correctWord={currentCard.chinese} userText={recognizedText} settings={settings} onContinue={handleNavigateToNext} onClose={handleCloseComparison} />)}
        {isJumping && <JumpModal max={cards.length} current={currentIndex} onJump={handleJumpToCard} onClose={() => setIsJumping(false)} />}

        {cardTransitions((cardStyle, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          return (
            <animated.div key={cardData.id} style={{ ...styles.animatedCardShell, ...cardStyle }}>
              <div style={styles.cardContainer}>
                  <div style={styles.mainContent}>
                      <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                          <div style={{...styles.pinyin, opacity: detailsVisible ? 1 : 0, transition: 'opacity 0.3s'}}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                          <div style={styles.textWordChinese}>{cardData.chinese}</div>
                      </div>
                  </div>
                  
                  {/* ✨ [New] Details Section: a scrollable container for all extra info */}
                  <animated.div style={{ ...styles.detailsWrapper, opacity: detailsVisible ? 1 : 0, transform: `translateY(${detailsVisible ? 0 : 20}px)` }}>
                    <div style={styles.detailsContent}>
                        <div style={styles.textWordBurmese} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>{cardData.burmese}</div>
                        
                        {/* Example Sentence Section */}
                        {cardData.sentence_ch && (
                            <div style={styles.detailsSection}>
                                <h3 style={styles.detailsTitle}>例句 / ဥပမာ</h3>
                                <p style={styles.sentenceChinese}>{cardData.sentence_ch}</p>
                                <p style={styles.sentenceBurmese}>{cardData.sentence_mm}</p>
                            </div>
                        )}

                        {/* Decomposition Section */}
                        {cardData.decomposition && (
                            <div style={styles.detailsSection}>
                                <h3 style={styles.detailsTitle}>拆解 / ဖွဲ့စည်းပုံ</h3>
                                <div style={styles.decompositionContainer}>
                                    {cardData.decomposition.map((part, index) => (
                                        <React.Fragment key={index}>
                                            {index > 0 && <span style={styles.plusSign}>+</span>}
                                            <div style={styles.decompositionPart}>
                                                <div style={styles.decompositionChar}>{part.char}</div>
                                                <div style={styles.decompositionPinyin}>{part.pinyin}</div>
                                                <div style={styles.decompositionMeaning}>{part.meaning}</div>
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mnemonic Section */}
                        {cardData.mnemonic && (
                            <div style={styles.detailsSection}>
                                <h3 style={styles.detailsTitle}>记忆技巧 / မှတ်သားရန်</h3>
                                <p style={styles.mnemonicText}>{cardData.mnemonic}</p>
                            </div>
                        )}
                    </div>
                  </animated.div>
              </div>
            </animated.div>
          );
        })}

        {currentCard && (<div style={styles.rightControls} data-no-gesture="true">
            <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={20} /></button>
            <button style={styles.rightIconButton} onClick={handleListen} title="发音练习">{isListening ? <FaStop size={20} color={'#dc2626'}/> : <FaMicrophone size={20} color={'#4a5568'} />}</button>
            {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺"><FaPenFancy size={20} /></button>)}
            {<button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>{isFavoriteCard ? <FaHeart size={20} color="#f87171" /> : <FaRegHeart size={20} />}</button>}
        </div>)}

        {currentCard && currentCard.id !== 'fallback' && currentCard.id !== 'finished' && (
          <div style={styles.bottomActionButtons} data-no-gesture="true">
            <button style={{...styles.actionButtonBase, ...styles.dontKnowButton}} onClick={handleDontKnowWord}>不认识</button>
            <button style={{...styles.actionButtonBase, ...styles.knowButton}} onClick={handleKnowWord}>认识</button>
          </div>
        )}

        {cards.length > 0 && (<div style={styles.bottomCenterCounter} data-no-gesture="true" onClick={() => setIsJumping(true)}>{currentIndex + 1} / {cards.length}</div>)}
      </animated.div>
    )
  );

  if (isMounted) return createPortal(cardContent, document.body);
  return null;
};

// =================================================================================
// ===== 样式表 (✨ Updated with new styles) =======================================
// =================================================================================
const styles = {
    // --- Core Layout ---
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: 'url(/background.jpg) center/cover no-repeat', backgroundAttachment: 'fixed', backgroundColor: '#004d40' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden', padding: '20px 0' },
    
    // --- Main Content (Top part of the card) ---
    mainContent: { width: '100%', textAlign: 'center', flexShrink: 0, paddingTop: '10vh' },
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '4rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 

    // --- ✨ [New] Details Wrapper & Content ---
    detailsWrapper: { width: '100%', flex: 1, overflow: 'hidden', transition: 'opacity 0.4s, transform 0.4s', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', marginTop: '2rem' },
    detailsContent: { width: '100%', maxWidth: '500px', overflowY: 'auto', padding: '0 20px 20px 20px', scrollbarWidth: 'none' /* Firefox */, 'msOverflowStyle': 'none' /* IE */, '::-webkit-scrollbar': { display: 'none' } /* Chrome, Safari */},
    textWordBurmese: { fontSize: '2rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)', textAlign: 'center', cursor: 'pointer' },
    detailsSection: { background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)', borderRadius: '16px', padding: '15px', marginTop: '20px', textAlign: 'left' },
    detailsTitle: { marginTop: 0, marginBottom: '10px', color: '#fcd34d', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '8px' },
    sentenceChinese: { fontSize: '1.2rem', color: 'white', margin: '0 0 5px 0' },
    sentenceBurmese: { fontSize: '1.1rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', margin: 0 },
    decompositionContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' },
    decompositionPart: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px' },
    decompositionChar: { fontSize: '2.5rem', color: 'white', fontWeight: 'bold' },
    decompositionPinyin: { fontSize: '0.9rem', color: '#fcd34d' },
    decompositionMeaning: { fontSize: '0.9rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif' },
    plusSign: { fontSize: '2rem', color: 'white', fontWeight: '300' },
    mnemonicText: { color: 'white', fontSize: '1.1rem', lineHeight: 1.6, fontFamily: '"Padauk", "Myanmar Text", sans-serif', margin: 0 },

    // --- Controls ---
    rightControls: { position: 'fixed', bottom: '50%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', transform: 'translateY(50%)' },
    rightIconButton: { background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'transform 0.2s, background 0.2s', color: '#4a5568', backdropFilter: 'blur(4px)' },
    bottomCenterCounter: { position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(0, 0, 0, 0.3)', color: 'white', padding: '8px 18px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(5px)', cursor: 'pointer', userSelect: 'none' },
    bottomActionButtons: { position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '20px', zIndex: 10, },
    actionButtonBase: { minWidth: '120px', padding: '15px 30px', fontSize: '1.1rem', fontWeight: 'bold', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, background 0.3s', backdropFilter: 'blur(5px)', },
    dontKnowButton: { background: 'rgba(239, 68, 68, 0.8)', },
    knowButton: { background: 'rgba(34, 197, 94, 0.8)', },

    // --- Modals (Comparison, Settings, etc.) ---
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
    audioComparisonSection: { display: 'flex', gap: '10px', justifyContent: 'center', padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8f9fa', flexWrap: 'wrap' },
    audioPlayerButton: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderRadius: '12px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151', fontWeight: 600 },
    comparisonActions: { padding: '20px' },
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
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002 },
    jumpModalContent: { background: 'white', padding: '25px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    jumpModalTitle: { marginTop: 0, marginBottom: '15px', color: '#333' },
    jumpModalInput: { width: '100px', padding: '10px', fontSize: '1.2rem', textAlign: 'center', border: '2px solid #ccc', borderRadius: '8px', marginBottom: '15px' },
    jumpModalButton: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#4299e1', color: 'white', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};

export default WordCard;
