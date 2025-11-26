// components/WordCard.js (最终完整版 - 录音对比 + 浏览器TTS双模式)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaTrash, FaCheck } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import { AdSlot } from '@/components/GoogleAdsense';
import InterstitialAd from './InterstitialAd';

// --- 数据库配置 ---
const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 2;
const STORE_FAVORITES = 'favoriteWords';
const STORE_AUDIO = 'audioCache';

// --- 数据库辅助函数 ---
function openDB() {
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
    const db = await openDB();
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    const store = tx.objectStore(STORE_FAVORITES);
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
}

async function isFavorite(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_FAVORITES, 'readonly');
    const store = tx.objectStore(STORE_FAVORITES);
    return new Promise((resolve) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => resolve(!!getReq.result);
        getReq.onerror = () => resolve(false);
    });
}

// --- 音频管理与 TTS 逻辑 ---
const generateAudioKey = (text, voice, rate) => `${text}_${voice}_${rate}`;

// 存入缓存
async function cacheAudioData(key, blob) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        const store = tx.objectStore(STORE_AUDIO);
        store.put(blob, key);
    } catch (e) {
        console.warn("缓存写入失败", e);
    }
}

// 读取缓存
async function getCachedAudio(key) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_AUDIO, 'readonly');
        const store = tx.objectStore(STORE_AUDIO);
        return new Promise((resolve) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

const sounds = {
    switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
    correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }), // 依然保留这些音效用于交互反馈
};

let _howlInstance = null;
let _currentAudioUrl = null;

// --- 浏览器原生 TTS 播放函数 ---
const playBrowserTTS = (text, lang, rate, onEndCallback) => {
    // 停止之前的播放
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // 语言代码映射：zh-CN-xxx -> zh-CN, my-MM-xxx -> my-MM
    // 如果是浏览器模式，voice 参数我们只取前缀作为 lang
    utterance.lang = lang.includes('my') ? 'my-MM' : 'zh-CN';
    
    // 速率映射： settings.rate (-100 to 100) -> 0.5 to 2.0
    // 0 -> 1, 100 -> 2, -100 -> 0.5
    const browserRate = rate >= 0 ? 1 + (rate / 100) : 1 + (rate / 200); 
    utterance.rate = Math.max(0.1, Math.min(browserRate, 2.0)); // 限制范围

    utterance.onend = () => {
        if (onEndCallback) onEndCallback();
    };
    utterance.onerror = (e) => {
        console.error("Browser TTS Error:", e);
        if (onEndCallback) onEndCallback();
    };

    window.speechSynthesis.speak(utterance);
};

// --- 核心播放函数 (统一入口) ---
const playTTS = async (text, voice, rate, source, onEndCallback, e, onlyCache = false) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text) {
        if (onEndCallback && !onlyCache) onEndCallback();
        return;
    }

    // --- 分支 1：浏览器 TTS ---
    if (source === 'browser') {
        if (onlyCache) return; // 浏览器 TTS 不需要预加载缓存
        if (_howlInstance?.playing()) _howlInstance.stop(); // 停止可能的 Server 音频
        playBrowserTTS(text, voice, rate, onEndCallback);
        return;
    }

    // --- 分支 2：云端 TTS (原逻辑) ---
    // 停止浏览器 TTS
    window.speechSynthesis.cancel();
    
    const cacheKey = generateAudioKey(text, voice, Math.round(rate / 2));

    // 如果只是为了预加载
    if (onlyCache) {
        const existing = await getCachedAudio(cacheKey);
        if (existing) return;
    } else {
        // 正常播放：停止当前 Howl
        if (_howlInstance?.playing()) _howlInstance.stop();
        if (_currentAudioUrl) {
            URL.revokeObjectURL(_currentAudioUrl);
            _currentAudioUrl = null;
        }
    }

    // 1. 查库
    let audioBlob = await getCachedAudio(cacheKey);

    // 2. 没命中则请求
    if (!audioBlob) {
        try {
            // 主接口
            const apiUrl = 'https://libretts.is-an.org/api/tts';
            const rateValue = Math.round(rate / 2);
            
            let response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }),
            });

            if (!response.ok) {
                // 备用接口
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
            console.error('TTS Playback/Cache Error:', error);
            if (onEndCallback && !onlyCache) onEndCallback();
            return;
        }
    }

    if (onlyCache) return;

    // 3. 播放
    const audioUrl = URL.createObjectURL(audioBlob);
    _currentAudioUrl = audioUrl;

    _howlInstance = new Howl({
        src: [audioUrl],
        format: ['mpeg', 'mp3', 'webm'],
        html5: true,
        onend: () => {
            if (onEndCallback) onEndCallback();
        },
        onloaderror: (id, err) => {
            console.error('Howler Load Error:', err);
            if (onEndCallback) onEndCallback();
        },
        onplayerror: (id, err) => {
            console.error('Howler Play Error:', err);
            _howlInstance.once('unlock', function() {
                _howlInstance.play();
            });
             if (onEndCallback) onEndCallback();
        }
    });

    _howlInstance.play();
};

const playSoundEffect = (type) => {
    // 音效通常很短，使用 Howl 即可，不依赖 TTS 设置
    if (sounds[type]) sounds[type].play();
};

// --- 设置 Hook ---
const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        try {
            const savedSettings = localStorage.getItem('learningWordCardSettings');
            const defaultSettings = {
                order: 'sequential',
                ttsSource: 'server', // 'server' | 'browser'
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
            console.error("加载设置失败", error);
            return { order: 'sequential', ttsSource: 'server', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' };
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('learningWordCardSettings', JSON.stringify(settings));
        } catch (error) {
            console.error("保存设置失败", error);
        }
    }, [settings]);

    return [settings, setSettings];
};

// --- 纯录音对比组件 ---
const RecordingComparisonModal = ({ word, settings, onClose }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);

    // 清理录音 URL
    useEffect(() => {
        return () => {
            if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (_howlInstance) _howlInstance.stop();
            window.speechSynthesis.cancel();
        };
    }, [userAudioUrl]);

    const handleToggleRecord = async () => {
        if (isRecording) {
            // 停止录音
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            return;
        }

        // 开始录音
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
                setIsRecording(false);
                // 停止轨道释放麦克风
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("麦克风访问失败", err);
            alert("无法访问麦克风，请检查权限。");
        }
    };

    const playStandard = () => {
        playTTS(word.chinese, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource);
    };

    const playUser = () => {
        if (!userAudioUrl) return;
        if (_howlInstance?.playing()) _howlInstance.stop();
        window.speechSynthesis.cancel();
        
        const sound = new Howl({ src: [userAudioUrl], format: ['webm'], html5: true });
        sound.play();
    };

    const deleteRecording = () => {
        if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
        setUserAudioUrl(null);
    };

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}>
                    <h3>发音对比</h3>
                    <button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button>
                </div>
                
                <div style={styles.recordContent}>
                    <div style={styles.recordWordDisplay}>
                        <div style={styles.pinyin}>{pinyinConverter(word.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                        <div style={styles.textWordChinese}>{word.chinese}</div>
                    </div>

                    <div style={styles.recordControls}>
                        {/* 标准音 */}
                        <div style={styles.controlRow}>
                            <span style={styles.label}>标准音:</span>
                            <button style={styles.circleBtnBlue} onClick={playStandard} title="播放标准音">
                                <FaVolumeUp size={20} />
                            </button>
                        </div>

                        {/* 录音控制 */}
                        <div style={styles.controlRow}>
                            <span style={styles.label}>你的发音:</span>
                            {!userAudioUrl ? (
                                <button 
                                    style={{...styles.circleBtnRed, ...(isRecording ? styles.recordingPulse : {})}} 
                                    onClick={handleToggleRecord}
                                >
                                    {isRecording ? <FaStop size={20} /> : <FaMicrophone size={20} />}
                                </button>
                            ) : (
                                <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                                    <button style={styles.circleBtnGreen} onClick={playUser} title="回放录音">
                                        <FaPlayCircle size={20} />
                                    </button>
                                    <button style={styles.circleBtnGray} onClick={deleteRecording} title="删除重录">
                                        <FaTrash size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                        {isRecording && <div style={{color: '#ef4444', fontSize: '0.9rem', marginTop: 5}}>正在录音...</div>}
                    </div>
                </div>

                <button style={styles.recordDoneBtn} onClick={onClose}>
                    <FaCheck /> 完成
                </button>
            </div>
        </div>
    );
};

const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
    const handleSettingChange = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => { handleSettingChange('backgroundImage', loadEvent.target.result); };
            reader.readAsDataURL(file);
        }
    };
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{ marginTop: 0 }}>常规设置</h2>
                
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>学习顺序</label>
                    <div style={styles.settingControl}>
                        <button onClick={() => handleSettingChange('order', 'sequential')} style={{ ...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown /> 顺序</button>
                        <button onClick={() => handleSettingChange('order', 'random')} style={{ ...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom /> 随机</button>
                    </div>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>语音来源 (TTS Source)</label>
                    <div style={styles.settingControl}>
                        <button onClick={() => handleSettingChange('ttsSource', 'server')} style={{ ...styles.settingButton, background: settings.ttsSource === 'server' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.ttsSource === 'server' ? 'white' : '#4a5568' }}>云端高音质</button>
                        <button onClick={() => handleSettingChange('ttsSource', 'browser')} style={{ ...styles.settingButton, background: settings.ttsSource === 'browser' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.ttsSource === 'browser' ? 'white' : '#4a5568' }}>浏览器本地</button>
                    </div>
                    <div style={{fontSize: '0.8rem', color: '#666', marginTop: 4}}>* 云端音质更好但需要网络；浏览器本地无网可用，音质取决于系统。</div>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>自动播放</label>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> 自动朗读例句</label></div>
                    <div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay / 1000}秒后自动切换</label></div>
                </div>

                <h2 style={{ marginTop: '30px' }}>外观设置</h2>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>自定义背景</label>
                    <div style={styles.settingControl}>
                        <input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} />
                        <button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>上传图片</button>
                        <button style={{ ...styles.settingButton, flex: '0 1 auto' }} onClick={() => handleSettingChange('backgroundImage', '')}>恢复默认</button>
                    </div>
                </div>

                <h2 style={{ marginTop: '30px' }}>发音设置</h2>
                {settings.ttsSource === 'browser' && <div style={{color: '#d97706', marginBottom: 10, fontSize: '0.9rem'}}>注意：浏览器模式下，发音人选择可能无效，将使用系统默认语音。</div>}
                
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>中文发音人 (仅云端)</label>
                    <select style={styles.settingSelect} disabled={settings.ttsSource === 'browser'} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label>
                    <div style={styles.settingControl}><span style={{ marginRight: '10px' }}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{ marginLeft: '10px' }}>+100</span></div>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>缅甸语发音人 (仅云端)</label>
                    <select style={styles.settingSelect} disabled={settings.ttsSource === 'browser'} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label>
                    <div style={styles.settingControl}><span style={{ marginRight: '10px' }}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{ marginLeft: '10px' }}>+100</span></div>
                </div>
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
// ===== 主组件: WordCard ==========================================================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
    const [isMounted, setIsMounted] = useState(false);
    
    // 清理音频与内存
    useEffect(() => {
        setIsMounted(true);
        return () => {
            if (_howlInstance) _howlInstance.stop();
            if (_currentAudioUrl) URL.revokeObjectURL(_currentAudioUrl);
            window.speechSynthesis.cancel();
        };
    }, []);

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
    
    // 初始化索引：读取 localStorage
    const [currentIndex, setCurrentIndex] = useState(() => {
        const savedIndex = localStorage.getItem(`word_progress_${progressKey}`);
        const parsed = parseInt(savedIndex, 10);
        return (!isNaN(parsed) && parsed < words.length) ? parsed : 0;
    });

    useEffect(() => {
        if (activeCards.length > 0) {
            localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
        }
    }, [currentIndex, progressKey, activeCards]);

    useEffect(() => {
        const initialCards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "暂无单词", burmese: "..." }];
        setActiveCards(initialCards);
        if (currentIndex >= initialCards.length) {
            setCurrentIndex(0);
        }
    }, [processedCards]); 

    // 智能预加载 Effect (仅当 source 为 server 时有效)
    useEffect(() => {
        if (!activeCards.length || settings.ttsSource !== 'server') return;
        const preloadCount = 3;
        for (let i = 1; i <= preloadCount; i++) {
            const nextIdx = (currentIndex + i) % activeCards.length;
            const nextCard = activeCards[nextIdx];
            if (nextCard && nextCard.chinese) {
                // onlyCache = true
                playTTS(nextCard.chinese, settings.voiceChinese, settings.speechRateChinese, 'server', null, null, true);
                if (nextCard.burmese) {
                    playTTS(nextCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, 'server', null, null, true);
                }
                if (nextCard.example) {
                    playTTS(nextCard.example, settings.voiceChinese, settings.speechRateChinese, 'server', null, null, true);
                }
            }
        }
    }, [currentIndex, activeCards, settings]);

    const [isRevealed, setIsRevealed] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRecordingOpen, setIsRecordingOpen] = useState(false); // 控制录音对比弹窗
    const [writerChar, setWriterChar] = useState(null);
    const [isFavoriteCard, setIsFavoriteCard] = useState(false);
    const [isJumping, setIsJumping] = useState(false);

    const wordCounterRef = useRef(0);
    const [showInterstitial, setShowInterstitial] = useState(false);

    const autoBrowseTimerRef = useRef(null);
    const lastDirection = useRef(0);
    const currentCard = activeCards.length > 0 ? activeCards[currentIndex] : null;

    useEffect(() => {
        if (currentCard?.id && currentCard.id !== 'fallback') {
            isFavorite(currentCard.id).then(setIsFavoriteCard);
        }
        setIsRevealed(false);
    }, [currentCard]);

    const handleToggleFavorite = async (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!currentCard || currentCard.id === 'fallback') return;
        const newState = !isFavoriteCard;
        setIsFavoriteCard(newState);
        const result = await toggleFavorite(currentCard);
        if (result !== newState) setIsFavoriteCard(result);
    };

    const navigate = useCallback((direction) => {
        if (activeCards.length === 0) return;
        lastDirection.current = direction;

        wordCounterRef.current += 1;
        if (wordCounterRef.current >= 20) {
            setShowInterstitial(true);
            wordCounterRef.current = 0;
        }

        setCurrentIndex(prev => (prev + direction + activeCards.length) % activeCards.length);
    }, [activeCards.length]);

    const handleJumpToCard = (index) => { if (index >= 0 && index < activeCards.length) { lastDirection.current = index > currentIndex ? 1 : -1; setCurrentIndex(index); } setIsJumping(false); };

    // 自动播放与自动浏览逻辑
    useEffect(() => {
        if (!isOpen || !currentCard) return;
        clearTimeout(autoBrowseTimerRef.current);

        // 清理音频
        if (_howlInstance?.playing()) _howlInstance.stop();
        window.speechSynthesis.cancel();

        const playFullSequence = () => {
            if (settings.autoPlayChinese && currentCard.chinese) {
                playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, () => {
                    if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
                        playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, settings.ttsSource, () => {
                            if (settings.autoPlayExample && currentCard.example && isRevealed) {
                                playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, startAutoBrowseTimer);
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

        const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };

        const initialPlayTimer = setTimeout(playFullSequence, 600);

        return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
    }, [currentIndex, currentCard, settings, isOpen, navigate, isRevealed]);

    // 手动点击播放
    const handleSidePlay = useCallback((e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!currentCard) return;
        if (_howlInstance?.playing()) _howlInstance.stop();
        window.speechSynthesis.cancel();

        if (!isRevealed) {
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource);
        } else {
            playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, settings.ttsSource, () => {
                if (currentCard.example) {
                    playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource);
                }
            });
        }
    }, [currentCard, isRevealed, settings]);

    const handleOpenRecorder = useCallback((e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        // 停止当前播放
        if (_howlInstance?.playing()) _howlInstance.stop();
        window.speechSynthesis.cancel();
        setIsRecordingOpen(true);
    }, []);

    const handleKnow = () => {
        if (_howlInstance?.playing()) _howlInstance.stop();
        window.speechSynthesis.cancel();
        if (!currentCard) return;
        navigate(1);
    };

    const handleDontKnow = () => {
        if (_howlInstance?.playing()) _howlInstance.stop();
        window.speechSynthesis.cancel();
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
        onStart: () => { if (currentCard) playSoundEffect('switch'); },
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
                <InterstitialAd isOpen={showInterstitial} onClose={() => { setShowInterstitial(false); }} />
                <div style={styles.adContainer} data-no-gesture="true"><AdSlot /></div>

                <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(prev => !prev)} />

                {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
                {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}

                {isRecordingOpen && currentCard && (
                    <RecordingComparisonModal word={currentCard} settings={settings} onClose={() => setIsRecordingOpen(false)} />
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
                                        <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, null, e)}>
                                            <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                                        </div>
                                        {isRevealed && (
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
                                    </div>
                                </div>
                            </animated.div>
                        );
                    })
                ) : (
                    <div style={styles.completionContainer}><h2>🎉 全部完成！</h2><p>你已学完本列表中的所有单词。</p><button style={{ ...styles.knowButton, ...styles.knowButtonBase }} onClick={onClose}>关闭</button></div>
                )}

                {currentCard && (
                    <div style={styles.rightControls} data-no-gesture="true">
                        <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置" data-no-gesture="true">
                            <FaCog size={18} style={{ pointerEvents: 'none' }} />
                        </button>

                        <button style={styles.rightIconButton} onClick={handleSidePlay} title="播放" data-no-gesture="true">
                            <FaVolumeUp size={18} color="#4a5568" style={{ pointerEvents: 'none' }} />
                        </button>

                        <button style={styles.rightIconButton} onClick={handleOpenRecorder} title="发音对比" data-no-gesture="true">
                             <FaMicrophone size={18} color={'#4a5568'} style={{ pointerEvents: 'none' }} />
                        </button>

                        {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && (
                            <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺" data-no-gesture="true">
                                <FaPenFancy size={18} style={{ pointerEvents: 'none' }} />
                            </button>
                        )}

                        <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"} data-no-gesture="true">
                            {isFavoriteCard ? <FaHeart size={18} color="#f87171" style={{ pointerEvents: 'none' }} /> : <FaRegHeart size={18} style={{ pointerEvents: 'none' }} />}
                        </button>
                    </div>
                )}

                <div style={styles.bottomControlsContainer} data-no-gesture="true">
                    {activeCards.length > 0 && (<div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>)}
                    <div style={styles.knowButtonsWrapper}>
                        <button style={{ ...styles.knowButtonBase, ...styles.dontKnowButton }} onClick={handleDontKnow}>不认识</button>
                        <button style={{ ...styles.knowButtonBase, ...styles.knowButton }} onClick={handleKnow}>认识</button>
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
    adContainer: { position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(5px)', textAlign: 'center', padding: '5px 0', minHeight: '50px' },
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#30505E' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '80px 20px 150px 20px' },
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
    // 录音对比弹窗样式
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '10px' },
    comparisonPanel: { width: '100%', maxWidth: '350px', background: 'white', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' },
    recordHeader: { padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' },
    closeButtonSimple: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.2rem' },
    recordContent: { padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
    recordWordDisplay: { textAlign: 'center' },
    recordControls: { width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', padding: '10px 15px', borderRadius: '12px' },
    label: { fontWeight: 'bold', color: '#4b5563', fontSize: '0.9rem' },
    circleBtnBlue: { width: '45px', height: '45px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(59, 130, 246, 0.3)' },
    circleBtnRed: { width: '45px', height: '45px', borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(239, 68, 68, 0.3)' },
    circleBtnGreen: { width: '45px', height: '45px', borderRadius: '50%', background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(16, 185, 129, 0.3)' },
    circleBtnGray: { width: '35px', height: '35px', borderRadius: '50%', background: '#e5e7eb', color: '#6b7280', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    recordingPulse: { animation: 'pulse 1.5s infinite', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)' },
    recordDoneBtn: { width: '100%', padding: '15px', background: '#111827', color: 'white', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    // 设置弹窗样式
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)', padding: '15px' },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto', position: 'relative' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#aaa', lineHeight: 1 },
    settingGroup: { marginBottom: '20px' },
    settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
    settingControl: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
    settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: '100px' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
    // 跳转弹窗
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002 },
    jumpModalContent: { background: 'white', padding: '25px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    jumpModalTitle: { marginTop: 0, marginBottom: '15px', color: '#333' },
    jumpModalInput: { width: '100px', padding: '10px', fontSize: '1.2rem', textAlign: 'center', border: '2px solid #ccc', borderRadius: '8px', marginBottom: '15px' },
    jumpModalButton: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#4299e1', color: 'white', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};

// 添加全局 keyframes (通过 style 标签插入)
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes pulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { transform: scale(1.0); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
`;
document.head.appendChild(styleSheet);

export default WordCard;
