// components/WordCard.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, 
    FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaRedo 
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// --- 数据库和辅助函数 (保持不变) ---
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';

function openDB() { 
    return new Promise((resolve, reject) => { 
        if (typeof window === 'undefined') return reject("Server side");
        const request = indexedDB.open(DB_NAME, 1); 
        request.onerror = () => reject('Database Error'); 
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
    try {
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
            const wordToStore = { ...word }; 
            store.put(wordToStore); 
            return true; 
        } 
    } catch (e) { return false; }
}

async function isFavorite(id) { 
    try {
        const db = await openDB(); 
        const tx = db.transaction(STORE_NAME, 'readonly'); 
        const store = tx.objectStore(STORE_NAME); 
        return new Promise((resolve) => { 
            const getReq = store.get(id); 
            getReq.onsuccess = () => resolve(!!getReq.result); 
            getReq.onerror = () => resolve(false); 
        }); 
    } catch (e) { return false; }
}

const TTS_VOICES = [ 
    { value: 'zh-CN-XiaoxiaoNeural', label: 'တရုတ် (အမျိုးသမီး)' }, 
    { value: 'zh-CN-XiaoyouNeural', label: 'တရုတ် (အမျိုးသမီး - ကလေး)' }, 
    { value: 'my-MM-NilarNeural', label: 'ဗမာ (အမျိုးသမီး)' }, 
    { value: 'my-MM-ThihaNeural', label: 'ဗမာ (အမျိုးသား)' }, 
];

// 16个整体认读音节
const WHOLE_SYLLABLES = [
  'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
  'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying'
];

let sounds = null;
let _howlInstance = null; 

const stopAllAudio = () => {
    if (_howlInstance) {
        _howlInstance.stop();
        _howlInstance.unload();
        _howlInstance = null;
    }
    if (sounds) {
        Object.values(sounds).forEach(s => s.stop());
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

const initSounds = () => {
    if (!sounds && typeof window !== 'undefined') {
        sounds = { 
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }), 
            correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }), 
            incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }), 
        };
    }
};

const playTTS = async (text, voice, rate, onEndCallback, e) => { 
    if (e && e.stopPropagation) e.stopPropagation(); 
    stopAllAudio(); 

    if (!text || !voice) { 
        if (onEndCallback) onEndCallback(); 
        return; 
    } 

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
        const audioUrl = URL.createObjectURL(audioBlob); 
        
        _howlInstance = new Howl({ 
            src: [audioUrl], 
            format: ['mpeg'], 
            html5: true, 
            onend: () => { 
                URL.revokeObjectURL(audioUrl); 
                if (onEndCallback) onEndCallback(); 
            }, 
            onloaderror: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); }, 
            onplayerror: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); } 
        }); 
        
        _howlInstance.play(); 
    } catch (error) { 
        if (typeof window !== 'undefined' && window.speechSynthesis) {
             const u = new SpeechSynthesisUtterance(text);
             u.lang = voice.includes('my') ? 'my-MM' : 'zh-CN';
             u.rate = rate >= 0 ? 1 + (rate / 100) : 1 + (rate / 200);
             u.onend = () => { if(onEndCallback) onEndCallback(); };
             u.onerror = () => { if(onEndCallback) onEndCallback(); };
             window.speechSynthesis.speak(u);
        } else {
             if (onEndCallback) onEndCallback();
        }
    } 
};

const playTTSWrapper = (text, voice = 'zh-CN-XiaoxiaoNeural') => {
    return new Promise((resolve) => {
        playTTS(text, voice, -20, resolve);
    });
};

const playSoundEffect = (type) => { 
    if (typeof window === 'undefined') return;
    initSounds();
    stopAllAudio();
    if (sounds && sounds[type]) sounds[type].play(); 
};

const useCardSettings = () => { 
    const [settings, setSettings] = useState(() => { 
        try { 
            if (typeof window === 'undefined') return {};
            const savedSettings = localStorage.getItem('learningWordCardSettings'); 
            const defaultSettings = { 
                order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: -50, speechRateBurmese: -50, backgroundImage: '' 
            }; 
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings; 
        } catch (error) { 
            return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: -50, speechRateBurmese: -50, backgroundImage: '' }; 
        } 
    }); 
    useEffect(() => { try { if (typeof window !== 'undefined') localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) { } }, [settings]); 
    return [settings, setSettings]; 
};

const SpellingModal = ({ word, onClose }) => {
    const [status, setStatus] = useState(''); 
    const isStoppingRef = useRef(false);

    const playLocal = (filename) => {
        return new Promise((resolve) => {
            if (isStoppingRef.current) { resolve(); return; }
            const cleanFilename = filename.trim();
            const audio = new Audio(`/pinyin-assets/${cleanFilename}`);
            audio.onended = resolve;
            audio.onerror = () => { console.warn(`❌ 缺文件: /pinyin-assets/${cleanFilename}`); resolve(); };
            audio.play().catch(resolve);
        });
    };

    const getCorrectFinalFilename = (pData) => {
        let final = pData.final; 
        const initial = pData.initial;
        if (['j', 'q', 'x', 'y'].includes(initial)) {
            if (final.startsWith('u') || final.startsWith('ū') || final.startsWith('ú') || final.startsWith('ǔ') || final.startsWith('ù')) {
               final = final.replace('u', 'ü').replace('ū', 'ǖ').replace('ú', 'ǘ').replace('ǔ', 'ǚ').replace('ù', 'ǜ');
            }
        }
        if (final.includes('ue') || final.includes('uē') || final.includes('ué') || final.includes('uě') || final.includes('uè')) {
             final = final.replace('u', 'ü'); 
        }
        return `${final}.mp3`;
    };

    const startSpelling = async () => {
        if (!word) return;
        isStoppingRef.current = false;
        stopAllAudio();
        const chars = word.split('');
        for (let i = 0; i < chars.length; i++) {
            if (isStoppingRef.current) break;
            const char = chars[i];
            const pData = pinyinConverter(char, { type: 'all', toneType: 'symbol', multiple: false })[0];
            const pinyinNoTone = pinyinConverter(char, { type: 'all', toneType: 'none', multiple: false })[0].pinyin;
            const isWhole = WHOLE_SYLLABLES.includes(pinyinNoTone);
            if (isWhole) {
                setStatus(`${i}-full`); 
                await playLocal(`${pinyinNoTone}.mp3`);
                await new Promise(r => setTimeout(r, 100));
                await playTTSWrapper(char);
                await new Promise(r => setTimeout(r, 400));
            } else if (pData.initial) {
                setStatus(`${i}-initial`);
                await playLocal(`${pData.initial}.mp3`);
                await new Promise(r => setTimeout(r, 150));
                setStatus(`${i}-final`);
                const finalFile = getCorrectFinalFilename(pData);
                await playLocal(finalFile);
                await new Promise(r => setTimeout(r, 150));
                setStatus(`${i}-full`);
                await playTTSWrapper(char);
                await new Promise(r => setTimeout(r, 500));
            } else {
                setStatus(`${i}-full`);
                await playLocal(`${pData.final}.mp3`); 
                await playTTSWrapper(char);
                await new Promise(r => setTimeout(r, 400));
            }
        }
        if (!isStoppingRef.current) {
            setStatus('all-full');
            await playTTSWrapper(word);
        }
        if (!isStoppingRef.current) {
            setTimeout(onClose, 1500);
        }
    };

    useEffect(() => {
        startSpelling();
        return () => { isStoppingRef.current = true; stopAllAudio(); };
    }, []);

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={{...styles.comparisonPanel, maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}>
                    <h3>ပေါင်း၍ဖတ်ခြင်း (拼读演示)</h3>
                    <button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button>
                </div>
                <div style={{...styles.recordContent, justifyContent: 'center'}}>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center'}}>
                        {word.split('').map((char, index) => {
                            const pData = pinyinConverter(char, { type: 'all', toneType: 'symbol', multiple: false })[0];
                            const initial = pData.initial;
                            const fullPinyin = pData.pinyin; 
                            const finalPart = initial ? fullPinyin.replace(initial, '') : fullPinyin;
                            const isInitialActive = status === `${index}-initial`;
                            const isFinalActive = status === `${index}-final`;
                            const isFullActive = status === `${index}-full`;
                            const isAllActive = status === 'all-full';
                            const initialColor = (isInitialActive || isFullActive || isAllActive) ? '#ef4444' : '#9ca3af';
                            const finalColor = (isFinalActive || isFullActive || isAllActive) ? '#ef4444' : '#9ca3af';
                            const fontWeight = (isInitialActive || isFinalActive || isFullActive || isAllActive) ? 'bold' : 'normal';
                            return (
                                <div key={index} style={{textAlign: 'center', transition: 'all 0.3s'}}>
                                    <div style={{fontSize: '1.4rem', marginBottom: '8px', height: '30px', fontFamily: 'Roboto, Arial'}}>
                                        {initial && (<span style={{color: initialColor, fontWeight: fontWeight, transition: 'color 0.2s'}}>{initial}</span>)}
                                        <span style={{color: finalColor, fontWeight: fontWeight, transition: 'color 0.2s'}}>{finalPart}</span>
                                    </div>
                                    <div style={{fontSize: '3rem', fontWeight: 'bold', color: (isFullActive || isAllActive) ? '#2563eb' : '#1f2937', transition: 'color 0.2s'}}>{char}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{marginTop: '25px', color: '#6b7280', fontSize: '0.9rem'}}>{status === 'all-full' ? 'ပြီးပါပြီ' : 'နားထောင်နေသည်...'}</div>
                </div>
            </div>
        </div>
    );
};

const PronunciationComparison = ({ correctWord, settings, onClose }) => {
    const [status, setStatus] = useState('idle'); 
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const localAudioRef = useRef(null);
    const checkSupport = () => !(typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia);

    useEffect(() => {
        return () => {
            if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (localAudioRef.current) localAudioRef.current.unload();
            stopAllAudio();
        };
    }, [userAudioUrl]);

    const startRecording = async () => {
        stopAllAudio();
        if (!checkSupport()) { alert("不支持录音"); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setUserAudioUrl(url);
                setStatus('review');
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
            setStatus('recording');
        } catch (err) { alert("请检查麦克风权限"); }
    };

    const stopRecording = () => { if (mediaRecorderRef.current) mediaRecorderRef.current.stop(); };
    const resetRecording = () => { if (userAudioUrl) URL.revokeObjectURL(userAudioUrl); setUserAudioUrl(null); setStatus('idle'); };
    const playStandard = () => { if (localAudioRef.current) localAudioRef.current.stop(); playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese); };
    const playUser = () => { if (!userAudioUrl) return; stopAllAudio(); if (localAudioRef.current) localAudioRef.current.unload(); localAudioRef.current = new Howl({ src: [userAudioUrl], format: ['webm'], html5: true }); localAudioRef.current.play(); };

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>အသံထွက် လေ့ကျင့်ရန်</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={styles.recordContent}>
                    <div style={styles.recordWordDisplay}><div style={styles.textWordChinese}>{correctWord}</div></div>
                    <div style={styles.actionArea}>
                        {status === 'idle' && (<div style={styles.idleStateContainer}><button style={styles.bigRecordBtn} onClick={startRecording}><FaMicrophone size={32} /></button><div style={styles.instructionText}>နှိပ်၍ အသံသွင်းပါ</div></div>)}
                        {status === 'recording' && (<div style={styles.idleStateContainer}><button style={{...styles.bigRecordBtn, ...styles.recordingPulse, background: '#ef4444'}} onClick={stopRecording}><FaStop size={32} /></button><div style={{...styles.instructionText, color: '#ef4444'}}>အသံသွင်းနေသည်...</div></div>)}
                        {status === 'review' && (<div style={styles.reviewContainer}><div style={styles.reviewRow}><div style={styles.reviewItem}><div style={styles.reviewLabel}>အမှန်</div><button style={styles.circleBtnBlue} onClick={playStandard}><FaVolumeUp size={24} /></button></div><div style={styles.reviewItem}><div style={styles.reviewLabel}>သင်၏အသံ</div><button style={styles.circleBtnGreen} onClick={playUser}><FaPlayCircle size={24} /></button></div></div><button style={styles.retryLink} onClick={resetRecording}><FaRedo size={14} /> ပြန်အသံသွင်းမယ်</button></div>)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => { 
    const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); }; 
    const handleImageUpload = (e) => { const file = e.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (loadEvent) => { handleSettingChange('backgroundImage', loadEvent.target.result); }; reader.readAsDataURL(file); } }; 
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{marginTop: 0, color: '#374151'}}>Settings</h2>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>Order</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : '#f3f4f6', color: settings.order === 'sequential' ? 'white' : '#4b5563' }}><FaSortAmountDown/> Sequential</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : '#f3f4f6', color: settings.order === 'random' ? 'white' : '#4b5563' }}><FaRandom/> Random</button></div></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>Auto Play</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> Chinese</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> Burmese</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> Example</label></div></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>Background</label><div style={styles.settingControl}><input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} /><button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>Upload</button><button style={{...styles.settingButton, flex: '0 1 auto'}} onClick={() => handleSettingChange('backgroundImage', '')}>Reset</button></div></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>Chinese Voice</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
            </div>
        </div>
    ); 
});

const JumpModal = ({ max, current, onJump, onClose }) => { 
    const [inputValue, setInputValue] = useState(current + 1); 
    const inputRef = useRef(null); 
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []); 
    const handleJump = () => { const num = parseInt(inputValue, 10); if (num >= 1 && num <= max) { onJump(num - 1); } }; 
    const handleKeyDown = (e) => { if (e.key === 'Enter') handleJump(); }; 
    return ( <div style={styles.jumpModalOverlay} onClick={onClose}><div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}><h3 style={styles.jumpModalTitle}>Go to</h3><input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} /><button style={styles.jumpModalButton} onClick={handleJump}>Go</button></div></div> ); 
};

const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  
  const getPinyin = useCallback((wordObj) => {
      if (wordObj.pinyin) return wordObj.pinyin;
      if (!wordObj.chinese) return '';
      try { return pinyinConverter(wordObj.chinese, { toneType: 'symbol', separator: ' ', v: true }).replace(/·/g, ' '); } catch (e) { return wordObj.chinese; }
  }, []);

  const processedCards = useMemo(() => {
    try {
        const mapped = words.map(w => ({ 
            id: w.id || Math.random().toString(36).substr(2, 9), 
            chinese: w.chinese || w.word, 
            audioText: w.audioText || w.chinese || w.word, 
            pinyin: w.pinyin,
            burmese: w.burmese || w.meaning, 
            mnemonic: w.mnemonic,
            example: w.example,
            example2: w.example2, 
        })).filter(w => w.chinese);
        if (settings.order === 'random') {
            for (let i = mapped.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mapped[i], mapped[j]] = [mapped[j], mapped[i]]; }
        }
        return mapped;
    } catch (error) { console.error("Data error:", error); return []; }
  }, [words, settings.order]);

  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const initialCards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "...", burmese: "..." }];
    setActiveCards(initialCards);
    if (typeof window !== 'undefined' && progressKey && processedCards.length > 0) {
        const savedIndex = localStorage.getItem(`word_progress_${progressKey}`);
        const parsed = parseInt(savedIndex, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < processedCards.length) { setCurrentIndex(parsed); } else { setCurrentIndex(0); }
    } else { setCurrentIndex(0); }
  }, [processedCards, progressKey]);

  useEffect(() => {
      if (typeof window !== 'undefined' && progressKey && activeCards.length > 0) {
          localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
      }
  }, [currentIndex, progressKey, activeCards.length]);

  const [isRevealed, setIsRevealed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [isSpellingOpen, setIsSpellingOpen] = useState(false); 
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(f
