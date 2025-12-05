// components/WordCard.js (最终融合修复版)

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
// ===== 1. 数据库 & 缓存 (来自版本一) =====
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

async function toggleFavorite(word) {
    if (typeof window === 'undefined' || !word?.id) return false;
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
    } catch (e) { return false; }
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

// =================================================================================
// ===== 2. 音频播放 & 拼音解析 (修复版) =====
// =================================================================================
const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

let _howlInstance = null;
let sounds = null;

const initSounds = () => {
    if (!sounds && typeof window !== 'undefined') {
        sounds = {
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
            correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
        };
    }
};

const playSoundEffect = (type) => {
    if (typeof window !== 'undefined') {
        initSounds();
        if (sounds && sounds[type]) sounds[type].play();
    }
};

const playTTS = async (text, voice, rate, source, onEndCallback, e, onlyCache = false) => {
    if (typeof window === 'undefined') return;
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text) { if (onEndCallback && !onlyCache) onEndCallback(); return; }

    const playNative = () => {
        window.speechSynthesis.cancel(); 
        const u = new SpeechSynthesisUtterance(text);
        u.lang = voice?.includes('my') ? 'my-MM' : 'zh-CN';
        u.rate = 1.0;
        u.onend = onEndCallback;
        u.onerror = onEndCallback;
        window.speechSynthesis.speak(u);
    };

    if (source === 'browser') {
        playNative();
        return;
    }

    if (_howlInstance?.playing()) _howlInstance.stop();

    const cacheKey = generateAudioKey(text, voice, Math.round(rate / 2));
    let audioBlob = await getCachedAudio(cacheKey);

    if (!audioBlob) {
        try {
            const apiUrl = 'https://libretts.is-an.org/api/tts';
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, rate: Math.round(rate/2), pitch: 0 }),
            });
            if (!res.ok) throw new Error('API failed');
            audioBlob = await res.blob();
            await cacheAudioData(cacheKey, audioBlob);
        } catch (error) {
            console.error('[TTS Error]', error);
            if (!onlyCache) playNative(); // 失败回退
            return;
        }
    }
    
    if (onlyCache) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    _howlInstance = new Howl({
        src: [audioUrl],
        format: ['mpeg'],
        html5: true,
        onend: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); },
        onloaderror: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); playNative(); }
    });
    _howlInstance.play();
};


// =================================================================================
// ===== 3. 子组件 (设置、录音等) =====
// =================================================================================
const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        const defaults = { 
            order: 'sequential', ttsSource: 'server', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, 
            voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' 
        };
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

    const startRecording = async () => {
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
        } catch (err) { alert("麦克风权限被拒绝或不可用。"); }
    };

    const stopRecording = () => { if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop(); };
    const resetRecording = () => { if (userAudioUrl) URL.revokeObjectURL(userAudioUrl); setUserAudioUrl(null); setStatus('idle'); };
    const playStandard = () => playTTS(word.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource);
    const playUser = () => { if (userAudioUrl) new Howl({ src: [userAudioUrl], html5: true }).play(); };

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>发音对比</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={styles.recordContent}>
                    <div style={styles.recordWordDisplay}><div style={styles.pinyin}>{pinyinConverter(word.chinese, { toneType: 'symbol' })}</div><div style={styles.textWordChinese}>{word.chinese}</div></div>
                    <div style={styles.actionArea}>
                        {status === 'idle' && <button style={styles.bigRecordBtn} onClick={startRecording}><FaMicrophone size={32} /></button>}
                        {status === 'recording' && <button style={{...styles.bigRecordBtn, background: '#ef4444', animation:'pulse 1.5s infinite'}} onClick={stopRecording}><FaStop size={32} /></button>}
                        {status === 'review' && (
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:20}}>
                                <div style={{display:'flex', justifyContent:'space-around', width:'100%'}}>
                                    <button style={styles.circleBtnBlue} onClick={playStandard}><FaVolumeUp size={24} /></button>
                                    <button style={styles.circleBtnGreen} onClick={playUser}><FaPlayCircle size={24} /></button>
                                </div>
                                <button style={styles.retryLink} onClick={resetRecording}><FaRedo size={12} /> 重录</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
    const handleSettingChange = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };
    const handleImageUpload = (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => handleSettingChange('backgroundImage', e.target.result); reader.readAsDataURL(file); } };

    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{marginTop:0}}>设置</h2>
                {/* 恢复了所有设置 */}
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>中文发音人</label>
                    <select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>中文语速 ({settings.speechRateChinese}%)</label>
                    <input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} />
                </div>
                 <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>缅甸语发音人</label>
                    <select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>自动播放</label>
                    <label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 中文</label>
                    <label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 缅语</label>
                </div>
            </div>
        </div>
    );
});


// =================================================================================
// ===== 4. 主组件 =====
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); initSounds(); }, []);

    const [settings, setSettings] = useCardSettings();

    const initialCards = useMemo(() => {
        return words.map(w => ({
            id: w.id || Math.random().toString(36),
            chinese: w.chinese || w.chineseWord || w.word || '',
            audioText: w.audioText || w.tts_text || w.chinese || '',
            burmese: w.burmese || w.burmeseTranslation || '', 
            example: w.example || '',
            pinyin: w.pinyin || ''
        })).filter(w => w.chinese);
    }, [words]);

    const [activeCards, setActiveCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        let list = [...initialCards];
        if (settings.order === 'random') list.sort(() => Math.random() - 0.5);
        setActiveCards(list);
        setCurrentIndex(0);
    }, [initialCards, settings.order]);

    const [isRevealed, setIsRevealed] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRecordingOpen, setIsRecordingOpen] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [isFavoriteCard, setIsFavoriteCard] = useState(false);
    
    const lastDirection = useRef(0);
    const currentCard = activeCards[currentIndex];

    useEffect(() => {
        if (currentCard?.id) isFavorite(currentCard.id).then(setIsFavoriteCard);
    }, [currentCard]);

    const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        if (!currentCard) return;
        setIsFavoriteCard(await toggleFavorite(currentCard));
    };

    const handleKnow = () => {
        if (!currentCard) return;
        const newCards = activeCards.filter(c => c.id !== currentCard.id);
        setActiveCards(newCards);
        setIsRevealed(false);
        if (currentIndex >= newCards.length) setCurrentIndex(0);
    };

    const handleDontKnow = () => {
        if (isRevealed) {
            lastDirection.current = 1;
            setCurrentIndex(p => (p + 1) % activeCards.length);
            setIsRevealed(false);
        } else {
            setIsRevealed(true);
        }
    };
    
    // 自动播放
    useEffect(() => {
        if (!isOpen || !currentCard) return;
        if (settings.autoPlayChinese) {
            playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, () => {
                if (settings.autoPlayBurmese && isRevealed) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, 0, settings.ttsSource);
                }
            });
        }
    }, [currentIndex, isRevealed, settings, isOpen]);

    // 动画
    const pageTransitions = useTransition(isOpen, { from: { opacity: 0 }, enter: { opacity: 1 }, leave: { opacity: 0 } });
    const cardTransitions = useTransition(currentCard, {
        key: item => item?.id,
        from: { opacity: 0, transform: `translateY(${lastDirection.current * 100}px)` },
        enter: { opacity: 1, transform: 'translateY(0px)' },
        leave: { opacity: 0, transform: `translateY(${-lastDirection.current * 100}px)`, position: 'absolute' },
        config: { tension: 300, friction: 30 },
        onStart: () => playSoundEffect('switch')
    });

    // 手势
    const bind = useDrag(({ down, movement: [mx, my], velocity: [vx, vy], direction: [xDir, yDir], event }) => {
        if (down) return;
        if (event.target.closest('[data-no-gesture]')) return;
        if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 80) { // 垂直划动
            if (my > 0) onClose(); // 下划关闭
            else navigate(yDir < 0 ? 1 : -1); // 上划下一张
        }
    }, { filterTaps: true });

    const content = pageTransitions((style, item) => item && (
        <animated.div style={{ ...styles.fullScreen, ...style, ... (settings.backgroundImage ? {background: `url(${settings.backgroundImage}) center/cover`} : {}) }}>
            <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(p => !p)} />
            
            {/* 弹窗 */}
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
            {isRecordingOpen && <RecordingComparisonModal word={currentCard} settings={settings} onClose={() => setIsRecordingOpen(false)} />}

            {/* 卡片区域 */}
            {activeCards.length > 0 ? (
                cardTransitions((cardStyle, item) => item && (
                    <animated.div style={{ ...styles.cardShell, ...cardStyle }}>
                        <div style={styles.cardContent}>
                            <div onClick={e => { e.stopPropagation(); playTTS(item.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource); }}>
                                <div style={styles.pinyin}>{pinyinConverter(item.chinese, { toneType: 'symbol' })}</div>
                                <div style={styles.chinese}>{item.chinese}</div>
                            </div>
                            
                            {isRevealed && (
                                <animated.div style={{ marginTop: 30 }} onClick={e => { e.stopPropagation(); playTTS(item.burmese, settings.voiceBurmese, 0, settings.ttsSource); }}>
                                    <div style={styles.burmese}>{item.burmese}</div>
                                    {item.example && <div style={styles.example}>{item.example}</div>}
                                </animated.div>
                            )}
                        </div>
                    </animated.div>
                ))
            ) : (
                <div style={styles.centerMsg}>
                    <h2>🎉 全部完成！</h2>
                    <p>您已学完本组单词</p>
                    <button style={styles.btnPrimary} onClick={onClose}>返回列表</button>
                </div>
            )}

            {/* 右侧工具栏 */}
            {activeCards.length > 0 && (
                <div style={styles.rightBar} data-no-gesture="true">
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setIsSettingsOpen(true)}}><FaCog /></button>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource)}}><FaVolumeUp /></button>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setIsRecordingOpen(true)}}><FaMicrophone /></button>
                    {currentCard?.chinese.length <= 4 && (
                        <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setWriterChar(currentCard.chinese)}}><FaPenFancy /></button>
                    )}
                    <button style={{...styles.iconBtn, color: isFavoriteCard ? '#ef4444' : '#6b7280'}} onClick={handleToggleFavorite}>
                        {isFavoriteCard ? <FaHeart /> : <FaRegHeart />}
                    </button>
                </div>
            )}

            {/* 底部按钮 */}
            {activeCards.length > 0 && (
                <div style={styles.bottomBar} data-no-gesture="true">
                    <button style={{...styles.btn, background:'#f97316'}} onClick={handleDontKnow}>{isRevealed ? '下一张' : '不认识'}</button>
                    <button style={{...styles.btn, background:'#22c55e'}} onClick={handleKnow}>认识</button>
                </div>
            )}
        </animated.div>
    ));

    if (isMounted) return createPortal(content, document.body);
    return null;
};

// =================================================================================
// ===== 6. 样式 (浅色系) =====
// =================================================================================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, background: '#f1f5f9', overflow: 'hidden', touchAction: 'none' },
    gestureArea: { position: 'absolute', inset: 0, zIndex: 1 },
    cardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '0 20px' },
    cardContent: { pointerEvents: 'auto', textAlign: 'center', width: '100%', maxWidth: 500 },
    
    pinyin: { fontSize: '1.8rem', color: '#64748b' },
    chinese: { fontSize: '4.5rem', fontWeight: 'bold', color: '#1e293b' },
    burmese: { fontSize: '2.5rem', color: '#059669', marginTop: 15, fontWeight: 500 },
    example: { fontSize: '1.2rem', color: '#4b5563', marginTop: 20, padding: 15, background: '#e2e8f0', borderRadius: 12 },

    bottomBar: { position: 'fixed', bottom: 30, left: 20, right: 20, display: 'flex', gap: 20, zIndex: 10, maxWidth: 400, margin: '0 auto' },
    btn: { flex: 1, padding: 18, border: 'none', borderRadius: 16, color: 'white', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' },
    
    rightBar: { position: 'fixed', right: 20, bottom: '25%', display: 'flex', flexDirection: 'column', gap: 15, zIndex: 10 },
    iconBtn: { width: 48, height: 48, borderRadius: '50%', border: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', color: '#475569' },

    centerMsg: { position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:5, color:'#333' },
    btnPrimary: { marginTop: 20, padding: '12px 30px', background: '#3b82f6', color:'white', border:'none', borderRadius: 8, fontSize: 18 },

    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { background: 'white', padding: 0, borderRadius: 20, width: '90%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    modalHeader: { padding: '15px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    
    // 录音
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 10000, padding: '10px', display:'flex', alignItems:'center', justifyContent:'center' },
    comparisonPanel: { width: '100%', maxWidth: '350px', background: 'white', borderRadius: '20px', overflow: 'hidden' },
    recordHeader: { padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' },
    closeButtonSimple: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.2rem' },
    recordContent: { padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px' },
    recordWordDisplay: { textAlign: 'center' },
    textWordChinese: { fontSize: '2.5rem', fontWeight: 'bold' },
    actionArea: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    bigRecordBtn: { width: 80, height: 80, borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    circleBtnBlue: { width: 60, height: 60, borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    circleBtnGreen: { width: 60, height: 60, borderRadius: '50%', background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    retryLink: { background: 'none', border: 'none', color: '#6b7280', textDecoration: 'underline', marginTop: 10 },
    
    // 设置
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10001, padding: '15px', display:'flex', alignItems:'center', justifyContent:'center' },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '450px' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', color: '#aaa' },
    settingGroup: { marginBottom: '20px' },
    settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px' },
    settingControl: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    settingButton: { background: '#eee', border: 'none', padding: '10px 14px', borderRadius: 14, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
};

export default WordCard;
