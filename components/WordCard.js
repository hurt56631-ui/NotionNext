// components/WordCard.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, 
    FaSortAmountDown, FaHeart, FaRegHeart, FaPlayCircle, 
    FaStop, FaVolumeUp, FaRedo, FaTrash, FaSpinner 
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import { AdSlot } from '@/components/GoogleAdsense';
import InterstitialAd from './InterstitialAd';

// =================================================================================
// ===== 数据库和辅助工具部分 =====
// =================================================================================

const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';
const TTS_CACHE_NAME = 'tts-audio-cache-v1';

// --- IndexedDB: 用于存储收藏单词 (结构化数据适合 IDB) ---
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
    } catch (e) {
        console.error("Favorite DB Error:", e);
        return false;
    }
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
    } catch (e) {
        return false;
    }
}

// --- 常量定义 ---
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
let _currentBlobUrl = null; // 用于追踪当前播放的 URL 以便清理

// --- 增强版 TTS 播放逻辑 (使用 Cache API) ---
// 改进理由：Cache API 是浏览器专门为 Request/Response 缓存设计的，比 IndexedDB 处理二进制流更高效。
const getTTSUrl = async (text, voice, rate) => {
    if (!text) return null;
    const rateValue = Math.round(rate / 2);
    // 生成唯一缓存键
    const cacheKey = `tts-${voice}-${rateValue}-${encodeURIComponent(text)}`;
    
    try {
        // 尝试从 Cache API 获取
        if ('caches' in window) {
            const cache = await caches.open(TTS_CACHE_NAME);
            const cachedResponse = await cache.match(cacheKey);
            
            if (cachedResponse) {
                const blob = await cachedResponse.blob();
                return URL.createObjectURL(blob);
            }
        }

        // 缓存未命中，发起网络请求
        const apiUrl = 'https://libretts.is-an.org/api/tts';
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }), 
        });

        if (!response.ok) throw new Error('TTS Network Error');
        
        const blob = await response.blob();
        
        // 存入缓存
        if ('caches' in window) {
            const cache = await caches.open(TTS_CACHE_NAME);
            cache.put(cacheKey, new Response(blob.clone(), { headers: { 'Content-Type': 'audio/mpeg' } }));
        }
        
        return URL.createObjectURL(blob);
    } catch (error) {
        console.warn('TTS Fetch failed, trying backup:', error);
        // 备用 Google TTS 逻辑
        try {
            let lang = voice.includes('zh') ? 'zh-CN' : 'my';
            const backupUrl = `/api/google-tts?text=${encodeURIComponent(text)}&lang=${lang}`;
            return backupUrl;
        } catch (e) {
            console.error('All TTS failed');
            return null;
        }
    }
};

const playTTS = async (text, voice, rate, onEndCallback, setLoadingState, e) => { 
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; } 
    
    if (_howlInstance?.playing()) _howlInstance.stop(); 
    
    // 清理上一个 Blob URL，防止内存泄漏
    if (_currentBlobUrl && _currentBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(_currentBlobUrl);
        _currentBlobUrl = null;
    }

    if (setLoadingState) setLoadingState(true);

    try {
        const audioUrl = await getTTSUrl(text, voice, rate);
        if (setLoadingState) setLoadingState(false);
        
        if (!audioUrl) { if (onEndCallback) onEndCallback(); return; }

        _currentBlobUrl = audioUrl; // 记录当前 URL

        _howlInstance = new Howl({ 
            src: [audioUrl], 
            format: ['mpeg', 'mp3'], 
            html5: true, 
            onend: () => { if (onEndCallback) onEndCallback(); },
            onloaderror: () => { if (onEndCallback) onEndCallback(); },
            onplayerror: () => { if (onEndCallback) onEndCallback(); }
        }); 
        _howlInstance.play();
    } catch (err) {
        if (setLoadingState) setLoadingState(false);
        if (onEndCallback) onEndCallback();
    }
};

// 预加载函数 (只请求并缓存，不播放)
const preloadTTS = async (text, voice, rate) => {
    if (!text) return;
    await getTTSUrl(text, voice, rate);
};

// =================================================================================
// ===== 子组件 =====
// =================================================================================

// --- 纯录音对比组件 ---
const AudioRecorderModal = ({ correctWord, settings, onClose }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const [isPlayingModel, setIsPlayingModel] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // 清理录音URL
    useEffect(() => {
        return () => { if (userAudioUrl) URL.revokeObjectURL(userAudioUrl); };
    }, [userAudioUrl]);

    const startRecording = async () => {
        if (_howlInstance?.playing()) _howlInstance.stop();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);
                setUserAudioUrl(url);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("麦克风调用失败", err);
            alert("无法访问麦克风，请检查权限。");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const playUserAudio = () => {
        if (!userAudioUrl) return;
        if (_howlInstance?.playing()) _howlInstance.stop();
        const sound = new Howl({ src: [userAudioUrl], format: ['webm'], html5: true });
        sound.play();
    };

    const playModelAudio = () => {
        setIsPlayingModel(true);
        playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese, () => {
            setIsPlayingModel(false);
        }, null);
    };

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.recorderPanel} onClick={e => e.stopPropagation()}>
                <h3 style={{marginTop: 0, textAlign: 'center', color: '#333'}}>发音跟读</h3>
                <div style={styles.recorderWordDisplay}>{correctWord}</div>
                
                <div style={styles.recorderControls}>
                    <button style={styles.recorderBtn} onClick={playModelAudio} disabled={isPlayingModel}>
                        {isPlayingModel ? <FaSpinner className="spin" /> : <FaVolumeUp size={20} />} 
                        {isPlayingModel ? '播放中...' : '听原音'}
                    </button>
                    
                    {!isRecording ? (
                        <button style={{...styles.recorderBtn, background: '#ef4444', color: 'white'}} onClick={startRecording}>
                            <FaMicrophone size={20} /> 开始录音
                        </button>
                    ) : (
                        <button style={{...styles.recorderBtn, background: '#6b7280', color: 'white'}} onClick={stopRecording}>
                            <FaStop size={20} /> 停止录音
                        </button>
                    )}

                    <button 
                        style={{...styles.recorderBtn, opacity: userAudioUrl ? 1 : 0.5}} 
                        onClick={playUserAudio} 
                        disabled={!userAudioUrl}
                    >
                        <FaPlayCircle size={20} /> 听回放
                    </button>
                </div>

                <div style={{marginTop: '20px', display: 'flex', justifyContent: 'center'}}>
                    <button style={styles.closeRecorderBtn} onClick={onClose}>完成练习</button>
                </div>
            </div>
        </div>
    );
};

// --- 设置组件 ---
const useCardSettings = () => { 
    const [settings, setSettings] = useState(() => { 
        try { 
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
                speechRateChinese: -30, // 默认改为 -30
                speechRateBurmese: 0, 
                backgroundImage: '', 
            }; 
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings; 
        } catch (error) { 
            return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: -30, speechRateBurmese: 0, backgroundImage: '' }; 
        } 
    }); 
    useEffect(() => { localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); }, [settings]); 
    return [settings, setSettings]; 
};

const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => { 
    const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); }; 
    const handleImageUpload = (e) => { 
        const file = e.target.files[0]; 
        if (file && file.type.startsWith('image/')) { 
            const reader = new FileReader(); 
            reader.onload = (loadEvent) => handleSettingChange('backgroundImage', loadEvent.target.result); 
            reader.readAsDataURL(file); 
        } 
    }; 
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{marginTop: 0}}>常规设置</h2>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> 自动朗读例句</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div>
                <h2 style={{marginTop: '30px'}}>外观设置</h2>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>自定义背景</label><div style={styles.settingControl}><input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} /><button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>上传图片</button><button style={{...styles.settingButton, flex: '0 1 auto'}} onClick={() => handleSettingChange('backgroundImage', '')}>恢复默认</button></div></div>
                <h2 style={{marginTop: '30px'}}>发音设置</h2>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div>
            </div>
        </div>
    ); 
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
    return ( 
        <div style={styles.jumpModalOverlay} onClick={onClose}>
            <div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}>
                <h3 style={styles.jumpModalTitle}>跳转到卡片</h3>
                <input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJump()} min="1" max={max} />
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
  
  // 改进：组件卸载时清理音频资源
  useEffect(() => { 
    setIsMounted(true);
    return () => { 
        if (_howlInstance) _howlInstance.stop();
        if (_currentBlobUrl && _currentBlobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(_currentBlobUrl);
        }
    };
  }, []);

  const [settings, setSettings] = useCardSettings();
  
  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 改进：防抖动/防重复点击锁
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // 初始化列表与进度恢复
  useEffect(() => {
    if (words.length === 0) return;

    let initialCards = words.map(w => ({ ...w })); 
    
    // 如果是随机模式，打乱数组
    if (settings.order === 'random') {
        for (let i = initialCards.length - 1; i > 0; i--) { 
            const j = Math.floor(Math.random() * (i + 1)); 
            [initialCards[i], initialCards[j]] = [initialCards[j], initialCards[i]]; 
        }
    }

    // 进度恢复逻辑
    const savedProgressId = localStorage.getItem(`learningProgress_ID_${progressKey}`);
    let startIndex = 0;
    
    if (savedProgressId) {
        const foundIndex = initialCards.findIndex(w => w.id === savedProgressId);
        if (foundIndex !== -1) startIndex = foundIndex;
    }

    setActiveCards(initialCards);
    setCurrentIndex(startIndex);
  }, [words, settings.order, progressKey]);

  // 进度保存 & 自动预加载逻辑
  useEffect(() => {
    if (activeCards.length > 0 && activeCards[currentIndex]) {
        // 1. 保存当前卡片的 ID 到 LocalStorage
        localStorage.setItem(`learningProgress_ID_${progressKey}`, activeCards[currentIndex].id);
        
        // 2. 预加载后 3 个单词的音频 (缓存到 Cache API)
        const preloadRange = 3;
        for (let i = 1; i <= preloadRange; i++) {
            const nextCard = activeCards[currentIndex + i];
            if (nextCard) {
                preloadTTS(nextCard.chinese, settings.voiceChinese, settings.speechRateChinese);
                if (nextCard.burmese) preloadTTS(nextCard.burmese, settings.voiceBurmese, settings.speechRateBurmese);
                if (nextCard.example) preloadTTS(nextCard.example, settings.voiceChinese, settings.speechRateChinese);
            }
        }
    }
  }, [currentIndex, activeCards, progressKey, settings]);

  const [isRevealed, setIsRevealed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  
  const wordCounterRef = useRef(0);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  
  const currentCard = activeCards.length > 0 ? activeCards[currentIndex] : null;

  useEffect(() => { 
      if (currentCard?.id) { 
          // 检查是否在 IDB 的收藏夹中
          isFavorite(currentCard.id).then(setIsFavoriteCard); 
      }
      setIsRevealed(false);
      setIsLoadingAudio(false);
  }, [currentCard]);
  
  const handleToggleFavorite = async (e) => { 
      if (e && e.stopPropagation) e.stopPropagation();
      if (!currentCard) return; 
      const newState = !isFavoriteCard;
      setIsFavoriteCard(newState);
      const result = await toggleFavorite(currentCard);
      if (result !== newState) setIsFavoriteCard(result);
  };
  
  const navigate = useCallback((direction) => { 
    if (activeCards.length === 0) return;
    
    setIsProcessing(true); // 锁定交互
    lastDirection.current = direction;

    wordCounterRef.current += 1;
    if (wordCounterRef.current >= 20) {
        setShowInterstitial(true);
        wordCounterRef.current = 0;
    }

    setCurrentIndex(prev => {
        const next = prev + direction;
        if (next < 0) return activeCards.length - 1; 
        if (next >= activeCards.length) return 0; 
        return next;
    }); 
    
    // 短暂延迟后释放锁，配合动画时间
    setTimeout(() => {
        setIsProcessing(false);
    }, 350);

  }, [activeCards.length]);

  const handleJumpToCard = (index) => { 
      if (index >= 0 && index < activeCards.length) { 
          lastDirection.current = index > currentIndex ? 1 : -1; 
          setCurrentIndex(index); 
      } 
      setIsJumping(false); 
  };

  // 自动播放逻辑
  useEffect(() => {
    if (!isOpen || !currentCard) return;
    clearTimeout(autoBrowseTimerRef.current);

    const playFullSequence = () => {
        if (settings.autoPlayChinese && currentCard.chinese) {
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => {
                if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
                        if (settings.autoPlayExample && currentCard.example && isRevealed) {
                           playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, startAutoBrowseTimer, setIsLoadingAudio);
                        } else {
                           startAutoBrowseTimer();
                        }
                    }, setIsLoadingAudio);
                } else {
                    startAutoBrowseTimer();
                }
            }, setIsLoadingAudio);
        } else {
             startAutoBrowseTimer();
        }
    };
    
    const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };
    const initialPlayTimer = setTimeout(playFullSequence, 600);
    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate, isRevealed]);

  const handleSidePlay = useCallback((e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!currentCard) return;
    if (_howlInstance?.playing()) _howlInstance.stop();

    if (!isRevealed) {
        playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, null, setIsLoadingAudio);
    } else {
        playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
            if (currentCard.example) playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, null, setIsLoadingAudio);
        }, setIsLoadingAudio);
    }
  }, [currentCard, isRevealed, settings]);
  
  // "认识" - 直接下一个
  const handleKnow = () => {
    if (isProcessing) return; // 防止连点
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (!currentCard) return;
    navigate(1);
  };

  // "不认识" - 核心逻辑：将卡片插入到队列后面（概率增加逻辑）
  const handleDontKnow = () => { 
      if (isProcessing) return; // 防止连点
      if (_howlInstance?.playing()) _howlInstance.stop();
      if (!isRevealed) { 
          setIsRevealed(true); 
          return; 
      }
      
      // 智能复习逻辑：将当前卡片复制并插入到当前位置 + 5 的地方
      if (currentCard) {
          setActiveCards(prev => {
              const newCards = [...prev];
              // 确保不越界
              const insertIndex = Math.min(newCards.length, currentIndex + 5);
              
              // 改进：生成更稳健的唯一 ID，防止 React key 冲突
              // 使用原始 ID + 随机后缀
              const originalId = currentCard.id.toString().split('_retry_')[0];
              const uniqueId = `${originalId}_retry_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
              
              const clonedCard = { ...currentCard, id: uniqueId };
              
              // 插入
              newCards.splice(insertIndex, 0, clonedCard);
              return newCards;
          });
      }
      
      navigate(1); 
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

  const playSoundEffect = (type) => { if (_howlInstance?.playing()) _howlInstance.stop(); if (sounds[type]) sounds[type].play(); };

  const cardContent = pageTransitions((style, item) => {
    const bgUrl = settings.backgroundImage;
    const backgroundStyle = bgUrl ? { background: `url(${bgUrl}) center/cover no-repeat` } : {};
    
    return item && (
      <animated.div style={{ ...styles.fullScreen, ...backgroundStyle, ...style }}>
        <InterstitialAd isOpen={showInterstitial} onClose={() => { setShowInterstitial(false); }} />
        <div style={styles.adContainer} data-no-gesture="true"><AdSlot /></div>
        
        <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(prev => !prev)} />
        
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        
        {isRecorderOpen && currentCard && (
            <AudioRecorderModal correctWord={currentCard.chinese} settings={settings} onClose={() => setIsRecorderOpen(false)} />
        )}
        
        {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={handleJumpToCard} onClose={() => setIsJumping(false)} />}
        
        {activeCards.length > 0 && currentCard ? (
            cardTransitions((cardStyle, i) => {
              const cardData = activeCards[i];
              if (!cardData) return null;
              return (
                <animated.div style={{ ...styles.animatedCardShell, ...cardStyle }}>
                  <div style={styles.cardContainer}>
                      <div style={{ textAlign: 'center' }}>
                          <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, setIsLoadingAudio, e)}>
                            <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                          </div>
                          {isRevealed && (
                              <animated.div style={styles.revealedContent}>
                                  <div style={{ cursor: 'pointer', marginTop: '1.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, setIsLoadingAudio, e)}><div style={styles.textWordBurmese}>{cardData.burmese}</div></div>
                                  {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}
                                  {cardData.example && (
                                      <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, null, setIsLoadingAudio, e)}>
                                          <div style={{ flex: 1, textAlign: 'center' }}>
                                            <div style={styles.examplePinyin}>{pinyinConverter(cardData.example, { toneType: 'symbol', separator: ' ' })}</div>
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
            <div style={styles.completionContainer}><h2>🎉 全部完成！</h2><p>你已学完本列表中的所有单词。</p><button style={{...styles.knowButton, ...styles.knowButtonBase}} onClick={onClose}>关闭</button></div>
        )}

        {currentCard && (
          <div style={styles.rightControls} data-no-gesture="true">
            <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置" data-no-gesture="true">
                <FaCog size={18} style={{pointerEvents: 'none'}} />
            </button>
            
            <button style={styles.rightIconButton} onClick={handleSidePlay} title="播放" data-no-gesture="true"> 
                {isLoadingAudio ? (
                    <FaSpinner size={18} className="spin" color="#4a5568" style={{pointerEvents: 'none', animation: 'spin 1s linear infinite'}} />
                ) : (
                    <FaVolumeUp size={18} color="#4a5568" style={{pointerEvents: 'none'}} /> 
                )}
            </button>
            
            <button style={styles.rightIconButton} onClick={() => setIsRecorderOpen(true)} title="发音跟读" data-no-gesture="true">
                <FaMicrophone size={18} color={'#4a5568'} style={{pointerEvents: 'none'}} />
            </button>
            
            {currentCard.chinese && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( 
                <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺" data-no-gesture="true">
                    <FaPenFancy size={18} style={{pointerEvents: 'none'}} />
                </button>
            )}
            
            <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"} data-no-gesture="true">
                {isFavoriteCard ? <FaHeart size={18} color="#f87171" style={{pointerEvents: 'none'}} /> : <FaRegHeart size={18} style={{pointerEvents: 'none'}} />}
            </button>
          </div>
        )}
        
        <div style={styles.bottomControlsContainer} data-no-gesture="true">
            {activeCards.length > 0 && (<div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>)}
            <div style={styles.knowButtonsWrapper}>
                <button 
                    style={{...styles.knowButtonBase, ...styles.dontKnowButton, opacity: isProcessing ? 0.7 : 1}} 
                    onClick={handleDontKnow}
                    disabled={isProcessing}
                >
                    不认识
                </button>
                <button 
                    style={{...styles.knowButtonBase, ...styles.knowButton, opacity: isProcessing ? 0.7 : 1}} 
                    onClick={handleKnow}
                    disabled={isProcessing}
                >
                    认识
                </button>
            </div>
        </div>
        
        {/* 全局 CSS 动画定义，用于 Loading Spinner */}
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .spin { animation: spin 1s linear infinite; }
        `}} />

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
    adContainer: { position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(5px)', textAlign: 'center', padding: '5px 0', minHeight: '50px' },
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#30505E' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '80px 20px 150px 20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    // 强制使用英文字体渲染 Pinyin 以保证符号位置正确
    pinyin: { fontFamily: `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, Arial, sans-serif`, fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em', lineHeight: 1.2 }, 
    textWordChinese: { fontSize: '3.2rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    revealedContent: { marginTop: '1rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' },
    textWordBurmese: { fontSize: '2.0rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    mnemonicBox: { color: '#E0E0E0', textAlign: 'center', fontSize: '1.2rem', textShadow: '0 1px 4px rgba(0,0,0,0.5)', backgroundColor: 'rgba(0, 0, 0, 0.25)', padding: '10px 18px', borderRadius: '16px', maxWidth: '90%', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(3px)' },
    exampleBox: { color: '#fff', width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textShadow: '0 1px 4px rgba(0,0,0,0.5)', cursor: 'pointer', padding: '10px', borderRadius: '12px', transition: 'background-color 0.2s' },
    examplePinyin: { fontFamily: `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, Arial, sans-serif`, fontSize: '1.1rem', color: '#fcd34d', marginBottom: '0.5rem', opacity: 0.9, letterSpacing: '0.05em' },
    exampleText: { fontSize: '1.4rem', lineHeight: 1.5 },
    rightControls: { position: 'fixed', bottom: '40%', right: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', transform: 'translateY(50%)' },
    rightIconButton: { background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', boxShadow: '0 3px 10px rgba(0,0,0,0.15)', transition: 'transform 0.2s, background 0.2s', color: '#4a5568', backdropFilter: 'blur(4px)' },
    bottomControlsContainer: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
    bottomCenterCounter: { background: 'rgba(0, 0, 0, 0.3)', color: 'white', padding: '8px 18px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(5px)', cursor: 'pointer', userSelect: 'none' },
    knowButtonsWrapper: { display: 'flex', width: '100%', maxWidth: '400px', gap: '15px' },
    knowButtonBase: { flex: 1, padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', transition: 'opacity 0.2s' },
    dontKnowButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    knowButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    completionContainer: { textAlign: 'center', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
    
    // 录音模态框样式
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '10px' },
    recorderPanel: { width: '100%', maxWidth: '350px', background: 'white', borderRadius: '20px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' },
    recorderWordDisplay: { fontSize: '2.5rem', fontWeight: 'bold', textAlign: 'center', color: '#1f2937', margin: '10px 0' },
    recorderControls: { display: 'flex', flexDirection: 'column', gap: '12px' },
    recorderBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', borderRadius: '12px', border: 'none', background: '#f3f4f6', color: '#374151', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' },
    closeRecorderBtn: { background: 'none', border: 'none', color: '#6b7280', textDecoration: 'underline', cursor: 'pointer' },

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
