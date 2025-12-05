// components/WordCard.js (纯净修复版：无广告 + 修复 Messenger 分享 + 修复编译错误)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, 
    FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaCheck, FaRedo,
    FaFacebookMessenger // Messenger 图标
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// ===== 数据库配置 =====
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 2;
const STORE_FAVORITES = 'favoriteWords';
const STORE_AUDIO = 'audioCache';

// --- 数据库辅助函数 ---
function openDB() {
    if (typeof window === 'undefined') return Promise.reject("Server side");
    
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('数据库打开失败');
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
                db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_AUDIO)) {
                db.createObjectStore(STORE_AUDIO);
            }
        };
    });
}

// 收藏相关操作
async function toggleFavorite(word) {
    if (typeof window === 'undefined') return false;
    if (!word || !word.id) return false;
    
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FAVORITES, 'readwrite');
        const store = tx.objectStore(STORE_FAVORITES);
        
        return new Promise((resolve) => {
            const getReq = store.get(word.id);
            getReq.onsuccess = () => {
                const existing = getReq.result;
                if (existing) {
                    store.delete(word.id);
                    resolve(false);
                } else {
                    const wordToStore = { ...word };
                    store.put(wordToStore);
                    resolve(true);
                }
            };
            getReq.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
}

async function isFavorite(id) {
    if (typeof window === 'undefined' || !id) return false;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FAVORITES, 'readonly');
        const store = tx.objectStore(STORE_FAVORITES);
        return new Promise((resolve) => {
            const getReq = store.get(id);
            getReq.onsuccess = () => resolve(!!getReq.result);
            getReq.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
}

// =================================================================================
// ===== 音频管理与 TTS 逻辑 =====
// =================================================================================
const generateAudioKey = (text, voice, rate) => `${text}_${voice}_${rate}`;

async function cacheAudioData(key, blob) {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        const store = tx.objectStore(STORE_AUDIO);
        store.put(blob, key);
    } catch (e) { console.warn("缓存写入失败", e); }
}

async function getCachedAudio(key) {
    if (typeof window === 'undefined') return null;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_AUDIO, 'readonly');
        const store = tx.objectStore(STORE_AUDIO);
        return new Promise((resolve) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    } catch (e) { return null; }
}

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

let sounds = null;
const initSounds = () => {
    if (!sounds && typeof window !== 'undefined') {
        sounds = {
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
            correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
        };
    }
};

let _howlInstance = null;
let _currentAudioUrl = null;

const playBrowserTTS = (text, lang, rate, onEndCallback) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang.includes('my') ? 'my-MM' : 'zh-CN';
    const browserRate = rate >= 0 ? 1 + (rate / 100) : 1 + (rate / 200); 
    utterance.rate = Math.max(0.1, Math.min(browserRate, 2.0)); 
    utterance.onend = () => { if (onEndCallback) onEndCallback(); };
    utterance.onerror = (e) => { if (onEndCallback) onEndCallback(); };
    window.speechSynthesis.speak(utterance);
};

const playTTS = async (text, voice, rate, source, onEndCallback, e, onlyCache = false) => {
    if (typeof window === 'undefined') return;
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text) { if (onEndCallback && !onlyCache) onEndCallback(); return; }

    if (source === 'browser') {
        if (onlyCache) return; 
        if (voice && voice.includes('my')) {
            if (onEndCallback) onEndCallback();
            return;
        }
        if (_howlInstance?.playing()) _howlInstance.stop();
        playBrowserTTS(text, voice, rate, onEndCallback);
        return;
    }

    window.speechSynthesis.cancel();
    const cacheKey = generateAudioKey(text, voice, Math.round(rate / 2));

    if (onlyCache) {
        const existing = await getCachedAudio(cacheKey);
        if (existing) return;
    } else {
        if (_howlInstance?.playing()) _howlInstance.stop();
        if (_currentAudioUrl) { URL.revokeObjectURL(_currentAudioUrl); _currentAudioUrl = null; }
    }

    let audioBlob = await getCachedAudio(cacheKey);

    if (!audioBlob) {
        try {
            const apiUrl = 'https://libretts.is-an.org/api/tts';
            const rateValue = Math.round(rate / 2);
            let response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }),
            });

            if (!response.ok) {
                let lang = 'en';
                if (voice.includes('zh')) lang = 'zh-CN';
                else if (voice.includes('my')) lang = 'my';
                const backupUrl = `/api/google-tts?text=${encodeURIComponent(text)}&lang=${lang}`;
                response = await fetch(backupUrl);
                if (!response.ok) throw new Error('TTS Failed');
            }

            audioBlob = await response.blob();
            await cacheAudioData(cacheKey, audioBlob);
        } catch (error) {
            console.error('TTS Error:', error);
            if (onEndCallback && !onlyCache) onEndCallback();
            return;
        }
    }

    if (onlyCache) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    _currentAudioUrl = audioUrl;

    _howlInstance = new Howl({
        src: [audioUrl],
        format: ['mpeg', 'mp3', 'webm'],
        html5: true,
        onend: () => { if (onEndCallback) onEndCallback(); },
        onloaderror: () => { if (onEndCallback) onEndCallback(); },
        onplayerror: () => { _howlInstance.once('unlock', function() { _howlInstance.play(); }); if (onEndCallback) onEndCallback(); }
    });

    _howlInstance.play();
};

const playSoundEffect = (type) => {
    if (typeof window !== 'undefined') {
        initSounds();
        if (sounds && sounds[type]) sounds[type].play();
    }
};

const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        if (typeof window === 'undefined') {
            return { order: 'sequential', ttsSource: 'server', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' };
        }
        try {
            const savedSettings = localStorage.getItem('learningWordCardSettings');
            const defaultSettings = { order: 'sequential', ttsSource: 'server', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' };
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
        } catch (error) {
            return { order: 'sequential', ttsSource: 'server', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' };
        }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try { localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) {}
        }
    }, [settings]);

    return [settings, setSettings];
};

// =================================================================================
// ===== 子组件 =====
// =================================================================================

const RecordingComparisonModal = ({ word, settings, onClose }) => {
    const [status, setStatus] = useState('idle'); 
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const localAudioRef = useRef(null); 

    useEffect(() => {
        return () => {
            if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (localAudioRef.current) localAudioRef.current.unload();
            if (_howlInstance) _howlInstance.stop();
            if (typeof window !== 'undefined') window.speechSynthesis.cancel();
        };
    }, [userAudioUrl]);

    const startRecording = async () => {
        if (_howlInstance?.playing()) _howlInstance.stop();
        if (typeof window !== 'undefined') window.speechSynthesis.cancel();
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
        } catch (err) { alert("无法访问麦克风，请检查权限。"); }
    };

    const stopRecording = () => { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); };
    const resetRecording = () => { if (userAudioUrl) URL.revokeObjectURL(userAudioUrl); setUserAudioUrl(null); setStatus('idle'); };
    const playStandard = () => { if (localAudioRef.current?.playing()) localAudioRef.current.stop(); playTTS(word.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource); };
    const playUser = () => { if (!userAudioUrl) return; if (_howlInstance?.playing()) _howlInstance.stop(); if (typeof window !== 'undefined') window.speechSynthesis.cancel(); if (localAudioRef.current) localAudioRef.current.unload(); localAudioRef.current = new Howl({ src: [userAudioUrl], format: ['webm'], html5: true }); localAudioRef.current.play(); };

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>发音对比</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={styles.recordContent}>
                    <div style={styles.recordWordDisplay}><div style={styles.pinyin}>{pinyinConverter(word.chinese, { toneType: 'symbol', separator: ' ' })}</div><div style={styles.textWordChinese}>{word.chinese}</div></div>
                    <div style={styles.actionArea}>
                        {status === 'idle' && (<div style={styles.idleStateContainer}><button style={styles.bigRecordBtn} onClick={startRecording}><FaMicrophone size={32} /></button><div style={styles.instructionText}>点击开始录音</div></div>)}
                        {status === 'recording' && (<div style={styles.idleStateContainer}><button style={{...styles.bigRecordBtn, ...styles.recordingPulse, background: '#ef4444'}} onClick={stopRecording}><FaStop size={32} /></button><div style={{...styles.instructionText, color: '#ef4444'}}>正在录音... 点击停止</div></div>)}
                        {status === 'review' && (<div style={styles.reviewContainer}><div style={styles.reviewRow}><div style={styles.reviewItem}><div style={styles.reviewLabel}>标准发音</div><button style={styles.circleBtnBlue} onClick={playStandard}><FaVolumeUp size={24} /></button></div><div style={styles.reviewItem}><div style={styles.reviewLabel}>你的发音</div><button style={styles.circleBtnGreen} onClick={playUser}><FaPlayCircle size={24} /></button></div></div><button style={styles.retryLink} onClick={resetRecording}><FaRedo size={12} /> 不满意？点击重录</button></div>)}
                    </div>
                </div>
                {status === 'review' && (<button style={styles.recordDoneBtn} onClick={onClose}><FaCheck /> 完成练习</button>)}
            </div>
        </div>
    );
};

const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
    const handleSettingChange = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };
    const handleImageUpload = (e) => { const file = e.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (loadEvent) => { handleSettingChange('backgroundImage', loadEvent.target.result); }; reader.readAsDataURL(file); } };
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{ marginTop: 0 }}>常规设置</h2>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{ ...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown /> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{ ...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom /> 随机</button></div></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>语音来源</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('ttsSource', 'server')} style={{ ...styles.settingButton, background: settings.ttsSource === 'server' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.ttsSource === 'server' ? 'white' : '#4a5568' }}>云端高音质</button><button onClick={() => handleSettingChange('ttsSource', 'browser')} style={{ ...styles.settingButton, background: settings.ttsSource === 'browser' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.ttsSource === 'browser' ? 'white' : '#4a5568' }}>浏览器本地</button></div></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> 自动朗读例句</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay / 1000}秒后自动切换</label></div></div>
                <h2 style={{ marginTop: '30px' }}>外观设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>自定义背景</label><div style={styles.settingControl}><input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} /><button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>上传图片</button><button style={{ ...styles.settingButton, flex: '0 1 auto' }} onClick={() => handleSettingChange('backgroundImage', '')}>恢复默认</button></div></div>
                <h2 style={{ marginTop: '30px' }}>发音设置</h2>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} disabled={settings.ttsSource === 'browser'} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速</label><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /></div>
            </div>
        </div>
    );
});

const JumpModal = ({ max, current, onJump, onClose }) => {
    const [inputValue, setInputValue] = useState(current + 1); const inputRef = useRef(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);
    const handleJump = () => { const num = parseInt(inputValue, 10); if (num >= 1 && num <= max) { onJump(num - 1); } else { alert(`请输入 1 到 ${max} 之间的数字`); } };
    const handleKeyDown = (e) => { if (e.key === 'Enter') handleJump(); };
    return (<div style={styles.jumpModalOverlay} onClick={onClose}><div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}><h3 style={styles.jumpModalTitle}>跳转到卡片</h3><input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} min="1" max={max} /><button style={styles.jumpModalButton} onClick={handleJump}>跳转</button></div></div>);
};

// =================================================================================
// ===== 主组件 WordCard =====
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
        if (typeof document !== 'undefined') {
            const styleId = 'wordcard-pulse-style';
            if (!document.getElementById(styleId)) {
                const styleSheet = document.createElement("style");
                styleSheet.id = styleId;
                styleSheet.innerText = `@keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { transform: scale(1.0); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }`;
                document.head.appendChild(styleSheet);
            }
        }
    }, []);

    const [settings, setSettings] = useCardSettings();

    const processedCards = useMemo(() => {
        if (!Array.isArray(words)) return [];
        try {
            const mapped = words.map(w => ({
                id: w.id || Math.random().toString(36).substr(2, 9),
                chinese: w.chinese || w.word || '', 
                audioText: w.audioText || w.tts_text || (w.chinese || w.word || ''),
                burmese: w.burmese || w.translation || w.meaning || '', 
                mnemonic: w.mnemonic || '',
                example: w.example || '',
            })).filter(w => w.chinese); 

            if (settings.order === 'random') {
                for (let i = mapped.length - 1; i > 0; i--) { 
                    const j = Math.floor(Math.random() * (i + 1)); 
                    [mapped[i], mapped[j]] = [mapped[j], mapped[i]]; 
                }
            }
            return mapped;
        } catch (error) {
            console.error("处理卡片数据出错:", error);
            return [];
        }
    }, [words, settings.order]);

    const [activeCards, setActiveCards] = useState([]);
    useEffect(() => {
        const initialCards = processedCards.length > 0 
            ? processedCards 
            : [{ id: 'fallback', chinese: "暂无单词", burmese: "请检查数据源", audioText: "暂无单词" }];
        setActiveCards(initialCards);
    }, [processedCards]);

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (typeof window !== 'undefined' && progressKey) {
            const savedIndex = localStorage.getItem(`word_progress_${progressKey}`);
            const parsed = parseInt(savedIndex, 10);
            if (!isNaN(parsed) && parsed >= 0 && processedCards.length > 0) {
                setCurrentIndex(parsed < processedCards.length ? parsed : 0);
            } else {
                setCurrentIndex(0);
            }
        } else {
            setCurrentIndex(0);
        }
    }, [progressKey, processedCards.length]);

    useEffect(() => {
        if (processedCards.length > 0 && typeof window !== 'undefined' && progressKey) {
            localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
        }
    }, [currentIndex, progressKey, processedCards.length]);

    useEffect(() => {
        if (!activeCards.length || settings.ttsSource !== 'server') return;
        const preloadCount = 3;
        for (let i = 1; i <= preloadCount; i++) {
            const nextIdx = (currentIndex + i) % activeCards.length;
            const nextCard = activeCards[nextIdx];
            if (nextCard && nextCard.audioText && nextCard.id !== 'fallback') {
                playTTS(nextCard.audioText, settings.voiceChinese, settings.speechRateChinese, 'server', null, null, true);
            }
        }
    }, [currentIndex, activeCards, settings]);

    const [isRevealed, setIsRevealed] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRecordingOpen, setIsRecordingOpen] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [isFavoriteCard, setIsFavoriteCard] = useState(false);
    const [isJumping, setIsJumping] = useState(false);
    const autoBrowseTimerRef = useRef(null);
    const lastDirection = useRef(0);
    const currentCard = activeCards.length > 0 ? activeCards[currentIndex] : null;

    useEffect(() => {
        let isActive = true;
        setIsRevealed(false);
        setIsFavoriteCard(false); 
        if (currentCard?.id && currentCard.id !== 'fallback') {
            isFavorite(currentCard.id).then(result => { if (isActive) setIsFavoriteCard(result); });
        }
        return () => { isActive = false; };
    }, [currentCard?.id]);

    const handleToggleFavorite = async (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!currentCard || currentCard.id === 'fallback') return;
        const newState = !isFavoriteCard;
        setIsFavoriteCard(newState);
        const result = await toggleFavorite(currentCard);
        if (result !== newState) setIsFavoriteCard(result);
    };

    // --- Messenger 分享逻辑 ---
    const handleFacebookShare = useCallback((e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!currentCard || currentCard.id === 'fallback') return;

        // 获取绝对链接
        const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://www.facebook.com';
        
        // 检测移动端
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            window.location.href = `fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`;
        } else {
            const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            window.open(facebookUrl, '_blank', 'width=600,height=500,noopener,noreferrer');
        }
    }, [currentCard]);

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
            if (settings.autoPlayChinese && currentCard.chinese && currentCard.id !== 'fallback') {
                playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, () => {
                    if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
                        playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, settings.ttsSource, () => {
                            if (settings.autoPlayExample && currentCard.example && isRevealed) {
                                playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, startAutoBrowseTimer);
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

    const handleSidePlay = useCallback((e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!currentCard || currentCard.id === 'fallback') return;
        if (_howlInstance?.playing()) _howlInstance.stop();
        if (typeof window !== 'undefined') window.speechSynthesis.cancel();
        
        if (!isRevealed) { 
            playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource); 
        } else { 
            playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, settings.ttsSource, () => { if (currentCard.example) playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource); }); 
        }
    }, [currentCard, isRevealed, settings]);

    const handleOpenRecorder = useCallback((e) => { if (e && e.stopPropagation) e.stopPropagation(); if (_howlInstance?.playing()) _howlInstance.stop(); if (typeof window !== 'undefined') window.speechSynthesis.cancel(); setIsRecordingOpen(true); }, []);
    const handleKnow = () => { if (_howlInstance?.playing()) _howlInstance.stop(); if (typeof window !== 'undefined') window.speechSynthesis.cancel(); if (!currentCard) return; navigate(1); };
    const handleDontKnow = () => { if (_howlInstance?.playing()) _howlInstance.stop(); if (typeof window !== 'undefined') window.speechSynthesis.cancel(); if (isRevealed) { navigate(1); } else { setIsRevealed(true); } };

    const pageTransitions = useTransition(isOpen, { from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 }, });
    const cardTransitions = useTransition(currentIndex, { key: currentCard ? currentCard.id : currentIndex, from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, config: { mass: 1, tension: 280, friction: 30 }, onStart: () => { if (currentCard) playSoundEffect('switch'); }, });

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
                {isRecordingOpen && currentCard && (<RecordingComparisonModal word={currentCard} settings={settings} onClose={() => setIsRecordingOpen(false)} />)}
                {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={handleJumpToCard} onClose={() => setIsJumping(false)} />}

                {activeCards.length > 0 && currentCard ? (
                    cardTransitions((cardStyle, i) => {
                        const cardData = activeCards[i];
                        if (!cardData) return null;
                        const isFallback = cardData.id === 'fallback';
                        return (
                            <animated.div key={cardData.id} style={{ ...styles.animatedCardShell, ...cardStyle }}>
                                <div style={styles.cardContainer}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ cursor: isFallback ? 'default' : 'pointer' }} onClick={(e) => !isFallback && playTTS(cardData.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, null, e)}>
                                            {!isFallback && <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>}
                                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                                        </div>
                                        {isRevealed && !isFallback && (
                                            <animated.div style={styles.revealedContent}>
                                                <div style={{ cursor: 'pointer', marginTop: '1.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, settings.ttsSource, null, e)}><div style={styles.textWordBurmese}>{cardData.burmese}</div></div>
                                                {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}
                                                {cardData.example && (
                                                    <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, null, e)}>
                                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                                            <div style={styles.examplePinyin}>{pinyinConverter(cardData.example, { toneType: 'symbol', separator: ' ' })}</div>
                                                            <div style={styles.exampleText}>{cardData.example}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </animated.div>
                                        )}
                                        {isRevealed && isFallback && <div style={{marginTop: 20, color: '#ccc'}}>没有找到对应的数据</div>}
                                    </div>
                                </div>
                            </animated.div>
                        );
                    })
                ) : (<div style={styles.completionContainer}><h2>🎉 全部完成！</h2><p>你已学完本列表中的所有单词。</p><button style={{ ...styles.knowButton, ...styles.knowButtonBase }} onClick={onClose}>关闭</button></div>)}

                {currentCard && currentCard.id !== 'fallback' && (
                    <div style={styles.rightControls} data-no-gesture="true">
                        <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置" data-no-gesture="true"><FaCog size={18} style={{ pointerEvents: 'none' }} /></button>
                        <button style={styles.rightIconButton} onClick={handleSidePlay} title="播放" data-no-gesture="true"><FaVolumeUp size={18} color="#4a5568" style={{ pointerEvents: 'none' }} /></button>
                        <button style={styles.rightIconButton} onClick={handleOpenRecorder} title="发音对比" data-no-gesture="true"><FaMicrophone size={18} color={'#4a5568'} style={{ pointerEvents: 'none' }} /></button>
                        
                        {/* Messenger 分享按钮 */}
                        <button style={{...styles.rightIconButton, color: '#0084FF'}} onClick={handleFacebookShare} title="分享到 Messenger" data-no-gesture="true">
                            <FaFacebookMessenger size={20} style={{ pointerEvents: 'none' }} />
                        </button>
                        
                        {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && (
                            <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺" data-no-gesture="true"><FaPenFancy size={18} style={{ pointerEvents: 'none' }} /></button>
                        )}
                        <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"} data-no-gesture="true">
                            {isFavoriteCard ? <FaHeart size={18} color="#f87171" style={{ pointerEvents: 'none' }} /> : <FaRegHeart size={18} style={{ pointerEvents: 'none' }} />}
                        </button>
                    </div>
                )}
                <div style={styles.bottomControlsContainer} data-no-gesture="true">
                    {activeCards.length > 0 && (<div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>)}
                    <div style={styles.knowButtonsWrapper}><button style={{ ...styles.knowButtonBase, ...styles.dontKnowButton }} onClick={handleDontKnow}>不认识</button><button style={{ ...styles.knowButtonBase, ...styles.knowButton }} onClick={handleKnow}>认识</button></div>
                </div>
            </animated.div>
        );
    });

    if (isMounted) return createPortal(cardContent, document.body);
    return null;
};

// 样式定义
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#30505E' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' }, // 移除多余的padding
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    pinyin: { fontFamily: 'Roboto, "Segoe UI", Arial, sans-serif', fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' },
    textWordChinese: { fontSize: '3.2rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' },
    revealedContent: { marginTop: '1rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' },
    textWordBurmese: { fontSize: '2.0rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    mnemonicBox: { color: '#E0E0E0', textAlign: 'center', fontSize: '1.2rem', textShadow: '0 1px 4px rgba(0,0,0,0.5)', backgroundColor: 'rgba(0, 0, 0, 0.25)', padding: '10px 18px', borderRadius: '16px', maxWidth: '90%', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(3px)' },
    exampleBox: { color: '#fff', width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textShadow: '0 1px 4px rgba(0,0,0,0.5)', cursor: 'pointer', padding: '10px', borderRadius: '12px', transition: 'background-color 0.2s' },
    examplePinyin: { fontFamily: 'Roboto, "Segoe UI", Arial, sans-serif', fontSize: '1.1rem', color: '#fcd34d', marginBottom: '0.5rem', opacity: 0.9, letterSpacing: '0.05em' },
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
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '10px' },
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
    recordDoneBtn: { width: '100%', padding: '15px', background: '#111827', color: 'white', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
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
