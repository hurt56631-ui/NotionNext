import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
// 引入 html 方法用于生成注音HTML
import { html as pinyinHtml } from 'pinyin-pro'; 
import { 
  FaPlay, FaPause, FaTimes, FaChevronLeft, FaChevronRight, FaExpand, FaVolumeUp 
} from 'react-icons/fa';
import { motion } from 'framer-motion';

// =================================================================================
// ===== 1. 工具与音频 Hook (IndexedDB 缓存 + 音频控制) =====
// =================================================================================
const DB_NAME = 'MixedTTSCache';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db || typeof window === 'undefined' || !window.indexedDB) return;
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = () => resolve();
    });
  },
  async get(key) {
    try { await this.init(); if (!this.db) return null; } catch (e) { return null; }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result?.size > 100 ? req.result : null);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (!blob || blob.size < 100) return;
    try { await this.init(); if (!this.db) return; } catch (e) { return; }
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
  }
};

const inFlightRequests = new Map();

function useMixedTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null); // 'main' or 'sentence_xyz'
  const [isLoading, setIsLoading] = useState(false);
  
  // 播放器状态
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const audioObjRef = useRef(null);

  useEffect(() => {
    return () => stop();
  }, []);

  useEffect(() => {
    if (audioObjRef.current) audioObjRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const stop = useCallback(() => {
    if (audioObjRef.current) {
      audioObjRef.current.pause();
      audioObjRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlayingId(null);
    setCurrentTime(0);
  }, []);

  const fetchAudioBlob = async (text) => {
    // 自动检测语言：如果有缅文用缅文引擎，否则用中文多语言引擎
    const hasBurmese = /[\u1000-\u109F]/.test(text);
    const voice = hasBurmese ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-v2-${voice}-${text}`;
    
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey);

    const promise = (async () => {
      try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        const blob = await res.blob();
        if (blob.size > 100) idb.set(cacheKey, blob);
        return blob;
      } finally { inFlightRequests.delete(cacheKey); }
    })();
    inFlightRequests.set(cacheKey, promise);
    return promise;
  };

  const play = useCallback(async (text, uniqueId) => {
    // 如果点击同一个ID且正在播放，则暂停/继续
    if (playingId === uniqueId && audioObjRef.current) {
      if (audioObjRef.current.paused) {
        audioObjRef.current.play();
        setIsPlaying(true);
      } else {
        audioObjRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    stop();
    
    // 清理文本中的HTML标签和特殊符号
    const cleanText = String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').trim();
    if (!cleanText) return;

    setIsLoading(true);
    setPlayingId(uniqueId);

    try {
      const blob = await fetchAudioBlob(cleanText);
      const audioUrl = URL.createObjectURL(blob);

      const audio = new Audio(audioUrl);
      audioObjRef.current = audio;
      audio.playbackRate = playbackRate;
      
      audio.onloadedmetadata = () => setDuration(audio.duration);
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        setPlayingId(null);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onerror = () => { setIsLoading(false); setPlayingId(null); };

      await audio.play();
      setIsLoading(false);
    } catch (e) {
      console.error("Play failed", e);
      setIsLoading(false);
      setPlayingId(null);
    }
  }, [playbackRate, stop, playingId]);

  const seek = (time) => {
    if (audioObjRef.current) {
      audioObjRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return { 
    play, stop, isPlaying, playingId, isLoading, 
    duration, currentTime, seek, 
    playbackRate, setPlaybackRate 
  };
}

// =================================================================================
// ===== 2. 悬浮播放器 (只对主讲解显示完整控制) =====
// =================================================================================
const FloatingMusicPlayer = ({ 
  isPlaying, onToggle, duration, currentTime, onSeek, 
  playbackRate, onRateChange, playingType, isLoading 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // 如果没有播放任何东西，不显示
  if (!playingType && !isLoading) return null;

  // 如果是在播放例句，只显示精简模式
  const isMain = playingType === 'main'; 

  const formatTime = (t) => {
    if (!t || isNaN(t)) return "00:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const cycleSpeed = () => {
    const rates = [0.75, 1.0, 1.25, 1.5];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    onRateChange(next);
  };

  return (
    <motion.div
      drag dragMomentum={false} whileDrag={{ scale: 1.05 }}
      initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      style={{ position: 'fixed', bottom: '100px', right: '20px', zIndex: 100, touchAction: 'none' }}
    >
      <div style={{
        background: 'rgba(255, 255, 255, 0.90)', backdropFilter: 'blur(12px)',
        borderRadius: '20px', boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        padding: isExpanded ? '14px' : '8px',
        width: isExpanded ? (isMain ? '280px' : '200px') : '56px',
        height: isExpanded ? 'auto' : '56px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'width 0.3s, height 0.3s'
      }}>
        {!isExpanded ? (
          <div onClick={() => setIsExpanded(true)} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2563eb' }}>
            {isLoading ? <FaTimes className="spin" /> : <span className="music-bars-anim" />}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMain ? '10px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span className="music-bars-anim" style={{ transform: 'scale(0.8)' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>
                  {isMain ? "语法讲解中..." : "正在朗读..."}
                </span>
              </div>
              <div style={{display:'flex', gap: 8}}>
                 {isMain && (
                   <button onClick={cycleSpeed} style={{ border: 'none', background: '#f1f5f9', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer' }}>
                     {playbackRate}x
                   </button>
                 )}
                 <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                   <FaExpand size={12} />
                 </button>
              </div>
            </div>

            {/* 只有主讲解才显示进度条和播放按钮 */}
            {isMain && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                  <button onClick={onToggle} style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', background: '#2563eb', 
                      color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)', cursor: 'pointer' 
                    }}>
                    {isPlaying ? <FaPause /> : <FaPlay style={{marginLeft:2}}/>}
                  </button>
                </div>
                <div style={{ width: '100%' }}>
                  <input type="range" min="0" max={duration || 100} value={currentTime} onChange={(e) => onSeek(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer', height: '4px', borderRadius: '2px', accentColor: '#2563eb', marginBottom: '4px', display: 'block' }} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <style>{`
        .music-bars-anim { width: 16px; height: 16px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E"); background-size: cover; animation: bounce 1s infinite alternate; }
        @keyframes bounce { from { transform: scale(0.9); } to { transform: scale(1.1); } }
      `}</style>
    </motion.div>
  );
};

// =================================================================================
// ===== 3. 富文本渲染组件 (拼音、点击朗读、表格) =====
// =================================================================================

// 辅助：给中文加注音
const PinyinText = ({ text }) => {
  if (!text) return null;
  // 使用 pinyin-pro 生成 html 字符串 (<ruby>...)
  // pinyin-pro 处理非中文字符很智能，会保留原文
  const html = pinyinHtml(text, { toneType: 'symbol' });
  return <span className="pinyin-ruby" dangerouslySetInnerHTML={{ __html: html }} />;
};

// 可点击的行（例句）
const PlayableLine = ({ text, onPlay, isPlaying }) => {
  const cleanText = text.replace(/^[·•✅❌⚠️]\s*/, ''); // 去掉前面的符号用于朗读
  
  return (
    <div 
      onClick={() => onPlay(cleanText)}
      className={`playable-line ${isPlaying ? 'active' : ''}`}
      style={{ 
        cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', 
        transition: 'background 0.2s', display: 'inline-block', width: '100%' 
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
        <div style={{ color: isPlaying ? '#2563eb' : '#94a3b8', fontSize: '0.9em', transform: 'translateY(2px)' }}>
          {isPlaying ? <span className="music-bars-anim" style={{display:'inline-block', width:12, height:12}} /> : <FaVolumeUp />}
        </div>
        <div style={{ flex: 1, lineHeight: '1.8' }}>
          {/* 将整行文字传给 PinyinText 处理 */}
          <PinyinText text={text} />
        </div>
      </div>
    </div>
  );
};

// 渲染表格
const MarkdownTable = ({ rows }) => {
  return (
    <div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <tbody>
          {rows.map((row, rIndex) => (
            <tr key={rIndex} style={{ background: rIndex === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #f1f5f9' }}>
              {row.map((cell, cIndex) => (
                <td key={cIndex} style={{ padding: '10px 14px', borderRight: '1px solid #f1f5f9', color: rIndex === 0 ? '#475569' : '#1e293b', fontWeight: rIndex === 0 ? 'bold' : 'normal' }}>
                  <PinyinText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 聊天气泡
const ChatBubble = ({ role, text, onPlay, isPlaying }) => {
  const isMe = role === 'B';
  return (
    <div 
      onClick={() => onPlay(text)}
      style={{ 
        display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', 
        marginBottom: '24px', gap: '12px', alignItems: 'flex-end' 
      }}
    >
      <div style={{ 
        width: '36px', height: '36px', borderRadius: '50%', 
        background: isMe ? '#3b82f6' : '#f97316', color: 'white', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        fontWeight: 'bold', fontSize: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {role}
      </div>
      <div style={{ position: 'relative', maxWidth: '85%' }}>
        <div 
          className={isPlaying ? 'chat-playing' : ''}
          style={{
            background: isMe ? '#2563eb' : 'white',
            color: isMe ? 'white' : '#1e293b',
            padding: '14px 18px',
            borderRadius: '18px',
            borderBottomRightRadius: isMe ? '2px' : '18px', // 尾巴在下面
            borderBottomLeftRadius: isMe ? '18px' : '2px', // 尾巴在下面
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            fontSize: '15px', lineHeight: '1.6', cursor: 'pointer',
            border: isMe ? 'none' : '1px solid #e2e8f0'
          }}
        >
          <PinyinText text={text} />
        </div>
      </div>
    </div>
  );
};

// 核心：内容解析器 -> 转为 React 组件数组
const ContentRenderer = ({ content, playFunc, playingId }) => {
  const elements = useMemo(() => {
    if (!content) return [];
    
    const lines = content.split('\n');
    const result = [];
    let tableBuffer = [];
    let dialogueBuffer = []; // 用于对话分组
    let groupCount = 0;

    const flushTable = () => {
      if (tableBuffer.length > 0) {
        result.push({ type: 'table', rows: tableBuffer });
        tableBuffer = [];
      }
    };

    const flushDialogue = () => {
      if (dialogueBuffer.length > 0) {
        groupCount++;
        result.push({ type: 'dialogue_group', items: dialogueBuffer, groupId: groupCount });
        dialogueBuffer = [];
      }
    };

    lines.forEach((line, index) => {
      const trim = line.trim();
      
      // 1. 处理表格
      if (trim.startsWith('|') && trim.endsWith('|')) {
        flushDialogue(); // 表格打断对话
        const cells = trim.split('|').filter(c => c).map(c => c.trim());
        if (!trim.includes('---')) { // 忽略分割线
            tableBuffer.push(cells);
        }
        return;
      }
      flushTable(); // 遇到非表格行，渲染表格

      // 2. 处理对话 (A: / B:)
      const dialogueMatch = trim.match(/^([AB])[:：](.*)/);
      if (dialogueMatch) {
        dialogueBuffer.push({ role: dialogueMatch[1], text: dialogueMatch[2].trim(), id: `dia_${index}` });
        return;
      }
      
      // 如果遇到非空行且不是对话，说明对话结束（或者还没开始）
      if (trim !== '') {
        flushDialogue();
      }

      // 3. 处理空行
      if (trim === '') {
        // 不立即flush dialogue，允许空行存在于对话之间吗？
        // 你的需求是"区分几组对话"，通常用非空文字隔开。纯空行可以视为间距。
        result.push({ type: 'spacer' });
        return;
      }

      // 4. 处理带朗读的例句 (✅, ❌, ·, ◆)
      // 如果包含中文，且以特定符号开头，视为可朗读例句
      const isExample = /^[✅❌·•◆]/.test(trim);
      if (isExample) {
        result.push({ type: 'playable', text: trim, id: `line_${index}` });
      } else if (trim.startsWith('##')) {
        result.push({ type: 'h2', text: trim.replace(/^##\s*/, '') });
      } else if (trim.startsWith('⚠️')) {
        result.push({ type: 'warning', text: trim.substring(1) });
      } else {
        result.push({ type: 'text', text: trim });
      }
    });

    flushTable();
    flushDialogue(); // 最后可能还有对话

    return result;
  }, [content]);

  return (
    <div>
      {elements.map((el, i) => {
        switch (el.type) {
          case 'table':
            return <MarkdownTable key={i} rows={el.rows} />;
          case 'dialogue_group':
            return (
              <div key={i} style={{ margin: '30px 0', padding: '20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                  Conversation Group {el.groupId}
                </div>
                {el.items.map(d => (
                  <ChatBubble 
                    key={d.id} role={d.role} text={d.text} 
                    isPlaying={playingId === d.id} onPlay={(t) => playFunc(t, d.id)} 
                  />
                ))}
              </div>
            );
          case 'playable':
            return (
              <PlayableLine 
                key={i} text={el.text} 
                isPlaying={playingId === el.id} onPlay={(t) => playFunc(t, el.id)} 
              />
            );
          case 'h2':
            return <h2 key={i} style={{ fontSize: '1.2rem', color: '#334155', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px', marginTop: '32px', marginBottom: '16px' }}>{el.text}</h2>;
          case 'warning':
            return (
              <div key={i} style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '12px', borderRadius: '8px', margin: '12px 0', display: 'flex', gap: '8px', color: '#92400e' }}>
                <span>⚠️</span>
                <span><PinyinText text={el.text} /></span>
              </div>
            );
          case 'spacer':
            return <div key={i} style={{ height: '12px' }} />;
          default:
            return <p key={i} style={{ lineHeight: 1.7, color: '#475569', margin: '8px 0' }}><PinyinText text={el.text} /></p>;
        }
      })}
    </div>
  );
};


// =================================================================================
// ===== 4. 主组件 =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const contentRef = useRef(null);
  
  const { 
    play, stop, isPlaying, playingId, isLoading, 
    duration, currentTime, seek, playbackRate, setPlaybackRate 
  } = useMixedTTS();

  const currentGp = grammarPoints[currentIndex] || {};
  
  // 决定当前播放类型：'main' (讲解) 还是 'example' (例句)
  const playingType = playingId === 'main_narration' ? 'main' : (playingId ? 'example' : null);

  const transitions = useTransition(currentIndex, {
    key: currentGp.id || currentIndex,
    from: { opacity: 0, transform: 'translateX(100%)' },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, transform: 'translateX(-100%)', position: 'absolute' },
    config: { mass: 1, tension: 280, friction: 30 },
  });

  const handleNext = () => { stop(); setCurrentIndex(p => p < grammarPoints.length - 1 ? p + 1 : p); if(currentIndex === grammarPoints.length -1) onComplete(); };
  const handlePrev = () => { stop(); setCurrentIndex(p => p > 0 ? p - 1 : 0); };

  return (
    <div style={styles.container}>
      {/* 悬浮播放器 */}
      <FloatingMusicPlayer 
        isPlaying={isPlaying && playingType === 'main'}
        isLoading={isLoading}
        playingType={playingType} // 传入类型，决定样式
        onToggle={() => play(currentGp['讲解脚本'] || currentGp.grammarPoint, 'main_narration')}
        duration={duration} currentTime={currentTime} onSeek={seek}
        playbackRate={playbackRate} onRateChange={setPlaybackRate}
      />

      {transitions((style, i) => {
        const gp = grammarPoints[i];
        if (!gp) return null;
        
        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                {/* 标题与主讲解 */}
                <div style={styles.header}>
                  <h2 style={styles.title}>{gp['语法标题'] || gp.grammarPoint}</h2>
                  <button 
                    onClick={() => play(gp['讲解脚本'] || gp.grammarPoint, 'main_narration')}
                    style={{...styles.mainPlayBtn, background: playingId === 'main_narration' && isPlaying ? '#2563eb' : '#eff6ff', color: playingId === 'main_narration' && isPlaying ? 'white' : '#2563eb'}}
                  >
                    {playingId === 'main_narration' && isPlaying ? <FaPause /> : <FaPlay />} 
                    <span style={{marginLeft:8}}>听讲解 (Listen)</span>
                  </button>
                </div>

                {gp['句型结构'] && (
                  <div style={styles.patternBox}>
                    <div style={styles.patternLabel}>STRUCTURE</div>
                    <div style={styles.patternText}><PinyinText text={gp['句型结构']} /></div>
                  </div>
                )}

                {/* 内容渲染区 (自动拼音、点击朗读、表格、气泡) */}
                <ContentRenderer 
                   content={gp['语法详解'] || gp.visibleExplanation} 
                   playFunc={play}
                   playingId={playingId}
                />

                <div style={{ height: '140px' }}></div>
              </div>
            </div>

            <div style={styles.bottomBar}>
              <button onClick={handlePrev} disabled={i===0} style={{ ...styles.navBtn, opacity: i === 0 ? 0.3 : 1 }}>
                <FaChevronLeft /> Prev
              </button>
              <div style={styles.pageIndicator}>{i + 1} / {grammarPoints.length}</div>
              <button onClick={handleNext} style={{ ...styles.navBtn, background: '#2563eb', color: 'white' }}>
                {i === grammarPoints.length - 1 ? 'Finish' : 'Next'} <FaChevronRight />
              </button>
            </div>
          </animated.div>
        );
      })}

      {/* CSS: 拼音注音样式 + 动画 */}
      <style dangerouslySetInnerHTML={{__html: `
        ruby { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; ruby-align: center; }
        rt { font-size: 0.5em; color: #64748b; font-weight: normal; user-select: none; }
        .playable-line:hover { background: #f1f5f9; }
        .playable-line.active { background: #eff6ff; }
        .chat-playing { border: 2px solid #60a5fa !important; background: #eff6ff !important; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

const styles = {
  container: { position: 'relative', width: '100%', height: '100%', background: '#fff', overflow: 'hidden' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' },
  scrollContainer: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  contentWrapper: { maxWidth: '800px', margin: '0 auto', padding: '24px 20px' },
  header: { textAlign: 'center', marginBottom: '32px' },
  title: { fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', marginBottom: '16px' },
  mainPlayBtn: { display: 'inline-flex', alignItems: 'center', padding: '10px 24px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  patternBox: { background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '32px', textAlign: 'center' },
  patternLabel: { fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '12px' },
  patternText: { fontSize: '1.5rem', color: '#2563eb', fontWeight: 'bold', lineHeight: 1.4 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 10 },
  navBtn: { border: 'none', background: '#f1f5f9', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' },
  pageIndicator: { fontSize: '14px', fontWeight: '600', color: '#94a3b8' }
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array.isRequired,
  onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
