// components/WordCard.js (拼音完美修复版 & TTS自动降级修复404)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, 
    FaArrowRight, FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp 
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// --- 数据库配置 ---
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';

function openDB() { 
    return new Promise((resolve, reject) => { 
        if (typeof window === 'undefined') return reject("Server side");
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

let sounds = null;
const initSounds = () => {
    if (!sounds && typeof window !== 'undefined') {
        sounds = { 
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }), 
            correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }), 
            incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }), 
        };
    }
};

let _howlInstance = null;

// ✅ 修复：TTS 播放逻辑 (包含本地降级，解决 API 404 问题)
const playTTS = async (text, voice, rate, onEndCallback, e) => { 
    if (e && e.stopPropagation) e.stopPropagation(); 
    
    // 1. 立即停止当前正在播放的所有声音
    if (_howlInstance) {
        _howlInstance.stop();
        _howlInstance.unload(); 
        _howlInstance = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    if (!text) { 
        if (onEndCallback) onEndCallback(); 
        return; 
    } 

    const apiUrl = 'https://libretts.is-an.org/api/tts'; 
    const rateValue = Math.round(rate / 2); 

    try { 
        // 尝试调用云端 API
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
        console.warn('云端TTS失败 (404或网络错误)，切换至浏览器本地语音:', error);
        
        // 🔥 降级方案：使用浏览器自带语音
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            // 简单映射语言
            if (voice && voice.includes('my')) utterance.lang = 'my-MM'; // 缅甸语
            else utterance.lang = 'zh-CN'; // 中文
            
            // 调整语速
            utterance.rate = rate >= 0 ? 1 + (rate / 100) : 1 + (rate / 200);
            
            utterance.onend = () => { if (onEndCallback) onEndCallback(); };
            utterance.onerror = () => { if (onEndCallback) onEndCallback(); };
            
            window.speechSynthesis.speak(utterance);
        } else {
            if (onEndCallback) onEndCallback(); 
        }
    } 
};

const playSoundEffect = (type) => { 
    if (typeof window === 'undefined') return;
    initSounds();
    if (sounds && sounds[type]) sounds[type].play(); 
};

// 拼音解析辅助
const parsePinyin = (pinyinNum) => { 
    if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' }; 
    const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, ''); 
    let pinyinPlain = rawPinyin.replace(/[1-5]$/, ''); 
    const toneMatch = rawPinyin.match(/[1-5]$/); 
    const tone = toneMatch ? toneMatch[0] : '0'; 
    const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' }).replace(/·/g, ' '); 
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

// --- 子组件部分 ---
const useCardSettings = () => { 
    const [settings, setSettings] = useState(() => { 
        try { 
            if (typeof window === 'undefined') return {};
            const savedSettings = localStorage.getItem('learningWordCardSettings'); 
            const defaultSettings = { 
                order: 'sequential', 
                autoPlayChinese: true, 
                autoPlayBurmese: true, 
                autoPlayExample: true, 
                autoBrowse: false, 
                autoBrowseDelay: 6000, 
                voiceChinese: 'zh-CN-XiaoyouNeural', 
                voiceBurmese: 'my-MM-NilarNeural', 
                speechRateChinese: 0, 
                speechRateBurmese: 0, 
                backgroundImage: '', 
            }; 
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings; 
        } catch (error) { 
            return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' }; 
        } 
    }); 
    useEffect(() => { 
        try { 
            if (typeof window !== 'undefined') {
                localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); 
            }
        } catch (error) { console.error("保存设置失败", error); } 
    }, [settings]); 
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

const PronunciationComparison = ({ correctWord, userText, settings, onContinue, onClose }) => { 
    const analysis = useMemo(() => { 
        if (!userText) { return { isCorrect: false, error: 'NO_PINYIN', message: 'အသံဖမ်းယူမှု မအောင်မြင်ပါ' }; } 
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true }); 
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true }); 
        if (correctPinyin.length === 0 || userPinyin.length === 0) return { isCorrect: false, error: 'NO_PINYIN', message: 'အသံဖမ်းယူမှု မအောင်မြင်ပါ' }; 
        if (correctPinyin.length !== userPinyin.length) return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `စာလုံးရေ မကိုက်ညီပါ: ${correctPinyin.length} လုံး ရှိရမည့်အစား ${userPinyin.length} လုံး ဖြစ်နေသည်` }; 
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
        } catch (err) { alert("မိုက်ခရိုဖုန်း ဖွင့်ထားခြင်း ရှိမရှိ စစ်ဆေးပါ"); } 
    }, [isRecording]); 
    const playUserAudio = useCallback(() => { 
        if (userRecordingUrl) { 
            if (_howlInstance?.playing()) _howlInstance.stop(); 
            if (typeof window !== 'undefined') window.speechSynthesis.cancel();
            const sound = new Howl({ src: [userRecordingUrl], html5: true }); 
            sound.play(); 
        } 
    }, [userRecordingUrl]); 
    const playCorrectTTS = useCallback(() => { playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese); }, [correctWord, settings]); 
    useEffect(() => { return () => { if (userRecordingUrl) { URL.revokeObjectURL(userRecordingUrl); } }; }, [userRecordingUrl]); 
    if (!analysis) return null; 
    return ( 
        <div style={styles.comparisonOverlay}> 
            <div style={styles.comparisonPanel}> 
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}> 
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div> 
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? 'အသံထွက် မှန်ကန်သည်' : `မှန်ကန်မှု: ${analysis.accuracy}%`}</div> 
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>{analysis.isCorrect ? 'အလွန်တော်သည်' : 'ထပ်မံ ကြိုးစားပါ'}</div> 
                </div> 
                <div style={styles.errorDetailsContainer}>
                    {analysis.error ? (<div style={styles.lengthError}><h3>{analysis.message}</h3></div>) : (
                        <div style={styles.comparisonGrid}>
                            {analysis.results.map((result, index) => (
                                <div key={index} style={styles.comparisonCell}>
                                    <div style={styles.comparisonChar}>{result.char}</div>
                                    <div style={styles.comparisonPinyinGroup}><div style={styles.pinyinLabel}>အမှန်</div><PinyinVisualizer analysis={result.correct} isCorrect={true} /></div>
                                    <div style={styles.comparisonPinyinGroup}><div style={styles.pinyinLabel}>သင်၏အသံ</div><PinyinVisualizer analysis={result.user} isCorrect={result.pinyinMatch} /></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div> 
                <div style={styles.audioComparisonSection}> 
                    <button style={styles.audioPlayerButton} onClick={playCorrectTTS}><FaPlayCircle size={18} /> ပုံမှန်အသံ</button> 
                    <button style={{...styles.audioPlayerButton, ...(isRecording ? {color: '#dc2626'} : {})}} onClick={handleRecord}> {isRecording ? <FaStop size={18} /> : <FaMicrophone size={18} />} {isRecording ? 'ရပ်တန့်ရန်' : 'အသံသွင်းရန်'} </button> 
                    {userRecordingUrl && <button style={styles.audioPlayerButton} onClick={playUserAudio}><FaPlayCircle size={18} /> ပြန်နားထောင်ရန်</button>} 
                </div> 
                <div style={styles.comparisonActions}> 
                    {analysis.isCorrect ? (<button style={{...styles.actionButton, ...styles.continueButton}} onClick={onContinue}>နောက်တစ်ခု <FaArrowRight /></button>) : (<button style={{...styles.actionButton, ...styles.retryButton}} onClick={onClose}>ထပ်ကြိုးစားမည်</button>)} 
                </div> 
            </div> 
        </div> 
    ); 
};

// --- 设置面板 ---
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => { 
    const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); }; 
    const handleImageUpload = (e) => { const file = e.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (loadEvent) => { handleSettingChange('backgroundImage', loadEvent.target.result); }; reader.readAsDataURL(file); } }; 
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{marginTop: 0}}>အထွေထွေ ဆက်တင်များ</h2>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>လေ့လာမည့် အစီအစဉ်</label>
                    <div style={styles.settingControl}>
                        <button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> အစဉ်လိုက်</button>
                        <button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> ကျပန်း</button>
                    </div>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>အလိုအလျောက် ဖွင့်ရန်</label>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> တရုတ်စကားလုံး</label></div>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> ဗမာအဓိပ္ပာယ်</label></div>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> ဥပမာစာကြောင်း</label></div>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}စက္ကန့်အကြာ နောက်တစ်ခုသွားရန်</label></div>
                </div>
                <h2 style={{marginTop: '30px'}}>အသွင်အပြင်</h2>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>နောက်ခံပုံ ပြောင်းရန်</label>
                    <div style={styles.settingControl}>
                        <input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} />
                        <button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>ပုံတင်ရန်</button>
                        <button style={{...styles.settingButton, flex: '0 1 auto'}} onClick={() => handleSettingChange('backgroundImage', '')}>မူလပုံစံ</button>
                    </div>
                </div>
                <h2 style={{marginTop: '30px'}}>အသံထွက် ဆက်တင်များ</h2>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>တရုတ် အသံထွက်</label>
                    <select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>တရုတ် အမြန်နှုန်း: {settings.speechRateChinese}%</label>
                    <div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>ဗမာ အသံထွက်</label>
                    <select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>ဗမာ အမြန်နှုန်း: {settings.speechRateBurmese}%</label>
                    <div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div>
                </div>
            </div>
        </div>
    ); 
});

const JumpModal = ({ max, current, onJump, onClose }) => { 
    const [inputValue, setInputValue] = useState(current + 1); 
    const inputRef = useRef(null); 
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []); 
    const handleJump = () => { const num = parseInt(inputValue, 10); if (num >= 1 && num <= max) { onJump(num - 1); } else { alert(`1 မှ ${max} အတွင်း ဂဏန်းရိုက်ထည့်ပါ`); } }; 
    const handleKeyDown = (e) => { if (e.key === 'Enter') handleJump(); }; 
    return ( 
        <div style={styles.jumpModalOverlay} onClick={onClose}>
            <div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}>
                <h3 style={styles.jumpModalTitle}>စာမျက်နှာ သွားရန်</h3>
                <input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} min="1" max={max} />
                <button style={styles.jumpModalButton} onClick={handleJump}>သွားမည်</button>
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
  
  // ✅ 拼音处理：强制替换 ·，并确保 ü 显示正确
  const getPinyin = useCallback((text) => {
      if (!text) return '';
      try {
          return pinyinConverter(text, { 
              toneType: 'symbol', 
              separator: ' ',
              v: true 
          }).replace(/·/g, ' '); 
      } catch (e) { return text; }
  }, []);

  const processedCards = useMemo(() => {
    try {
        const mapped = words.map(w => ({ 
            id: w.id || Math.random().toString(36).substr(2, 9), 
            chinese: w.chinese || w.word, 
            burmese: w.burmese || w.meaning, 
            mnemonic: w.mnemonic,
            example: w.example,
        })).filter(w => w.chinese);
        if (settings.order === 'random') {
            for (let i = mapped.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mapped[i], mapped[j]] = [mapped[j], mapped[i]]; }
        }
        return mapped;
    } catch (error) { console.error("数据处理错:", error); return []; }
  }, [words, settings.order]);

  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const initialCards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "...", burmese: "..." }];
    setActiveCards(initialCards);
    if (typeof window !== 'undefined' && progressKey && processedCards.length > 0) {
        const savedIndex = localStorage.getItem(`word_progress_${progressKey}`);
        const parsed = parseInt(savedIndex, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < processedCards.length) {
            setCurrentIndex(parsed);
        } else { setCurrentIndex(0); }
    } else { setCurrentIndex(0); }
  }, [processedCards, progressKey]);

  useEffect(() => {
      if (typeof window !== 'undefined' && progressKey && activeCards.length > 0) {
          localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
      }
  }, [currentIndex, progressKey, activeCards.length]);

  const [isRevealed, setIsRevealed] = useState(false);
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
      if(e) e.stopPropagation();
      if (!currentCard || currentCard.id === 'fallback') return; 
      const newStatus = await toggleFavorite(currentCard);
      setIsFavoriteCard(newStatus); 
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
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();

    const playFullSequence = () => {
        if (settings.autoPlayChinese && currentCard.chinese) {
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => {
                if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
                        if (settings.autoPlayExample && currentCard.example && isRevealed) {
                           playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, startAutoBrowseTimer);
                        } else { startAutoBrowseTimer(); }
                    });
                } else { startAutoBrowseTimer(); }
            });
        } else { startAutoBrowseTimer(); }
    };
    
    const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };
    const initialPlayTimer = setTimeout(playFullSequence, 600);
    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate, isRevealed]);
  
  const handleListen = useCallback((e) => {
    e.stopPropagation();
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("ဆောရီးပါ၊ သင့်ဖုန်းတွင် အသံဖမ်းစနစ် မရနိုင်ပါ"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.onstart = () => { setIsListening(true); setRecognizedText(""); };
    recognition.onresult = (event) => { const result = event.results[event.results.length - 1][0].transcript; setRecognizedText(result.trim().replace(/[.,。，]/g, '')); };
    recognition.onerror = (event) => { if (event.error !== 'aborted' && event.error !== 'no-speech') { alert(`Error: ${event.error}`); } };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; setIsComparisonOpen(true); };
    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  const handleCloseComparison = useCallback(() => { setIsComparisonOpen(false); setRecognizedText(''); }, []);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);
  useEffect(() => { return () => { if (recognitionRef.current) { recognitionRef.current.stop(); } }; }, []);
  
  const handleKnow = () => {
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    if (!currentCard) return;
    navigate(1);
  };

  const handleDontKnow = () => {
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    if (isRevealed) { navigate(1); } else { setIsRevealed(true); }
  };

  const pageTransitions = useTransition(isOpen, {
    from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 },
  });

  const cardTransitions = useTransition(currentIndex, {
      key: currentCard ? currentCard.id : currentIndex,
      from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, 
      enter: { opacity: 1, transform: 'translateY(0%)' }, 
      leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, 
      config: { mass: 1, tension: 280, friction: 30 }, 
      onStart: () => { if(currentCard) playSoundEffect('switch'); },
  });
  
  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
      if (event.target.closest('[data-no-gesture]')) return;
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
        
        {isComparisonOpen && currentCard && (
            <PronunciationComparison correctWord={currentCard.chinese} userText={recognizedText} settings={settings} onContinue={handleNavigateToNext} onClose={handleCloseComparison} />
        )}
        
        {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={handleJumpToCard} onClose={() => setIsJumping(false)} />}
        
        {activeCards.length > 0 && currentCard ? (
            cardTransitions((cardStyle, i) => {
              const cardData = activeCards[i];
              if (!cardData) return null;
              return (
                <animated.div key={cardData.id} style={{ ...styles.animatedCardShell, ...cardStyle }}>
                  <div style={styles.cardContainer}>
                      <div style={{ textAlign: 'center' }}>
                          <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                            <div style={styles.pinyin}>{getPinyin(cardData.chinese)}</div>
                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                          </div>
                          {isRevealed && (
                              <animated.div style={styles.revealedContent}>
                                  <div style={{ cursor: 'pointer', marginTop: '1.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}><div style={styles.textWordBurmese}>{cardData.burmese}</div></div>
                                  {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}
                                  {cardData.example && (
                                      <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                                          <div style={{ flex: 1, textAlign: 'center' }}>
                                            <div style={styles.examplePinyin}>{getPinyin(cardData.example)}</div>
                                            <div style={styles.exampleText}>{cardData.example}</div>
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
            <div style={styles.completionContainer}>
                <h2>🎉 အားလုံးပြီးဆုံးပါပြီ!</h2> 
                <p>သင်သည် စာလုံးအားလုံးကို လေ့လာပြီးပါပြီ။</p>
                <button style={{...styles.knowButton, ...styles.knowButtonBase}} onClick={onClose}>ပိတ်မည်</button>
            </div>
        )}

        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="ဆက်တင်များ"><FaCog size={18} /></button>
                <button style={styles.rightIconButton} onClick={handleListen} title="အသံထွက်လေ့ကျင့်ရန်">{isListening ? <FaStop size={18} color={'#dc2626'}/> : <FaMicrophone size={18} color={'#4a5568'} />}</button>
                {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="ရေးနည်း"><FaPenFancy size={18} /></button>)}
                <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "ပယ်ဖျက်" : "သိမ်းဆည်း"}>{isFavoriteCard ? <FaHeart size={18} color="#f87171" /> : <FaRegHeart size={18} />}</button>
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

// =================================================================================
// ===== 样式表 ====================================================================
// =================================================================================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#30505E' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '80px 20px 150px 20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    // ✅ 修复：fontFamily 使用 Arial 解决第一声声调偏移
    pinyin: { fontFamily: '"Arial", "Helvetica", sans-serif', fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '3.2rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    revealedContent: { marginTop: '1rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' },
    textWordBurmese: { fontSize: '2.0rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    mnemonicBox: { color: '#fff', display: 'inline-block', textAlign: 'center', fontSize: '1.2rem', textShadow: '0 1px 4px rgba(0,0,0,0.5)', backgroundColor: 'rgba(252, 211, 77, 0.2)', padding: '8px 16px', borderRadius: '12px', maxWidth: '100%' },
    exampleBox: { color: '#fff', width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textShadow: '0 1px 4px rgba(0,0,0,0.5)', cursor: 'pointer' },
    // ✅ 修复：fontFamily 使用 Arial
    examplePinyin: { fontFamily: '"Arial", "Helvetica", sans-serif', fontSize: '1.1rem', color: '#fcd34d', marginBottom: '0.5rem', opacity: 0.9, letterSpacing: '0.05em' },
    exampleText: { fontSize: '1.4rem', lineHeight: 1.5 },
    rightControls: { position: 'fixed', bottom: '40%', right: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', transform: 'translateY(50%)' },
    rightIconButton: { background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', boxShadow: '0 3px 10px rgba(0,0,0,0.15)', transition: 'transform 0.2s, background 0.2s', color: '#4a5568', backdropFilter: 'blur(4px)' },
    bottomControlsContainer: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
    bottomCenterCounter: { background: 'rgba(0, 0, 0, 0.3)', color: 'white', padding: '8px 18px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(5px)', cursor: 'pointer', userSelect: 'none' },
    knowButtonsWrapper: { display: 'flex', width: '100%', maxWidth: '400px', gap: '15px' },
    knowButtonBase: { flex: 1, padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' },
    dontKnowButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    knowButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    completionContainer: { textAlign: 'center', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '15px' },
    comparisonPanel: { width: '100%', maxWidth: '500px', maxHeight: '90vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
    resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
    errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: 1 },
    lengthError: { textAlign: 'center', color: '#b91c1c', padding: '10px 0' },
    comparisonGrid: { display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' },
    comparisonCell: { flex: '1 1 120px', padding: '12px', borderRadius: '12px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' },
    comparisonChar: { fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' },
    comparisonPinyinGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' },
    pinyinVisualizerContainer: { display: 'flex', alignItems: 'baseline', fontSize: '1.5rem', height: '1.8rem', color: '#333', fontFamily: '"Arial", sans-serif' },
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
    settingControl: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
    settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: '100px' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002 },
    jumpModalContent: { background: 'white', padding: '25px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    jumpModalTitle: { marginTop: 0, marginBottom: '15px', color: '#333' },
    jumpModalInput: { width: '100px', padding: '10px', fontSize: '1.2rem', textAlign: 'center', border: '2px solid #ccc', borderRadius: '8px', marginBottom: '15px' },
    jumpModalButton: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#4299e1', color: 'white', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};

export default WordCard;
