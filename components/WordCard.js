// components/WordCard.js (修复版：带日志 + 无广告 + 功能全开)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, 
    FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaCheck, FaRedo,
    FaFacebookMessenger 
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

function openDB() {
    if (typeof window === 'undefined') return Promise.reject("Server side");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('数据库打开失败');
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_FAVORITES)) db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORE_AUDIO)) db.createObjectStore(STORE_AUDIO);
        };
    });
}

// 收藏相关
async function toggleFavorite(word) {
    if (typeof window === 'undefined' || !word) return false;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FAVORITES, 'readwrite');
        const store = tx.objectStore(STORE_FAVORITES);
        return new Promise((resolve) => {
            const getReq = store.get(word.id);
            getReq.onsuccess = () => {
                if (getReq.result) { store.delete(word.id); resolve(false); }
                else { store.put({ ...word }); resolve(true); }
            };
            getReq.onerror = () => resolve(false);
        });
    } catch (e) { console.error("收藏出错:", e); return false; }
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
    } catch (e) { return false; }
}

// =================================================================================
// ===== TTS 逻辑 =====
// =================================================================================
const generateAudioKey = (text, voice, rate) => `${text}_${voice}_${rate}`;

async function cacheAudioData(key, blob) {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        const store = tx.objectStore(STORE_AUDIO);
        store.put(blob, key);
    } catch (e) {}
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
        try {
            sounds = {
                switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
                correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
            };
        } catch (e) {}
    }
};

let _howlInstance = null;
let _currentAudioUrl = null;

const playTTS = async (text, voice, rate, source, onEndCallback, e, onlyCache = false) => {
    if (typeof window === 'undefined') return;
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text) { if (onEndCallback && !onlyCache) onEndCallback(); return; }

    console.log(`[TTS] 播放: ${text}, 语音: ${voice}, 源: ${source}`);

    // 浏览器 TTS 回退
    const playBrowser = () => {
        console.log('[TTS] 使用浏览器原生接口');
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = (voice && voice.includes('my')) ? 'my-MM' : 'zh-CN';
        utterance.rate = 1.0; 
        utterance.onend = () => { if (onEndCallback) onEndCallback(); };
        utterance.onerror = (err) => { console.error('[TTS] 浏览器播放失败', err); if (onEndCallback) onEndCallback(); };
        window.speechSynthesis.speak(utterance);
    };

    if (source === 'browser') {
        playBrowser();
        return;
    }

    // 云端 TTS 逻辑
    const cacheKey = generateAudioKey(text, voice, Math.round(rate / 2));
    
    // 如果只需要缓存且已有缓存，直接返回
    if (onlyCache && await getCachedAudio(cacheKey)) return;

    if (!onlyCache) {
        if (_howlInstance?.playing()) _howlInstance.stop();
        if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    }

    let audioBlob = await getCachedAudio(cacheKey);

    if (!audioBlob) {
        try {
            const apiUrl = 'https://libretts.is-an.org/api/tts';
            let response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, rate: Math.round(rate / 2), pitch: 0 }),
            });
            
            if (!response.ok) {
                // 备用接口尝试
                console.warn('[TTS] 主接口失败，尝试备用接口...');
                let lang = (voice && voice.includes('my')) ? 'my' : 'zh-CN';
                let backupUrl = `/api/google-tts?text=${encodeURIComponent(text)}&lang=${lang}`;
                response = await fetch(backupUrl);
                if (!response.ok) throw new Error('All TTS APIs failed');
            }
            
            audioBlob = await response.blob();
            await cacheAudioData(cacheKey, audioBlob);
        } catch (error) {
            console.error('[TTS] 云端播放失败:', error);
            if (!onlyCache) playBrowser(); // 失败回退到浏览器TTS
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
        onloaderror: () => { console.warn('[Howl] 加载错误'); playBrowser(); },
        onplayerror: () => { 
            _howlInstance.once('unlock', function() { _howlInstance.play(); }); 
        }
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
        const defaults = { order: 'sequential', ttsSource: 'server', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' };
        if (typeof window === 'undefined') return defaults;
        try {
            const saved = localStorage.getItem('learningWordCardSettings');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch (e) { return defaults; }
    });
    useEffect(() => {
        if (typeof window !== 'undefined') localStorage.setItem('learningWordCardSettings', JSON.stringify(settings));
    }, [settings]);
    return [settings, setSettings];
};

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

const SettingsPanel = ({ settings, setSettings, onClose }) => {
    const handleSettingChange = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{ marginTop: 0 }}>设置</h2>
                
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>学习顺序</label>
                    <div style={styles.settingControl}>
                        <button onClick={() => handleSettingChange('order', 'sequential')} style={{ ...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : '#eee', color: settings.order === 'sequential' ? 'white' : '#333' }}><FaSortAmountDown /> 顺序</button>
                        <button onClick={() => handleSettingChange('order', 'random')} style={{ ...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : '#eee', color: settings.order === 'random' ? 'white' : '#333' }}><FaRandom /> 随机</button>
                    </div>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>语音来源</label>
                    <div style={styles.settingControl}>
                        <button onClick={() => handleSettingChange('ttsSource', 'server')} style={{ ...styles.settingButton, background: settings.ttsSource === 'server' ? '#4299e1' : '#eee', color: settings.ttsSource === 'server' ? 'white' : '#333' }}>云端高音质</button>
                        <button onClick={() => handleSettingChange('ttsSource', 'browser')} style={{ ...styles.settingButton, background: settings.ttsSource === 'browser' ? '#4299e1' : '#eee', color: settings.ttsSource === 'browser' ? 'white' : '#333' }}>浏览器本地</button>
                    </div>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>自动播放</label>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 中文</label></div>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 缅语</label></div>
                </div>
            </div>
        </div>
    );
};

const JumpModal = ({ max, current, onJump, onClose }) => {
    const [inputValue, setInputValue] = useState(current + 1); 
    const inputRef = useRef(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);
    const handleJump = () => { const num = parseInt(inputValue, 10); if (num >= 1 && num <= max) { onJump(num - 1); } else { alert(`请输入 1 到 ${max}`); } };
    
    return (
        <div style={styles.jumpModalOverlay} onClick={onClose}>
            <div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}>
                <h3 style={styles.jumpModalTitle}>跳转到卡片</h3>
                <input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                <button style={styles.jumpModalButton} onClick={handleJump}>跳转</button>
            </div>
        </div>
    );
};

// =================================================================================
// ===== 主组件 WordCard =====
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
        console.log('[WordCard] 组件已挂载');
        // 注入动画样式
        if (typeof document !== 'undefined') {
            const styleId = 'wordcard-pulse-style';
            if (!document.getElementById(styleId)) {
                const styleSheet = document.createElement("style");
                styleSheet.id = styleId;
                styleSheet.innerText = `@keyframes pulse { 0% { transform: scale(0.95); } 50% { transform: scale(1.0); } 100% { transform: scale(0.95); } }`;
                document.head.appendChild(styleSheet);
            }
        }
    }, []);

    const [settings, setSettings] = useCardSettings();

    // ✅ 数据处理：兼容旧版数据字段
    const processedCards = useMemo(() => {
        if (!Array.isArray(words)) {
            console.error('[WordCard] 错误: words 不是数组', words);
            return [];
        }
        console.log(`[WordCard] 收到 ${words.length} 个单词`);
        
        try {
            const mapped = words.map(w => ({
                id: w.id || Math.random().toString(36).substr(2, 9),
                chinese: w.chinese || w.chineseWord || w.word || '',
                audioText: w.audioText || w.tts_text || w.chinese || w.chineseWord || w.word || '',
                burmese: w.burmese || w.burmeseTranslation || w.translation || w.meaning || '', 
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
            console.error("[WordCard] 数据处理异常:", error);
            return [];
        }
    }, [words, settings.order]);

    const [activeCards, setActiveCards] = useState([]);
    useEffect(() => {
        const initialCards = processedCards.length > 0 
            ? processedCards 
            : [{ id: 'fallback', chinese: "加载中...", burmese: "请检查数据", audioText: "加载中" }];
        setActiveCards(initialCards);
    }, [processedCards]);

    const [currentIndex, setCurrentIndex] = useState(0);

    // 进度管理
    useEffect(() => {
        if (typeof window !== 'undefined' && progressKey && activeCards.length > 1) {
            try {
                const saved = parseInt(localStorage.getItem(`word_progress_${progressKey}`), 10);
                if (!isNaN(saved) && saved >= 0 && saved < activeCards.length) {
                    console.log('[WordCard] 恢复进度:', saved);
                    setCurrentIndex(saved);
                }
            } catch(e) {}
        }
    }, [progressKey, activeCards.length]);

    useEffect(() => {
        if (typeof window !== 'undefined') localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
    }, [currentIndex, progressKey]);

    // 预加载
    useEffect(() => {
        if (!activeCards.length || settings.ttsSource !== 'server') return;
        const nextIdx = (currentIndex + 1) % activeCards.length;
        const nextCard = activeCards[nextIdx];
        if (nextCard?.id !== 'fallback') {
            playTTS(nextCard.audioText, settings.voiceChinese, 0, 'server', null, null, true);
        }
    }, [currentIndex, activeCards, settings]);

    const [isRevealed, setIsRevealed] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRecordingOpen, setIsRecordingOpen] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [isFavoriteCard, setIsFavoriteCard] = useState(false);
    const [isJumping, setIsJumping] = useState(false);
    const wordCounterRef = useRef(0);
    const autoBrowseTimerRef = useRef(null);
    const lastDirection = useRef(0);
    const currentCard = activeCards[currentIndex];

    useEffect(() => {
        if (currentCard?.id && currentCard.id !== 'fallback') {
            isFavorite(currentCard.id).then(setIsFavoriteCard);
        }
    }, [currentCard]);

    const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        if (!currentCard) return;
        const res = await toggleFavorite(currentCard);
        setIsFavoriteCard(res);
    };

    // ✅ Messenger 分享修复
    const handleFacebookShare = (e) => {
        e.stopPropagation();
        if (!currentCard) return;
        
        // 关键：移除 URL 中的 Hash (#)，防止 Messenger 404
        const baseUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
        const shareText = `正在学习: ${currentCard.chinese}`;
        
        console.log('[WordCard] 分享链接:', baseUrl);

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            window.location.href = `fb-messenger://share/?link=${encodeURIComponent(baseUrl)}`;
        } else {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(baseUrl)}&quote=${shareText}`, '_blank');
        }
    };

    const navigate = (dir) => {
        lastDirection.current = dir;
        setCurrentIndex(prev => (prev + dir + activeCards.length) % activeCards.length);
        setIsRevealed(false);
    };

    useEffect(() => {
        if (!isOpen || !currentCard) return;
        clearTimeout(autoBrowseTimerRef.current);
        
        // 自动播放逻辑
        if (settings.autoPlayChinese && currentCard.id !== 'fallback') {
            playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, () => {
                if (settings.autoPlayBurmese && isRevealed) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, settings.ttsSource, startTimer);
                } else { startTimer(); }
            });
        } else { startTimer(); }

        function startTimer() {
            if (settings.autoBrowse) {
                autoBrowseTimerRef.current = setTimeout(() => navigate(1), settings.autoBrowseDelay);
            }
        }
        return () => clearTimeout(autoBrowseTimerRef.current);
    }, [currentIndex, isRevealed, settings, isOpen]);

    // 动画
    const transitions = useTransition(currentIndex, {
        key: currentCard?.id || currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
        onStart: () => playSoundEffect('switch'),
    });

    const pageTransitions = useTransition(isOpen, {
        from: { opacity: 0, transform: 'translateY(100%)' },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: 'translateY(100%)' },
    });

    // 划屏手势修复：放宽条件
    const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
        // 如果点到了特定按钮，阻止手势
        if (event.target.closest('[data-no-gesture]')) return;
        if (down) return;
        event.stopPropagation();

        const isHorizontal = Math.abs(mx) > Math.abs(my);
        if (isHorizontal) { 
            // 水平滑动关闭
            if (Math.abs(mx) > 80 || (vel > 0.5 && Math.abs(mx) > 40)) onClose(); 
        } else { 
            // 垂直滑动切词
            if (Math.abs(my) > 60 || (vel > 0.4 && Math.abs(my) > 30)) navigate(yDir < 0 ? 1 : -1); 
        }
    }, { filterTaps: true, preventDefault: true });

    const content = pageTransitions((style, item) => item && (
        <animated.div style={{ ...styles.fullScreen, ...style }}>
            <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(p => !p)} />
            
            {/* 顶部按钮 */}
            <button style={styles.closeBtn} onClick={onClose} data-no-gesture="true"><FaTimes /></button>
            <div style={styles.topCounter}>{currentIndex + 1} / {activeCards.length}</div>

            {/* 弹窗组件 */}
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
            {isRecordingOpen && <RecordingComparisonModal word={currentCard} settings={settings} onClose={() => setIsRecordingOpen(false)} />}
            {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={(i)=>{setCurrentIndex(i);setIsJumping(false)}} onClose={()=>setIsJumping(false)} />}

            {transitions((cardStyle, i) => {
                const card = activeCards[i];
                if (!card) return null;
                const isFallback = card.id === 'fallback';
                return (
                    <animated.div style={{ ...styles.cardShell, ...cardStyle }}>
                        <div style={styles.cardContent}>
                            <div onClick={e => {
                                e.stopPropagation();
                                if(!isFallback) playTTS(card.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource);
                            }}>
                                <div style={styles.pinyin}>{pinyinConverter(card.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                                <div style={styles.chinese}>{card.chinese}</div>
                            </div>
                            
                            {(isRevealed || isFallback) && (
                                <animated.div style={{ marginTop: 30 }} onClick={e => {
                                    e.stopPropagation();
                                    if(!isFallback) playTTS(card.burmese, settings.voiceBurmese, 0, settings.ttsSource);
                                }}>
                                    <div style={styles.burmese}>{card.burmese}</div>
                                    {card.example && <div style={styles.example}>{card.example}</div>}
                                </animated.div>
                            )}
                        </div>
                    </animated.div>
                );
            })}

            {/* 右侧工具栏 */}
            <div style={styles.rightBar} data-no-gesture="true">
                <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setIsSettingsOpen(true)}}><FaCog /></button>
                <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); playTTS(currentCard.audioText, settings.voiceChinese, 0)}}><FaVolumeUp /></button>
                <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setIsRecordingOpen(true)}}><FaMicrophone /></button>
                <button style={{...styles.iconBtn, color: '#0084FF'}} onClick={handleFacebookShare}><FaFacebookMessenger /></button>
                {currentCard?.chinese && currentCard.chinese.length <= 4 && (
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setWriterChar(currentCard.chinese)}}><FaPenFancy /></button>
                )}
                <button style={{...styles.iconBtn, color: isFavoriteCard ? 'red' : 'gray'}} onClick={handleToggleFavorite}>
                    {isFavoriteCard ? <FaHeart /> : <FaRegHeart />}
                </button>
            </div>

            {/* 底部按钮 */}
            <div style={styles.bottomBar} data-no-gesture="true">
                <div style={styles.counter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>
                <div style={styles.buttons}>
                    <button style={{...styles.btn, background:'#f59e0b'}} onClick={(e)=>{e.stopPropagation(); navigate(1)}}>不认识</button>
                    <button style={{...styles.btn, background:'#22c55e'}} onClick={(e)=>{e.stopPropagation(); navigate(1)}}>认识</button>
                </div>
            </div>

        </animated.div>
    ));

    if (isMounted) return createPortal(content, document.body);
    return null;
};

// 样式
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, background: '#30505E', overflow: 'hidden', touchAction: 'none' },
    gestureArea: { position: 'absolute', inset: 0, zIndex: 1 },
    cardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' },
    cardContent: { pointerEvents: 'auto', textAlign: 'center', width: '100%', maxWidth: 500 },
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', marginBottom: 10 },
    chinese: { fontSize: '3.5rem', fontWeight: 'bold', color: 'white' },
    burmese: { fontSize: '2rem', color: '#fce38a', marginTop: 10, fontFamily: '"Padauk", sans-serif' },
    example: { fontSize: '1.1rem', color: '#e5e7eb', marginTop: 15, padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 10 },
    bottomBar: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 10 },
    counter: { background: 'rgba(0,0,0,0.5)', color: 'white', padding: '5px 15px', borderRadius: 15, fontSize: '0.9rem' },
    buttons: { display: 'flex', gap: 15, width: '100%', maxWidth: 400 },
    btn: { flex: 1, padding: 15, border: 'none', borderRadius: 15, color: 'white', fontSize: '1.1rem', fontWeight: 'bold' },
    rightBar: { position: 'fixed', right: 15, bottom: '20%', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 10 },
    iconBtn: { width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 2px 5px rgba(0,0,0,0.2)', color: '#444' },
    closeBtn: { position: 'fixed', top: 20, left: 20, zIndex: 100, width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 20 },
    topCounter: { position: 'fixed', top: 25, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.6)', pointerEvents: 'none', zIndex: 90 },
    
    // 弹窗相关
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    settingsContent: { background: 'white', padding: 25, borderRadius: 15, width: '85%', maxWidth: 350 },
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    jumpModalContent: { background: 'white', padding: 25, borderRadius: 15, textAlign:'center' },
    jumpModalInput: { fontSize: 20, padding: 10, width: 80, textAlign: 'center', marginBottom: 15, border: '1px solid #ccc', borderRadius: 5 },
    jumpModalButton: { padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: 5, fontSize: 16 },
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    comparisonPanel: { background: 'white', borderRadius: 20, width: '90%', maxWidth: 350, overflow: 'hidden' },
    recordHeader: { padding: 15, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems:'center' },
    recordContent: { padding: 20, textAlign: 'center' },
    recordWordDisplay: { marginBottom: 20 },
    textWordChinese: { fontSize: '2rem', fontWeight: 'bold' },
    actionArea: { marginTop: 20 },
    bigRecordBtn: { width: 70, height: 70, borderRadius: '50%', background: '#007bff', color: 'white', border: 'none', fontSize: 24, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' },
    recordingPulse: { animation: 'pulse 1s infinite', background: '#dc3545' },
    instructionText: { marginTop: 10, color: '#666', fontSize: 14 },
    recordDoneBtn: { width: '100%', padding: 15, background: '#333', color: 'white', border: 'none', fontSize: 16 },
    
    // 设置项样式
    closeButton: { float: 'right', background: 'none', border: 'none', fontSize: 20, color: '#999' },
    settingGroup: { marginBottom: 20 },
    settingLabel: { display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#444' },
    settingControl: { display: 'flex', gap: 10 },
    settingButton: { flex: 1, padding: '8px 0', border: 'none', borderRadius: 5, fontSize: 14 }
};

export default WordCard;
