// components/WordCard.js (最终修复版：解决无声缓存问题 + 找回录音按钮)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaTrashAlt } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import { AdSlot } from '@/components/GoogleAdsense';
import InterstitialAd from './InterstitialAd'; 

// --- 数据库配置 (版本号升级为 3 以强制刷新缓存) ---
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';
const STORE_TTS_CACHE = 'ttsAudioCache'; 

function openDB() { 
    return new Promise((resolve, reject) => { 
        if (typeof window === 'undefined') return resolve(null);

        // 🔥 关键修改：版本号升级到 3，强制触发数据库升级逻辑
        const request = indexedDB.open(DB_NAME, 3); 
        
        request.onerror = () => reject('数据库打开失败'); 
        request.onsuccess = () => resolve(request.result); 
        
        request.onupgradeneeded = (e) => { 
            const db = e.target.result; 
            
            // 收藏夹存储库
            if (!db.objectStoreNames.contains(STORE_NAME)) { 
                db.createObjectStore(STORE_NAME, { keyPath: 'id' }); 
            }
            
            // 🔥 关键修改：如果存在旧的音频缓存，先删除，再重建。
            // 这样可以解决“旧数据导致没声音”的问题。
            if (db.objectStoreNames.contains(STORE_TTS_CACHE)) {
                db.deleteObjectStore(STORE_TTS_CACHE);
            }
            db.createObjectStore(STORE_TTS_CACHE); 
        }; 
    }); 
}

// 收藏相关函数
async function toggleFavorite(word) { const db = await openDB(); const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME); const existing = await new Promise((resolve) => { const getReq = store.get(word.id); getReq.onsuccess = () => resolve(getReq.result); getReq.onerror = () => resolve(null); }); if (existing) { store.delete(word.id); return false; } else { const wordToStore = { ...word }; store.put(wordToStore); return true; } }
async function isFavorite(id) { const db = await openDB(); const tx = db.transaction(STORE_NAME, 'readonly'); const store = tx.objectStore(STORE_NAME); return new Promise((resolve) => { const getReq = store.get(id); getReq.onsuccess = () => resolve(!!getReq.result); getReq.onerror = () => resolve(false); }); }

// 手动清理缓存函数 (用于设置面板)
async function clearAudioCache() {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_TTS_CACHE, 'readwrite');
    tx.objectStore(STORE_TTS_CACHE).clear();
    alert("音频缓存已清理，请重新点击发音。");
}

// --- TTS 缓存读写 ---
const getTTSFromCache = async (key) => {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_TTS_CACHE, 'readonly');
        const req = tx.objectStore(STORE_TTS_CACHE).get(key);
        req.onsuccess = () => resolve(req.result); 
        req.onerror = () => resolve(null);
    });
};

const saveTTSToCache = async (key, blob) => {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_TTS_CACHE, 'readwrite');
    tx.objectStore(STORE_TTS_CACHE).put(blob, key);
};

const TTS_VOICES = [ { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' }, { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' }, ];
const sounds = { switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }), correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }), incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }), };

let _howlInstance = null;
let _currentTTSUrl = null; 

// --- 播放 TTS (带缓存逻辑) ---
const playTTS = async (text, voice, rate, onEndCallback, e) => { 
    if (e && e.stopPropagation) e.stopPropagation(); 
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; } 
    
    if (_howlInstance) { _howlInstance.stop(); _howlInstance.unload(); }
    if (_currentTTSUrl) { URL.revokeObjectURL(_currentTTSUrl); _currentTTSUrl = null; }

    const cacheKey = `${text}_${voice}_${rate}`;

    const playBlob = (blob) => {
        const audioUrl = URL.createObjectURL(blob);
        _currentTTSUrl = audioUrl;
        _howlInstance = new Howl({ 
            src: [audioUrl], 
            format: ['mp3', 'webm'], 
            html5: true, 
            onend: () => { if (onEndCallback) onEndCallback(); }, 
            onloaderror: () => { console.error('Audio Load Error'); if (onEndCallback) onEndCallback(); }, 
            onplayerror: () => { console.error('Audio Play Error'); if (onEndCallback) onEndCallback(); } 
        }); 
        _howlInstance.play(); 
    };

    try { 
        // 1. 查缓存
        const cachedBlob = await getTTSFromCache(cacheKey);
        if (cachedBlob) {
            // console.log("播放缓存音频:", text);
            playBlob(cachedBlob);
            return;
        }

        // 2. 无缓存且断网
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            alert("网络已断开，且无此单词的缓存音频。");
            if (onEndCallback) onEndCallback();
            return;
        }

        // 3. 请求 API
        // console.log("请求API音频:", text);
        const apiUrl = 'https://libretts.is-an.org/api/tts'; 
        const rateValue = Math.round(rate / 2); 
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }), 
        }); 
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`); 
        const audioBlob = await response.blob(); 
        
        if (audioBlob.size < 100) throw new Error("Audio blob too small, likely error"); // 防止缓存空文件

        saveTTSToCache(cacheKey, audioBlob);
        playBlob(audioBlob);

    } catch (error) { 
        console.error('TTS fetch error:', error); 
        if (onEndCallback) onEndCallback(); 
    } 
};

const playSoundEffect = (type) => { if (_howlInstance?.playing()) _howlInstance.stop(); if (sounds[type]) sounds[type].play(); };
const parsePinyin = (pinyinNum) => { if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' }; const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, ''); let pinyinPlain = rawPinyin.replace(/[1-5]$/, ''); const toneMatch = rawPinyin.match(/[1-5]$/); const tone = toneMatch ? toneMatch[0] : '0'; const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' }); const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']; let initial = ''; let final = pinyinPlain; for (const init of initials) { if (pinyinPlain.startsWith(init)) { initial = init; final = pinyinPlain.slice(init.length); break; } } return { initial, final, tone, pinyinMark, rawPinyin }; };

// --- Settings & Sub-components ---
const useCardSettings = () => { const [settings, setSettings] = useState(() => { try { const savedSettings = localStorage.getItem('learningWordCardSettings'); const defaultSettings = { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '', }; return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings; } catch (error) { console.error("加载设置失败", error); return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' }; } }); useEffect(() => { try { localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) { console.error("保存设置失败", error); } }, [settings]); return [settings, setSettings]; };

const PinyinVisualizer = React.memo(({ analysis, isCorrect }) => { const { parts, errors } = analysis; const initialStyle = !isCorrect && parts.initial && errors.initial ? styles.wrongPart : {}; const finalStyle = !isCorrect && parts.final && errors.final ? styles.wrongPart : {}; const toneStyle = !isCorrect && parts.tone !== '0' && errors.tone ? styles.wrongPart : {}; let finalDisplay = parts.pinyinMark.replace(parts.initial, '').replace(' ', ''); if (!finalDisplay || parts.pinyinMark === parts.rawPinyin) { finalDisplay = parts.final; } finalDisplay = finalDisplay.replace(/[1-5]$/, ''); return ( <div style={styles.pinyinVisualizerContainer}><span style={{...styles.pinyinPart, ...initialStyle}}>{parts.initial || ''}</span><span style={{...styles.pinyinPart, ...finalStyle}}>{finalDisplay}</span><span style={{...styles.pinyinPart, ...styles.toneNumber, ...toneStyle}}>{parts.tone}</span></div> ); });

const PronunciationComparison = ({ correctWord, userText, settings, onContinue, onClose }) => { const analysis = useMemo(() => { if (!userText) { return { isCorrect: false, error: 'NO_PINYIN', message: '未能识别有效发音' }; } const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true }); const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true }); if (correctPinyin.length === 0 || userPinyin.length === 0) return { isCorrect: false, error: 'NO_PINYIN', message: '未能识别有效发音' }; if (correctPinyin.length !== userPinyin.length) return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` }; const results = correctPinyin.map((correctPy, index) => { const userPy = userPinyin[index]; const correctParts = parsePinyin(correctPy); const userParts = parsePinyin(userPy); const errors = { initial: (correctParts.initial || userParts.initial) && (correctParts.initial !== userParts.initial), final: correctParts.final !== userParts.final, tone: correctParts.tone !== userParts.tone }; const pinyinMatch = !errors.initial && !errors.final && !errors.tone; return { char: correctWord[index], pinyinMatch, correct: { parts: correctParts }, user: { parts: userParts, errors } }; }); const isCorrect = results.every(r => r.pinyinMatch); const accuracy = (results.filter(r => r.pinyinMatch).length / results.length * 100).toFixed(0); return { isCorrect, results, accuracy }; }, [correctWord, userText]); const [isRecording, setIsRecording] = useState(false); const [userRecordingUrl, setUserRecordingUrl] = useState(null); const mediaRecorderRef = useRef(null); const streamRef = useRef(null); useEffect(() => { if (analysis && analysis.results) playSoundEffect(analysis.isCorrect ? 'correct' : 'incorrect'); }, [analysis]); const handleRecord = useCallback(async () => { if (isRecording) { mediaRecorderRef.current?.stop(); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; const recorder = new MediaRecorder(stream); mediaRecorderRef.current = recorder; const chunks = []; recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => { const blob = new Blob(chunks, { type: 'audio/webm' }); const url = URL.createObjectURL(blob); setUserRecordingUrl(url); streamRef.current?.getTracks().forEach(track => track.stop()); setIsRecording(false); }; recorder.start(); setIsRecording(true); } catch (err) { console.error("录音初始化失败:", err); alert("请检查麦克风权限。"); } }, [isRecording]); const playUserAudio = useCallback(() => { if (userRecordingUrl) { if (_howlInstance?.playing()) _howlInstance.stop(); const sound = new Howl({ src: [userRecordingUrl], html5: true }); sound.play(); } }, [userRecordingUrl]); const playCorrectTTS = useCallback(() => { playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese); }, [correctWord, settings]); useEffect(() => { return () => { if (userRecordingUrl) { URL.revokeObjectURL(userRecordingUrl); } }; }, [userRecordingUrl]); if (!analysis) return null; return ( <div style={styles.comparisonOverlay}> <div style={styles.comparisonPanel}> <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}> <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div> <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '发音完美！' : `准确率: ${analysis.accuracy}%`}</div> <div style={{ fontSize: '1rem', marginTop: '8px' }}>{analysis.isCorrect ? '太棒了！' : '再接再厉！'}</div> </div> <div style={styles.errorDetailsContainer}>{analysis.error ? (<div style={styles.lengthError}><h3>{analysis.message}</h3></div>) : (<div style={styles.comparisonGrid}>{analysis.results.map((result, index) => (<div key={index} style={styles.comparisonCell}><div style={styles.comparisonChar}>{result.char}</div><div style={styles.comparisonPinyinGroup}><div style={styles.pinyinLabel}>标准</div><PinyinVisualizer analysis={result.correct} isCorrect={true} /></div><div style={styles.comparisonPinyinGroup}><div style={styles.pinyinLabel}>你的发音</div><PinyinVisualizer analysis={result.user} isCorrect={result.pinyinMatch} /></div></div>))}</div>)}</div> <div style={styles.audioComparisonSection}> <button style={styles.audioPlayerButton} onClick={playCorrectTTS}><FaPlayCircle size={18} /> 标准发音</button> <button style={{...styles.audioPlayerButton, ...(isRecording ? {color: '#dc2626'} : {})}} onClick={handleRecord}> {isRecording ? <FaStop size={18} /> : <FaMicrophone size={18} />} {isRecording ? '停止录音' : '录音对比'} </button> {userRecordingUrl && <button style={styles.audioPlayerButton} onClick={playUserAudio}><FaPlayCircle size={18} /> 你的录音</button>} </div> <div style={styles.comparisonActions}> {analysis.isCorrect ? (<button style={{...styles.actionButton, ...styles.continueButton}} onClick={onContinue}>继续下一个 <FaArrowRight /></button>) : (<button style={{...styles.actionButton, ...styles.retryButton}} onClick={onClose}>再试一次</button>)} </div> </div> </div> ); };

// 修改：设置面板增加清理缓存按钮
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => { const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); }; const handleImageUpload = (e) => { const file = e.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (loadEvent) => { handleSettingChange('backgroundImage', loadEvent.target.result); }; reader.readAsDataURL(file); } }; return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> 自动朗读例句</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>外观设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>自定义背景</label><div style={styles.settingControl}><input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} /><button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>上传图片</button><button style={{...styles.settingButton, flex: '0 1 auto'}} onClick={() => handleSettingChange('backgroundImage', '')}>恢复默认</button></div></div><h2 style={{marginTop: '30px'}}>数据管理</h2><div style={styles.settingGroup}><div style={styles.settingControl}><button style={{...styles.settingButton, color: '#ef4444', border: '1px solid #ef4444'}} onClick={clearAudioCache}><FaTrashAlt /> 清理音频缓存 (解决无声)</button></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>); });
const JumpModal = ({ max, current, onJump, onClose }) => { const [inputValue, setInputValue] = useState(current + 1); const inputRef = useRef(null); useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []); const handleJump = () => { const num = parseInt(inputValue, 10); if (num >= 1 && num <= max) { onJump(num - 1); } else { alert(`请输入 1 到 ${max} 之间的数字`); } }; const handleKeyDown = (e) => { if (e.key === 'Enter') handleJump(); }; return ( <div style={styles.jumpModalOverlay} onClick={onClose}><div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}><h3 style={styles.jumpModalTitle}>跳转到卡片</h3><input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} min="1" max={max} /><button style={styles.jumpModalButton} onClick={handleJump}>跳转</button></div></div> ); };

// =================================================================================
// ===== 主组件: WordCard ==========================================================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, onFinishLesson, hasMore, progressKey = 'default' }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  
  const processedCards = useMemo(() => {
    try {
        const mapped = words.map(w => ({ 
            id: w.id, 
            chinese: w.chinese, 
            burmese: w.burmese, 
            mnemonic: w.mnemonic,
            example: w.example,
        }));
        if (settings.order === 'random') {
            for (let i = mapped.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mapped[i], mapped[j]] = [mapped[j], mapped[i]]; }
        }
        return mapped;
    } catch (error) { console.error("处理卡片数据出错:", error); return []; }
  }, [words, settings.order]);

  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const initialCards = processedCards.length > 0 ? processedCards : [];
    setActiveCards(initialCards);
    setCurrentIndex(0);
  }, [processedCards]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }
  }, []);

  const [isRevealed, setIsRevealed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  
  // 插页式广告相关的 state
  const wordCounterRef = useRef(0);
  const [showInterstitial, setShowInterstitial] = useState(false);

  const recognitionRef = useRef(null);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const processingRef = useRef(false); 

  const currentCard = activeCards.length > 0 && currentIndex < activeCards.length ? activeCards[currentIndex] : null;

  useEffect(() => { 
      if (currentCard?.id) { 
          isFavorite(currentCard.id).then(setIsFavoriteCard); 
      }
      setIsRevealed(false);
  }, [currentCard]);
  
  const handleToggleFavorite = async () => { if (!currentCard) return; setIsFavoriteCard(await toggleFavorite(currentCard)); };
  
  const navigate = useCallback((direction) => { 
    if (activeCards.length === 0) return;
    lastDirection.current = direction;

    // 单词计数和广告触发逻辑 (仅在有网时触发)
    if (isOnline && direction > 0) {
        wordCounterRef.current += 1;
        if (wordCounterRef.current >= 20) {
            setShowInterstitial(true);
            wordCounterRef.current = 0; 
        }
    }

    setCurrentIndex(prev => (prev + direction + activeCards.length) % activeCards.length); 
  }, [activeCards.length, isOnline]);

  const handleJumpToCard = (index) => { if (index >= 0 && index < activeCards.length) { lastDirection.current = index > currentIndex ? 1 : -1; setCurrentIndex(index); } setIsJumping(false); };

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
    
    const startAutoBrowseTimer = () => { if (settings.autoBrowse && !processingRef.current) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };
    
    const initialPlayTimer = setTimeout(playFullSequence, 600);

    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate, isRevealed]);
  
  // 录音逻辑
  const handleListen = useCallback((e) => {
    e.stopPropagation();
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("抱歉，您的浏览器不支持语音识别。"); return; }
    
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = "zh-CN";
        recognition.interimResults = false;
        recognition.onstart = () => { setIsListening(true); setRecognizedText(""); };
        recognition.onresult = (event) => { const result = event.results[event.results.length - 1][0].transcript; setRecognizedText(result.trim().replace(/[.,。，]/g, '')); };
        recognition.onerror = (event) => { console.error("语音识别出错:", event.error); };
        recognition.onend = () => { setIsListening(false); recognitionRef.current = null; setIsComparisonOpen(true); };
        recognitionRef.current = recognition;
        recognition.start();
    } catch (err) {
        console.error("录音启动失败", err);
    }
  }, [isListening]);

  const handleCloseComparison = useCallback(() => { setIsComparisonOpen(false); setRecognizedText(''); }, []);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);
  
  useEffect(() => { return () => { if (recognitionRef.current) { recognitionRef.current.abort(); } }; }, []);
  
  const handleKnow = () => {
    if (processingRef.current) return;
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (!currentCard) return;

    processingRef.current = true;

    navigate(1);

    setTimeout(() => {
        const newActiveCards = activeCards.filter(card => card.id !== currentCard.id);
        setActiveCards(newActiveCards);
        if (currentIndex >= newActiveCards.length) {
            setCurrentIndex(Math.max(0, newActiveCards.length - 1));
        }
        processingRef.current = false;
    }, 400); 
  };

  const handleDontKnow = () => {
    if (processingRef.current) return;
    if (isRevealed) {
      navigate(1);
    } else {
      setIsRevealed(true);
    }
  };

  const pageTransitions = useTransition(isOpen, {
    from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 },
  });

  const cardTransitions = useTransition(currentIndex, {
      key: currentCard ? currentCard.id : 'empty_key',
      from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, 
      enter: { opacity: 1, transform: 'translateY(0%)' }, 
      leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, 
      config: { mass: 1, tension: 280, friction: 30 }, 
      onStart: () => { if(currentCard) playSoundEffect('switch'); },
  });
  
  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
      if (event.target.closest('[data-no-gesture]')) return;
      if (down) return;
      if (processingRef.current) return; 
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
        
        {isOnline && <InterstitialAd 
            isOpen={showInterstitial} 
            onClose={() => {
                setShowInterstitial(false);
            }} 
        />}

        {isOnline && (
            <div style={styles.adContainer} data-no-gesture="true">
                <AdSlot />
            </div>
        )}
      
        <div style={styles.gestureArea} {...bind()} onClick={() => { if(!processingRef.current) setIsRevealed(prev => !prev) }} />
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        
        {isComparisonOpen && currentCard && (
            <PronunciationComparison 
                correctWord={currentCard.chinese} 
                userText={recognizedText} 
                settings={settings} 
                onContinue={handleNavigateToNext} 
                onClose={handleCloseComparison} 
            />
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
                            <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                          </div>
                          {isRevealed && (
                              <animated.div style={styles.revealedContent}>
                                  <div style={{ cursor: 'pointer', marginTop: '1.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}><div style={styles.textWordBurmese}>{cardData.burmese}</div></div>
                                  
                                  {cardData.mnemonic && 
                                    <div style={styles.mnemonicBox}>
                                        {cardData.mnemonic}
                                    </div>
                                  }
                                  
                                  {cardData.example && (
                                      <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, null, e)}>
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
            <div style={styles.completionContainer}>
                <h2>🎉 本课完成！</h2>
                <p>你已学完本组所有单词。</p>
                {hasMore ? (
                    <button 
                        style={{...styles.knowButton, ...styles.knowButtonBase, marginTop: '20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)'}} 
                        onClick={() => { if (onFinishLesson) onFinishLesson(); }}
                    >
                        进入下一课 <FaArrowRight style={{marginLeft: '8px'}}/>
                    </button>
                ) : (
                    <p style={{marginTop: '10px', fontSize: '0.9rem', opacity: 0.8}}>太棒了！该等级所有单词已学完！</p>
                )}
                <button 
                    style={{...styles.knowButtonBase, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', marginTop: '15px'}} 
                    onClick={onClose}
                >
                    关闭
                </button>
            </div>
        )}

        {/* 修复：在侧边栏加回录音按钮 */}
        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={18} /></button>
                
                {/* 录音对比按钮 (打开弹窗) */}
                <button style={styles.rightIconButton} onClick={() => setIsComparisonOpen(true)} title="发音评测">
                    <FaMicrophone size={18} color="#e11d48" />
                </button>

                {/* 快速发音练习 (调用浏览器语音识别) */}
                <button style={styles.rightIconButton} onClick={handleListen} title="快速语音识别">
                    {isListening ? <FaStop size={18} color={'#dc2626'}/> : <FaVolumeUp size={18} color={'#4a5568'} />}
                </button>

                {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺"><FaPenFancy size={18} /></button>)}
                {<button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>{isFavoriteCard ? <FaHeart size={18} color="#f87171" /> : <FaRegHeart size={18} />}</button>}
            </div>
        )}
        
        <div style={styles.bottomControlsContainer} data-no-gesture="true">
            {activeCards.length > 0 && (<div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>)}
            <div style={styles.knowButtonsWrapper}>
                <button style={{...styles.knowButtonBase, ...styles.dontKnowButton}} onClick={handleDontKnow}>不认识</button>
                <button style={{...styles.knowButtonBase, ...styles.knowButton}} onClick={handleKnow}>认识</button>
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
    adContainer: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(5px)',
        textAlign: 'center',
        padding: '5px 0',
        minHeight: '50px',
        maxHeight: '15vh', 
        overflow: 'hidden',
    },
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#30505E' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '80px 20px 150px 20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '3.2rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    revealedContent: { marginTop: '1rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' },
    textWordBurmese: { fontSize: '2.0rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    mnemonicBox: { 
        color: '#E0E0E0', 
        textAlign: 'center', 
        fontSize: '1.2rem', 
        textShadow: '0 1px 4px rgba(0,0,0,0.5)', 
        backgroundColor: 'rgba(0, 0, 0, 0.25)', 
        padding: '10px 18px', 
        borderRadius: '16px', 
        maxWidth: '90%',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(3px)'
    },
    exampleBox: { 
        color: '#fff', 
        width: '100%', 
        maxWidth: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '10px', 
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        cursor: 'pointer',
        padding: '10px',
        borderRadius: '12px',
        transition: 'background-color 0.2s'
    },
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
