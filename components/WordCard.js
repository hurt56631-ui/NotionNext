// components/WordCard.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, 
    FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaRedo 
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// --- 数据库和辅助函数部分 ---
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';

function openDB() { 
    return new Promise((resolve, reject) => { 
        if (typeof window === 'undefined') return reject("Server side");
        const request = indexedDB.open(DB_NAME, 1); 
        request.onerror = () => reject('Database Error'); 
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
    } catch (e) { return false; }
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
    } catch (e) { return false; }
}

const TTS_VOICES = [ 
    { value: 'zh-CN-XiaoxiaoNeural', label: 'တရုတ် (အမျိုးသမီး)' }, 
    { value: 'zh-CN-XiaoyouNeural', label: 'တရုတ် (အမျိုးသမီး - ကလေး)' }, 
    { value: 'my-MM-NilarNeural', label: 'ဗမာ (အမျိုးသမီး)' }, 
    { value: 'my-MM-ThihaNeural', label: 'ဗမာ (အမျိုးသား)' }, 
];

// 16个整体认读音节 (这些音节不拼读，直接读整字)
const WHOLE_SYLLABLES = [
  'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
  'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying'
];

let sounds = null;
let _howlInstance = null; 

// ✅ 全局停止音频函数
const stopAllAudio = () => {
    if (_howlInstance) {
        _howlInstance.stop();
        _howlInstance.unload();
        _howlInstance = null;
    }
    if (sounds) {
        Object.values(sounds).forEach(s => s.stop());
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

const initSounds = () => {
    if (!sounds && typeof window !== 'undefined') {
        sounds = { 
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }), 
            correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }), 
            incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }), 
        };
    }
};

// ✅ TTS 播放逻辑
const playTTS = async (text, voice, rate, onEndCallback, e) => { 
    if (e && e.stopPropagation) e.stopPropagation(); 
    stopAllAudio(); 

    if (!text || !voice) { 
        if (onEndCallback) onEndCallback(); 
        return; 
    } 

    const apiUrl = 'https://libretts.is-an.org/api/tts'; 
    const rateValue = Math.round(rate / 2); 

    try { 
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }), 
        }); 
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`); 
        
        const audioBlob = await response.blob(); 
        const audioUrl = URL.createObjectURL(audioBlob); 
        
        _howlInstance = new Howl({ 
            src: [audioUrl], 
            format: ['mpeg'], 
            html5: true, 
            onend: () => { 
                URL.revokeObjectURL(audioUrl); 
                if (onEndCallback) onEndCallback(); 
            }, 
            onloaderror: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); }, 
            onplayerror: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); } 
        }); 
        
        _howlInstance.play(); 
    } catch (error) { 
        // 降级：使用本地语音
        if (typeof window !== 'undefined' && window.speechSynthesis) {
             const u = new SpeechSynthesisUtterance(text);
             u.lang = voice.includes('my') ? 'my-MM' : 'zh-CN';
             u.rate = rate >= 0 ? 1 + (rate / 100) : 1 + (rate / 200);
             u.onend = () => { if(onEndCallback) onEndCallback(); };
             u.onerror = () => { if(onEndCallback) onEndCallback(); };
             window.speechSynthesis.speak(u);
        } else {
             if (onEndCallback) onEndCallback();
        }
    } 
};

// 简单的 TTS 包装器 (读慢一点适合拼读)
const playTTSWrapper = (text, voice = 'zh-CN-XiaoxiaoNeural') => {
    return new Promise((resolve) => {
        playTTS(text, voice, -20, resolve);
    });
};

const playSoundEffect = (type) => { 
    if (typeof window === 'undefined') return;
    initSounds();
    stopAllAudio();
    if (sounds && sounds[type]) sounds[type].play(); 
};

// --- 子组件部分 ---

const useCardSettings = () => { 
    const [settings, setSettings] = useState(() => { 
        try { 
            if (typeof window === 'undefined') return {};
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
                speechRateChinese: -50, 
                speechRateBurmese: -50, 
                backgroundImage: '', 
            }; 
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings; 
        } catch (error) { 
            return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: -50, speechRateBurmese: -50, backgroundImage: '' }; 
        } 
    }); 
    useEffect(() => { 
        try { 
            if (typeof window !== 'undefined') {
                localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); 
            }
        } catch (error) { } 
    }, [settings]); 
    return [settings, setSettings]; 
};

// ✅ 全新 SpellingModal (完全按照视频逻辑修改)
// 视频逻辑：显示数字声调 (da3)，读声母(d) -> 读整字(da)
const SpellingModal = ({ word, onClose }) => {
    const [status, setStatus] = useState(''); // e.g., '0-initial', '0-full'
    const isStoppingRef = useRef(false);

    // 播放本地声母文件 /pinyin-assets/
    const playLocal = (filename) => {
        return new Promise((resolve) => {
            if (isStoppingRef.current) { resolve(); return; }
            const cleanFilename = filename.trim();
            const audio = new Audio(`/pinyin-assets/${cleanFilename}`);
            audio.onended = resolve;
            audio.onerror = () => { 
                // console.warn(`缺失声母音频: /pinyin-assets/${cleanFilename}`); 
                resolve(); 
            };
            audio.play().catch(resolve);
        });
    };

    const startSpelling = async () => {
        if (!word) return;
        isStoppingRef.current = false;
        stopAllAudio();
        
        const chars = word.split('');
        
        // 1. 逐字拼读
        for (let i = 0; i < chars.length; i++) {
            if (isStoppingRef.current) break;
            const char = chars[i];
            
            // 获取带数字的拼音：如 da3
            const pData = pinyinConverter(char, { type: 'all', toneType: 'num', multiple: false })[0];
            const pinyinNoTone = pData.pinyin.replace(/\d/g, '');
            const isWhole = WHOLE_SYLLABLES.includes(pinyinNoTone);

            // --- 阶段 1: 读声母 (Initial) ---
            // 只有不是整体认读音节，且有声母时才读
            if (!isWhole && pData.initial) {
                setStatus(`${i}-initial`); // 状态：高亮声母 (红色)
                await playLocal(`${pData.initial}.mp3`); // 播放 d.mp3
                
                // 模拟视频里的短暂停顿
                await new Promise(r => setTimeout(r, 100));
            }

            // --- 阶段 2: 读整字 (Full) ---
            // 视频逻辑：直接从声母跳到整字读音，不读单独的韵母
            setStatus(`${i}-full`); // 状态：高亮全部 (红色)
            
            // 使用 TTS 读这个汉字 (char)，这样最准，一定是带声调的
            await playTTSWrapper(char); 
            
            await new Promise(r => setTimeout(r, 400));
        }

        // 2. 整词连读 (单词)
        if (!isStoppingRef.current) {
            setStatus('all-full'); // 状态：全部高亮
            await playTTSWrapper(word);
        }

        if (!isStoppingRef.current) {
            setTimeout(onClose, 1500); // 读完延迟关闭
        }
    };

    useEffect(() => {
        startSpelling();
        return () => { isStoppingRef.current = true; stopAllAudio(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={{...styles.
