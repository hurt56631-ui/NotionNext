// components/Tixing/GengDuTi.js (V7 - 纯前端稳定最终版)

import React, { useState, useRef, useEffect } from 'react';
import { pinyin } from 'pinyin-pro';
import { FaMicrophone, FaStopCircle, FaVolumeUp, FaRedo, FaCheck, FaSpinner } from 'react-icons/fa';
import { Howl, Howler } from 'howler';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const theme = {
  primary: '#3b82f6',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  gray: '#64748b',
  textPrimary: '#1e2b3b',
  textSecondary: '#64748b',
  bgContainer: '#f7f9fc',
  borderRadiusContainer: '28px',
  boxShadowContainer: '0 8px 40px rgba(0, 0, 0, 0.08)',
};

const styles = {
  container: { backgroundColor: theme.bgContainer, borderRadius: theme.borderRadiusContainer, padding: '24px', boxShadow: theme.boxShadowContainer, fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', textAlign: 'center' },
  sentenceArea: { marginBottom: '24px', padding: '20px', backgroundColor: 'white', borderRadius: '16px' },
  pinyin: { fontSize: '1.2rem', color: theme.textSecondary, marginBottom: '8px' },
  sentence: { fontSize: '1.8rem', fontWeight: 'bold', color: theme.textPrimary, lineHeight: '1.5' },
  translation: { fontSize: '1rem', color: theme.gray, marginTop: '12px' },
  controls: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  controlButton: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100px', height: '100px', borderRadius: '50%', border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' },
  buttonLabel: { marginTop: '8px', fontSize: '0.85rem', fontWeight: '500' },
  recordingPulse: { animation: 'pulse 1.5s infinite' },
  resultArea: { marginTop: '24px', padding: '16px', backgroundColor: 'white', borderRadius: '16px', animation: 'fadeIn 0.5s' },
  resultText: { color: theme.textSecondary, marginBottom: '12px' },
  recognizedText: { fontSize: '1.2rem', fontWeight: '500', color: theme.textPrimary },
  scoreBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 20px', borderRadius: '9999px', color: 'white', fontSize: '1.1rem', fontWeight: 'bold' },
};

let ttsPlayer;
const GengDuTi = ({ sentence, pinyinText, translation, lang = "zh-CN", rate = -35 }) => {
  const [state, setState] = useState('idle'); // idle, recording, result
  const [ttsState, setTtsState] = useState('idle'); // idle, loading, playing
  const [recognizedText, setRecognizedText] = useState("");
  const [score, setScore] = useState(null);

  const recognitionRef = useRef(null);
  
  const playTTS = () => {
    if (ttsState !== 'idle') return;
    Howler.autoUnlock = true;
    if (ttsPlayer?.playing()) ttsPlayer.stop();
    setTtsState('loading');
    const voiceMap = { 'zh-CN': 'zh-CN-XiaoyouNeural', 'en-US': 'en-US-JennyNeural' };
    const voice = voiceMap[lang] || voiceMap['zh-CN'];
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(sentence)}&v=${voice}&r=${rate}`;
    
    ttsPlayer = new Howl({ 
        src: [ttsUrl], 
        html5: true,
        onplay: () => setTtsState('playing'),
        onend: () => setTtsState('idle'),
        onplayerror: () => setTtsState('idle'),
        onloaderror: () => setTtsState('idle')
    });
    ttsPlayer.play();
  };

  const calcSimilarity = (a, b) => {
    const clean = (s) => s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s']/g, "").toLowerCase();
    const s1 = clean(a);
    const s2 = clean(b);
    if (!s1 || !s2) return 0;
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
      }
    }
    const distance = track[s2.length][s1.length];
    const longerLength = Math.max(s1.length, s2.length);
    return Math.round(Math.max(0, 1 - distance / longerLength) * 100);
  };
  
  // ✅ [核心变更] 彻底移除 MediaRecorder，只使用 SpeechRecognition
  const handleStartRecognition = () => {
    if (!SpeechRecognition) {
      alert("抱歉，您的浏览器不支持语音识别功能。");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setState('recording');
      };

      recognition.onresult = (event) => {
        const resultText = event.results[0][0].transcript;
        setRecognizedText(resultText);
        setScore(calcSimilarity(sentence, resultText));
      };
      
      recognition.onend = () => {
        setState('result');
      };

      recognition.onerror = (event) => {
        console.error('Speech Recognition Error:', event.error);
        // 如果出错，也直接跳转到结果页，让用户看到错误/空结果
        setState('result');
      };
      
      recognition.start();

    } catch (err) {
      console.error("语音识别启动失败:", err);
      alert("无法启动语音识别，请检查浏览器设置或权限。");
      setState('idle');
    }
  };

  const handleStopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };
  
  const handleReset = () => {
    if (ttsPlayer?.playing()) ttsPlayer.stop();
    if (recognitionRef.current) recognitionRef.current.abort(); // 确保中止任何正在进行的识别
    setTtsState('idle');
    setRecognizedText("");
    setScore(null);
    setState('idle');
  };

  useEffect(() => {
    handleReset();
    // 组件卸载时，确保停止所有活动
    return () => {
        if (ttsPlayer) ttsPlayer.unload();
        if (recognitionRef.current) recognitionRef.current.abort();
    }
  }, [sentence, lang]);

  const finalPinyin = pinyinText || (lang === 'zh-CN' ? pinyin(sentence, { toneType: 'mark' }) : null);
  const scoreColor = score >= 80 ? theme.success : score >= 50 ? theme.warning : theme.error;

  return (
    <div style={styles.container}>
      <style>{`@keyframes pulse { 0% { box-shadow: 0 0 0 0 ${theme.error}B3; } 70% { box-shadow: 0 0 0 15px ${theme.error}00; } 100% { box-shadow: 0 0 0 0 ${theme.error}00; } } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      <div style={styles.sentenceArea}>
        {finalPinyin && <div style={styles.pinyin}>{finalPinyin}</div>}
        <div style={styles.sentence}>{sentence}</div>
        {translation && <div style={styles.translation}>{translation}</div>}
      </div>
      <div style={styles.controls}>
        <button style={{ ...styles.controlButton, backgroundColor: '#e0f2fe', color: '#0ea5e9' }} onClick={playTTS}>
          {ttsState === 'loading' ? <div className="animate-spin"><FaSpinner size="40%" /></div> : <FaVolumeUp size="40%" />}
          <span style={styles.buttonLabel}>{ttsState === 'loading' ? '加载中' : '听原音'}</span>
        </button>
        {state === 'idle' && (
          <button style={{ ...styles.controlButton, backgroundColor: '#fee2e2', color: theme.error }} onClick={handleStartRecognition}>
            <FaMicrophone size="40%" /><span style={styles.buttonLabel}>开始跟读</span>
          </button>
        )}
        {state === 'recording' && (
          <button style={{ ...styles.controlButton, backgroundColor: '#fee2e2', color: theme.error, ...styles.recordingPulse }} onClick={handleStopRecognition}>
            <FaStopCircle size="40%" /><span style={styles.buttonLabel}>停止</span>
          </button>
        )}
        {state === 'result' && (
            <button style={{ ...styles.controlButton, backgroundColor: '#f1f5f9', color: theme.gray }} onClick={handleReset}>
              <FaRedo size="35%" /><span style={styles.buttonLabel}>再试一次</span>
            </button>
        )}
      </div>
      {state === 'result' && (
        <div style={styles.resultArea}>
          <div style={styles.resultText}>你的跟读结果：</div>
          <p style={styles.recognizedText}>{recognizedText || "(未能识别语音)"}</p>
          {score !== null && (
            <div style={{ ...styles.scoreBadge, backgroundColor: scoreColor }}>
              <FaCheck /><span>相似度：{score}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GengDuTi;
