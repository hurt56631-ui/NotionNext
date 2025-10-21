// components/Tixing/GengDuTi.js (V4 - 真正支持多语言的最终版)

import React, { useState, useRef, useEffect } from 'react';
import { pinyin } from 'pinyin-pro';
import { FaMicrophone, FaStopCircle, FaPlayCircle, FaVolumeUp, FaRedo, FaCheck } from 'react-icons/fa';
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
  Howler.autoUnlock = true;
  if (ttsPlayer?.playing()) ttsPlayer.stop();

  // ✅ [核心修正] 创建一个语音模型映射表
  const voiceMap = {
    'zh-CN': 'zh-CN-XiaoyouNeural',
    'en-US': 'en-US-JennyNeural',
    // 未来可以轻松扩展更多语言
    // 'ja-JP': 'ja-JP-NanamiNeural', 
  };

  // ✅ [核心修正] 智能选择语音模型，如果找不到则默认使用中文
  const voice = voiceMap[lang] || voiceMap['zh-CN'];
  
  // ✅ [核心修正] 统一使用 t.leftsite.cn 服务
  const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
  
  console.log(`[GengDuTi] Requesting TTS from: ${ttsUrl}`); // 保留日志以供调试

  ttsPlayer = new Howl({ 
      src: [ttsUrl], 
      html5: true,
      onplayerror: (id, err) => {
        console.error('TTS Play Error:', err);
        alert('音频播放失败，请检查网络或浏览器权限。');
      },
      onloaderror: (id, err) => {
        console.error(`TTS Load Error for URL [${ttsUrl}]:`, err);
        alert('音频加载失败，可能是TTS服务暂时不可用或网络问题。');
      }
  });
  ttsPlayer.play();
};

const calcSimilarity = (a, b) => {
  const clean = (s) => s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s']/g, "").toLowerCase(); // 保留空格和撇号以更好地处理英文
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

const GengDuTi = ({ sentence, pinyinText, translation, lang = "zh-CN" }) => {
  const [state, setState] = useState('idle');
  const [audioBlob, setAudioBlob] = useState(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [score, setScore] = useState(null);

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);
  const userAudioPlayerRef = useRef(null);
  
  useEffect(() => {
    const unlockAudio = () => { Howler.autoUnlock = true; document.removeEventListener('click', unlockAudio); };
    document.addEventListener('click', unlockAudio);
    return () => document.removeEventListener('click', unlockAudio);
  }, []);

  const handleStart = async () => {
    if (!SpeechRecognition) { alert("抱歉，您的浏览器不支持语音识别功能，将仅进行录音。"); }
    if (!navigator.mediaDevices?.getUserMedia) { alert("抱歉，您的浏览器不支持录音功能。"); return; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setState('recording');
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = event => audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = () => {
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
          setRecognizedText(resultText);
          setScore(calcSimilarity(sentence, resultText));
        };
        recognition.onend = () => setState('result');
        recognition.onerror = (event) => { console.error('Speech Recognition Error:', event.error); setState('result'); };
        recognition.start();
      }
      mediaRecorderRef.current.start();
    } catch (err) {
      console.error("麦克风授权失败:", err);
      alert("无法开始录音，请检查并授权麦克风权限。");
      setState('idle');
    }
  };

  const handleStop = () => {
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    setState('processing');
    if (!SpeechRecognition) setTimeout(() => setState('result'), 500);
  };
  
  const handleReset = () => {
    setAudioBlob(null);
    setRecognizedText("");
    setScore(null);
    setState('idle');
  };

  const playUserAudio = () => {
    if (!audioBlob) return;
    userAudioPlayerRef.current?.pause();
    const audioUrl = URL.createObjectURL(audioBlob);
    userAudioPlayerRef.current = new Audio(audioUrl);
    userAudioPlayerRef.current.play();
  };

  useEffect(() => { handleReset(); }, [sentence, lang]);

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

export default GengDuTi;
