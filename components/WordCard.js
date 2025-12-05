// components/WordCard.js (最终融合增强版：缅文界面 + 完美拼音 + 录音修复 + 进度保存)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, 
    FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaCheck, FaRedo,
    FaFacebookMessenger, FaImage 
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// ===== 1. 数据库配置 =====
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 2;
const STORE_FAVORITES = 'favoriteWords';
const STORE_AUDIO = 'audioCache';

function openDB() {
    if (typeof window === 'undefined') return Promise.reject("Server side");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('DB Error');
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

// =================================================================================
// ===== 2. 拼音工具 (完美支持第一声) =====
// =================================================================================
// 简单的拼音渲染组件：自动标注音调
const PinyinDisplay = ({ text, size = '1.5rem', color = '#fcd34d' }) => {
    if (!text) return null;
    // 使用 pinyin-pro 的 html 模式生成带声调的 HTML，确保准确
    // 但为了 React 安全，我们这里直接用 symbol 模式输出字符串即可，pinyin-pro 处理第一声很完美
    const pinyinStr = pinyinConverter(text, { toneType: 'symbol', separator: ' ' });
    return <div style={{ fontSize: size, color, marginBottom: '0.5rem', fontFamily: 'Arial' }}>{pinyinStr}</div>;
};

// =================================================================================
// ===== 3. 音频逻辑 (全局单例) =====
// =================================================================================
const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: 'တရုတ် (အမျိုးသမီး)' },
    { value: 'zh-CN-XiaoyouNeural', label: 'တရုတ် (ကလေး)' },
    { value: 'my-MM-NilarNeural', label: 'မြန်မာ (အမျိုးသမီး)' },
    { value: 'my-MM-ThihaNeural', label: 'မြန်မာ (အမျိုးသား)' },
];

let _howlInstance = null;

const stopAllAudio = () => {
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
};

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

const playTTS = async (text, voice, rate, source, onEndCallback, e, onlyCache = false) => {
    if (e && e.stopPropagation) e.stopPropagation();
    // 只有非预加载模式才停止当前声音
    if (!onlyCache) stopAllAudio();
    if (!text) { if (onEndCallback && !onlyCache) onEndCallback(); return; }

    const playNative = () => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = voice?.includes('my') ? 'my-MM' : 'zh-CN';
        u.rate = rate >= 0 ? 1 + (rate / 100) : 0.6; // 默认慢一点
        u.onend = onEndCallback;
        u.onerror = onEndCallback;
        window.speechSynthesis.speak(u);
    };

    if (source === 'browser') { playNative(); return; }

    const cacheKey = generateAudioKey(text, voice, Math.round(rate / 2));
    if (onlyCache && await getCachedAudio(cacheKey)) return; // 已缓存则跳过

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
            if (!onlyCache) playNative();
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
// ===== 4. 设置 Hook =====
// =================================================================================
const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        const defaults = { 
            order: 'sequential', ttsSource: 'server', 
            autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, 
            autoBrowse: false, autoBrowseDelay: 6000, 
            voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', 
            speechRateChinese: -40, // 默认语速 -40
            speechRateBurmese: 0, 
            backgroundImage: '' 
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

// =================================================================================
// ===== 5. 子组件 (录音、设置、跳转) =====
// =================================================================================

// 录音对比组件 (使用 Blob 录音 + 播放对比，非语音识别)
const RecordingComparisonModal = ({ word, settings, onClose }) => {
    const [status, setStatus] = useState('idle'); 
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        return () => {
            if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
            streamRef.current?.getTracks().forEach(t => t.stop());
            stopAllAudio();
        };
    }, [userAudioUrl]);

    const startRecording = async () => {
        stopAllAudio();
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
                setUserAudioUrl(url);
                setStatus('review');
                stream.getTracks().forEach(track => track.stop());
            };
            recorder.start();
            setStatus('recording');
        } catch (err) { alert("မိုက်ခရိုဖုန်း ဖွင့်မရပါ (无法访问麦克风)"); }
    };

    const stopRecording = () => { mediaRecorderRef.current?.stop(); };
    const resetRecording = () => { setUserAudioUrl(null); setStatus('idle'); };
    const playStandard = () => playTTS(word.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource);
    const playUser = () => { 
        stopAllAudio();
        if (userAudioUrl) new Howl({ src: [userAudioUrl], html5: true }).play(); 
    };

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>အသံထွက် လေ့ကျင့်မည်</h3><FaTimes onClick={onClose} /></div>
                <div style={styles.recordContent}>
                    <div style={{marginBottom: 20}}>
                        <PinyinDisplay text={word.chinese} />
                        <div style={styles.textWordChinese}>{word.chinese}</div>
                    </div>
                    
                    {status === 'idle' && (
                        <div style={{textAlign:'center'}}>
                            <button style={styles.bigRecordBtn} onClick={startRecording}><FaMicrophone size={32} /></button>
                            <p style={{marginTop:10, color:'#666'}}>နှိပ်၍ အသံသွင်းပါ</p>
                        </div>
                    )}
                    
                    {status === 'recording' && (
                        <div style={{textAlign:'center'}}>
                            <button style={{...styles.bigRecordBtn, background:'#ef4444', animation:'pulse 1.5s infinite'}} onClick={stopRecording}><FaStop size={32} /></button>
                            <p style={{marginTop:10, color:'#ef4444'}}>အသံသွင်းနေသည်...</p>
                        </div>
                    )}

                    {status === 'review' && (
                        <div style={{width:'100%'}}>
                            <div style={{display:'flex', justifyContent:'space-around', marginBottom:20}}>
                                <div style={{textAlign:'center'}}>
                                    <button style={styles.circleBtnBlue} onClick={playStandard}><FaVolumeUp size={24}/></button>
                                    <p style={{fontSize:12, marginTop:5}}>မူရင်း</p>
                                </div>
                                <div style={{textAlign:'center'}}>
                                    <button style={styles.circleBtnGreen} onClick={playUser}><FaPlayCircle size={24}/></button>
                                    <p style={{fontSize:12, marginTop:5}}>ကိုယ့်အသံ</p>
                                </div>
                            </div>
                            <button style={styles.retryLink} onClick={resetRecording}><FaRedo /> ပြန်အသံသွင်းမည်</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
    const handleSettingChange = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };
    const handleImageUpload = (e) => { 
        const file = e.target.files[0]; 
        if (file) { 
            const reader = new FileReader(); 
            reader.onload = (e) => handleSettingChange('backgroundImage', e.target.result); 
            reader.readAsDataURL(file); 
        } 
    };

    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                    <h3 style={{margin:0}}>အပြင်အဆင် (设置)</h3>
                    <FaTimes onClick={onClose} size={20} color="#999" />
                </div>
                
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>နောက်ခံပုံ (背景图片)</label>
                    <div style={{display:'flex', gap:10}}>
                        <label style={styles.uploadBtn}>
                            <FaImage /> ပုံရွေးရန်
                            <input type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} />
                        </label>
                        <button style={styles.resetBtn} onClick={() => handleSettingChange('backgroundImage', '')}>မူလပုံ</button>
                    </div>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>တရုတ်အသံ (中文发音)</label>
                    <select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>အသံအမြန်နှုန်း ({settings.speechRateChinese})</label>
                    <input type="range" min="-100" max="50" step="10" value={settings.speechRateChinese} style={{width:'100%'}} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value))} />
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>အလိုအလျောက်ဖွင့် (自动播放)</label>
                    <div style={{display:'flex', gap:15}}>
                        <label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> တရုတ်</label>
                        <label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> မြန်မာ</label>
                    </div>
                </div>
            </div>
        </div>
    );
});

const JumpModal = ({ max, current, onJump, onClose }) => {
    const [val, setVal] = useState(current + 1);
    return (
        <div style={styles.jumpModalOverlay} onClick={onClose}>
            <div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}>
                <h3>စာမျက်နှာသွားရန်</h3>
                <div style={{display:'flex', justifyContent:'center', gap:10, margin:'20px 0'}}>
                    <input type="number" style={styles.jumpInput} value={val} onChange={e => setVal(e.target.value)} />
                    <span style={{lineHeight:'40px'}}> / {max}</span>
                </div>
                <button style={styles.jumpBtn} onClick={() => {
                    const n = parseInt(val);
                    if (n > 0 && n <= max) onJump(n - 1);
                }}>သွားပါ</button>
            </div>
        </div>
    );
};

// =================================================================================
// ===== 6. 主组件 WordCard =====
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
        // 注入动画样式
        if (typeof document !== 'undefined' && !document.getElementById('wc-anim-style')) {
            const s = document.createElement("style");
            s.id = 'wc-anim-style';
            s.innerText = `@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }`;
            document.head.appendChild(s);
        }
    }, []);

    const [settings, setSettings] = useCardSettings();

    // 数据处理
    const initialCards = useMemo(() => {
        if (!Array.isArray(words)) return [];
        return words.map(w => ({
            id: w.id || Math.random().toString(36),
            chinese: w.chinese || w.chineseWord || w.word || '',
            audioText: w.audioText || w.tts_text || w.chinese || '',
            burmese: w.burmese || w.burmeseTranslation || w.translation || '', 
            mnemonic: w.mnemonic || '', // 谐音
            example: w.example || '',
        })).filter(w => w.chinese);
    }, [words]);

    const [activeCards, setActiveCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // 初始化 & 进度恢复
    useEffect(() => {
        if (!initialCards.length) return;
        
        let list = [...initialCards];
        if (settings.order === 'random') list.sort(() => Math.random() - 0.5);
        setActiveCards(list);

        // 尝试恢复进度
        if (typeof window !== 'undefined' && progressKey) {
            const saved = parseInt(localStorage.getItem(`word_progress_${progressKey}`), 10);
            if (!isNaN(saved) && saved < list.length) setCurrentIndex(saved);
            else setCurrentIndex(0);
        }
    }, [initialCards, settings.order, progressKey]);

    // 保存进度
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
        }
    }, [currentIndex, progressKey]);

    const [isRevealed, setIsRevealed] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRecordingOpen, setIsRecordingOpen] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [isFavoriteCard, setIsFavoriteCard] = useState(false);
    const [isJumping, setIsJumping] = useState(false);
    
    const autoBrowseTimerRef = useRef(null);
    const lastDirection = useRef(0);
    const currentCard = activeCards[currentIndex];

    // 预加载 TTS
    useEffect(() => {
        if (activeCards.length && settings.ttsSource === 'server') {
            const nextIdx = (currentIndex + 1) % activeCards.length;
            const nextCard = activeCards[nextIdx];
            if (nextCard) playTTS(nextCard.audioText, settings.voiceChinese, settings.speechRateChinese, 'server', null, null, true);
        }
    }, [currentIndex, activeCards, settings]);

    // 收藏状态
    useEffect(() => {
        if (currentCard?.id) isFavorite(currentCard.id).then(setIsFavoriteCard);
    }, [currentCard]);

    const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        if (!currentCard) return;
        const res = await toggleFavorite(currentCard);
        setIsFavoriteCard(res);
    };

    const handleShare = useCallback((e) => {
        e.stopPropagation();
        if (!currentCard) return;
        const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) window.location.href = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
        else window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    }, [currentCard]);

    const navigate = useCallback((direction) => {
        if (!activeCards.length) return;
        stopAllAudio();
        lastDirection.current = direction;
        setCurrentIndex(prev => (prev + direction + activeCards.length) % activeCards.length);
        setIsRevealed(false);
    }, [activeCards.length]);

    // 自动播放序列
    useEffect(() => {
        if (!isOpen || !currentCard) return;
        clearTimeout(autoBrowseTimerRef.current);
        stopAllAudio();

        if (settings.autoPlayChinese) {
            playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, () => {
                if (settings.autoPlayBurmese && isRevealed) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, settings.ttsSource, () => {
                        if (settings.autoPlayExample && currentCard.example && isRevealed) {
                            playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, startTimer);
                        } else startTimer();
                    });
                } else startTimer();
            });
        } else startTimer();

        function startTimer() {
            if (settings.autoBrowse) {
                autoBrowseTimerRef.current = setTimeout(() => navigate(1), settings.autoBrowseDelay);
            }
        }
        return () => { clearTimeout(autoBrowseTimerRef.current); stopAllAudio(); };
    }, [currentIndex, isRevealed, settings, isOpen, navigate]);

    // 动画
    const transitions = useTransition(currentCard, {
        key: currentCard?.id || currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current * 100}%)` },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: `translateY(${-lastDirection.current * 100}%)`, position: 'absolute' },
        config: { tension: 280, friction: 30 }
    });

    const pageTransition = useTransition(isOpen, {
        from: { opacity: 0, transform: 'translateY(100%)' },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: 'translateY(100%)' },
    });

    // 划屏手势 (修复)
    const bind = useDrag(({ down, movement: [mx, my], velocity: [vx, vy], direction: [xDir, yDir], event }) => {
        if (event.target.closest('[data-no-gesture]')) return;
        if (down) return;
        event.stopPropagation();
        
        // 垂直下滑 -> 关闭
        if (my > 100 && vy > 0.5) onClose();
        // 水平滑动 -> 切词
        else if (Math.abs(mx) > 50 && Math.abs(mx) > Math.abs(my)) navigate(xDir < 0 ? 1 : -1);
    }, { filterTaps: true });

    const content = pageTransition((style, item) => item && (
        <animated.div style={{ ...styles.fullScreen, ...style, ...(settings.backgroundImage ? {background: `url(${settings.backgroundImage}) center/cover`} : {}) }}>
            
            <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(p => !p)} />
            
            {/* 弹窗层 */}
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
            {isRecordingOpen && <RecordingComparisonModal word={currentCard} settings={settings} onClose={() => setIsRecordingOpen(false)} />}
            {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={(i)=>{setCurrentIndex(i);setIsJumping(false)}} onClose={()=>setIsJumping(false)} />}

            {/* 卡片主体 */}
            {activeCards.length > 0 ? (
                transitions((cardStyle, item) => item && (
                    <animated.div style={{ ...styles.cardShell, ...cardStyle }}>
                        <div style={styles.cardContent}>
                            <div onClick={e => { e.stopPropagation(); playTTS(item.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource); }}>
                                {/* 拼音 */}
                                <PinyinDisplay text={item.chinese} />
                                {/* 汉字 */}
                                <div style={styles.chinese}>{item.chinese}</div>
                            </div>
                            
                            {isRevealed && (
                                <animated.div style={{ marginTop: 20 }} onClick={e => { e.stopPropagation(); playTTS(item.burmese, settings.voiceBurmese, 0, settings.ttsSource); }}>
                                    {/* 缅语含义 */}
                                    <div style={styles.burmese}>{item.burmese}</div>
                                    
                                    {/* 谐音 (Mnemonic) */}
                                    {item.mnemonic && <div style={styles.mnemonicBox}>{item.mnemonic}</div>}

                                    {/* 例句 (无背景，加拼音) */}
                                    {item.example && (
                                        <div style={styles.exampleBox} onClick={e=>{e.stopPropagation(); playTTS(item.example, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource)}}>
                                            <PinyinDisplay text={item.example} size="1rem" color="#9ca3af" />
                                            <div style={styles.exampleText}>{item.example}</div>
                                        </div>
                                    )}
                                </animated.div>
                            )}
                        </div>
                    </animated.div>
                ))
            ) : (
                <div style={styles.centerMsg}>
                    <h2>🎉 ဂုဏ်ယူပါသည်！</h2>
                    <p>သင်ခန်းစာ ပြီးဆုံးပါပြီ</p>
                    <button style={styles.btnPrimary} onClick={onClose}>ပြန်ထွက်ရန်</button>
                </div>
            )}

            {/* 右侧工具栏 */}
            {activeCards.length > 0 && (
                <div style={styles.rightBar} data-no-gesture="true">
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setIsSettingsOpen(true)}}><FaCog /></button>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese)}}><FaVolumeUp /></button>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setIsRecordingOpen(true)}}><FaMicrophone /></button>
                    <button style={{...styles.iconBtn, color: '#0084FF'}} onClick={handleShare}><FaFacebookMessenger /></button>
                    {currentCard?.chinese.length <= 4 && (
                        <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setWriterChar(currentCard.chinese)}}><FaPenFancy /></button>
                    )}
                    <button style={{...styles.iconBtn, color: isFavoriteCard ? '#ef4444' : '#6b7280'}} onClick={handleToggleFavorite}>
                        {isFavoriteCard ? <FaHeart /> : <FaRegHeart />}
                    </button>
                </div>
            )}

            {/* 底部点击区域：打开跳转面板 */}
            <div style={styles.bottomArea} onClick={(e) => {e.stopPropagation(); setIsJumping(true);}} data-no-gesture="true"></div>

        </animated.div>
    ));

    if (isMounted) return createPortal(content, document.body);
    return null;
};

// =================================================================================
// ===== 6. 样式 (浅色系 + 优化) =====
// =================================================================================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, background: '#f8fafc', overflow: 'hidden', touchAction: 'none' },
    gestureArea: { position: 'absolute', inset: 0, zIndex: 1 },
    
    // 卡片
    cardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '0 20px' },
    cardContent: { pointerEvents: 'auto', textAlign: 'center', width: '100%', maxWidth: 500, paddingBottom: 50 },
    
    // 文字
    chinese: { fontSize: '4rem', fontWeight: 'bold', color: '#1e293b' },
    burmese: { fontSize: '2.2rem', color: '#059669', marginTop: 10, fontWeight: 500 },
    
    // 谐音 (紫色胶囊)
    mnemonicBox: { display: 'inline-block', marginTop: 15, padding: '6px 12px', background: '#8b5cf6', color: 'white', borderRadius: 20, fontSize: '1.1rem', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
    
    // 例句 (无背景，简洁)
    exampleBox: { marginTop: 25, padding: '0 10px' },
    exampleText: { fontSize: '1.3rem', color: '#374151', lineHeight: 1.5 },

    // 侧边栏
    rightBar: { position: 'fixed', right: 20, bottom: '20%', display: 'flex', flexDirection: 'column', gap: 15, zIndex: 10 },
    iconBtn: { width: 48, height: 48, borderRadius: '50%', border: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', color: '#475569' },

    // 底部不可见点击区 (用于跳转)
    bottomArea: { position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, zIndex: 5 },

    // 弹窗通用
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    comparisonPanel: { width: '90%', maxWidth: 350, background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    recordHeader: { padding: '15px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight:'bold', color:'#333' },
    recordContent: { padding: 25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 },
    textWordChinese: { fontSize: '2.5rem', fontWeight: 'bold', color: '#333' },
    
    bigRecordBtn: { width: 80, height: 80, borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' },
    circleBtnBlue: { width: 60, height: 60, borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    circleBtnGreen: { width: 60, height: 60, borderRadius: '50%', background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    retryLink: { background: 'none', border: 'none', color: '#6b7280', textDecoration: 'underline', marginTop: 10, display:'flex', alignItems:'center', gap:5 },

    // 设置弹窗
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    settingsContent: { background: 'white', padding: 25, borderRadius: 20, width: '85%', maxWidth: 350 },
    settingGroup: { marginBottom: 20 },
    settingLabel: { display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#333' },
    settingSelect: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' },
    uploadBtn: { display: 'inline-block', padding: '8px 15px', background: '#3b82f6', color: 'white', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
    resetBtn: { padding: '8px 15px', background: '#ef4444', color: 'white', borderRadius: 8, border:'none', fontSize: 14 },

    // 跳转弹窗
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    jumpModalContent: { background: 'white', padding: 25, borderRadius: 15, textAlign:'center' },
    jumpModalTitle: { marginTop: 0, marginBottom: 15, color: '#333' },
    jumpInput: { fontSize: 20, padding: 10, width: 80, textAlign: 'center', border: '1px solid #ddd', borderRadius: 8 },
    jumpBtn: { display:'block', width:'100%', marginTop: 15, padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 16 },

    // 完成页
    centerMsg: { position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:5, color:'#333' },
    btnPrimary: { marginTop: 20, padding: '12px 30px', background: '#3b82f6', color:'white', border:'none', borderRadius: 8, fontSize: 18 },
};

export default WordCard;
