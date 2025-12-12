// components/WordCard.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import {
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown,
    FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaRedo,
    FaHome // 🔥 1. 新增 Home 图标引入
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

// 全局停止音频函数
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

// TTS 播放逻辑
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

// 播放R2音频文件的函数 (支持 defaultLevel)
const playR2Audio = (word, onEndCallback, settings, defaultLevel) => {
    const targetLevel = word.hsk_level || defaultLevel;

    if (!word || !word.id || !targetLevel) {
        console.warn("R2 Audio Warn: 缺少 level 信息，回退到 TTS。", word);
        const textToRead = word.audioText || word.chinese;
        playTTS(textToRead, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
        return;
    }

    stopAllAudio();

    const formattedId = String(word.id).padStart(4, '0');
    const audioSrc = `https://audio.886.best/chinese-vocab-audio/hsk${targetLevel}/${formattedId}.mp3`;

    _howlInstance = new Howl({
        src: [audioSrc],
        html5: true,
        onend: () => {
            if (onEndCallback) onEndCallback();
        },
        onloaderror: (id, err) => {
            console.error(`加载R2音频失败: ${audioSrc}`, err);
            const textToRead = word.audioText || word.chinese;
            playTTS(textToRead, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
        },
        onplayerror: (id, err) => {
            console.error(`播放R2音频失败: ${audioSrc}`, err);
            if (onEndCallback) onEndCallback();
        }
    });

    _howlInstance.play();
};

const playSoundEffect = (type) => {
    if (typeof window === 'undefined') return;
    initSounds();
    stopAllAudio();
    if (sounds && sounds[type]) sounds[type].play();
};

// --- Hook ---
const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        try {
            if (typeof window === 'undefined') return {};
            const savedSettings = localStorage.getItem('learningWordCardSettings');
            const defaultSettings = {
                order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: -60, speechRateBurmese: -60, backgroundImage: ''
            };
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
        } catch (error) {
            return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: -60, speechRateBurmese: -60, backgroundImage: ''
            };
        }
    });
    useEffect(() => { try { if (typeof window !== 'undefined') localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) { } }, [settings]);
    return [settings, setSettings];
};

// =================================================================================
// 🔥 核心拼读组件 (逻辑已优化)
// =================================================================================
const SpellingModal = ({ wordObj, settings, level, onClose }) => {
    const [status, setStatus] = useState('');
    const isStoppingRef = useRef(false);
    const preloadedSounds = useRef({});
    const word = wordObj.chinese;

    // ✅ Preload all necessary audio files when the component mounts
    useEffect(() => {
        const urlsToPreload = new Set();
        if (word) {
            word.split('').forEach(char => {
                const pData = pinyinConverter(char, { type: 'all', toneType: 'symbol', multiple: false })[0];
                if (pData && pData.pinyin) {
                    const encodedFilename = encodeURIComponent(pData.pinyin);
                    urlsToPreload.add(`https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodedFilename}.mp3`);
                }
            });
        }

        preloadedSounds.current = {}; // Reset
        urlsToPreload.forEach(url => {
            preloadedSounds.current[url] = new Howl({
                src: [url],
                html5: true,
                preload: true,
            });
        });

        // Cleanup on unmount
        return () => {
            Object.values(preloadedSounds.current).forEach(sound => sound.unload());
        };
    }, [word]);

    const playPreloadedAudio = (filename) => {
        return new Promise((resolve) => {
            if (isStoppingRef.current) {
                resolve();
                return;
            }
            stopAllAudio();

            const encodedFilename = encodeURIComponent(filename);
            const audioSrc = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodedFilename}.mp3`;

            const sound = preloadedSounds.current[audioSrc];

            if (sound) {
                sound.once('end', resolve);
                sound.once('loaderror', () => { console.warn(`❌ Preloaded sound failed to load: ${audioSrc}`); resolve(); });
                sound.once('playerror', () => { console.error(`❌ Preloaded sound failed to play: ${audioSrc}`); resolve(); });

                _howlInstance = sound; // Track for global stop
                sound.play();
            } else {
                console.warn(`🔊 Sound not found in preload cache: ${audioSrc}. Playing on-the-fly.`);
                const fallbackSound = new Howl({
                    src: [audioSrc],
                    html5: true,
                    onend: resolve,
                    onloaderror: (id, err) => { console.warn(`❌ Fallback failed to load: ${audioSrc}`, err); resolve(); },
                    onplayerror: (id, err) => { console.error(`❌ Fallback failed to play: ${audioSrc}`, err); resolve(); }
                });
                _howlInstance = fallbackSound;
                fallbackSound.play();
            }
        });
    };

    const startSpelling = useCallback(async () => {
        if (!word) return;
        isStoppingRef.current = false;

        await new Promise(r => setTimeout(r, 100)); // Short delay for preloading

        const chars = word.split('');
        for (let i = 0; i < chars.length; i++) {
            if (isStoppingRef.current) break;

            const char = chars[i];
            const pData = pinyinConverter(char, { type: 'all', toneType: 'symbol', multiple: false })[0];
            const pinyinWithTone = pData.pinyin;
            
            setStatus(`${i}-full`);
            await playPreloadedAudio(pinyinWithTone);

            if (i < chars.length - 1) {
                await new Promise(r => setTimeout(r, 250)); // Reduced delay
            } else {
                await new Promise(r => setTimeout(r, 400));
            }
        }

        if (!isStoppingRef.current) {
            setStatus('all-full');
            await new Promise(resolve => playR2Audio(wordObj, resolve, settings, level));
        }

        if (!isStoppingRef.current) {
            setTimeout(onClose, 1200);
        }
    }, [word, wordObj, settings, level, onClose]);

    useEffect(() => {
        startSpelling();
        return () => {
            isStoppingRef.current = true;
            stopAllAudio();
        };
    }, [startSpelling]);

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={{...styles.comparisonPanel, maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>ပေါင်း၍ဖတ်ခြင်း (拼读演示)</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={{...styles.recordContent, justifyContent: 'center'}}>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center'}}>
                        {word && word.split('').map((char, index) => {
                            const pData = pinyinConverter(char, { type: 'all', toneType: 'symbol', multiple: false })[0];
                            const initial = pData.initial;
                            const fullPinyin = pData.pinyin;
                            const finalPart = initial ? fullPinyin.replace(initial, '') : fullPinyin;

                            const isFullActive = status === `${index}-full`;
                            const isAllActive = status === 'all-full';
                            
                            const isActive = isFullActive || isAllActive;
                            const color = isActive ? '#ef4444' : '#9ca3af';
                            const fontWeight = isActive ? 'bold' : 'normal';

                            return (
                                <div key={index} style={{textAlign: 'center', transition: 'all 0.3s'}}>
                                    <div style={{fontSize: '1.4rem', marginBottom: '8px', height: '30px', fontFamily: 'Roboto, Arial'}}>
                                        {initial && (<span style={{color: color, fontWeight: fontWeight, transition: 'color 0.2s', marginRight: '2px'}}>{initial}</span>)}
                                        <span style={{color: color, fontWeight: fontWeight, transition: 'color 0.2s'}}>{finalPart}</span>
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
    const [status, setStatus] = useState('idle'); const [userAudioUrl, setUserAudioUrl] = useState(null); const mediaRecorderRef = useRef(null); const streamRef = useRef(null); const localAudioRef = useRef(null);
    const checkSupport = () => { if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false; return true; };
    useEffect(() => { return () => { if (userAudioUrl) URL.revokeObjectURL(userAudioUrl); if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); if (localAudioRef.current) localAudioRef.current.unload(); stopAllAudio(); }; }, [userAudioUrl]);
    const startRecording = async () => { stopAllAudio(); if (!checkSupport()) { alert("不支持录音"); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; const recorder = new MediaRecorder(stream); const chunks = []; recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => { const blob = new Blob(chunks, { type: 'audio/webm' }); const url = URL.createObjectURL(blob); setUserAudioUrl(url); setStatus('review'); stream.getTracks().forEach(track => track.stop()); }; mediaRecorderRef.current = recorder; recorder.start(); setStatus('recording'); } catch (err) { alert("请检查麦克风权限"); } };
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

// =================================================================================
// ===== 主组件: WordCard ==========================================================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default', level }) => {
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
            id: w.id,
            hsk_level: w.hsk_level,
            chinese: w.chinese || w.word,
            audioText: w.audioText || w.chinese || w.word,
            pinyin: w.pinyin,
            burmese: w.burmese || w.meaning,
            explanation: w.explanation,
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
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);

  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const currentCard = activeCards.length > 0 ? activeCards[currentIndex] : null;

  useEffect(() => {
      let isActive = true;
      if (currentCard?.id && currentCard.id !== 'fallback') {
          isFavorite(currentCard.id).then(res => { if(isActive) setIsFavoriteCard(res); });
      }
      setIsRevealed(false);
      return () => { isActive = false; };
  }, [currentCard]);

  const handleToggleFavorite = async (e) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (!currentCard || currentCard.id === 'fallback') return;

      const newStatus = !isFavoriteCard;
      setIsFavoriteCard(newStatus);

      const success = await toggleFavorite(currentCard);
      if (success !== newStatus) {
         setIsFavoriteCard(success);
      }
  };

  const handleGoHome = (e) => {
      e.stopPropagation();
      window.location.href = 'https://886.best';
  };

  const navigate = useCallback((direction) => {
    if (activeCards.length === 0) return;
    lastDirection.current = direction;
    setCurrentIndex(prev => (prev + direction + activeCards.length) % activeCards.length);
  }, [activeCards.length]);

  const handleJumpToCard = (index) => { if (index >= 0 && index < activeCards.length) { lastDirection.current = index > currentIndex ? 1 : -1; setCurrentIndex(index); } setIsJumping(false); };

  useEffect(() => {
    if (!isOpen || !currentCard) return;
    clearTimeout(autoBrowseTimerRef.current);
    stopAllAudio();

    const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };

    const playSequence = () => {
        const playTtsChain = () => {
            if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
                playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
                    if (settings.autoPlayExample && currentCard.example && isRevealed) {
                        playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, () => {
                            if (settings.autoPlayExample && currentCard.example2 && isRevealed) {
                                playTTS(currentCard.example2, settings.voiceChinese, settings.speechRateChinese, startAutoBrowseTimer);
                            } else {
                                startAutoBrowseTimer();
                            }
                        });
                    } else {
                        startAutoBrowseTimer();
                    }
                });
            } else {
                startAutoBrowseTimer();
            }
        };

        if (settings.autoPlayChinese && currentCard.chinese) {
            playR2Audio(currentCard, playTtsChain, settings, level);
        } else {
            playTtsChain();
        }
    };

    const initialPlayTimer = setTimeout(playSequence, 600);
    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate, isRevealed, level]);

  const handleOpenRecorder = useCallback((e) => { if(e && e.stopPropagation) e.stopPropagation(); stopAllAudio(); setIsRecordingOpen(true); }, []);
  const handleOpenSpelling = useCallback((e) => { if(e && e.stopPropagation) e.stopPropagation(); stopAllAudio(); setIsSpellingOpen(true); }, []);

  const handleKnow = () => {
    stopAllAudio();
    if (!currentCard) return;
    const newActiveCards = activeCards.filter(card => card.id !== currentCard.id);
    if (newActiveCards.length === 0) { setActiveCards([]); return; }
    setActiveCards(newActiveCards);
    if (currentIndex >= newActiveCards.length) { setCurrentIndex(0); }
  };

  const handleDontKnow = () => { stopAllAudio(); if (isRevealed) { navigate(1); } else { setIsRevealed(true); } };

  const pageTransitions = useTransition(isOpen, { from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 }, });
  const cardTransitions = useTransition(currentIndex, { key: currentCard ? currentCard.id : currentIndex, from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, config: { mass: 1, tension: 280, friction: 30 }, onStart: () => { if(currentCard) playSoundEffect('switch'); }, });

  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
      if (event.target.closest('[data-no-gesture]')) {
          return;
      }

      if (down) return;
      event.stopPropagation();
      const isHorizontal = Math.abs(mx) > Math.abs(my);
      if (isHorizontal) { if (Math.abs(mx) > 80 || (vel > 0.5 && Math.abs(mx) > 40)) onClose(); }
      else { if (Math.abs(my) > 60 || (vel > 0.4 && Math.abs(my) > 30)) navigate(yDir < 0 ? 1 : -1); }
  }, { filterTaps: true, preventDefault: true, threshold: 10 });

  const cardContent = pageTransitions((style, item) => {
    const bgUrl = settings.backgroundImage;
    const backgroundStyle = bgUrl ? { background: `url(${bgUrl}) center/cover no-repeat` } : {};
    return item && (
      <animated.div style={{ ...styles.fullScreen, ...backgroundStyle, ...style }}>
        <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(prev => !prev)} />
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {isRecordingOpen && currentCard && (<PronunciationComparison correctWord={currentCard.chinese} settings={settings} onClose={() => setIsRecordingOpen(false)} />)}

        {isSpellingOpen && currentCard && (
            <SpellingModal wordObj={currentCard} settings={settings} level={level} onClose={() => setIsSpellingOpen(false)} />
        )}

        {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={handleJumpToCard} onClose={() => setIsJumping(false)} />}

        {activeCards.length > 0 && currentCard ? (
            cardTransitions((cardStyle, i) => {
              const cardData = activeCards[i];
              if (!cardData) return null;

              return (
                <animated.div key={cardData.id} style={{ ...styles.animatedCardShell, ...cardStyle }}>
                  <div style={styles.cardContainer}>
                      <div style={{ textAlign: 'center', width: '100%' }}>
                          <div style={{ cursor: 'pointer' }} onClick={(e) => {
                                e.stopPropagation();
                                playR2Audio(cardData, null, settings, level);
                            }}>
                            <div style={styles.pinyin}>{getPinyin(cardData)}</div>
                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                          </div>

                          {isRevealed && (
                              <animated.div style={styles.revealedContent}>

                                  {cardData.burmese &&
                                    <div style={styles.definitionBox} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                                        <div style={styles.textWordBurmese}>{cardData.burmese}</div>
                                    </div>
                                  }

                                  {cardData.explanation &&
                                    <div style={styles.explanationBox} onClick={(e) => playTTS(cardData.explanation, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                                        <div style={styles.explanationText}>{cardData.explanation}</div>
                                    </div>
                                  }

                                  {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}

                                  {cardData.example && (
                                      <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                                          <div style={{ flex: 1, textAlign: 'center' }}>
                                            <div style={styles.examplePinyin}>{pinyinConverter(cardData.example, { toneType: 'symbol', separator: ' ' }).replace(/·/g, ' ')}</div>
                                            <div style={styles.exampleText}>{cardData.example}</div>
                                          </div>
                                      </div>
                                  )}

                                  {cardData.example2 && (
                                      <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example2, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                                          <div style={{ flex: 1, textAlign: 'center' }}>
                                            <div style={styles.examplePinyin}>{pinyinConverter(cardData.example2, { toneType: 'symbol', separator: ' ' }).replace(/·/g, ' ')}</div>
                                            <div style={styles.exampleText}>{cardData.example2}</div>
                                          </div>
                                      </div>
                                  )}

                              </animated.div>
                          )}
                      </div>
                  </div>
                </animated.div>
              );
            })
        ) : (
            <div style={styles.completionContainer}><h2>🎉 ဂုဏ်ယူပါတယ်!</h2><p>သင် ဒီသင်ခန်းစာကို လေ့လာပြီးသွားပါပြီ။</p><button style={{...styles.knowButton, ...styles.knowButtonBase}} onClick={onClose}>ပိတ်မည်</button></div>
        )}

        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button
                    style={styles.rightIconButton}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleGoHome}
                    title="Home Page"
                >
                    <FaHome size={18} color={'#4b5563'} />
                </button>

                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="ဆက်တင်များ"><FaCog size={18} /></button>
                <button style={styles.rightIconButton} onClick={handleOpenSpelling} title="拼读"><span style={{ fontSize: '16px', fontWeight: 'bold', color: '#d97706', fontFamily: 'serif' }}>拼</span></button>
                <button style={styles.rightIconButton} onClick={handleOpenRecorder} title="အသံထွက်လေ့ကျင့်ရန်"><FaMicrophone size={18} color={'#4b5563'} /></button>
                {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="ရေးနည်း"><FaPenFancy size={18} /></button>)}

                <button
                    style={styles.rightIconButton}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleToggleFavorite}
                    title={isFavoriteCard ? "ပယ်ဖျက်" : "သိမ်းဆည်း"}
                >
                    {isFavoriteCard ? <FaHeart size={18} color="#f87171" /> : <FaRegHeart size={18} />}
                </button>
            </div>
        )}

        <div style={styles.bottomControlsContainer} data-no-gesture="true">
            {activeCards.length > 0 && (<div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>)}
            <div style={styles.knowButtonsWrapper}>
                <button style={{...styles.knowButtonBase, ...styles.dontKnowButton}} onClick={handleDontKnow}>မသိဘူး</button>
                <button style={{...styles.knowButtonBase, ...styles.knowButton}} onClick={handleKnow}>သိတယ်</button>
            </div>
        </div>

      </animated.div>
    );
  });

  if (isMounted) return createPortal(cardContent, document.body);
  return null;
};

// ✅ 样式全面优化：字体更小，无背景，排版紧密
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#f0f4f8' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '60px 15px 130px 15px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflowY: 'auto', overflowX: 'hidden', padding: '40px 10px' },
    pinyin: { fontFamily: 'Roboto, "Segoe UI", Arial, sans-serif', fontSize: '1.4rem', color: '#d97706', textShadow: 'none', marginBottom: '0.8rem', letterSpacing: '0.05em', fontWeight: 'bold' },
    textWordChinese: { fontSize: '2.4rem', fontWeight: 'bold', color: '#1f2937', lineHeight: 1.2, wordBreak: 'break-word', textShadow: 'none' },
    revealedContent: { marginTop: '0.8rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    definitionBox: { cursor: 'pointer', textAlign: 'center' },
    textWordBurmese: { fontSize: '1.3rem', color: '#4b5563', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.5, wordBreak: 'break-word', textShadow: 'none' },
    explanationBox: { color: '#16a34a', textAlign: 'center', fontSize: '1.1rem', textShadow: 'none', background: 'transparent', padding: '5px', maxWidth: '100%', cursor: 'pointer', border: 'none' },
    explanationText: { fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.4, fontWeight: '500' },
    mnemonicBox: { color: '#6b7280', display: 'inline-block', textAlign: 'center', fontSize: '1.0rem', textShadow: 'none', background: 'transparent', padding: '2px 0', maxWidth: '100%' },
    exampleBox: { color: '#374151', width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textShadow: 'none', cursor: 'pointer', background: 'transparent', padding: '5px 0', borderRadius: '0', boxShadow: 'none', borderBottom: '1px dashed #e5e7eb' },
    examplePinyin: { fontFamily: 'Roboto, "Segoe UI", Arial, sans-serif', fontSize: '0.95rem', color: '#d97706', marginBottom: '0.2rem', opacity: 0.9, letterSpacing: '0.03em', fontWeight: 500 },
    exampleText: { fontSize: '1.2rem', lineHeight: 1.4 },
    rightControls: { position: 'fixed', bottom: '40%', right: '10px', zIndex: 101, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', transform: 'translateY(50%)' },
    rightIconButton: { background: 'white', border: '1px solid #e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', transition: 'transform 0.2s', color: '#4b5563' },
    bottomControlsContainer: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
    bottomCenterCounter: { background: 'rgba(0, 0, 0, 0.1)', color: '#374151', padding: '8px 18px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' },
    knowButtonsWrapper: { display: 'flex', width: '100%', maxWidth: '400px', gap: '15px' },
    knowButtonBase: { flex: 1, padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    dontKnowButton: { background: '#f59e0b', color: 'white' },
    knowButton: { background: '#10b981', color: 'white' },
    completionContainer: { textAlign: 'center', color: '#374151', textShadow: 'none', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '15px' },
    comparisonPanel: { width: '100%', maxWidth: '350px', background: 'white', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' },
    recordHeader: { padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' },
    closeButtonSimple: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.2rem' },
    recordContent: { padding: '25px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px', minHeight: '250px' },
    recordWordDisplay: { textAlign: 'center', marginBottom: '10px' },
    actionArea: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 },
    idleStateContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
    bigRecordBtn: { width: '80px', height: '80px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: '4px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)', transition: 'transform 0.1s' },
    instructionText: { color: '#6b7280', fontSize: '1rem', fontWeight: 500 },
    recordingPulse: { animation: 'pulse 1.5s infinite', border: '4px solid #fee2e2', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' },
    reviewContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
    reviewRow: { display: 'flex', justifyContent: 'space-around', width: '100%', gap: '10px' },
    reviewItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    reviewLabel: { fontSize: '0.85rem', color: '#6b7280', fontWeight: 'bold' },
    retryLink: { background: 'none', border: 'none', color: '#6b7280', fontSize: '0.9rem', cursor: 'pointer', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'underline' },
    circleBtnBlue: { width: '60px', height: '60px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' },
    circleBtnGreen: { width: '60px', height: '60px', borderRadius: '50%', background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' },
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)', padding: '15px' },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto', position: 'relative' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#aaa', lineHeight: 1 },
    settingGroup: { marginBottom: '20px' },
    settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
    settingControl: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
    settingButton: { background: '#f3f4f6', color: '#4b5563', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: '100px' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002 },
    jumpModalContent: { background: 'white', padding: '25px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    jumpModalTitle: { marginTop: 0, marginBottom: '15px', color: '#333' },
    jumpModalInput: { width: '100px', padding: '10px', fontSize: '1.2rem', textAlign: 'center', border: '2px solid #ccc', borderRadius: '8px', marginBottom: '15px' },
    jumpModalButton: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#4299e1', color: 'white', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};

export default WordCard;
