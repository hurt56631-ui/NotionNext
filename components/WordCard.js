// components/WordCard.js (混合降级 + 预加载10个 + 播放按钮 + 双备用接口 + 可视化日志调试版)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl, Howler } from 'howler'; // 仅用于音效
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaArrowRight, 
    FaHeart, FaRegHeart, FaPlay, FaStop, FaRedo, FaTrashAlt, 
    FaSortAmountDown, FaRandom, FaVolumeUp, FaBug
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import { AdSlot } from '@/components/GoogleAdsense';
import InterstitialAd from './InterstitialAd'; 

// =================================================================================
// ===== 0. 日志调试系统 (新增) =====
// =================================================================================
const DEBUG_LOGS = [];
const MAX_LOGS = 50;

function addLog(type, msg) {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] [${type}] ${msg}`;
    console.log(logEntry); // 同时也输出到控制台
    DEBUG_LOGS.unshift(logEntry); // 新日志在最前
    if (DEBUG_LOGS.length > MAX_LOGS) DEBUG_LOGS.pop();
}

// 日志弹窗组件
const LogConsole = ({ onClose }) => {
    const [logs, setLogs] = useState(DEBUG_LOGS);
    // 实时更新日志
    useEffect(() => {
        const interval = setInterval(() => setLogs([...DEBUG_LOGS]), 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{position:'fixed', inset:0, zIndex:20000, background:'rgba(0,0,0,0.85)', color:'#0f0', fontFamily:'monospace', padding:'20px', display:'flex', flexDirection:'column'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', borderBottom:'1px solid #333', paddingBottom:'10px'}}>
                <h3 style={{margin:0}}>🛠️ 调试日志</h3>
                <button onClick={onClose} style={{background:'#ef4444', color:'white', border:'none', padding:'5px 15px', borderRadius:'4px'}}>关闭</button>
            </div>
            <div style={{flex:1, overflowY:'auto', fontSize:'12px', lineHeight:'1.5'}}>
                {logs.length === 0 ? <div>暂无日志...</div> : logs.map((log, i) => (
                    <div key={i} style={{marginBottom:'5px', borderBottom:'1px dashed #333'}}>{log}</div>
                ))}
            </div>
            <div style={{marginTop:'10px', display:'flex', gap:'10px'}}>
                <button onClick={() => { DEBUG_LOGS.length = 0; setLogs([]); }} style={{padding:'8px', flex:1, background:'#444', color:'white', border:'none'}}>清空日志</button>
                <button onClick={() => navigator.clipboard.writeText(DEBUG_LOGS.join('\n')).then(()=>alert('已复制'))} style={{padding:'8px', flex:1, background:'#2563eb', color:'white', border:'none'}}>复制日志</button>
            </div>
        </div>
    );
};

// =================================================================================
// ===== 1. 数据库与缓存逻辑 =====
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';
const STORE_TTS_CACHE = 'ttsAudioCache'; 

function openDB() { 
    return new Promise((resolve, reject) => { 
        if (typeof window === 'undefined') return resolve(null);
        const request = indexedDB.open(DB_NAME, 3); 
        request.onerror = () => { addLog('DB', '数据库打开失败'); reject('数据库打开失败'); }; 
        request.onsuccess = () => resolve(request.result); 
        request.onupgradeneeded = (e) => { 
            const db = e.target.result; 
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' }); 
            if (db.objectStoreNames.contains(STORE_TTS_CACHE)) db.deleteObjectStore(STORE_TTS_CACHE);
            db.createObjectStore(STORE_TTS_CACHE); 
        }; 
    }); 
}
async function toggleFavorite(word) { 
    const db = await openDB(); const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME); 
    const existing = await new Promise(r => { const req = store.get(word.id); req.onsuccess = () => r(req.result); req.onerror = () => r(null); }); 
    if (existing) { store.delete(word.id); return false; } 
    else { store.put({ id: word.id, chinese: word.chinese, burmese: word.burmese, mnemonic: word.mnemonic, example: word.example }); return true; } 
}
async function isFavorite(id) { const db = await openDB(); const tx = db.transaction(STORE_NAME, 'readonly'); const store = tx.objectStore(STORE_NAME); return new Promise(r => { const req = store.get(id); req.onsuccess = () => r(!!req.result); req.onerror = () => r(false); }); }
async function clearAudioCache() { 
    const db = await openDB(); if (!db) return; 
    const tx = db.transaction(STORE_TTS_CACHE, 'readwrite'); 
    tx.objectStore(STORE_TTS_CACHE).clear(); 
    addLog('CACHE', '用户手动清理缓存');
    alert("音频缓存已清理"); 
}
const getTTSFromCache = async (key) => { 
    const db = await openDB(); if (!db) return null; 
    return new Promise(r => { 
        const tx = db.transaction(STORE_TTS_CACHE, 'readonly'); 
        const req = tx.objectStore(STORE_TTS_CACHE).get(key); 
        req.onsuccess = () => r(req.result); 
        req.onerror = () => r(null); 
    }); 
};
const saveTTSToCache = async (key, blob) => { 
    const db = await openDB(); if (!db) return; 
    const tx = db.transaction(STORE_TTS_CACHE, 'readwrite'); 
    tx.objectStore(STORE_TTS_CACHE).put(blob, key); 
    addLog('CACHE', `已缓存音频: ${key.substring(0, 10)}...`);
};

// =================================================================================
// ===== 2. 音频播放系统 (带日志追踪) =====
// =================================================================================
const TTS_VOICES = [ { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' }, { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' }, ];
const sounds = { 
    switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.3, html5: false }), 
    correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8, html5: false }), 
    incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8, html5: false }), 
};

let _currentAudio = null; 
let _currentAudioUrl = null;
const PRELOAD_COUNT = 10; 

const TTS_SOURCES = [
    { url: 'https://libretts.is-an.org/api/tts', type: 'edge', name: 'Main' },
    { url: 'https://otts.api.zwei.de.eu.org/v1/tts', type: 'edge', key: 'sk-Zwei', name: 'Backup(Zwei)' },
    { type: 'google', name: 'Google' }
];

// --- 核心：下载并返回 Blob ---
const fetchAudioBlob = async (text, voice, rate) => {
    const cacheKey = `${text}_${voice}_${rate}`;
    
    // 1. 查缓存
    let blob = await getTTSFromCache(cacheKey);
    if (blob) {
        // 这是一个静默操作，预加载时不需要频繁弹日志，除非出错
        return blob;
    }

    // 2. 轮询下载
    const tryFetch = async (source) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); 

            let response;
            addLog('NET', `尝试请求: ${source.name}, 文本: ${text.substring(0,5)}`);

            if (source.type === 'edge') {
                const headers = { 'Content-Type': 'application/json' };
                if (source.key) headers['Authorization'] = `Bearer ${source.key}`;

                response = await fetch(source.url, { 
                    method: 'POST', 
                    headers: headers,
                    body: JSON.stringify({ text, voice, rate: Math.round(rate / 2), pitch: 0 }),
                    signal: controller.signal
                });
            } else if (source.type === 'google') {
                let lang = 'en';
                if (voice.startsWith('zh')) lang = 'zh-CN';
                if (lang === 'zh-CN') {
                    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
                    response = await fetch(googleUrl, { signal: controller.signal });
                } else {
                    return null; 
                }
            }

            clearTimeout(timeoutId);
            
            if (!response || !response.ok) {
                addLog('NET', `请求失败 ${source.name}: Status ${response?.status}`);
                return null;
            }
            
            const data = await response.blob();
            if (data.size < 1000) {
                addLog('NET', `文件过小 ${source.name}: ${data.size} bytes`);
                return null; 
            }
            
            addLog('NET', `下载成功 ${source.name}: ${Math.round(data.size/1024)}KB`);
            return data;
        } catch (e) { 
            addLog('NET', `异常 ${source.name}: ${e.message}`);
            return null; 
        }
    };

    for (const source of TTS_SOURCES) {
        const result = await tryFetch(source);
        if (result) {
            saveTTSToCache(cacheKey, result); 
            return result;
        }
    }
    addLog('ERR', `所有接口都失败了: ${text}`);
    return null;
};

// --- 核心：播放逻辑 ---
const playTTS = (text, voice, rate, e) => {
    if (e && e.stopPropagation) e.stopPropagation();

    return new Promise(async (resolve) => {
        if (!text || !voice) return resolve();

        addLog('PLAY', `准备播放: ${text.substring(0, 8)}...`);

        if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }
        if (_currentAudioUrl) { URL.revokeObjectURL(_currentAudioUrl); _currentAudioUrl = null; }

        try {
            const blob = await fetchAudioBlob(text, voice, rate);

            if (!blob) {
                addLog('PLAY', '播放失败: 无法获取音频数据');
                resolve(); 
                return;
            }

            const audioUrl = URL.createObjectURL(blob);
            _currentAudioUrl = audioUrl;
            const audio = new Audio(audioUrl);
            _currentAudio = audio;
            
            audio.onended = () => {
                addLog('PLAY', '播放完成');
                resolve();
            };
            audio.onerror = (err) => { 
                addLog('PLAY', `播放器错误: ${err.code || '未知'}`);
                console.error(err); 
                resolve(); 
            };
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    addLog('PLAY', `浏览器拦截/播放失败: ${error.message}`);
                    resolve();
                });
            }
        } catch (err) {
            addLog('ERR', `播放流程异常: ${err.message}`);
            resolve();
        }
    });
};

// ... (parsePinyin 保持不变) ...
const parsePinyin = (pinyinNum) => { if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' }; const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, ''); let pinyinPlain = rawPinyin.replace(/[1-5]$/, ''); const toneMatch = rawPinyin.match(/[1-5]$/); const tone = toneMatch ? toneMatch[0] : '0'; const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' }); const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']; let initial = ''; let final = pinyinPlain; for (const init of initials) { if (pinyinPlain.startsWith(init)) { initial = init; final = pinyinPlain.slice(init.length); break; } } return { initial, final, tone, pinyinMark, rawPinyin }; };

// =================================================================================
// ===== 3. 语音对比弹窗组件 (保持不变) =====
// =================================================================================
const PronunciationModal = ({ correctWord, settings, onClose }) => {
    const [recordingState, setRecordingState] = useState('idle');
    const [userText, setUserText] = useState('');
    const [audioUrl, setAudioUrl] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const mediaRecorderRef = useRef(null);
    const recognitionRef = useRef(null);
    const chunksRef = useRef([]);
    const startRecording = async () => { setUserText(''); try { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { alert("您的浏览器不支持语音识别"); return; } const recognition = new SpeechRecognition(); recognition.lang = "zh-CN"; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onresult = (e) => { if (e.results.length > 0) setUserText(e.results[0][0].transcript.replace(/[.,。，]/g, '')); }; recognition.onerror = (e) => console.error("Recognition error:", e); recognitionRef.current = recognition; const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mediaRecorder = new MediaRecorder(stream); chunksRef.current = []; mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data); mediaRecorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); const url = URL.createObjectURL(blob); setAudioUrl(url); stream.getTracks().forEach(track => track.stop()); }; mediaRecorderRef.current = mediaRecorder; recognition.start(); mediaRecorder.start(); setRecordingState('recording'); setTimeout(() => { if (recognitionRef.current) stopRecording(); }, 5000); } catch (err) { console.error("录音启动失败", err); alert("无法访问麦克风"); } };
    const stopRecording = () => { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; } setRecordingState('analyzing'); };
    useEffect(() => { if (recordingState === 'analyzing') { const checkTimeout = setTimeout(() => { if (userText) analyzeResult(); else { alert("未检测到清晰语音，请再试一次"); setRecordingState('idle'); } }, 1000); return () => clearTimeout(checkTimeout); } }, [recordingState, userText]);
    const analyzeResult = () => { if (!userText) return; const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true }); const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true }); if (!correctPinyin || !userPinyin || userPinyin.length === 0) { setRecordingState('idle'); return; } let matchCount = 0; const details = correctPinyin.map((cpy, i) => { const upy = userPinyin[i] || ''; const cParts = parsePinyin(cpy); const uParts = parsePinyin(upy); const isMatch = cParts.rawPinyin === uParts.rawPinyin; if (isMatch) matchCount++; return { char: correctWord[i], pinyin: cParts.pinyinMark, isMatch, uPinyin: uParts.pinyinMark }; }); const score = Math.round((matchCount / Math.max(correctPinyin.length, userPinyin.length)) * 100); setAnalysis({ score, details }); setRecordingState('result'); if (score === 100) { if (sounds.correct) sounds.correct.play(); } else { if (sounds.incorrect) sounds.incorrect.play(); } };
    const reset = () => { setRecordingState('idle'); setUserText(''); setAnalysis(null); if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(null); };
    const playUserAudio = () => { if (audioUrl) { const sound = new Audio(audioUrl); sound.play(); } };
    return ( <div style={modalStyles.overlay}> <div style={modalStyles.card}> <button onClick={onClose} style={modalStyles.closeBtn}><FaTimes /></button> <h3 style={modalStyles.title}>发音评测</h3> {recordingState !== 'result' && <div style={modalStyles.bigWord}>{correctWord}</div>} {recordingState === 'recording' && (<div style={modalStyles.waveContainer}><div style={modalStyles.wave}></div><div style={modalStyles.wave}></div><div style={modalStyles.wave}></div><p style={{color: '#ef4444', fontWeight: 'bold'}}>正在录音...</p></div>)} {recordingState === 'analyzing' && (<div style={{margin: '20px 0', color: '#666'}}>正在分析...</div>)} {recordingState === 'result' && analysis && ( <div style={modalStyles.resultContainer}> <div style={modalStyles.scoreCircle(analysis.score)}><span style={{fontSize: '2.5rem', fontWeight: 'bold'}}>{analysis.score}</span><span style={{fontSize: '0.8rem'}}>分</span></div> <div style={modalStyles.detailRow}>{analysis.details.map((item, i) => (<div key={i} style={modalStyles.charBlock}><div style={{color: item.isMatch ? '#10b981' : '#ef4444', fontSize: '0.9rem'}}>{item.pinyin}</div><div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{item.char}</div></div>))}</div> <div style={modalStyles.audioControls}> <button style={modalStyles.playBtn} onClick={(e) => playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese, e)}><FaPlay size={12} /> 标准音</button> <button style={modalStyles.playBtn} onClick={playUserAudio}><FaPlay size={12} /> 我的录音</button> </div> </div> )} <div style={modalStyles.footer}> {recordingState === 'idle' && <button style={modalStyles.recordBtn} onClick={startRecording}><FaMicrophone size={24} /></button>} {recordingState === 'recording' && <button style={{...modalStyles.recordBtn, background: '#ef4444'}} onClick={stopRecording}><FaStop size={24} /></button>} {recordingState === 'result' && <button style={modalStyles.retryBtn} onClick={reset}><FaRedo /> 再试一次</button>} </div> </div> </div> );
};

// --- 4. 设置面板 (添加了查看日志按钮) ---
const SettingsPanel = React.memo(({ settings, setSettings, onClose, onOpenLogs }) => { 
    const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); }; 
    const handleImageUpload = (e) => { const file = e.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (ev) => handleSettingChange('backgroundImage', ev.target.result); reader.readAsDataURL(file); } }; 
    return ( 
        <div style={styles.settingsModal} onClick={onClose}> 
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}> 
                <button type="button" style={styles.closeButton} onClick={onClose}><FaTimes /></button> 
                <h2 style={{marginTop: 0}}>常规设置</h2> 
                <div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button type="button" onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button type="button" onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div> 
                <div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayExample} onChange={(e) => handleSettingChange('autoPlayExample', e.target.checked)} /> 自动朗读例句</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div> 
                <h2 style={{marginTop: '30px'}}>外观设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>自定义背景</label><div style={styles.settingControl}><input type="file" accept="image/*" id="bg-upload" style={{ display: 'none' }} onChange={handleImageUpload} /><button style={styles.settingButton} onClick={() => document.getElementById('bg-upload').click()}>上传图片</button><button style={{...styles.settingButton, flex: '0 1 auto'}} onClick={() => handleSettingChange('backgroundImage', '')}>恢复默认</button></div></div> 
                <h2 style={{marginTop: '30px'}}>数据管理</h2><div style={styles.settingGroup}><div style={styles.settingControl}><button type="button" style={{...styles.settingButton, color: '#ef4444', border: '1px solid #ef4444'}} onClick={clearAudioCache}><FaTrashAlt /> 清理音频缓存 (解决无声)</button></div></div>
                {/* 新增：调试按钮 */}
                <div style={styles.settingGroup}><div style={styles.settingControl}><button type="button" style={{...styles.settingButton, background:'#111', color:'#0f0'}} onClick={onOpenLogs}><FaBug /> 打开调试日志</button></div></div>
                <h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div> 
            </div> 
        </div> 
    ); 
});

// ... (JumpModal, useCardSettings 保持不变) ...
const JumpModal = ({ max, current, onJump, onClose }) => { const [inputValue, setInputValue] = useState(current + 1); const inputRef = useRef(null); useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []); const handleJump = () => { const num = parseInt(inputValue, 10); if (num >= 1 && num <= max) { onJump(num - 1); } else { alert(`请输入 1 到 ${max} 之间的数字`); } }; return ( <div style={styles.jumpModalOverlay} onClick={onClose}><div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}><h3 style={styles.jumpModalTitle}>跳转到卡片</h3><input ref={inputRef} type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} min="1" max={max} /><button style={styles.jumpModalButton} onClick={handleJump}>跳转</button></div></div> ); };
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
  const storageKey = useMemo(() => { if (progressKey !== 'default') return `progress_${progressKey}`; if (words && words.length > 0) return `prog_${words[0].id}_${words.length}`; return 'prog_default'; }, [progressKey, words]);
  const [currentIndex, setCurrentIndex] = useState(() => { if (typeof window !== 'undefined') { const saved = localStorage.getItem(storageKey); if (saved) { const idx = parseInt(saved, 10); if (!isNaN(idx) && idx >= 0 && idx < words.length) return idx; } } return 0; });
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const initialCards = processedCards.length > 0 ? processedCards : [];
    setActiveCards(initialCards);
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(storageKey);
        if (saved) { const idx = parseInt(saved, 10); if (!isNaN(idx) && idx >= 0 && idx < initialCards.length) setCurrentIndex(idx); else setCurrentIndex(0); } else setCurrentIndex(0);
    }
  }, [processedCards, storageKey]);

  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem(storageKey, currentIndex); }, [currentIndex, storageKey]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }
  }, []);

  // =========================================================================
  // ✅ 核心：批量预加载器 (预加载10个)
  // =========================================================================
  useEffect(() => {
      if (!activeCards || activeCards.length === 0) return;
      const runPreload = async () => {
          const indicesToLoad = [];
          for (let i = 1; i <= PRELOAD_COUNT; i++) { indicesToLoad.push((currentIndex + i) % activeCards.length); }
          for (const idx of indicesToLoad) {
              const card = activeCards[idx];
              if (!card) continue;
              if (card.chinese) await fetchAudioBlob(card.chinese, settings.voiceChinese, settings.speechRateChinese);
              if (card.burmese) await fetchAudioBlob(card.burmese, settings.voiceBurmese, settings.speechRateBurmese);
              if (card.example) await fetchAudioBlob(card.example, settings.voiceChinese, settings.speechRateChinese);
          }
      };
      const timer = setTimeout(runPreload, 1000);
      return () => clearTimeout(timer);
  }, [currentIndex, activeCards, settings]);


  const [isRevealed, setIsRevealed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false); // 控制日志弹窗
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
  
  const handleToggleFavorite = async () => { if (!currentCard) return; const newStatus = await toggleFavorite(currentCard); setIsFavoriteCard(newStatus); };
  const navigate = useCallback((direction) => { if (activeCards.length === 0) return; lastDirection.current = direction; if (isOnline && direction > 0) { wordCounterRef.current += 1; if (wordCounterRef.current >= 20) { setShowInterstitial(true); wordCounterRef.current = 0; } } setCurrentIndex(prev => (prev + direction + activeCards.length) % activeCards.length); }, [activeCards.length, isOnline]);
  const handleJumpToCard = (index) => { if (index >= 0 && index < activeCards.length) { lastDirection.current = index > currentIndex ? 1 : -1; setCurrentIndex(index); } setIsJumping(false); };

  // ... (自动播放 useEffect) ...
  useEffect(() => {
    if (!isOpen || !currentCard) return;
    if (processingRef.current) return;
    let isCancelled = false;
    clearTimeout(autoBrowseTimerRef.current);
    if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }
    const runAutoPlaySequence = async () => {
        await new Promise(r => setTimeout(r, 500)); 
        if (isCancelled) return;
        const thisCardId = currentCard.id;
        if (settings.autoPlayChinese && currentCard.chinese) {
            await playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese);
            if (isCancelled || currentCard.id !== thisCardId) return;
        }
        if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
            await new Promise(r => setTimeout(r, 200)); if (isCancelled) return;
            await playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese);
            if (isCancelled || currentCard.id !== thisCardId) return;
        }
        if (settings.autoPlayExample && currentCard.example && isRevealed) {
            await new Promise(r => setTimeout(r, 200)); if (isCancelled) return;
            await playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese);
            if (isCancelled || currentCard.id !== thisCardId) return;
        }
        if (settings.autoBrowse && !processingRef.current) {
            autoBrowseTimerRef.current = setTimeout(() => {
                if (!isCancelled && currentCard.id === thisCardId) { navigate(1); }
            }, settings.autoBrowseDelay);
        }
    };
    runAutoPlaySequence();
    return () => { isCancelled = true; clearTimeout(autoBrowseTimerRef.current); if (_currentAudio) { _currentAudio.pause(); } };
  }, [currentIndex, currentCard, settings, isOpen, navigate, isRevealed]);

  const handleKnow = () => { if (processingRef.current) return; if (_currentAudio) _currentAudio.pause(); if (!currentCard) return; processingRef.current = true; navigate(1); setTimeout(() => { const newActiveCards = activeCards.filter(card => card.id !== currentCard.id); setActiveCards(newActiveCards); if (currentIndex >= newActiveCards.length) setCurrentIndex(Math.max(0, newActiveCards.length - 1)); processingRef.current = false; }, 400); };
  const handleDontKnow = () => { if (processingRef.current) return; if (isRevealed) navigate(1); else setIsRevealed(true); };
  const pageTransitions = useTransition(isOpen, { from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 } });
  const cardTransitions = useTransition(currentIndex, { key: currentCard ? currentCard.id : 'empty_key', from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, config: { mass: 1, tension: 280, friction: 30 }, onStart: () => { if(currentCard) { if(sounds.switch) sounds.switch.play(); } } });
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
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} onOpenLogs={() => setShowLogs(true)} />}
        {showLogs && <LogConsole onClose={() => setShowLogs(false)} />}
        {isComparisonOpen && currentCard && <PronunciationModal correctWord={currentCard.chinese} settings={settings} onClose={() => setIsComparisonOpen(false)} />}
        {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={handleJumpToCard} onClose={() => setIsJumping(false)} />}
        {activeCards.length > 0 && currentCard ? (
            cardTransitions((cardStyle, i) => {
              const cardData = activeCards[i];
              if (!cardData) return null;
              return (
                <animated.div key={cardData.id} style={{ ...styles.animatedCardShell, ...cardStyle }}>
                  <div style={styles.cardContainer}>
                      <div style={{ textAlign: 'center', width: '100%' }}>
                          
                          {/* --- 中文区域 (带播放按钮) --- */}
                          <div style={styles.wordGroup}>
                            <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                            <div style={styles.mainWordRow}>
                                <div style={styles.textWordChinese} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, e)}>
                                    {cardData.chinese}
                                </div>
                                <button style={styles.audioBtn} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, e)}>
                                    <FaVolumeUp size={22} />
                                </button>
                            </div>
                          </div>

                          {isRevealed && (
                              <animated.div style={styles.revealedContent}>
                                  
                                  {/* --- 缅文区域 (带播放按钮) --- */}
                                  <div style={styles.wordGroup}>
                                      <div style={styles.mainWordRow}>
                                          <div style={styles.textWordBurmese} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, e)}>
                                              {cardData.burmese}
                                          </div>
                                          <button style={{...styles.audioBtn, color: '#fce38a'}} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, e)}>
                                              <FaVolumeUp size={20} />
                                          </button>
                                      </div>
                                  </div>

                                  {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}
                                  
                                  {/* --- 例句区域 (带播放按钮) --- */}
                                  {cardData.example && (
                                      <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, e)}>
                                          <div style={{ flex: 1 }}>
                                              <div style={styles.examplePinyin}>{pinyinConverter(cardData.example, { toneType: 'symbol', separator: ' ' })}</div>
                                              <div style={styles.exampleText}>{cardData.example}</div>
                                          </div>
                                          <button style={styles.exampleAudioBtn} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, e)}>
                                              <FaVolumeUp size={16} />
                                          </button>
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
                    <button style={{...modalStyles.retryBtn, width: '100%', marginTop: '15px', justifyContent: 'center', background: '#f3f4f6', color: '#333'}} onClick={onClose}>
                        关闭
                    </button>
                </div>
            </div>
        )}
        {currentCard && ( <div style={styles.rightControls} data-no-gesture="true"> <button type="button" style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={18} /></button> <button type="button" style={styles.rightIconButton} onClick={() => setIsComparisonOpen(true)} title="发音评测"><FaMicrophone size={18} color="#e11d48" /></button> {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( <button type="button" style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺"><FaPenFancy size={18} /></button>)} {<button type="button" style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>{isFavoriteCard ? <FaHeart size={18} color="#f87171" /> : <FaRegHeart size={18} />}</button>} </div> )}
        <div style={styles.bottomControlsContainer} data-no-gesture="true"> {activeCards.length > 0 && (<div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>)} <div style={styles.knowButtonsWrapper}> <button type="button" style={{...styles.knowButtonBase, ...styles.dontKnowButton}} onClick={handleDontKnow}>不认识</button> <button type="button" style={{...styles.knowButtonBase, ...styles.knowButton}} onClick={handleKnow}>认识</button> </div> </div>
      </animated.div>
    );
  });
  if (isMounted) return createPortal(cardContent, document.body);
  return null;
};

// ===== 样式表 (广告位已压缩) =====
const styles = {
    // 广告位尺寸压缩
    adContainer: { position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(2px)', textAlign: 'center', padding: '2px 0', minHeight: '30px', maxHeight: '60px', height: 'auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#30505E' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '80px 20px 150px 20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    
    // 新增/修改的样式
    wordGroup: { marginBottom: '1.2rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    mainWordRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', position: 'relative' },
    audioBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'background 0.2s', touchAction: 'manipulation', flexShrink: 0 },
    exampleAudioBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fcd34d', marginLeft: '10px', flexShrink: 0 },
    
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '0.5rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '3.2rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)', cursor: 'pointer' }, 
    revealedContent: { marginTop: '0.5rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' },
    textWordBurmese: { fontSize: '2.0rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)', cursor: 'pointer' },
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

export default WordCard;
