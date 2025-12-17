import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { html as pinyinHtml } from 'pinyin-pro'; 
import { 
  FaPlay, FaPause, FaTimes, FaChevronLeft, FaChevronRight, 
  FaExpand, FaVolumeUp, FaImage, FaVideo, FaListUl 
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
  const [playingId, setPlayingId] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  
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
    const hasBurmese = /[\u1000-\u109F]/.test(text);
    const voice = hasBurmese ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-v3-${voice}-${text}`; // v3 cache key
    
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
    
    // 清理 Markdown 标记用于朗读
    const cleanText = String(text)
      .replace(/<[^>]+>/g, '')
      .replace(/\*\*/g, '') // remove bold
      .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
      .replace(/\[VIDEO\]\(.*?\)/g, '') // remove videos
      .replace(/^[#\-\s✅❌⚠️·•]+/, '') // remove bullet points headers
      .trim();

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

  if (!playingType && !isLoading) return null;

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
      style={{ 
        position: 'fixed', 
        bottom: '120px', // 提高位置，避免遮挡底部导航
        right: '20px', 
        zIndex: 100, 
        touchAction: 'none' 
      }}
    >
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)',
        borderRadius: '24px', boxShadow: '0 10px 40px rgba(30, 41, 59, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        padding: isExpanded ? '16px' : '10px',
        width: isExpanded ? (isMain ? '290px' : '220px') : '60px',
        height: isExpanded ? 'auto' : '60px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.3s'
      }}>
        {!isExpanded ? (
          <div onClick={() => setIsExpanded(true)} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6366f1' }}>
            {isLoading ? <FaTimes className="spin" /> : <span className="music-bars-anim" />}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMain ? '12px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <span className="music-bars-anim" style={{ transform: 'scale(0.8)' }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                  {isMain ? "语法讲解中" : "正在朗读..."}
                </span>
              </div>
              <div style={{display:'flex', gap: 8}}>
                 {isMain && (
                   <button onClick={cycleSpeed} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', transition:'background 0.2s' }}>
                     {playbackRate}x
                   </button>
                 )}
                 <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
                   <FaExpand size={12} />
                 </button>
              </div>
            </div>

            {isMain && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <button onClick={onToggle} style={{ 
                      width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', 
                      color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      boxShadow: '0 6px 15px rgba(99, 102, 241, 0.4)', cursor: 'pointer', fontSize: '16px'
                    }}>
                    {isPlaying ? <FaPause /> : <FaPlay style={{marginLeft:3}}/>}
                  </button>
                </div>
                <div style={{ width: '100%' }}>
                  <input type="range" min="0" max={duration || 100} value={currentTime} onChange={(e) => onSeek(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer', height: '4px', borderRadius: '2px', accentColor: '#6366f1', marginBottom: '6px', display: 'block' }} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>
                    <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <style>{`
        .music-bars-anim { width: 16px; height: 16px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E"); background-size: cover; animation: bounce 1s infinite alternate; }
        @keyframes bounce { from { transform: scale(0.9); } to { transform: scale(1.1); } }
      `}</style>
    </motion.div>
  );
};

// =================================================================================
// ===== 3. 富文本渲染组件 (支持加粗、多层级、媒体) =====
// =================================================================================

// 核心：支持加粗的拼音渲染
const RichPinyinText = ({ text }) => {
  if (!text) return null;
  
  // 1. 分割加粗语法 **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          const html = pinyinHtml(content, { toneType: 'symbol' });
          return <strong key={index} className="rich-bold" dangerouslySetInnerHTML={{ __html: html }} />;
        } else {
          const html = pinyinHtml(part, { toneType: 'symbol' });
          return <span key={index} className="pinyin-ruby" dangerouslySetInnerHTML={{ __html: html }} />;
        }
      })}
    </span>
  );
};

// 媒体组件：图片
const ImageViewer = ({ src, alt }) => (
  <div style={{ margin: '16px 0', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
    <img src={src} alt={alt} style={{ width: '100%', height: 'auto', display: 'block' }} loading="lazy" />
    {alt && <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#64748b', background: '#f1f5f9', display:'flex', alignItems:'center', gap:6 }}><FaImage /> {alt}</div>}
  </div>
);

// 媒体组件：视频 (简单链接或嵌入)
const VideoPlayer = ({ src }) => (
  <div style={{ margin: '16px 0', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#000' }}>
    <video controls src={src} style={{ width: '100%', height: 'auto', display: 'block' }} />
    <div style={{ padding: '8px', color: '#94a3b8', fontSize: '0.8rem', background: '#1e293b', display:'flex', alignItems:'center', gap:6 }}><FaVideo /> Video Playback</div>
  </div>
);

// 列表项 (支持缩进)
const ListItem = ({ text, level = 0 }) => (
  <div style={{ display: 'flex', gap: '10px', marginLeft: `${level * 20}px`, marginBottom: '8px', alignItems: 'flex-start' }}>
    <span style={{ color: '#6366f1', marginTop: '6px', fontSize: '0.8rem' }}><FaListUl /></span>
    <div style={{ flex: 1, lineHeight: '1.7' }}>
      <RichPinyinText text={text} />
    </div>
  </div>
);

// 可点击的行（例句）
const PlayableLine = ({ text, onPlay, isPlaying }) => {
  const cleanText = text.replace(/^[·•✅❌⚠️]\s*/, ''); 
  
  return (
    <div 
      onClick={() => onPlay(cleanText)}
      className={`playable-line ${isPlaying ? 'active' : ''}`}
      style={{ 
        cursor: 'pointer', padding: '10px 14px', borderRadius: '12px', 
        transition: 'all 0.2s ease', display: 'block', width: '100%',
        margin: '6px 0', border: '1px solid transparent'
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ color: isPlaying ? '#6366f1' : '#cbd5e1', fontSize: '1rem', marginTop: '4px' }}>
          {isPlaying ? <span className="music-bars-anim" style={{display:'inline-block', width:14, height:14}} /> : <FaVolumeUp />}
        </div>
        <div style={{ flex: 1, lineHeight: '1.8', fontSize: '1.05rem', color: '#334155' }}>
          <RichPinyinText text={text} />
        </div>
      </div>
    </div>
  );
};

// 渲染表格
const MarkdownTable = ({ rows }) => {
  return (
    <div style={{ overflowX: 'auto', margin: '20px 0', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
        <tbody>
          {rows.map((row, rIndex) => (
            <tr key={rIndex} style={{ background: rIndex === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #f1f5f9' }}>
              {row.map((cell, cIndex) => (
                <td key={cIndex} style={{ 
                  padding: '12px 16px', borderRight: '1px solid #f1f5f9', 
                  color: rIndex === 0 ? '#475569' : '#1e293b', 
                  fontWeight: rIndex === 0 ? '700' : 'normal',
                  minWidth: '80px'
                }}>
                  <RichPinyinText text={cell} />
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
        marginBottom: '20px', gap: '12px', alignItems: 'flex-end' 
      }}
    >
      <div style={{ 
        width: '40px', height: '40px', borderRadius: '50%', 
        background: isMe ? '#6366f1' : '#f97316', color: 'white', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        {role}
      </div>
      <div style={{ position: 'relative', maxWidth: '82%' }}>
        <div 
          className={isPlaying ? 'chat-playing' : ''}
          style={{
            background: isMe ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'white',
            color: isMe ? 'white' : '#1e293b',
            padding: '12px 18px',
            borderRadius: '20px',
            borderBottomRightRadius: isMe ? '4px' : '20px',
            borderBottomLeftRadius: isMe ? '20px' : '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            fontSize: '1.05rem', lineHeight: '1.6', cursor: 'pointer',
            border: isMe ? 'none' : '1px solid #f1f5f9'
          }}
        >
          {/* 这里加个简单的白字处理，因为 RichPinyinText 生成的 ruby rt 默认是灰色 */}
          <div className={isMe ? 'white-ruby' : ''}>
            <RichPinyinText text={text} />
          </div>
        </div>
      </div>
    </div>
  );
};

// 内容解析器
const ContentRenderer = ({ content, playFunc, playingId }) => {
  const elements = useMemo(() => {
    if (!content) return [];
    
    const lines = content.split('\n');
    const result = [];
    let tableBuffer = [];
    let dialogueBuffer = [];
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
      
      // 表格检测
      if (trim.startsWith('|') && trim.endsWith('|')) {
        flushDialogue();
        const cells = trim.split('|').filter(c => c).map(c => c.trim());
        if (!trim.includes('---')) tableBuffer.push(cells);
        return;
      }
      flushTable();

      // 对话检测
      const dialogueMatch = trim.match(/^([AB])[:：](.*)/);
      if (dialogueMatch) {
        dialogueBuffer.push({ role: dialogueMatch[1], text: dialogueMatch[2].trim(), id: `dia_${index}` });
        return;
      }
      if (trim !== '') flushDialogue();

      // 空行
      if (trim === '') {
        result.push({ type: 'spacer' });
        return;
      }

      // 标题 (Heading)
      const headerMatch = trim.match(/^(#{1,6})\s+(.*)/);
      if (headerMatch) {
        result.push({ type: 'heading', level: headerMatch[1].length, text: headerMatch[2] });
        return;
      }

      // 图片 ![alt](src)
      const imgMatch = trim.match(/^!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) {
        result.push({ type: 'image', alt: imgMatch[1], src: imgMatch[2] });
        return;
      }

      // 视频 [VIDEO](src)
      const vidMatch = trim.match(/^\[VIDEO\]\((.*?)\)/);
      if (vidMatch) {
        result.push({ type: 'video', src: vidMatch[1] });
        return;
      }

      // 列表 (多级缩进检测)
      const listMatch = line.match(/^(\s*)([-*])\s+(.*)/);
      if (listMatch) {
        const indent = listMatch[1].length; // 空格数量
        // 假设2空格或1tab为一级，粗略计算
        const level = Math.floor(indent / 2);
        result.push({ type: 'list', text: listMatch[3], level });
        return;
      }

      // 可朗读例句
      if (/^[✅❌·•◆]/.test(trim)) {
        result.push({ type: 'playable', text: trim, id: `line_${index}` });
      } else if (trim.startsWith('⚠️')) {
        result.push({ type: 'warning', text: trim.substring(1) });
      } else {
        result.push({ type: 'text', text: trim });
      }
    });

    flushTable();
    flushDialogue();
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
              <div key={i} style={{ margin: '32px 0', padding: '24px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>
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
            return <PlayableLine key={i} text={el.text} isPlaying={playingId === el.id} onPlay={(t) => playFunc(t, el.id)} />;
          case 'heading':
            const fontSize = el.level === 1 ? '1.8rem' : el.level === 2 ? '1.5rem' : '1.2rem';
            const marginTop = el.level === 1 ? '32px' : '24px';
            return <div key={i} style={{ fontSize, fontWeight: '800', color: '#1e293b', marginTop, marginBottom: '16px', lineHeight: 1.3 }}><RichPinyinText text={el.text} /></div>;
          case 'image':
            return <ImageViewer key={i} src={el.src} alt={el.alt} />;
          case 'video':
            return <VideoPlayer key={i} src={el.src} />;
          case 'list':
            return <ListItem key={i} text={el.text} level={el.level} />;
          case 'warning':
            return (
              <div key={i} style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '0 8px 8px 0', margin: '16px 0', display: 'flex', gap: '12px', color: '#92400e', alignItems:'center' }}>
                <span style={{fontSize:'1.2rem'}}>⚠️</span>
                <span style={{lineHeight: 1.6}}><RichPinyinText text={el.text} /></span>
              </div>
            );
          case 'spacer':
            return <div key={i} style={{ height: '16px' }} />;
          default:
            return <p key={i} style={{ lineHeight: 1.8, fontSize: '1.05rem', color: '#475569', margin: '10px 0' }}><RichPinyinText text={el.text} /></p>;
        }
      })}
    </div>
  );
};


// =================================================================================
// ===== 4. 主组件 (布局逻辑 - 修复移动端地址栏遮挡) =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const contentRef = useRef(null);
  
  const { 
    play, stop, isPlaying, playingId, isLoading, 
    duration, currentTime, seek, playbackRate, setPlaybackRate 
  } = useMixedTTS();

  const currentGp = grammarPoints[currentIndex] || {};
  const playingType = playingId === 'main_narration' ? 'main' : (playingId ? 'example' : null);

  const transitions = useTransition(currentIndex, {
    key: currentGp.id || currentIndex,
    from: { opacity: 0, transform: 'translateX(60px)' },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, transform: 'translateX(-60px)', position: 'absolute' },
    config: { tension: 280, friction: 30 },
  });

  const handleNext = () => { stop(); setCurrentIndex(p => p < grammarPoints.length - 1 ? p + 1 : p); if(currentIndex === grammarPoints.length -1) onComplete(); };
  const handlePrev = () => { stop(); setCurrentIndex(p => p > 0 ? p - 1 : 0); };

  // 回到顶部
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex]);

  return (
    <div style={styles.container}>
      
      {/* 悬浮播放器 */}
      <FloatingMusicPlayer 
        isPlaying={isPlaying && playingType === 'main'}
        isLoading={isLoading}
        playingType={playingType} 
        onToggle={() => play(currentGp['讲解脚本'] || currentGp.grammarPoint, 'main_narration')}
        duration={duration} currentTime={currentTime} onSeek={seek}
        playbackRate={playbackRate} onRateChange={setPlaybackRate}
      />

      {/* 页面过渡区域 */}
      <div style={styles.transitionWrapper}>
        {transitions((style, i) => {
          const gp = grammarPoints[i];
          if (!gp) return null;
          
          return (
            <animated.div style={{ ...styles.page, ...style }}>
              
              {/* 核心内容滚动区 */}
              <div style={styles.scrollContainer} ref={contentRef}>
                <div style={styles.contentWrapper}>
                  
                  {/* 顶部标题区 */}
                  <div style={styles.header}>
                    <div style={styles.tag}>Grammar Point {i + 1}</div>
                    <h2 style={styles.title}>{gp['语法标题'] || gp.grammarPoint}</h2>
                    <button 
                      onClick={() => play(gp['讲解脚本'] || gp.grammarPoint, 'main_narration')}
                      style={{
                        ...styles.mainPlayBtn, 
                        background: playingId === 'main_narration' && isPlaying ? '#6366f1' : '#e0e7ff', 
                        color: playingId === 'main_narration' && isPlaying ? 'white' : '#4338ca',
                        transform: playingId === 'main_narration' && isPlaying ? 'scale(1.05)' : 'scale(1)'
                      }}
                    >
                      {playingId === 'main_narration' && isPlaying ? <FaPause /> : <FaPlay />} 
                      <span style={{marginLeft:8}}>听老师讲解</span>
                    </button>
                  </div>

                  {/* 句型结构卡片 */}
                  {gp['句型结构'] && (
                    <div style={styles.patternBox}>
                      <div style={styles.patternLabel}>STRUCTURE / 句型结构</div>
                      <div style={styles.patternText}><RichPinyinText text={gp['句型结构']} /></div>
                    </div>
                  )}

                  {/* 动态内容渲染 */}
                  <ContentRenderer 
                     content={gp['语法详解'] || gp.visibleExplanation} 
                     playFunc={play}
                     playingId={playingId}
                  />

                  {/* 底部留白，防止内容被导航栏遮挡 */}
                  <div style={{ height: '140px' }}></div>
                </div>
              </div>

            </animated.div>
          );
        })}
      </div>

      {/* 固定底部导航栏 (Padding safe area) */}
      <div style={styles.bottomBar}>
        <button onClick={handlePrev} disabled={currentIndex === 0} style={{ ...styles.navBtn, opacity: currentIndex === 0 ? 0.4 : 1 }}>
          <FaChevronLeft /> Prev
        </button>
        <div style={styles.pageIndicator}>
          <span style={{color: '#6366f1', fontSize: '1.2rem'}}>{currentIndex + 1}</span> 
          <span style={{opacity: 0.4, margin: '0 4px'}}>/</span> 
          {grammarPoints.length}
        </div>
        <button onClick={handleNext} style={{ ...styles.navBtn, background: '#6366f1', color: 'white', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
          {currentIndex === grammarPoints.length - 1 ? 'Done' : 'Next'} <FaChevronRight />
        </button>
      </div>

      {/* 全局样式注入 */}
      <style dangerouslySetInnerHTML={{__html: `
        ruby { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; ruby-align: center; }
        rt { font-size: 0.55em; color: #94a3b8; font-weight: normal; user-select: none; transform: translateY(-2px); }
        .white-ruby rt { color: rgba(255,255,255,0.8); }
        .playable-line:hover { background: #f1f5f9; border-color: #e2e8f0 !important; }
        .playable-line.active { background: #eef2ff; border-color: #c7d2fe !important; }
        .chat-playing { border: 2px solid #818cf8 !important; background: linear-gradient(135deg, #4f46e5, #4338ca) !important; box-shadow: 0 8px 20px rgba(99,102,241,0.3) !important; }
        .rich-bold { color: #0f172a; font-weight: 800; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        /* 隐藏滚动条但保留功能 */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}} />
    </div>
  );
};

// =================================================================================
// ===== 5. 样式系统 (支持 dvh 和 safe-area) =====
// =================================================================================
const styles = {
  // 使用 dvh (Dynamic Viewport Height) 解决移动端地址栏问题
  container: { 
    position: 'absolute', 
    inset: 0, 
    height: '100dvh', // 关键 fix
    background: '#f8fafc', 
    display: 'flex', 
    flexDirection: 'column',
    overflow: 'hidden'
  },
  transitionWrapper: {
    position: 'relative',
    flex: 1, // 占据剩余空间
    width: '100%',
    overflow: 'hidden' // 确保动画不溢出
  },
  page: { 
    position: 'absolute', 
    inset: 0, 
    display: 'flex', 
    flexDirection: 'column', 
    background: '#fff',
    width: '100%',
    height: '100%'
  },
  scrollContainer: { 
    flex: 1, 
    overflowY: 'auto', 
    WebkitOverflowScrolling: 'touch',
    scrollBehavior: 'smooth',
    paddingBottom: '20px' 
  },
  contentWrapper: { 
    maxWidth: '800px', 
    margin: '0 auto', 
    padding: '32px 24px' 
  },
  header: { 
    textAlign: 'center', 
    marginBottom: '40px' 
  },
  tag: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '20px',
    background: '#f1f5f9',
    color: '#64748b',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    marginBottom: '12px'
  },
  title: { 
    fontSize: '2rem', 
    fontWeight: '800', 
    color: '#1e293b', 
    marginBottom: '20px',
    lineHeight: 1.2
  },
  mainPlayBtn: { 
    display: 'inline-flex', 
    alignItems: 'center', 
    padding: '12px 28px', 
    borderRadius: '50px', 
    border: 'none', 
    fontWeight: '700', 
    cursor: 'pointer', 
    fontSize: '15px', 
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' 
  },
  patternBox: { 
    background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)', 
    padding: '28px', 
    borderRadius: '24px', 
    border: '1px solid #e2e8f0', 
    marginBottom: '40px', 
    textAlign: 'center',
    boxShadow: '0 4px 20px -5px rgba(0,0,0,0.03)'
  },
  patternLabel: { 
    fontSize: '0.7rem', 
    color: '#94a3b8', 
    fontWeight: '800', 
    letterSpacing: '1.5px', 
    marginBottom: '14px',
    textTransform: 'uppercase'
  },
  patternText: { 
    fontSize: '1.6rem', 
    color: '#4f46e5', 
    fontWeight: '700', 
    lineHeight: 1.4 
  },
  // 底部导航栏：包含安全区域 padding
  bottomBar: { 
    height: 'auto',
    minHeight: '80px', 
    background: 'rgba(255,255,255,0.92)', 
    backdropFilter: 'blur(12px)', 
    borderTop: '1px solid #e2e8f0', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: '16px 24px', 
    // 适配 iPhone X 等底部横条
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', 
    zIndex: 50,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.02)'
  },
  navBtn: { 
    border: 'none', 
    background: '#f1f5f9', 
    padding: '12px 24px', 
    borderRadius: '16px', 
    fontSize: '15px', 
    fontWeight: '700', 
    color: '#475569', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    cursor: 'pointer', 
    transition: 'transform 0.1s' 
  },
  pageIndicator: { 
    fontSize: '15px', 
    fontWeight: '800', 
    color: '#94a3b8',
    fontFamily: 'monospace'
  }
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array.isRequired,
  onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
