// components/Tixing/TeacherLedDisplay.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { pinyin } from 'pinyin-pro';
import { Howl } from 'howler';
import { FaPlay, FaPause, FaStop } from 'react-icons/fa';

// =================================================================================
// ===== 可控的 TTS 播放器模块 (核心) =============================================
// =================================================================================
// 这个模块现在返回一个 Promise，其中包含 Howl 实例，以便外部可以控制
const createPlayableTTS = (text, voice) => {
  return new Promise((resolve, reject) => {
    const apiUrl = 'https://libretts.is-an.org/api/tts';
    const body = JSON.stringify({ text, voice, rate: 0, pitch: 0 });

    fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      .then(response => response.ok ? response.blob() : Promise.reject('API Error'))
      .then(audioBlob => {
        const audioUrl = URL.createObjectURL(audioBlob);
        const howlInstance = new Howl({
          src: [audioUrl],
          format: ['mpeg'],
          html5: true,
          onload: () => resolve({ howlInstance, audioUrl }), // 加载成功时 resolve
          onloaderror: (id, err) => reject(err),
        });
      })
      .catch(error => reject(error));
  });
};


// =================================================================================
// ===== 主组件 ===================================================================
// =================================================================================
export default function TeacherLedDisplay({ data }) {
  const { title, displayText, narrationText, voice = 'zh-CN-XiaoxiaoNeural' } = data;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const howlRef = useRef(null);
  const audioUrlRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // 解析黑板上要显示的文本，并自动添加拼音
  const displayLines = useMemo(() => {
    if (!displayText) return [];
    return displayText.split('\n').map(line => ({
      text: line,
      pinyin: line.match(/[a-zA-Z0-9?]+/g) ? '' : pinyin(line, { toneType: 'symbol', separator: ' ' }),
    }));
  }, [displayText]);

  // 清理函数，用于停止播放和清除 interval
  const cleanup = () => {
    clearInterval(progressIntervalRef.current);
    if (howlRef.current) {
      howlRef.current.stop();
      howlRef.current.unload(); // 彻底卸载音频
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    howlRef.current = null;
    audioUrlRef.current = null;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };
  
  const startProgressTracker = () => {
    clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const seek = howlRef.current.seek() || 0;
      const dur = howlRef.current.duration() || 0;
      setCurrentTime(seek);
      setProgress(dur > 0 ? (seek / dur) * 100 : 0);
    }, 100);
  };
  
  const handlePlay = async () => {
    if (howlRef.current) {
      howlRef.current.play();
      setIsPlaying(true);
      startProgressTracker();
    } else {
      try {
        const { howlInstance, audioUrl } = await createPlayableTTS(narrationText, voice);
        howlRef.current = howlInstance;
        audioUrlRef.current = audioUrl;

        howlInstance.on('play', () => {
          setDuration(howlInstance.duration());
          setIsPlaying(true);
          startProgressTracker();
        });
        howlInstance.on('pause', () => setIsPlaying(false));
        howlInstance.on('stop', () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); });
        howlInstance.on('end', () => cleanup());

        howlInstance.play();
      } catch (error) {
        console.error("无法加载 TTS 音频:", error);
        alert("音频加载失败，请稍后重试。");
      }
    }
  };

  const handlePause = () => {
    howlRef.current?.pause();
    clearInterval(progressIntervalRef.current);
  };

  const handleStop = () => {
    cleanup();
  };

  // 组件卸载时执行清理
  useEffect(() => {
    return () => cleanup();
  }, []);
  
  const formatTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div style={styles.container}>
      {title && <h1 style={styles.mainTitle}>{title}</h1>}
      
      {/* "黑板" 显示区域 */}
      <div style={styles.displayContainer}>
        {displayLines.map((line, index) => (
          <div key={index} style={styles.displayLine}>
            <p style={styles.displayText}>{line.text}</p>
            {line.pinyin && <p style={styles.displayPinyin}>{line.pinyin}</p>}
          </div>
        ))}
      </div>

      {/* "老师" 讲解播放器区域 */}
      <div style={styles.playerContainer}>
        <div style={styles.controls}>
          {isPlaying ? (
            <button onClick={handlePause} style={{ ...styles.button, ...styles.pauseButton }}><FaPause size={20} /></button>
          ) : (
            <button onClick={handlePlay} style={{ ...styles.button, ...styles.playButton }}><FaPlay size={20} /></button>
          )}
          <button onClick={handleStop} style={{ ...styles.button, ...styles.stopButton }}><FaStop size={20} /></button>
        </div>
        <div style={styles.progressWrapper}>
          <span style={styles.timeText}>{formatTime(currentTime)}</span>
          <div style={styles.progressBarContainer}>
            <div style={{...styles.progressBarFill, width: `${progress}%`}} />
          </div>
          <span style={styles.timeText}>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}


// =================================================================================
// ===== 样式表 (Styles) ===========================================================
// =================================================================================
const styles = {
  container: { width: '100%', height: '100%', padding: '20px', backgroundColor: '#f0f4f8', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', justifyContent: 'space-between' },
  mainTitle: { textAlign: 'center', color: '#2c3e50', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' },
  displayContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    padding: '30px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  },
  displayLine: { marginBottom: '20px' },
  displayText: { fontSize: '32px', fontWeight: 'bold', color: '#34495e', margin: '0 0 8px 0', lineHeight: 1.4 },
  displayPinyin: { fontSize: '20px', color: '#95a5a6', margin: 0, fontStyle: 'italic' },
  playerContainer: {
    width: '100%',
    padding: '20px 0 0 0',
    boxSizing: 'border-box',
  },
  controls: { display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' },
  button: { border: 'none', borderRadius: '50%', width: '55px', height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '0 15px', color: 'white', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)', transition: 'transform 0.2s ease' },
  playButton: { backgroundColor: '#2ecc71' },
  pauseButton: { backgroundColor: '#f39c12' },
  stopButton: { backgroundColor: '#e74c3c' },
  progressWrapper: { display: 'flex', alignItems: 'center', width: '100%' },
  timeText: { fontSize: '12px', color: '#7f8c8d', minWidth: '40px', textAlign: 'center' },
  progressBarContainer: { flex: 1, height: '8px', backgroundColor: '#ecf0f1', borderRadius: '4px', margin: '0 10px', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#3498db', borderRadius: '4px', transition: 'width 0.1s linear' },
};
