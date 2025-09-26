// components/Tixing/CiDianKa.js (V18.2 - 布局与渲染最终修复版)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaImages, FaPlay } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 美化：渐变色背景 =====================
const gradients = [
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
];
// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  container: { position: 'relative', width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deck: { position: 'absolute', width: '92%', maxWidth: '900px', height: '100%', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.12)' },
  cardInner: { position: 'relative', width: '100%', height: '100%', flex: 1, transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', color: '#1a202c', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center' },
  backFace: { transform: 'rotateY(180deg)', background: '#ffffff' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab' },
  header: { textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.25)' }, // 增强阴影
  pinyin: { fontSize: '1.4rem', color: 'rgba(255,255,255,0.95)', marginBottom: 6, textShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: 'white' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  settingsModal: { position: 'absolute', bottom: '110px', right: '20px', background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 100 },
  feedbackArea: { width: '100%', minHeight: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  feedbackMessage: { color: 'white', height: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', marginBottom: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.2)' },
  feedbackPinyinRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' },
  feedbackPinyinSyllable: { padding: '6px 12px', borderRadius: '8px', fontSize: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.8)' },
  example: { background: 'rgba(240,244,255,0.7)', padding: '12px 16px', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', width: '100%', maxWidth: '400px', textAlign: 'left' },
  meaning: { fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 10 },
};
// ===================== TTS 管理 =====================
let _howlInstance = null;
const playTTS = (text) => {
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (e) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};
// ===================== 语音识别与录音组件 =====================
const PronunciationPractice = ({ word, onResult }) => {
    const [status, setStatus] = useState('idle');
    const recognitionRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const comparePinyin = (correctWord, spokenText) => {
        const correctPinyin = pinyinConverter(correctWord, { type: 'array' });
        const spokenPinyin = pinyinConverter(spokenText, { type: 'array' });
        return correctPinyin.map((correct, i) => {
            const spoken = spokenPinyin[i] || '';
            const cParsed = parsePinyin(correct);
            const sParsed = parsePinyin(spoken);
            return { correct, spoken, initialMatch: cParsed.initial === sParsed.initial, finalMatch: cParsed.final === sParsed.final, toneMatch: cParsed.tone === sParsed.tone };
        });
    };

    const handleListen = useCallback(async (e) => {
        e.stopPropagation();
        if (status === 'listening') {
            mediaRecorderRef.current?.stop();
            recognitionRef.current?.stop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) { onResult({ msg: '浏览器不支持语音识别', pinyin: [], audioBlob: null }); return; }
            
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = event => audioChunksRef.current.push(event.data);
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                onResult(prev => ({ ...prev, audioBlob }));
                stream.getTracks().forEach(track => track.stop());
            };

            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.lang = 'zh-CN';
            recognition.onstart = () => { setStatus('listening'); onResult({ msg: '请说话...', pinyin: [], audioBlob: null }); };
            recognition.onresult = event => {
                const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
                const pinyinFeedback = comparePinyin(word, transcript);
                const allCorrect = pinyinFeedback.every(p => p.initialMatch && p.finalMatch && p.toneMatch);
                onResult(prev => ({ ...prev, msg: allCorrect ? '完全正确！' : '请看对比结果', pinyin: pinyinFeedback }));
            };
            recognition.onerror = err => { onResult({ msg: `识别出错: ${err.error}`, pinyin: [], audioBlob: null }); setStatus('idle'); };
            recognition.onend = () => setStatus('idle');

            recognition.start();
            mediaRecorderRef.current.start();

        } catch (err) { onResult({ msg: '无法访问麦克风', pinyin: [], audioBlob: null }); }
    }, [status, word, onResult]);

    return ( <button style={{...styles.button, background
