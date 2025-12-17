import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { html as pinyinHtml } from 'pinyin-pro'; 
import { 
  FaPlay, FaPause, FaTimes, FaChevronLeft, FaChevronRight, FaExpand, FaVolumeUp, FaSpinner
} from 'react-icons/fa';
import { motion } from 'framer-motion';

// =================================================================================
// ===== 1. IndexedDB 工具 (旧代码的稳定版) =====
// =================================================================================
const DB_NAME = 'MixedTTSCache';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    try { await this.init(); } catch (e) { return null; }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result?.size > 100 ? req.result : null);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (!blob || blob.size < 100) return;
    try { await this.init(); } catch (e) { return; }
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
  }
};

const inFlightRequests = new Map();

// =================================================================================
// ===== 2. 混合 TTS Hook (FIX: 使用旧代码的强大内核) =====
// =================================================================================
function useMixedTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  const audioQueueRef = useRef([]);
  const currentAudioRef = useRef(null);
  const createdObjectURLsRef = useRef(new Set());
  const latestRequestIdRef = useRef(0);
  const playingIdRef = useRef(null);

  useEffect(() => {
    return () => {
      stop();
      createdObjectURLsRef.current.forEach(url => URL.revokeObjectURL(url));
      createdObjectURLsRef.current.clear();
    };
  }, []);

  const stop = useCallback(() => {
    latestRequestIdRef.current++;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    audioQueueRef.current.forEach(a => a.pause());
    audioQueueRef.current = [];
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    setIsPlaying(false);
    setIsPaused(false);
    setPlayingId(null);
    playingIdRef.current = null;
    setLoadingId(null);
  }, []);
  
  const toggle = useCallback(() => {
    if (currentAudioRef.current) {
        if (currentAudioRef.current.paused) {
            currentAudioRef.current.play().catch(e => console.error('Resume failed', e));
            setIsPaused(false);
        } else {
            currentAudioRef.current.pause();
            setIsPaused(true);
        }
    } else if (window.speechSynthesis?.speaking) {
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            setIsPaused(false);
        } else {
            window.speechSynthesis.pause();
            setIsPaused(true);
        }
    }
  }, []);

  const fetchAudioBlob = async (text, lang) => {
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-blob-${voice}-${text}`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;
    if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey);

    const promise = (async () => {
      try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TTS Fetch Failed: ${res.status}`);
        const blob = await res.blob();
        if (!blob || blob.size < 100) throw new Error('TTS Response too small');
        idb.set(cacheKey, blob);
        return blob;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();
    inFlightRequests.set(cacheKey, promise);
    return promise;
  };

  const play = useCallback(async (text, uniqueId) => {
    if (playingIdRef.current === uniqueId) {
      toggle();
      return;
    }
    stop();
    setLoadingId(uniqueId);
    const myRequestId = ++latestRequestIdRef.current;
    
    let cleanText = String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').trim();
    if (!cleanText) {
      setLoadingId(null);
      return;
    }

    try {
      const segments = [];
      const hasBurmese = /[\u1000-\u109F]/.test(cleanText);

      if (!hasBurmese) {
        segments.push({ text: cleanText, lang: 'zh' });
      } else {
        const regex = /([\u1000-\u109F]+)|([^\u1000-\u109F]+)/g;
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
          const chunk = match[0].trim();
          if (chunk) {
            segments.push({ text: chunk, lang: /[\u1000-\u109F]/.test(chunk) ? 'my' : 'zh' });
          }
        }
      }

      const blobs = await Promise.all(segments.map(seg => fetchAudioBlob(seg.text, seg.lang)));
      if (myRequestId !== latestRequestIdRef.current) return;

      const audioObjects = blobs.map(blob => {
        const objectURL = URL.createObjectURL(blob);
        createdObjectURLsRef.current.add(objectURL);
        return new Audio(objectURL);
      });

      audioQueueRef.current = audioObjects;
      setLoadingId(null);
      setPlayingId(uniqueId);
      playingIdRef.current = uniqueId;
      setIsPlaying(true);
      setIsPaused(false);

      const playNext = (index) => {
        if (myRequestId !== latestRequestIdRef.current || index >= audioObjects.length) {
          stop();
          return;
        }
        const audio = audioObjects[index];
        currentAudioRef.current = audio;
        audio.onended = () => playNext(index + 1);
        audio.onerror = () => playNext(index + 1);
        audio.play().catch(() => playNext(index + 1));
      };
      playNext(0);

    } catch (e) {
      console.warn('Cloud TTS failed, fallback might be needed:', e);
      if (myRequestId === latestRequestIdRef.current) stop();
    }
  }, [stop, toggle]);

  return { play, stop, isPlaying, isPaused, playingId, loadingId: loadingId };
}

// =================================================================================
// ===== 3. 悬浮播放器 (MODIFIED: 简化以适配新逻辑) =====
// =================================================================================
const FloatingMusicPlayer = ({ 
  isPlaying, onToggle, onStop, playingType, isLoading 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!playingType && !isLoading) return null;
  const isMain = playingType === 'main'; 
  const avatarUrl = "https://api.dicebear.com/9.x/notionists/svg?seed=Teacher";
  
  return (
    <motion.div
      drag dragMomentum={false} whileDrag={{ scale: 1.05 }}
      initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      style={{ position: 'fixed', bottom: '110px', right: '20px', zIndex: 100, touchAction: 'none' }}
    >
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)',
        borderRadius: '24px', boxShadow: '0 8px 32px rgba(31, 38, 135, 0.12)',
        border: '1px solid white', padding: isExpanded ? '16px' : '6px',
        width: isExpanded ? (isMain ? '220px' : '200px') : '56px',
        height: isExpanded ? 'auto' : '56px', display: 'flex', 
        flexDirection: 'column', overflow: 'hidden', transition: 'all 0.3s'
      }}>
        {!isExpanded ? (
          <div onClick={() => setIsExpanded(true)} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
             {isLoading ? <FaSpinner className="spin" color="#64748b"/> : <img src={avatarUrl} alt="Avatar" style={{width: 40, height: 40, borderRadius: '50%'}} />}
             {isPlaying && <div style={{position:'absolute', bottom:0, right:0, width:12, height:12, background:'#22c55e', borderRadius:'50%', border:'2px solid white'}}></div>}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <img src={avatarUrl} alt="Teacher" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0f2fe' }} />
                  {isPlaying && <div className="speaking-wave" style={{position:'absolute', bottom:-2, right:-2}}></div>}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>{isMain ? "语法讲解" : "朗读中..."}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{isLoading ? '加载中...' : (isPlaying ? '正在播放' : '已暂停')}</div>
                </div>
              </div>
              <button onClick={() => setIsExpanded(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: 4 }}><FaExpand size={12} /></button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', gap: '16px' }}>
               <button onClick={onToggle} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.4)' }}>
                {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} style={{marginLeft:2}}/>}
              </button>
               <button onClick={onStop} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', color: '#64748b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaTimes size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

// =================================================================================
// ===== 4. 内容渲染组件 (保持不变) =====
// =================================================================================
const PinyinText = ({ text }) => {
  if (!text) return null;
  const html = pinyinHtml(text, { toneType: 'symbol' });
  return <span className="pinyin-ruby" dangerouslySetInnerHTML={{ __html: html }} />;
};

const PlayableLine = ({ text, onPlay, isPlaying, type }) => {
  const cleanText = text.replace(/^[·•✅❌⚠️]\s*/, '');
  const isCorrect = type === 'example_correct';
  const isWrong = type === 'example_wrong';
  let bgStyle = { background: 'transparent', borderLeft: '3px solid transparent' };
  let textStyle = { color: '#475569' };
  if (isCorrect) { bgStyle = { background: '#f0fdf4', borderLeft: '3px solid #22c55e' }; textStyle = { color: '#15803d' }; } 
  else if (isWrong) { bgStyle = { background: '#fef2f2', borderLeft: '3px solid #ef4444' }; textStyle = { color: '#b91c1c' }; } 
  else { bgStyle = { background: '#f8fafc', borderLeft: '3px solid #e2e8f0' }; }

  return (
    <div onClick={() => onPlay(cleanText)} className={`playable-line ${isPlaying ? 'active' : ''}`} style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', marginBottom: 8, marginLeft: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px', transition: 'all 0.2s', ...bgStyle }}>
      <div style={{ color: isPlaying ? '#2563eb' : '#cbd5e1', fontSize: '0.9em', marginTop: '4px' }}>
        {isPlaying ? <span className="music-bars-anim" style={{display:'inline-block', width:14, height:14}} /> : <FaVolumeUp />}
      </div>
      <div style={{ flex: 1, lineHeight: '1.6', fontSize: '0.95rem', ...textStyle }}>
        <PinyinText text={text} />
      </div>
    </div>
  );
};

const KeyPoint = ({ text }) => (<div style={{ fontWeight: '700', color: '#334155', fontSize: '1rem', marginBottom: '8px', marginTop: '12px', display: 'flex', alignItems: 'center' }}><div style={{width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', marginRight: 8}}></div><PinyinText text={text.replace(/^[·•]\s*/, '')} /></div>);
const WarningBox = ({ text }) => (<div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px 16px', borderRadius: '8px', margin: '12px 0 12px 16px', display: 'flex', gap: '10px', color: '#b45309', fontSize: '0.95rem' }}><span>⚠️</span><div><PinyinText text={text.substring(1).trim()} /></div></div>);
const MarkdownTable = ({ rows }) => (<div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: '8px', border: '1px solid #e2e8f0' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}><tbody>{rows.map((row, rIndex) => (<tr key={rIndex} style={{ background: rIndex === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #f1f5f9' }}>{row.map((cell, cIndex) => (<td key={cIndex} style={{ padding: '10px 14px', borderRight: '1px solid #f1f5f9', color: rIndex === 0 ? '#475569' : '#1e293b', fontWeight: rIndex === 0 ? '700' : 'normal' }}><PinyinText text={cell} /></td>))}</tr>))}</tbody></table></div>);
const ChatBubble = ({ role, text, onPlay, isPlaying }) => {
  const isMe = role === 'B';
  return ( <div onClick={() => onPlay(text)} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: '20px', gap: '10px', alignItems: 'flex-end' }}><div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isMe ? '#3b82f6' : '#f97316', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>{role}</div><div className={isPlaying ? 'chat-playing' : ''} style={{ background: isMe ? '#2563eb' : '#fff', color: isMe ? '#fff' : '#1e293b', padding: '12px 16px', borderRadius: '16px', borderBottomRightRadius: isMe ? '2px' : '16px', borderBottomLeftRadius: isMe ? '16px' : '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: isMe ? 'none' : '1px solid #e2e8f0', cursor: 'pointer', maxWidth: '85%' }}><PinyinText text={text} /></div></div> );
};

const ContentRenderer = ({ content, playFunc, playingId }) => {
  const elements = useMemo(() => {
    if (!content) return [];
    const lines = content.split('\n');
    const result = []; let tableBuffer = []; let dialogueBuffer = []; let groupCount = 0;
    const flushTable = () => { if (tableBuffer.length > 0) { result.push({ type: 'table', rows: tableBuffer }); tableBuffer = []; } };
    const flushDialogue = () => { if (dialogueBuffer.length > 0) { groupCount++; result.push({ type: 'dialogue_group', items: dialogueBuffer, groupId: groupCount }); dialogueBuffer = []; } };
    lines.forEach((line, index) => {
      const trim = line.trim();
      if (trim.startsWith('|') && trim.endsWith('|')) { flushDialogue(); const cells = trim.split('|').filter(c => c).map(c => c.trim()); if (!trim.includes('---')) tableBuffer.push(cells); return; }
      flushTable();
      const dialogueMatch = trim.match(/^([AB])[:：](.*)/);
      if (dialogueMatch) { dialogueBuffer.push({ role: dialogueMatch[1], text: dialogueMatch[2].trim(), id: `dia_${index}` }); return; }
      if (trim !== '') flushDialogue();
      if (trim === '') { result.push({ type: 'spacer' }); return; }
      if (trim.startsWith('✅')) { result.push({ type: 'example_correct', text: trim, id: `line_${index}` }); } 
      else if (trim.startsWith('❌')) { result.push({ type: 'example_wrong', text: trim, id: `line_${index}` }); } 
      else if (trim.startsWith('·') || trim.startsWith('•')) { result.push({ type: 'key_point', text: trim }); } 
      else if (trim.startsWith('##')) { result.push({ type: 'h2', text: trim.replace(/^##\s*/, '') }); } 
      else if (trim.startsWith('⚠️')) { result.push({ type: 'warning', text: trim }); } 
      else if (trim.startsWith('◆')) { result.push({ type: 'key_point', text: trim.replace(/^◆\s*/, '') }); } 
      else { result.push({ type: 'text', text: trim }); }
    });
    flushTable(); flushDialogue();
    return result;
  }, [content]);
  return (<div>{elements.map((el, i) => { switch (el.type) { case 'table': return <MarkdownTable key={i} rows={el.rows} />; case 'dialogue_group': return <div key={i} style={{ margin: '24px 0', padding: '20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>{el.items.map(d => <ChatBubble key={d.id} role={d.role} text={d.text} isPlaying={playingId === d.id} onPlay={(t) => playFunc(t, d.id)} />)}</div>; case 'example_correct': case 'example_wrong': case 'playable': return <PlayableLine key={i} text={el.text} type={el.type} isPlaying={playingId === el.id} onPlay={(t) => playFunc(t, el.id)} />; case 'key_point': return <KeyPoint key={i} text={el.text} />; case 'h2': return <h2 key={i} style={{ fontSize: '1.2rem', color: '#1e293b', fontWeight: '800', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px', marginTop: '32px', marginBottom: '16px' }}>{el.text}</h2>; case 'warning': return <WarningBox key={i} text={el.text} />; case 'spacer': return <div key={i} style={{ height: '12px' }} />; default: return <p key={i} style={{ lineHeight: 1.7, color: '#475569', margin: '8px 0' }}><PinyinText text={el.text} /></p>; } })}</div>);
};

// =================================================================================
// ===== 5. 主组件 (MODIFIED: 使用新Hook) =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const contentRef = useRef(null);
  
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('gp-styles')) {
      const style = document.createElement('style'); style.id = 'gp-styles';
      style.innerHTML = `ruby { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; ruby-align: center; } rt { font-size: 0.5em; color: #94a3b8; font-weight: normal; user-select: none; } .playable-line:hover { opacity: 0.9; } .playable-line.active { transform: scale(1.01); } .chat-playing { border: 2px solid #60a5fa !important; background: #eff6ff !important; } .spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .speaking-wave { width: 10px; height: 10px; background: #22c55e; border-radius: 50%; border: 2px solid white; animation: speak-pulse 1.5s infinite; } @keyframes speak-pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }`;
      document.head.appendChild(style);
    }
  }, []);
  
  const { play, stop, isPlaying, isPaused, playingId, loadingId } = useMixedTTS();
  const currentGp = grammarPoints[currentIndex] || {};
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
  
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex]);
  
  return (
    <div style={styles.container}>
      <FloatingMusicPlayer 
        isPlaying={isPlaying && !isPaused}
        isLoading={!!loadingId}
        playingType={playingType}
        onToggle={() => play(currentGp['讲解脚本'] || currentGp.grammarPoint, 'main_narration')}
        onStop={stop}
      />
      <div style={{flex: 1, position: 'relative'}}>
        {transitions((style, i) => {
            const gp = grammarPoints[i]; if (!gp) return null;
            return (
            <animated.div style={{ ...styles.page, ...style }}>
                <div style={styles.scrollContainer} ref={contentRef}>
                <div style={styles.contentWrapper}>
                    <div style={styles.header}>
                    <h2 style={styles.title}>{gp['语法标题'] || gp.grammarPoint}</h2>
                    <button 
                        onClick={() => play(gp['讲解脚本'] || gp.grammarPoint, 'main_narration')}
                        style={{...styles.mainPlayBtn, background: playingId === 'main_narration' && isPlaying ? '#2563eb' : '#eff6ff', color: playingId === 'main_narration' && isPlaying ? 'white' : '#2563eb'}}
                    >
                        {loadingId === 'main_narration' ? <FaSpinner className="spin" /> : (playingId === 'main_narration' && isPlaying && !isPaused ? <FaPause /> : <FaPlay />)}
                        <span style={{marginLeft:8}}>听讲解 (Listen)</span>
                    </button>
                    </div>
                    {gp['句型结构'] && (<div style={styles.patternBox}><div style={styles.patternLabel}>STRUCTURE</div><div style={styles.patternText}><PinyinText text={gp['句型结构']} /></div></div>)}
                    <ContentRenderer content={gp['语法详解'] || gp.visibleExplanation} playFunc={play} playingId={playingId}/>
                    <div style={{ height: '100px' }}></div>
                </div>
                </div>
            </animated.div>
            );
        })}
      </div>
      <div style={styles.bottomBar}>
        <button onClick={handlePrev} disabled={currentIndex===0} style={{ ...styles.navBtn, opacity: currentIndex === 0 ? 0.3 : 1 }}><FaChevronLeft /> Prev</button>
        <div style={styles.pageIndicator}>{currentIndex + 1} / {grammarPoints.length}</div>
        <button onClick={handleNext} style={{ ...styles.navBtn, background: '#2563eb', color: 'white' }}>{currentIndex === grammarPoints.length - 1 ? 'Finish' : 'Next'} <FaChevronRight /></button>
      </div>
    </div>
  );
};

const styles = {
  container: { position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' },
  scrollContainer: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  contentWrapper: { maxWidth: '800px', margin: '0 auto', padding: '32px 24px' },
  header: { textAlign: 'center', marginBottom: '32px' },
  title: { fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', marginBottom: '20px', lineHeight: 1.2 },
  mainPlayBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 24px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '150px' },
  patternBox: { background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '32px', textAlign: 'center' },
  patternLabel: { fontSize: '0.75rem', color: '#94a3b8', fontWeight: '800', letterSpacing: '2px', marginBottom: '12px' },
  patternText: { fontSize: '1.5rem', color: '#2563eb', fontWeight: 'bold', lineHeight: 1.5 },
  bottomBar: { flexShrink: 0, height: '80px', background: 'rgba(255,255,255,0.95)', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 50 },
  navBtn: { border: 'none', background: '#f1f5f9', padding: '12px 22px', borderRadius: '14px', fontSize: '14px', fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' },
  pageIndicator: { fontSize: '14px', fontWeight: '700', color: '#94a3b8' }
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array.isRequired,
  onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
