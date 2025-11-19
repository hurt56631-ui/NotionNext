// components/WordCard.js (最终完整修正版：修复设置404、进度丢失、录音按钮、音频中断)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl, Howler } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, 
    FaSortAmountDown, FaArrowRight, FaHeart, FaRegHeart, 
    FaPlay, FaStop, FaRedo, FaTrashAlt
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import { AdSlot } from '@/components/GoogleAdsense';
import InterstitialAd from './InterstitialAd'; 

// =================================================================================
// ===== 1. 数据库与缓存逻辑 (保持不变) =====
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';
const STORE_TTS_CACHE = 'ttsAudioCache'; 

function openDB() { 
    return new Promise((resolve, reject) => { 
        if (typeof window === 'undefined') return resolve(null);
        const request = indexedDB.open(DB_NAME, 3); 
        request.onerror = () => reject('数据库打开失败'); 
        request.onsuccess = () => resolve(request.result); 
        request.onupgradeneeded = (e) => { 
            const db = e.target.result; 
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' }); 
            if (db.objectStoreNames.contains(STORE_TTS_CACHE)) db.deleteObjectStore(STORE_TTS_CACHE);
            db.createObjectStore(STORE_TTS_CACHE); 
        }; 
    }); 
}
async function toggleFavorite(word) { const db = await openDB(); const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME); const existing = await new Promise((resolve) => { const getReq = store.get(word.id); getReq.onsuccess = () => resolve(getReq.result); getReq.onerror = () => resolve(null); }); if (existing) { store.delete(word.id); return false; } else { const wordToStore = { ...word }; store.put(wordToStore); return true; } }
async function isFavorite(id) { const db = await openDB(); const tx = db.transaction(STORE_NAME, 'readonly'); const store = tx.objectStore(STORE_NAME); return new Promise((resolve) => { const getReq = store.get(id); getReq.onsuccess = () => resolve(!!getReq.result); getReq.onerror = () => resolve(false); }); }
async function clearAudioCache() { const db = await openDB(); if (!db) return; const tx = db.transaction(STORE_TTS_CACHE, 'readwrite'); tx.objectStore(STORE_TTS_CACHE).clear(); alert("音频缓存已清理"); }
const getTTSFromCache = async (key) => { const db = await openDB(); if (!db) return null; return new Promise((resolve) => { const tx = db.transaction(STORE_TTS_CACHE, 'readonly'); const req = tx.objectStore(STORE_TTS_CACHE).get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); }); };
const saveTTSToCache = async (key, blob) => { const db = await openDB(); if (!db) return; const tx = db.transaction(STORE_TTS_CACHE, 'readwrite'); tx.objectStore(STORE_TTS_CACHE).put(blob, key); };

// =================================================================================
// ===== 2. 音频播放系统 (修复经常无法朗读的问题) =====
// =================================================================================
const TTS_VOICES = [ { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' }, { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' }, ];
const sounds = { switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }), correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }), incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }), };
let _howlInstance = null;
let _currentTTSUrl = null; 

// 🔥 全局音频解锁函数
const unlockAudioContext = () => {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume().then(() => {
            console.log('AudioContext Resumed');
        });
    }
};

const playTTS = async (text, voice, rate, onEndCallback, e) => { 
    if (e && e.stopPropagation) e.stopPropagation(); 
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; } 
    
    // 1. 尝试解锁音频环境
    unlockAudioContext();

    // 2. 清理旧实例
    if (_howlInstance) { 
        _howlInstance.stop(); 
        _howlInstance.unload(); 
    }
    if (_currentTTSUrl) { 
        URL.revokeObjectURL(_currentTTSUrl); 
        _currentTTSUrl = null; 
    }

    const cacheKey = `${text}_${voice}_${rate}`;
    
    const playBlob = (blob) => {
        if (blob.size < 100) { console.error("Audio file too small"); if (onEndCallback) onEndCallback(); return; }
        
        const audioUrl = URL.createObjectURL(blob);
        _currentTTSUrl = audioUrl;
        
        _howlInstance = new Howl({ 
            src: [audioUrl], 
            format: ['mp3', 'webm'], 
            html5: true, 
            onend: () => { if (onEndCallback) onEndCallback(); }, 
            onloaderror: (id, err) => { console.error("Load Error", err); if (onEndCallback) onEndCallback(); }, 
            onplayerror: (id, err) => { 
                console.error("Play Error", err); 
                unlockAudioContext(); // 播放失败再次尝试解锁
                if (onEndCallback) onEndCallback(); 
            } 
        }); 
        _howlInstance.play(); 
    };

    try { 
        const cachedBlob = await getTTSFromCache(cacheKey);
        if (cachedBlob) { playBlob(cachedBlob); return; }
        
        if (typeof navigator !== 'undefined' && !navigator.onLine) { 
            if (onEndCallback) onEndCallback(); 
            return; 
        }
        
        const apiUrl = 'https://libretts.is-an.org/api/tts'; 
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice, rate: Math.round(rate / 2), pitch: 0 }), }); 
        if (!response.ok) throw new Error(`API Error`); 
        const audioBlob = await response.blob(); 
        saveTTSToCache(cacheKey, audioBlob);
        playBlob(audioBlob);
    } catch (error) { console.error('TTS error:', error); if (onEndCallback) onEndCallback(); } 
};

const playSoundEffect = (type) => { 
    unlockAudioContext();
    if (_howlInstance?.playing()) _howlInstance.stop(); 
    if (sounds[type]) sounds[type].play(); 
};

const parsePinyin = (pinyinNum) => { if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' }; const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, ''); let pinyinPlain = rawPinyin.replace(/[1-5]$/, ''); const toneMatch = rawPinyin.match(/[1-5]$/); const tone = toneMatch ? toneMatch[0] : '0'; const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' }); const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']; let initial = ''; let final = pinyinPlain; for (const init of initials) { if (pinyinPlain.startsWith(init)) { initial = init; final = pinyinPlain.slice(init.length); break; } } return { initial, final, tone, pinyinMark, rawPinyin }; };

// =================================================================================
// ===== 3. 语音对比弹窗组件 (UI重构版) =====
// =================================================================================
const PronunciationModal = ({ correctWord, settings, onClose }) => {
    const [recordingState, setRecordingState] = useState('idle');
    const [userText, setUserText] = useState('');
    const [audioUrl, setAudioUrl] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    
    const mediaRecorderRef = useRef(null);
    const recognitionRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        unlockAudioContext();
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) { alert("您的浏览器不支持语音识别"); return; }
            const recognition = new SpeechRecognition();
            recognition.lang = "zh-CN";
            recognition.interimResults = false;
            recognition.onresult = (e) => setUserText(e.results[0][0].transcript.replace(/[.,。，]/g, ''));
            recognitionRef.current = recognition;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            chunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current = mediaRecorder;

            recognition.start();
            mediaRecorder.start();
            setRecordingState('recording');
            
            setTimeout(() => { if (recordingState === 'recording') stopRecording(); }, 5000);
        } catch (err) {
            console.error("录音启动失败", err);
            alert("无法访问麦克风");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
        if (recognitionRef.current) recognitionRef.current.stop();
        setRecordingState('analyzing');
    };

    useEffect(() => {
        if (recordingState === 'analyzing') {
            if (userText) analyzeResult();
            else setTimeout(() => { if (!userText) { setRecordingState('idle'); } }, 1500);
        }
    }, [recordingState, userText]);

    const analyzeResult = () => {
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });
        if (!correctPinyin || !userPinyin || userPinyin.length === 0) { setRecordingState('idle'); return; }

        let matchCount = 0;
        const details = correctPinyin.map((cpy, i) => {
            const upy = userPinyin[i] || '';
            const cParts = parsePinyin(cpy);
            const uParts = parsePinyin(upy);
            const isMatch = cParts.rawPinyin === uParts.rawPinyin;
            if (isMatch) matchCount++;
            return { char: correctWord[i], pinyin: cParts.pinyinMark, isMatch, uPinyin: uParts.pinyinMark };
        });
        const score = Math.round((matchCount / Math.max(correctPinyin.length, userPinyin.length)) * 100);
        setAnalysis({ score, details });
        setRecordingState('result');
        if (score === 100) playSoundEffect('correct'); else playSoundEffect('incorrect');
    };

    const reset = () => { setRecordingState('idle'); setUserText(''); setAnalysis(null); if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(null); };
    const playUserAudio = () => { if (audioUrl) { const sound = new Howl({ src: [audioUrl], format: ['webm'], html5: true }); sound.play(); } };

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.card}>
                <button onClick={onClose} style={modalStyles.closeBtn}><FaTimes /></button>
                <h3 style={modalStyles.title}>发音评测</h3>
                {recordingState !== 'result' && <div style={modalStyles.bigWord}>{correctWord}</div>}
                {recordingState === 'recording' && (
                    <div style={modalStyles.waveContainer}>
                        <div style={modalStyles.wave}></div><div style={modalStyles.wave}></div><div style={modalStyles.wave}></div>
                        <p style={{color: '#ef4444', fontWeight: 'bold'}}>正在录音...</p>
                    </div>
                )}
                {recordingState === 'result' && analysis && (
                    <div style={modalStyles.resultContainer}>
                        <div style={modalStyles.scoreCircle(analysis.score)}>
                            <span style={{fontSize: '2.5rem', fontWeight: 'bold'}}>{analysis.score}</span><span style={{fontSize: '0.8rem'}}>分</span>
                        </div>
                        <div style={modalStyles.detailRow}>
                            {analysis.details.map((item, i) => (
                                <div key={i} style={modalStyles.charBlock}>
                                    <div style={{color: item.isMatch ? '#10b981' : '#ef4444', fontSize: '0.9rem'}}>{item.pinyin}</div>
                                    <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{item.char}</div>
                                </div>
                            ))}
                        </div>
                        <div style={modalStyles.audioControls}>
                            <button style={modalStyles.playBtn} onClick={() => playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese)}><FaPlay size={12} /> 标准音</button>
                            <button style={modalStyles.playBtn} onClick={playUserAudio}><FaPlay size={12} /> 我的录音</button>
                        </div>
                    </div>
                )}
                <div style={modalStyles.footer}>
                    {recordingState === 'idle' && <button style={modalStyles.recordBtn} onClick={startRecording}><FaMicrophone size={24} /></button>}
                    {recordingState === 'recording' && <button style={{...modalStyles.recordBtn, background: '#ef4444'}} onClick={stopRecording}><FaStop size={24} /></button>}
                    {recordingState === 'result' && <button style={modalStyles.retryBtn} onClick={reset}><FaRedo /> 再试一次</button>}
                </div>
            </div>
        </div>
    );
};

// --- 4. 设置面板 (修复 ReferenceError: FaSortAmountDown) ---
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => { 
    const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); }; 
    const handleImageUpload = (e) => { 
        const file = e.target.files[0]; 
        if (file && file.type.startsWith('image/')) { 
            const reader = new FileReader(); 
            reader.onload = (ev) => handleSettingChange('backgroundImage', ev.target.result); 
            reader.readAsDataURL(file); 
        } 
    }; 
    // 🔥 关键修复：所有 button 加上 type="button"，防止触发页面默认提交
    // 🔥 关键修复：确保 FaSortAmountDown 已在顶部导入
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button type="button" style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{marginTop: 0}}>常规设置</h2>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button type="button" onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button type="button" onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div>
                <div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> 自动朗读例句</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div>
                <h2 style={{marginTop: '30px'}}>外观设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>自定义背景</label><div style={styles.settingControl}><input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} /><button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>上传图片</button><button style={{...styles.settingButton, flex: '0 1 auto'}} onClick={() => handleSettingChange('backgroundImage', '')}>恢复默认</button></div></div>
                <h2 style={{marginTop: '30px'}}>数据管理</h2><div style={styles.settingGroup}><div style={styles.settingControl}><button type="button" style={{...styles.settingButton, color: '#ef4444', border: '1px solid #ef4444'}} onClick={clearAudioCache}><FaTrashAlt /> 清理音频缓存 (解决无声)</button></div></div>
                <h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div>
            </div>
        </div>
    ); 
});

// --- 5. 跳转弹窗 ---
const JumpModal = ({ max, current, onJump, onClose }) => { const [inputValue, setInputValue] = useState(current + 1); const inputRef = useRef(null); useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []); const handleJump = () => { const num = parseInt(inputValue, 10); if (num >= 1 && num <= max) { onJump(num - 1); } else { alert(`请输入 1 到 ${max} 之间的数字`); } }; const handleKeyDown = (e) => { if (e.key === 'Enter') handleJump(); }; return ( <div style={styles.jumpModalOverlay} onClick={onClose}><div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}><h3 style={styles.jumpModalTitle}>跳转到卡片</h3><input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} min="1" max={max} /><button style={styles.jumpModalButton} onClick={handleJump}>跳转</button></div></div> ); };
const useCardSettings = () => { const [settings, setSettings] = useState(() => { try { const savedSettings = localStorage.getItem('learningWordCardSettings'); const defaultSettings = { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '', }; return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings; } catch (error) { return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' }; } }); useEffect(() => { try { localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) {} }, [settings]); return [settings, setSettings]; };

// =================================================================================
// ===== 6. 主组件: WordCard =======================================================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, onFinishLesson, hasMore, progressKey = 'default' }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  
  const processedCards = useMemo(() => {
    try {
        const mapped = words.map(w => ({ id: w.id, chinese: w.chinese, burmese: w.burmese, mnemonic: w.mnemonic, example: w.example }));
        if (settings.order === 'random') {
            for (let i = mapped.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mapped[i], mapped[j]] = [mapped[j], mapped[i]]; }
        }
        return mapped;
    } catch (error) { return []; }
  }, [words, settings.order]);

  const [activeCards, setActiveCards] = useState([]);
  
  // 🔥 关键修复：生成唯一的进度 Key (基于第一个单词的 ID 和总长度)
  const storageKey = useMemo(() => {
    if (progressKey !== 'default') return `progress_${progressKey}`;
    // 自动生成：prog_首词ID_长度，这样 HSK1 Lesson1 和 HSK2 Lesson1 的 Key 会不同
    if (words && words.length > 0) return `prog_${words[0].id}_${words.length}`;
    return 'prog_default';
  }, [progressKey, words]);

  // 🔥 关键修复：初始化时优先读取本地存储的进度
  const [currentIndex, setCurrentIndex] = useState(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
              const idx = parseInt(saved, 10);
              if (!isNaN(idx) && idx >= 0 && idx < words.length) return idx;
          }
      }
      return 0;
  });

  const [isOnline, setIsOnline] = useState(true);

  // 当课程数据变化时，重置或加载进度
  useEffect(() => {
    const initialCards = processedCards.length > 0 ? processedCards : [];
    setActiveCards(initialCards);
    
    // 加载进度
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const idx = parseInt(saved, 10);
            if (!isNaN(idx) && idx >= 0 && idx < initialCards.length) {
                setCurrentIndex(idx);
            } else {
                setCurrentIndex(0);
            }
        } else {
            setCurrentIndex(0);
        }
    }
  }, [processedCards, storageKey]);

  // 监听进度变化并保存
  useEffect(() => {
      if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, currentIndex);
      }
  }, [currentIndex, storageKey]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        const unlockHandler = () => { unlockAudioContext(); window.removeEventListener('click', unlockHandler); };
        window.addEventListener('click', unlockHandler);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('click', unlockHandler);
        };
    }
  }, []);

  const [isRevealed, setIsRevealed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  
  const wordCounterRef = useRef(0);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const processingRef = useRef(false); 

  const currentCard = activeCards.length > 0 && currentIndex < activeCards.length ? activeCards[currentIndex] : null;

  useEffect(() => { if (currentCard?.id) isFavorite(currentCard.id).then(setIsFavoriteCard); setIsRevealed(false); }, [currentCard]);
  const handleToggleFavorite = async () => { if (!currentCard) return; setIsFavoriteCard(await toggleFavorite(currentCard)); };
  
  const navigate = useCallback((direction) => { 
    if (activeCards.length === 0) return;
    lastDirection.current = direction;
    if (isOnline && direction > 0) {
        wordCounterRef.current += 1;
        if (wordCounterRef.current >= 20) { setShowInterstitial(true); wordCounterRef.current = 0; }
    }
    setCurrentIndex(prev => (prev + direction + activeCards.length) % activeCards.length); 
  }, [activeCards.length, isOnline]);

  const handleJumpToCard = (index) => { if (index >= 0 && index < activeCards.length) { lastDirection.current = index > currentIndex ? 1 : -1; setCurrentIndex(index); } setIsJumping(false); };

  // 自动播放逻辑
  useEffect(() => {
    if (!isOpen || !currentCard) return;
    clearTimeout(autoBrowseTimerRef.current);
    if (processingRef.current) return;
    const playFullSequence = () => {
        const thisCardId = currentCard.id; 
        if (settings.autoPlayChinese && currentCard.chinese) {
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => {
                if (currentCard.id !== thisCardId) return; 
                if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
                        if (currentCard.id !== thisCardId) return;
                        if (settings.autoPlayExample && currentCard.example && isRevealed) {
                           playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, startAutoBrowseTimer);
                        } else { startAutoBrowseTimer(); }
                    });
                } else { startAutoBrowseTimer(); }
            });
        } else { startAutoBrowseTimer(); }
    };
    const startAutoBrowseTimer = () => { if (settings.autoBrowse && !processingRef.current) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };
    const initialPlayTimer = setTimeout(playFullSequence, 600);
    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate, isRevealed]);
  
  const handleKnow = () => {
    if (processingRef.current) return;
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (!currentCard) return;
    processingRef.current = true;
    navigate(1);
    setTimeout(() => {
        const newActiveCards = activeCards.filter(card => card.id !== currentCard.id);
        setActiveCards(newActiveCards);
        if (currentIndex >= newActiveCards.length) setCurrentIndex(Math.max(0, newActiveCards.length - 1));
        processingRef.current = false;
    }, 400); 
  };

  const handleDontKnow = () => {
    if (processingRef.current) return;
    if (isRevealed) navigate(1); else setIsRevealed(true);
  };

  const pageTransitions = useTransition(isOpen, { from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 } });
  const cardTransitions = useTransition(currentIndex, { key: currentCard ? currentCard.id : 'empty_key', from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, config: { mass: 1, tension: 280, friction: 30 }, onStart: () => { if(currentCard) playSoundEffect('switch'); } });
  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => { if (event.target.closest('[data-no-gesture]')) return; if (down) return; if (processingRef.current) return; event.stopPropagation(); const isHorizontal = Math.abs(mx) > Math.abs(my); if (isHorizontal) { if (Math.abs(mx) > 80 || (vel > 0.5 && Math.abs(mx) > 40)) onClose(); } else { if (Math.abs(my) > 60 || (vel > 0.4 && Math.abs(my) > 30)) navigate(yDir < 0 ? 1 : -1); } }, { filterTaps: true, preventDefault: true, threshold: 10 });

  const cardContent = pageTransitions((style, item) => {
    const bgUrl = settings.backgroundImage;
    const backgroundStyle = bgUrl ? { background: `url(${bgUrl}) center/cover no-repeat` } : {};
    
    return item && (
      <animated.div style={{ ...styles.fullScreen, ...backgroundStyle, ...style }}>
        
        {isOnline && <InterstitialAd isOpen={showInterstitial} onClose={() => setShowInterstitial(false)} />}
        {isOnline && <div style={styles.adContainer} data-no-gesture="true"><AdSlot /></div>}
      
        <div style={styles.gestureArea} {...bind()} onClick={() => { if(!processingRef.current) setIsRevealed(prev => !prev) }} />
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {isComparisonOpen && currentCard && <PronunciationModal correctWord={currentCard.chinese} settings={settings} onClose={() => setIsComparisonOpen(false)} />}
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
                            <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                          </div>
                          {isRevealed && (
                              <animated.div style={styles.revealedContent}>
                                  <div style={{ cursor: 'pointer', marginTop: '1.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}><div style={styles.textWordBurmese}>{cardData.burmese}</div></div>
                                  {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}
                                  {cardData.example && (<div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, null, e)}><div style={{ flex: 1, textAlign: 'center' }}><div style={styles.examplePinyin}>{pinyinConverter(cardData.example, { toneType: 'symbol', separator: ' ' })}</div><div style={styles.exampleText}>{cardData.example}</div></div></div>)}
                              </animated.div>
                          )}
                      </div>
                  </div>
                </animated.div>
              );
            })
        ) : (
            // 🔥 修复：学完界面改成居中卡片样式，并在卡片内增加关闭按钮
            <div style={styles.completionOverlay}>
                <div style={modalStyles.card}>
                    <h2 style={modalStyles.title}>🎉 本课完成！</h2>
                    <div style={{fontSize: '4rem', marginBottom: '20px'}}>🏆</div>
                    <p style={{color: '#666', marginBottom: '30px'}}>你已学完本组所有单词。</p>
                    {hasMore ? (
                        <button style={{...modalStyles.recordBtn, width: '100%', height: 'auto', borderRadius: '12px', padding: '12px', fontSize: '1.1rem', gap: '10px'}} onClick={() => { if (onFinishLesson) onFinishLesson(); }}>
                            进入下一课 <FaArrowRight />
                        </button>
                    ) : (
                        <p style={{color: '#10b981', fontWeight: 'bold'}}>太棒了！该等级所有单词已学完！</p>
                    )}
                    {/* 居中关闭按钮 */}
                    <button 
                        style={{
                            ...modalStyles.retryBtn, 
                            width: '100%', 
                            marginTop: '15px', 
                            justifyContent: 'center',
                            background: '#f3f4f6',
                            color: '#333'
                        }} 
                        onClick={onClose}
                    >
                        关闭
                    </button>
                </div>
            </div>
        )}

        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button type="button" style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={18} /></button>
                <button type="button" style={styles.rightIconButton} onClick={() => setIsComparisonOpen(true)} title="发音评测"><FaMicrophone size={18} color="#e11d48" /></button>
                {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( <button type="button" style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺"><FaPenFancy size={18} /></button>)}
                {<button type="button" style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>{isFavoriteCard ? <FaHeart size={18} color="#f87171" /> : <FaRegHeart size={18} />}</button>}
            </div>
        )}
        
        <div style={styles.bottomControlsContainer} data-no-gesture="true">
            {activeCards.length > 0 && (<div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>)}
            <div style={styles.knowButtonsWrapper}>
                <button type="button" style={{...styles.knowButtonBase, ...styles.dontKnowButton}} onClick={handleDontKnow}>不认识</button>
                <button type="button" style={{...styles.knowButtonBase, ...styles.knowButton}} onClick={handleKnow}>认识</button>
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
    adContainer: { position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(5px)', textAlign: 'center', padding: '5px 0', minHeight: '50px', maxHeight: '15vh', overflow: 'hidden', },
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#30505E' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '80px 20px 150px 20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '3.2rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    revealedContent: { marginTop: '1rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' },
    textWordBurmese: { fontSize: '2.0rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    mnemonicBox: { color: '#E0E0E0', textAlign: 'center', fontSize: '1.2rem', textShadow: '0 1px 4px rgba(0,0,0,0.5)', backgroundColor: 'rgba(0, 0, 0, 0.25)', padding: '10px 18px', borderRadius: '16px', maxWidth: '90%', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(3px)' },
    exampleBox: { color: '#fff', width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textShadow: '0 1px 4px rgba(0,0,0,0.5)', cursor: 'pointer', padding: '10px', borderRadius: '12px', transition: 'background-color 0.2s' },
    examplePinyin: { fontSize: '1.1rem', color: '#fcd34d', marginBottom: '0.5rem', opacity: 0.9, letterSpacing: '0.05em' },
    exampleText: { fontSize: '1.4rem', lineHeight: 1.5 },
    rightControls: { position: 'fixed', bottom: '40%', right: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', transform: 'translateY(50%)' },
    rightIconButton: { background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', boxShadow: '0 3px 10px rgba(0,0,0,0.15)', transition: 'transform 0.2s, background 0.2s', color: '#4a5568', backdropFilter: 'blur(4px)' },
    bottomControlsContainer: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
    bottomCenterCounter: { background: 'rgba(0, 0, 0, 0.3)', color: 'white', padding: '8px 18px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(5px)', cursor: 'pointer', userSelect: 'none' },
    knowButtonsWrapper: { display: 'flex', width: '100%', maxWidth: '400px', gap: '15px' },
    knowButtonBase: { flex: 1, padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' },
    dontKnowButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    knowButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    completionOverlay: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 10003 },
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
    pinyinVisualizerContainer: { display: 'flex', alignItems: 'baseline', fontSize: '1.5rem', height: '1.8rem', color: '#333' },
    pinyinPart: { transition: 'color 0.3s', fontWeight: 500 },
    toneNumber: { fontSize: '1.1rem', fontWeight: 'bold', marginLeft: '2px' },
    wrongPart: { color: '#dc2626', fontWeight: 'bold' },
};

const modalStyles = {
    overlay: { position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    card: { width: '100%', maxWidth: '400px', background: 'white', borderRadius: '28px', padding: '30px', textAlign: 'center', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    closeBtn: { position: 'absolute', top: '20px', right: '20px', background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', cursor: 'pointer' },
    title: { fontSize: '1.2rem', color: '#4b5563', margin: '0 0 20px 0' },
    bigWord: { fontSize: '4rem', fontWeight: 'bold', color: '#111827', marginBottom: '30px' },
    waveContainer: { height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '20px' },
    wave: { width: '8px', height: '40px', background: '#ef4444', borderRadius: '4px', animation: 'wave 1s infinite ease-in-out' },
    footer: { width: '100%', display: 'flex', justifyContent: 'center', marginTop: 'auto' },
    recordBtn: { width: '80px', height: '80px', borderRadius: '50%', background: '#3b82f6', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.5)', cursor: 'pointer', transition: 'transform 0.1s' },
    retryBtn: { background: '#f3f4f6', border: 'none', color: '#4b5563', padding: '12px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', cursor: 'pointer' },
    resultContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    scoreCircle: (score) => ({ width: '100px', height: '100px', borderRadius: '50%', border: `6px solid ${score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444', marginBottom: '20px' }),
    detailRow: { display: 'flex', gap: '15px', marginBottom: '20px' },
    charBlock: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f9fafb', padding: '10px', borderRadius: '12px' },
    audioControls: { display: 'flex', gap: '15px', marginBottom: '20px' },
    playBtn: { background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }
};

export default WordCard;
