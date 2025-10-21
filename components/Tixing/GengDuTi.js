// components/Tixing/GengDuTi.js (V3 - 带日志的调试版)

import React, { useState, useRef, useEffect } from 'react';
import { pinyin } from 'pinyin-pro';
import { FaMicrophone, FaStopCircle, FaPlayCircle, FaVolumeUp, FaRedo, FaCheck } from 'react-icons/fa';
import { Howl } from 'howler';

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
  controlButton: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100px', height: '100px', borderRadius: '50%', border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'all 0.2s ease' },
  buttonLabel: { marginTop: '8px', fontSize: '0.85rem', fontWeight: '500' },
  recordingPulse: { animation: 'pulse 1.5s infinite' },
  resultArea: { marginTop: '24px', padding: '16px', backgroundColor: 'white', borderRadius: '16px', animation: 'fadeIn 0.5s' },
  resultText: { color: theme.textSecondary, marginBottom: '12px' },
  recognizedText: { fontSize: '1.2rem', fontWeight: '500', color: theme.textPrimary },
  scoreBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 20px', borderRadius: '9999px', color: 'white', fontSize: '1.1rem', fontWeight: 'bold' },
};

let ttsPlayer;
const playTTS = (text, lang) => {
  // [LOG] 记录函数调用
  console.log(`[GengDuTi] playTTS called with text: "${text}" and lang: "${lang}"`);

  if (ttsPlayer?.playing()) {
    // [LOG] 记录停止当前播放
    console.log('[GengDuTi] Stopping currently playing TTS.');
    ttsPlayer.stop();
  }

  const ttsUrl = lang === 'zh-CN'
    ? `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`
    : `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;

  // [LOG] 记录生成的URL，这是诊断404问题的关键！
  console.log(`[GengDuTi] Generated TTS URL: ${ttsUrl}`);

  ttsPlayer = new Howl({
    src: [ttsUrl],
    html5: true, // 必须开启，以避免CORS问题
  });

  // [LOG] 添加关键的错误监听器
  ttsPlayer.on('loaderror', (id, error) => {
    console.error(`[GengDuTi] Howler Load Error: `, { id, error });
    alert(`音频加载失败，可能是TTS服务暂时不可用。请查看控制台获取详细信息。`);
  });

  ttsPlayer.on('playerror', (id, error) => {
    console.error(`[GengDuTi] Howler Play Error: `, { id, error });
    alert(`音频播放失败。请查看控制台获取详细信息。`);
  });
  
  // [LOG] 记录播放事件
  ttsPlayer.on('play', () => {
    console.log('[GengDuTi] TTS playback started.');
  });

  ttsPlayer.play();
};

const calcSimilarity = (a, b) => { /* ... (此函数无需修改) ... */ };

const GengDuTi = ({ sentence, pinyinText, translation, lang = "zh-CN" }) => {
  const [state, setState] = useState('idle');
  const [audioBlob, setAudioBlob] = useState(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [score, setScore] = useState(null);

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);
  const userAudioPlayerRef = useRef(null);

  const handleStart = async () => {
    // [LOG]
    console.log('[GengDuTi] handleStart called.');
    if (!SpeechRecognition) { alert("抱歉，您的浏览器不支持语音识别功能，将仅进行录音。"); }
    if (!navigator.mediaDevices?.getUserMedia) { alert("抱歉，您的浏览器不支持录音功能。"); return; }

    try {
      // [LOG]
      console.log('[GengDuTi] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[GengDuTi] Microphone permission granted.');
      setState('recording');
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = event => {
        // [LOG]
        console.log('[GengDuTi] MediaRecorder data available.');
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        // [LOG]
        console.log('[GengDuTi] MediaRecorder stopped.');
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        audioChunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
      };
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognitionRef.current = recognition;
        
        recognition.onresult = (event) => {
          const resultText = event.results[0][0].transcript;
          // [LOG]
          console.log(`[GengDuTi] Speech recognized: "${resultText}"`);
          setRecognizedText(resultText);
          setScore(calcSimilarity(sentence, resultText));
        };
        recognition.onend = () => {
            // [LOG]
            console.log('[GengDuTi] Speech recognition ended.');
            setState('result');
        };
        recognition.onerror = (event) => {
            // [LOG]
            console.error('[GengDuTi] Speech recognition error:', event.error);
            setState('result');
        };
        
        // [LOG]
        console.log('[GengDuTi] Starting speech recognition...');
        recognition.start();
      }
      // [LOG]
      console.log('[GengDuTi] Starting media recorder...');
      mediaRecorderRef.current.start();
    } catch (err) {
      console.error("[GengDuTi] Microphone permission failed:", err);
      alert("无法开始录音，请检查并授权麦克风权限。");
      setState('idle');
    }
  };

  const handleStop = () => {
    // [LOG]
    console.log('[GengDuTi] handleStop called.');
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    setState('processing');
    if (!SpeechRecognition) setTimeout(() => setState('result'), 500);
  };
  
  const handleReset = () => {
    // [LOG]
    console.log('[GengDuTi] handleReset called.');
    setAudioBlob(null);
    setRecognizedText("");
    setScore(null);
    setState('idle');
  };

  const playUserAudio = () => {
    // [LOG]
    console.log('[GengDuTi] playUserAudio called.');
    if (!audioBlob) {
        console.warn('[GengDuTi] No audio blob to play.');
        return;
    }
    userAudioPlayerRef.current?.pause();
    const audioUrl = URL.createObjectURL(audioBlob);
    userAudioPlayerRef.current = new Audio(audioUrl);
    userAudioPlayerRef.current.play();
  };

  useEffect(() => {
    // [LOG]
    console.log('[GengDuTi] Component rerendered due to sentence change. Resetting state.');
    handleReset();
  }, [sentence]);

  const finalPinyin = pinyinText || (lang === 'zh-CN' ? pinyin(sentence, { toneType: 'mark' }) : null);
  const scoreColor = score >= 80 ? theme.success : score >= 50 ? theme.warning : theme.error;

  return (
    <div style={styles.container}>
      <style>{`/* ... (动画样式不变) ... */`}</style>
      <div style={styles.sentenceArea}>
        {finalPinyin && <div style={styles.pinyin}>{finalPinyin}</div>}
        <div style={styles.sentence}>{sentence}</div>
        {translation && <div style={styles.translation}>{translation}</div>}
      </div>
      <div style={styles.controls}>
        <button style={{ ...styles.controlButton, backgroundColor: '#e0f2fe', color: '#0ea5e9' }} onClick={() => playTTS(sentence, lang)}>
          <FaVolumeUp size="40%" /><span style={styles.buttonLabel}>听原音</span>
        </button>
        {state === 'idle' && (
          <button style={{ ...styles.controlButton, backgroundColor: '#fee2e2', color: theme.error }} onClick={handleStart}>
            <FaMicrophone size="40%" /><span style={styles.buttonLabel}>开始跟读</span>
          </button>
        )}
        {state === 'recording' && (
          <button style={{ ...styles.controlButton, backgroundColor: '#fee2e2', color: theme.error, ...styles.recordingPulse }} onClick={handleStop}>
            <FaStopCircle size="40%" /><span style={styles.buttonLabel}>停止录音</span>
          </button>
        )}
        {state === 'processing' && (
          <button style={{ ...styles.controlButton, backgroundColor: '#f1f5f9', color: theme.gray }} disabled>
            <div className="animate-spin"><FaRedo size="40%" /></div><span style={styles.buttonLabel}>评分中...</span>
          </button>
        )}
        {state === 'result' && (
          <>
            {audioBlob && (<button style={{ ...styles.controlButton, backgroundColor: '#dcfce7', color: '#16a34a' }} onClick={playUserAudio}>
              <FaPlayCircle size="40%" /><span style={styles.buttonLabel}>听回放</span>
            </button>)}
            <button style={{ ...styles.controlButton, backgroundColor: '#f1f5f9', color: theme.gray }} onClick={handleReset}>
              <FaRedo size="35%" /><span style={styles.buttonLabel}>再试一次</span>
            </button>
          </>
        )}
      </div>
      {state === 'result' && (
        <div style={styles.resultArea}>
          <div style={styles.resultText}>你的跟读结果：</div>
          <p style={styles.recognizedText}>{recognizedText || "(未能识别语音，可听回放自我评估)"}</p>
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
