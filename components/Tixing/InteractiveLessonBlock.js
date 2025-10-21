// components/Tixing/InteractiveLessonBlock.js

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';
import { Howl } from 'howler';
import { FaPlay, FaPause, FaStop } from 'react-icons/fa';

// =================================================================================
// ===== 1. 封装了您指定TTS服务的自定义 Hook ======================================
// =================================================================================
const useLibreTTS = () => {
  const howlRef = useRef(null);
  const audioUrlRef = useRef(null);
  
  const [playerState, setPlayerState] = useState({
    isLoading: false,
    isPlaying: false,
    duration: 0,
    seek: 0,
  });

  const progressIntervalRef = useRef(null);

  const cleanup = useCallback(() => {
    clearInterval(progressIntervalRef.current);
    if (howlRef.current) {
      howlRef.current.stop();
      howlRef.current.unload();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    howlRef.current = null;
    audioUrlRef.current = null;
    setPlayerState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 });
  }, []);

  const play = useCallback(async (text, voice) => {
    cleanup();
    setPlayerState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch('https://libretts.is-an.org/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, rate: 0, pitch: 0 }),
      });
      if (!response.ok) throw new Error('API Error');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      const howlInstance = new Howl({
        src: [audioUrl],
        format: ['mpeg'],
        html5: true,
      });
      howlRef.current = howlInstance;

      howlInstance.once('load', () => {
        setPlayerState(prev => ({ ...prev, isLoading: false, duration: howlInstance.duration() }));
        howlInstance.play();
      });

      howlInstance.on('play', () => {
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
        progressIntervalRef.current = setInterval(() => {
          setPlayerState(prev => ({ ...prev, seek: howlInstance.seek() || 0 }));
        }, 100);
      });
      
      howlInstance.on('pause', () => setPlayerState(prev => ({ ...prev, isPlaying: false })));
      howlInstance.on('stop', () => setPlayerState(prev => ({ ...prev, isPlaying: false, seek: 0 })));
      howlInstance.on('end', () => cleanup());
      howlInstance.on('loaderror', cleanup);

    } catch (error) {
      console.error("TTS 加载失败:", error);
      alert("音频加载失败");
      cleanup();
    }
  }, [cleanup]);

  const pause = useCallback(() => howlRef.current?.pause(), []);
  const resume = useCallback(() => howlRef.current?.play(), []);
  const stop = useCallback(() => howlRef.current?.stop(), []);

  useEffect(() => cleanup, [cleanup]); // 组件卸载时清理

  return { play, pause, resume, stop, ...playerState };
};


// =================================================================================
// ===== 2. 黑板、字幕、播放器等子组件 ============================================
// =================================================================================

const Blackboard = ({ title, displayText }) => {
  const displayLines = useMemo(() => {
    if (!displayText) return [];
    return displayText.split('\n').map(line => ({
      text: line,
      pinyin: line.match(/[a-zA-Z0-9?]+/g) ? '' : pinyin(line, { toneType: 'symbol', separator: ' ' }),
    }));
  }, [displayText]);

  return (
    <div style={styles.blackboard}>
      {title && <h1 style={styles.mainTitle}>{title}</h1>}
      <div style={styles.displayContent}>
        {displayLines.map((line, index) => (
          <div key={index} style={styles.displayLine}>
            <p style={styles.displayText}>{line.text}</p>
            {line.pinyin && <p style={styles.displayPinyin}>{line.pinyin}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

const SubtitleBar = ({ text, duration, seek }) => {
    const chars = useMemo(() => text ? Array.from(text) : [], [text]);
    const totalChars = chars.length;
    
    // 估算当前应该高亮到哪个字
    const highlightedIndex = duration > 0 ? Math.floor((seek / duration) * totalChars) : -1;
  
    return (
      <div style={styles.subtitleContainer}>
        <p style={styles.subtitleText}>
          {chars.map((char, index) => (
            <span 
              key={index}
              style={{
                ...styles.subtitleChar,
                color: index <= highlightedIndex ? '#f1c40f' : '#ffffff', // 高亮已播放的字
                opacity: index <= highlightedIndex ? 1 : 0.6,
              }}
            >
              {char}
            </span>
          ))}
        </p>
      </div>
    );
};
  
const Controls = ({ onPlay, onPause, onStop, isPlaying, isLoading }) => (
    <div style={styles.playerContainer}>
      <div style={styles.controls}>
        {isPlaying ? (
          <button onClick={onPause} style={{ ...styles.button, ...styles.pauseButton }}><FaPause size={20} /></button>
        ) : (
          <button onClick={onPlay} style={{ ...styles.button, ...styles.playButton }} disabled={isLoading}>
            {isLoading ? '...' : <FaPlay size={20} />}
          </button>
        )}
        <button onClick={onStop} style={{ ...styles.button, ...styles.stopButton }}><FaStop size={20} /></button>
      </div>
    </div>
);


// =================================================================================
// ===== 3. 最终导出的主组件 =======================================================
// =================================================================================
export default function InteractiveLessonBlock({ data }) {
  const { title, displayText, narrationText, voice = 'zh-CN-XiaoyouNeural' } = data;
  const { play, pause, stop, isPlaying, isLoading, duration, seek } = useLibreTTS();
  
  const handlePlay = () => {
    // 如果已有播放实例则继续，否则从头播放
    if (seek > 0) {
        howlRef.current?.play();
    } else {
        play(narrationText, voice);
    }
  };

  return (
    <div style={styles.container}>
      <Blackboard title={title} displayText={displayText} />
      <SubtitleBar text={narrationText} duration={duration} seek={seek} />
      <Controls 
        onPlay={() => play(narrationText, voice)} 
        onPause={pause} 
        onStop={stop} 
        isPlaying={isPlaying} 
        isLoading={isLoading} 
      />
    </div>
  );
}


// =================================================================================
// ===== 4. 样式表 =================================================================
// =================================================================================
const styles = {
  container: { width: '100%', height: '100%', backgroundColor: '#2c3e50', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  // 黑板样式
  blackboard: {
    flex: 1,
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  },
  mainTitle: { textAlign: 'center', color: '#ecf0f1', fontSize: '24px', fontWeight: 'bold', marginBottom: '30px', borderBottom: '2px solid #3498db', paddingBottom: '10px' },
  displayContent: { textAlign: 'center' },
  displayLine: { marginBottom: '25px' },
  displayText: { fontSize: '36px', fontWeight: 'bold', color: '#ffffff', margin: '0 0 8px 0', lineHeight: 1.5, textShadow: '2px 2px 4px rgba(0,0,0,0.2)' },
  displayPinyin: { fontSize: '22px', color: '#bdc3c7', margin: 0, fontStyle: 'italic' },
  // 字幕样式
  subtitleContainer: {
    width: '100%',
    padding: '20px 30px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    boxSizing: 'border-box',
    minHeight: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  subtitleText: { fontSize: '18px', margin: 0, textAlign: 'center', lineHeight: 1.8 },
  subtitleChar: { transition: 'color 0.2s ease, opacity 0.2s ease' },
  // 播放器样式
  playerContainer: { width: '100%', padding: '15px 0', backgroundColor: '#34495e', boxShadow: '0 -5px 15px rgba(0,0,0,0.1)' },
  controls: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
  button: { border: 'none', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '0 20px', color: 'white', boxShadow: '0 5px 20px rgba(0, 0, 0, 0.3)', transition: 'transform 0.2s ease', background: 'transparent' },
  playButton: { backgroundColor: '#27ae60' },
  pauseButton: { backgroundColor: '#f39c12' },
  stopButton: { backgroundColor: '#c0392b' },
};
