// components/WordCard.js (最终完整版 - 集成IndexedDB缓存、预加载、进度记忆)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import { AdSlot } from '@/components/GoogleAdsense';
import InterstitialAd from './InterstitialAd';

// --- 数据库配置 (升级版本以支持音频缓存) ---
const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 2; // 升级版本号
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
            // 收藏表
            if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
                db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
            }
            // 音频缓存表
            if (!db.objectStoreNames.contains(STORE_AUDIO)) {
                db.createObjectStore(STORE_AUDIO); // key 为生成的唯一指纹
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

// --- 音频缓存与播放逻辑 ---
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
    correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
    incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};

let _howlInstance = null;
let _currentAudioUrl = null; // 用于跟踪当前的 Blob URL 以便释放

// 核心播放函数（带缓存与预载逻辑）
const playTTS = async (text, voice, rate, onEndCallback, e, onlyCache = false) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) {
        if (onEndCallback && !onlyCache) onEndCallback();
        return;
    }

    const cacheKey = generateAudioKey(text, voice, Math.round(rate / 2));

    // 如果只是为了预加载（onlyCache = true）
    if (onlyCache) {
        const existing = await getCachedAudio(cacheKey);
        if (existing) return; // 已存在，跳过
        // 不存在则继续下载逻辑，但在最后不播放
    } else {
        // 正常播放模式：停止当前音频
        if (_howlInstance?.playing()) _howlInstance.stop();
        // 释放上一个音频的内存
        if (_currentAudioUrl) {
            URL.revokeObjectURL(_currentAudioUrl);
            _currentAudioUrl = null;
        }
    }

    // 1. 尝试从 IndexedDB 读取
    let audioBlob = await getCachedAudio(cacheKey);

    // 2. 如果缓存没命中，则网络请求
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
                // 备用接口逻辑
                let lang = 'en';
                if (voice.includes('zh')) lang = 'zh-CN';
                else if (voice.includes('my')) lang = 'my';
                const backupUrl = `/api/google-tts?text=${encodeURIComponent(text)}&lang=${lang}`;
                response = await fetch(backupUrl);
                if (!response.ok) throw new Error('TTS Failed');
            }

            audioBlob = await response.blob();
            // 写入 IndexedDB
            await cacheAudioData(cacheKey, audioBlob);

        } catch (error) {
            console.error('TTS Playback/Cache Error:', error);
            if (onEndCallback && !onlyCache) onEndCallback();
            return;
        }
    }

    // 3. 如果是预加载模式，到此结束
    if (onlyCache) return;

    // 4. 创建 URL 并播放
    const audioUrl = URL.createObjectURL(audioBlob);
    _currentAudioUrl = audioUrl; // 记录以便稍后释放

    _howlInstance = new Howl({
        src: [audioUrl],
        format: ['mpeg', 'mp3', 'webm'],
        html5: true,
        onend: () => {
            // 播放结束不立即释放URL，防止循环播放时的问题，但在下一次播放前会释放
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
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (sounds[type]) sounds[type].play();
};

const parsePinyin = (pinyinNum) => {
    if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' };
    const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, '');
    let pinyinPlain = rawPinyin.replace(/[1-5]$/, '');
    const toneMatch = rawPinyin.match(/[1-5]$/);
    const tone = toneMatch ? toneMatch[0] : '0';
    const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' });
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

// 设置 Hook
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
                speechRateChinese: 0,
                speechRateBurmese: 0,
                backgroundImage: '',
            };
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
        } catch (error) {
            console.error("加载设置失败", error);
            return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, backgroundImage: '' };
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

const PinyinVisualizer = React.memo(({ analysis, isCorrect }) => {
    const { parts, errors } = analysis;
    const initialStyle = !isCorrect && parts.initial && errors.initial ? styles.wrongPart : {};
    const finalStyle = !isCorrect && parts.final && errors.final ? styles.wrongPart : {};
    const toneStyle = !isCorrect && parts.tone !== '0' && errors.tone ? styles.wrongPart : {};
    let finalDisplay = parts.pinyinMark.replace(parts.initial, '').replace(' ', '');
    if (!finalDisplay || parts.pinyinMark === parts.rawPinyin) { finalDisplay = parts.final; }
    finalDisplay = finalDisplay.replace(/[1-5]$/, '');
    return (
        <div style={styles.pinyinVisualizerContainer}><span style={{ ...styles.pinyinPart, ...initialStyle }}>{parts.initial || ''}</span><span style={{ ...styles.pinyinPart, ...finalStyle }}>{finalDisplay}</span><span style={{ ...styles.pinyinPart, ...styles.toneNumber, ...toneStyle }}>{parts.tone}</span></div>
    );
});

// 录音对比组件
const PronunciationComparison = ({ correctWord, userText, settings, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        if (!userText) { return { isCorrect: false, error: 'NO_PINYIN', message: '未能识别有效发音' }; }
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });
        if (correctPinyin.length === 0 || userPinyin.length === 0) return { isCorrect: false, error: 'NO_PINYIN', message: '未能识别有效发音' };
        if (correctPinyin.length !== userPinyin.length) return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
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
    const [isRecording, setIsRecording] = useState(false); const [userRecordingUrl, setUserRecordingUrl] = useState(null); const mediaRecorderRef = useRef(null); const streamRef = useRef(null);
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
        } catch (err) { console.error("录音初始化失败:", err); alert("请检查麦克风权限。"); }
    }, [isRecording]);
    const playUserAudio = useCallback(() => { if (userRecordingUrl) { if (_howlInstance?.playing()) _howlInstance.stop(); const sound = new Howl({ src: [userRecordingUrl], html5: true }); sound.play(); } }, [userRecordingUrl]);
    const playCorrectTTS = useCallback(() => { playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese); }, [correctWord, settings]);
    useEffect(() => { return () => { if (userRecordingUrl) { URL.revokeObjectURL(userRecordingUrl); } }; }, [userRecordingUrl]);
    if (!analysis) return null;
    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{ ...styles.resultHeader, background: analysis.isCorrect ? '#10b981' : '#ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'white' }}>
                        <div style={{ fontSize: '1.8rem' }}>{analysis.isCorrect ? '🎉' : '💡'}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>{analysis.isCorrect ? '完美' : `${analysis.accuracy}%`}</div>
                    </div>
                </div>
                <div style={styles.errorDetailsContainer}>
                    {analysis.error ? (<div style={styles.lengthError}>{analysis.message}</div>) : (<div style={styles.comparisonGrid}>{analysis.results.map((result, index) => (<div key={index} style={styles.comparisonCell}><div style={styles.comparisonChar}>{result.char}</div><div style={styles.comparisonGroupWrapper}><div style={styles.comparisonRow}><span style={styles.tinyLabel}>标准</span><PinyinVisualizer analysis={result.correct} isCorrect={true} /></div><div style={styles.comparisonRow}><span style={styles.tinyLabel}>你的</span><PinyinVisualizer analysis={result.user} isCorrect={result.pinyinMatch} /></div></div></div>))}</div>)}
                </div>
                <div style={styles.audioComparisonSection}>
                    <button style={styles.compactAudioBtn} onClick={playCorrectTTS} title="播放标准音"><FaPlayCircle size={16} color="#4299e1" /> 标准</button>
                    <button style={{ ...styles.compactAudioBtn, ...(isRecording ? { color: '#ef4444', background: '#fef2f2' } : {}) }} onClick={handleRecord} title="录音">{isRecording ? <FaStop size={16} /> : <FaMicrophone size={16} />} {isRecording ? '停止' : '重录'}</button>
                    {userRecordingUrl && (<button style={styles.compactAudioBtn} onClick={playUserAudio} title="回放录音"><FaPlayCircle size={16} color="#8b5cf6" /> 回放</button>)}
                </div>
                <div style={styles.comparisonActions}>
                    {analysis.isCorrect ? (<button style={{ ...styles.compactActionBtn, ...styles.continueButton }} onClick={onContinue}>下一题 <FaArrowRight size={14} /></button>) : (<button style={{ ...styles.compactActionBtn, ...styles.retryButton }} onClick={onClose}>再试一次</button>)}
                </div>
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
    return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{ marginTop: 0 }}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{ ...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown /> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{ ...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom /> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> 自动朗读例句</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay / 1000}秒后自动切换</label></div></div><h2 style={{ marginTop: '30px' }}>外观设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>自定义背景</label><div style={styles.settingControl}><input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} /><button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>上传图片</button><button style={{ ...styles.settingButton, flex: '0 1 auto' }} onClick={() => handleSettingChange('backgroundImage', '')}>恢复默认</button></div></div><h2 style={{ marginTop: '30px' }}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{ marginRight: '10px' }}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{ marginLeft: '10px' }}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{ marginRight: '10px' }}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{ marginLeft: '10px' }}>+100</span></div></div></div></div>);
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
    
    // 初始化索引：优先读取 localStorage 中的进度
    const [currentIndex, setCurrentIndex] = useState(() => {
        const savedIndex = localStorage.getItem(`word_progress_${progressKey}`);
        const parsed = parseInt(savedIndex, 10);
        return (!isNaN(parsed) && parsed < words.length) ? parsed : 0;
    });

    // 进度保存 Effect
    useEffect(() => {
        if (activeCards.length > 0) {
            localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
        }
    }, [currentIndex, progressKey, activeCards]);

    useEffect(() => {
        const initialCards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "暂无单词", burmese: "..." }];
        setActiveCards(initialCards);
        // 如果处理后的列表变短了，修正索引
        if (currentIndex >= initialCards.length) {
            setCurrentIndex(0);
        }
    }, [processedCards]); // 注意：processedCards变化时(如切顺序)，可能需要重置或保持索引

    // 智能预加载 Effect：监听 currentIndex，自动缓存后 3 个单词的音频
    useEffect(() => {
        if (!activeCards.length) return;
        const preloadCount = 3;
        for (let i = 1; i <= preloadCount; i++) {
            const nextIdx = (currentIndex + i) % activeCards.length;
            const nextCard = activeCards[nextIdx];
            if (nextCard && nextCard.chinese) {
                // 仅缓存，不播放 (onlyCache = true)
                playTTS(nextCard.chinese, settings.voiceChinese, settings.speechRateChinese, null, null, true);
                if (nextCard.burmese) {
                    playTTS(nextCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, null, true);
                }
                if (nextCard.example) {
                    playTTS(nextCard.example, settings.voiceChinese, settings.speechRateChinese, null, null, true);
                }
            }
        }
    }, [currentIndex, activeCards, settings]);

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

    useEffect(() => {
        if (!isOpen || !currentCard) return;
        clearTimeout(autoBrowseTimerRef.current);

        // 如果不自动播放，也要清理当前的音频
        if (!settings.autoPlayChinese) {
             if (_howlInstance?.playing()) _howlInstance.stop();
        }

        const playFullSequence = () => {
            if (settings.autoPlayChinese && currentCard.chinese) {
                playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => {
                    if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
                        playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
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

        const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };

        const initialPlayTimer = setTimeout(playFullSequence, 600);

        return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
    }, [currentIndex, currentCard, settings, isOpen, navigate, isRevealed]);

    const handleSidePlay = useCallback((e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!currentCard) return;
        if (_howlInstance?.playing()) _howlInstance.stop();

        if (!isRevealed) {
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese);
        } else {
            playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
                if (currentCard.example) {
                    playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese);
                }
            });
        }
    }, [currentCard, isRevealed, settings]);

    const handleListen = useCallback((e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (_howlInstance?.playing()) _howlInstance.stop();
        if (isListening) { recognitionRef.current?.stop(); return; }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert("抱歉，您的浏览器不支持语音识别。"); return; }
        const recognition = new SpeechRecognition();
        recognition.lang = "zh-CN";
        recognition.interimResults = false;
        recognition.onstart = () => { setIsListening(true); setRecognizedText(""); };
        recognition.onresult = (event) => { const result = event.results[event.results.length - 1][0].transcript; setRecognizedText(result.trim().replace(/[.,。，]/g, '')); };
        recognition.onerror = (event) => { console.error("语音识别出错:", event.error); if (event.error !== 'aborted' && event.error !== 'no-speech') { alert(`语音识别错误: ${event.error}`); } };
        recognition.onend = () => { setIsListening(false); recognitionRef.current = null; setIsComparisonOpen(true); };
        recognitionRef.current = recognition;
        recognition.start();
    }, [isListening]);

    const handleCloseComparison = useCallback(() => { setIsComparisonOpen(false); setRecognizedText(''); }, []);
    const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);

    useEffect(() => { return () => { if (recognitionRef.current) { recognitionRef.current.stop(); } }; }, []);

    const handleKnow = () => {
        if (_howlInstance?.playing()) _howlInstance.stop();
        if (!currentCard) return;
        navigate(1);
        // 这里可以添加将单词移出 activeCards 的逻辑，但为了保持顺序浏览通常只移动索引
    };

    const handleDontKnow = () => {
        if (_howlInstance?.playing()) _howlInstance.stop();
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
                                            <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                                        </div>
                                        {isRevealed && (
                                            <animated.div style={styles.revealedContent}>
                                                <div style={{ cursor: 'pointer', marginTop: '1.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}><div style={styles.textWordBurmese}>{cardData.burmese}</div></div>
                                                {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}
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

                        <button style={styles.rightIconButton} onClick={handleListen} title="发音练习" data-no-gesture="true">
                            {isListening ? <FaStop size={18} color={'#dc2626'} style={{ pointerEvents: 'none' }} /> : <FaMicrophone size={18} color={'#4a5568'} style={{ pointerEvents: 'none' }} />}
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
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '10px' },
    comparisonPanel: { width: '100%', maxWidth: '400px', maxHeight: '80vh', background: 'white', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' },
    resultHeader: { padding: '15px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    errorDetailsContainer: { padding: '10px', overflowY: 'auto', flex: 1, background: '#f9fafb' },
    lengthError: { textAlign: 'center', color: '#ef4444', padding: '15px', background: '#fee2e2', borderRadius: '10px', fontSize: '0.9rem' },
    comparisonGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' },
    comparisonCell: { padding: '8px', borderRadius: '10px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    comparisonChar: { fontSize: '1.6rem', fontWeight: 'bold', color: '#111827' },
    comparisonGroupWrapper: { width: '100%', display: 'flex', flexDirection: 'column', gap: '2px' },
    comparisonRow: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    tinyLabel: { fontSize: '0.6rem', color: '#9ca3af', transform: 'scale(0.9)' },
    pinyinVisualizerContainer: { display: 'flex', alignItems: 'baseline', fontSize: '1rem', height: '1.2rem', color: '#374151' },
    pinyinPart: { fontWeight: 600 },
    toneNumber: { fontSize: '0.7rem', fontWeight: 'bold', marginLeft: '1px', color: '#9ca3af', verticalAlign: 'super' },
    wrongPart: { color: '#ef4444' },
    audioComparisonSection: { display: 'flex', gap: '8px', justifyContent: 'center', padding: '10px', borderTop: '1px solid #f3f4f6', background: 'white' },
    compactAudioBtn: { display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '20px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#4b5563', fontWeight: 600 },
    comparisonActions: { padding: '10px', background: 'white' },
    compactActionBtn: { width: '100%', padding: '12px', borderRadius: '12px', border: 'none', fontSize: '1rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    continueButton: { background: '#10b981' },
    retryButton: { background: '#f59e0b' },
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
