// components/Tixing/CiDianKa.js (优化图片加载速度，移除渐显，提高压缩率)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaStar, FaRegStar, FaArrowRight } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// ===== Utilities: 音频播放, 拼音解析 ==============================================
// =================================================================================

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'zh-CN-YunjianNeural', label: '中文男声 (云间)' }, { value: 'zh-CN-YunxiNeural', label: '中文男声 (云希)' },
    { value: 'vi-VN-HoaiMyNeural', label: '越南语女声' }, { value: 'vi-VN-NamMinhNeural', label: '越南语男声' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;

const playTTS = (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; }
    Object.values(sounds).forEach(sound => sound.stop());
    if (_howlInstance?.playing()) _howlInstance.stop();
    const rateValue = Math.round(rate / 2);
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;
    _howlInstance = new Howl({ src: [ttsUrl], html5: true, onend: onEndCallback });
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
            if (initial === 'y' && final.startsWith('i')) final = final.slice(1);
            if (initial === 'w' && final.startsWith('u')) final = final.slice(1);
            break;
        }
    }
    
    if (pinyinPlain === 'er') { initial = ''; final = 'er'; }
    if (initial === '' && initials.some(i => pinyinPlain.startsWith(i))) { initial = pinyinPlain; final = ''; } 

    return { initial, final, tone, pinyinMark, rawPinyin };
};


// =================================================================================
// ===== Custom Hooks: 用户设置 ====================================================
// =================================================================================
const useCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('ciDianKaSettings');
      const defaultSettings = { 
        order: 'sequential', autoPlayWord: true, autoBrowse: false, autoPlayDetails: true,
        voiceWord: 'zh-CN-XiaoyouNeural', voiceMeaning: 'zh-CN-XiaoxiaoNeural', voiceExample: 'zh-CN-XiaoxiaoNeural', speechRate: 0,
      };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) { 
        console.error("Failed to load settings", error);
        return { order: 'sequential', autoPlayWord: true, autoBrowse: false, autoPlayDetails: true, voiceWord: 'zh-CN-XiaoyouNeural', voiceMeaning: 'zh-CN-XiaoxiaoNeural', voiceExample: 'zh-CN-XiaoxiaoNeural', speechRate: 0 };
    }
  });
  useEffect(() => { try { localStorage.setItem('ciDianKaSettings', JSON.stringify(settings)); } catch (error) { console.error("Failed to save settings", error); } }, [settings]);
  return [settings, setSettings];
};

// =================================================================================
// ===== Component: 视觉化拼音分析器 ================================================
// =================================================================================
const PinyinVisualizer = React.memo(({ analysis }) => {
    const { parts, errors } = analysis;
    
    const hasInitial = !!parts.initial;
    const hasFinal = !!parts.final;
    const hasTone = parts.tone !== '0';

    const initialStyle = hasInitial && errors.initial ? styles.wrongPart : styles.correctPart;
    const finalStyle = hasFinal && errors.final ? styles.wrongPart : styles.correctPart;
    const toneStyle = hasTone && errors.tone ? styles.wrongPart : styles.correctPart;

    let finalDisplay = parts.pinyinMark.replace(parts.initial, '').replace(' ', '');
    if (!finalDisplay || parts.pinyinMark === parts.rawPinyin) {
        finalDisplay = parts.final;
    }
    finalDisplay = finalDisplay.replace(/[1-5]$/, '');


    return (
        <div style={styles.pinyinVisualizerContainer}>
            <span style={{...styles.pinyinPart, ...initialStyle}}>{parts.initial || '' }</span>
            <span style={{...styles.pinyinPart, ...finalStyle}}>{finalDisplay}</span>
            <span style={{...styles.pinyinPart, ...styles.toneNumber, ...toneStyle}}>{parts.tone}</span>
        </div>
    );
});

// =================================================================================
// ===== Component: 发音对比面板 ===================================================
// =================================================================================
const PronunciationComparison = ({ correctWord, userText, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });

        if (correctPinyin.length !== userPinyin.length) {
            return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
        }

        const results = correctPinyin.map((correctPy, index) => {
            const userPy = userPinyin[index];
            const correctParts = parsePinyin(correctPy);
            const userParts = parsePinyin(userPy);
            
            const errors = {
                initial: (correctParts.initial || userParts.initial) && (correctParts.initial !== userParts.initial),
                final: correctParts.final !== userParts.final,
                tone: correctParts.tone !== userParts.tone,
            };
            const pinyinMatch = !errors.initial && !errors.final && !errors.tone;
            
            return {
                char: correctWord[index],
                pinyinMatch,
                correct: { parts: correctParts, errors: { initial: false, final: false, tone: false } },
                user: { parts: userParts, errors: errors }
            };
        });

        const isCorrect = results.every(r => r.pinyinMatch);
        const correctCount = results.filter(r => r.pinyinMatch).length;
        const accuracy = (correctCount / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText]);

    useEffect(() => {
        if (!analysis) return;
        const isSuccess = analysis.isCorrect && analysis.accuracy > 0;
        playSoundEffect(isSuccess ? 'correct' : 'incorrect');
    }, [analysis]);

    if (!analysis) return null;

    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '发音完美！' : '再接再厉！'}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>准确率: {analysis.accuracy}%</div>
                </div>

                <div style={styles.errorDetailsContainer}>
                    {analysis.error === 'LENGTH_MISMATCH' ? (
                        <div style={styles.lengthError}>
                            <h3>{analysis.message}</h3>
                            <p>标准答案：<strong>{correctWord}</strong></p>
                            <p>你的朗读：<strong>
