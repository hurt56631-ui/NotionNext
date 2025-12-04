import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaLightbulb, FaBookOpen, FaFacebook, FaTelegram, FaTiktok, FaLink } from 'react-icons/fa'; // 引入分享图标
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存 ---
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const res = req.result;
        if (res && typeof res.size === 'number' && res.size > 0) resolve(res);
        else resolve(null);
      };
      // --- 错误修复：这里移除了一个多余的等号 ---
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(blob, key);
    });
  }
};

// --- 2. 音频控制器 (无修改) ---
const audioController = {
  currentAudio: null,
  playlist: [],
  activeBlobUrls: [],
  latestRequestId: 0,
  _pendingFetches: [],

  stop() {
    this.latestRequestId++;
    this._pendingFetches.forEach(ctrl => {
      try { ctrl.abort(); } catch (e) {}
    });
    this._pendingFetches = [];

    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }

    this.playlist.forEach(a => {
      try {
        a.onended = null;
        a.onerror = null;
        a.pause();
        a.src = '';
      } catch (e) {}
    });
    this.playlist = [];

    if (this.activeBlobUrls.length > 0) {
      this.activeBlobUrls.forEach(url => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
      this.activeBlobUrls = [];
    }
  },

  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh';
  },

  async fetchAudioBlob(text, lang) {
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const rateParam = 0;
    const cacheKey = `tts-${voice}-${text}-${rateParam}`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateParam}`;
    const controller = new AbortController();
    this._pendingFetches.push(controller);
    const signal = controller.signal;
    try {
      const res = await fetch(apiUrl, { signal });
      if (!res.ok) throw new Error(`TTS Fetch failed: ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) return null;
      await idb.set(cacheKey, blob);
      return blob;
    } finally {
      this._pendingFetches = this._pendingFetches.filter(c => c !== controller);
    }
  },

  async playMixed(text, onStart, onEnd) {
    this.stop();
    if (!text) {
      if (onEnd) onEnd();
      return;
    }
    const reqId = ++this.latestRequestId;
    if (onStart) onStart();

    const segments = [];
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const segmentText = match[0].trim();
      const isValidContent = /[\u4e00-\u9fa5a-zA-Z0-9\u1000-\u109F]/.test(segmentText);
      if (segmentText && isValidContent) {
        const lang = this.detectLanguage(segmentText);
        segments.push({ text: segmentText, lang });
      }
    }

    if (segments.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    try {
      const blobs = await Promise.all(
        segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang))
      );

      if (reqId !== this.latestRequestId) return;

      const validBlobs = [];
      const validSegments = [];
      blobs.forEach((b, i) => {
        if (b) {
          validBlobs.push(b);
          validSegments.push(segments[i]);
        }
      });

      if (validBlobs.length === 0) {
        if (onEnd) onEnd();
        return;
      }

      const audioObjects = validBlobs.map((blob, index) => {
        const url = URL.createObjectURL(blob);
        this.activeBlobUrls.push(url);
        const audio = new Audio(url);
        if (validSegments[index].lang === 'zh') {
          audio.playbackRate = 0.7;
        } else {
          audio.playbackRate = 1.0;
        }
        audio.preload = 'auto';
        return audio;
      });

      this.playlist = audioObjects;

      const playNext = (index) => {
        if (reqId !== this.latestRequestId) return;
        if (index >= audioObjects.length) {
          this.currentAudio = null;
          if (onEnd) onEnd();
          return;
        }
        const audio = audioObjects[index];
        this.currentAudio = audio;

        audio.onended = () => playNext(index + 1);
        audio.onerror = (e) => {
          console.warn(`Audio segment error, skipping...`, e);
          playNext(index + 1);
        };
        audio.onloadedmetadata = () => {
          try {
            if (validSegments[index].lang === 'zh') audio.playbackRate = 0.7;
          } catch (e) {}
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Playback prevented:", error);
            this.stop();
            if (onEnd) onEnd();
          });
        }
      };

      playNext(0);
    } catch (e) {
      console.error("Fatal Load Error:", e);
      if (onEnd) onEnd();
    }
  }
};


// --- 3. 样式定义 (包含分享按钮样式) ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;600;700&family=Ma+Shan+Zheng&display=swap');

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    position: absolute; 
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 24px 220px 24px; 
    overflow-y: auto;
    background-color: #fcfcfc;
    -webkit-tap-highlight-color: transparent;
    scrollbar-width: none; 
    -ms-overflow-style: none;
  }
  .xzt-container::-webkit-scrollbar {
    display: none;
  }

  .book-read-btn {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #a78bfa, #7c3aed);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.6rem;
    margin-bottom: 24px;
    box-shadow: 0 8px 15px -3px rgba(124, 58, 237, 0.4);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    z-index: 110;
    pointer-events: auto;
    -webkit-user-select: none;
  }
  .book-read-btn:active { transform: scale(0.9); box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3); }
  .book-read-btn.playing { animation: pulse-purple 2s infinite; background: #7c3aed; }

  @keyframes pulse-purple {
    0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.7); }
    70% { box-shadow: 0 0 0 15px rgba(124, 58, 237, 0); }
    100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
  }

  .xzt-question-area {
    width: 100%; max-width: 500px; margin: 0 auto 32px auto; 
    display: flex; flex-direction: column; align-items: center;
    flex-shrink: 0;
    z-index: 10;
  }
  .question-img { 
    width: 100%; max-height: 220px; object-fit: contain; 
    border-radius: 16px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    pointer-events: none;
  }

  .rich-text-container {
    width: 100%; display: flex; flex-wrap: wrap;
    justify-content: center; align-items: flex-end;
    gap: 6px; line-height: 1.8; padding: 0 10px;
    pointer-events: none;
  }
  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; position: relative; pointer-events: auto; }
  
  .pinyin-top { font-size: 0.75rem; color: #64748b; font-family: monospace; font-weight: 500; height: 1.4em; margin-bottom: -2px; }
  .cn-char { font-size: 1.35rem; font-weight: 600; color: #1e293b; font-family: "Noto Sans SC", serif; line-height: 1.2; text-shadow: 1px 1px 0 rgba(0,0,0,0.02); }
  .other-text-block { font-size: 1.2rem; font-weight: 500; color: #334155; padding: 0 4px; display: inline-block; align-self: flex-end; margin-bottom: 4px; pointer-events: auto; }

  .xzt-options-grid { 
    display: flex; flex-direction: column; gap: 16px; 
    width: 100%; max-width: 500px; padding-bottom: 20px;
    z-index: 15; 
    pointer-events: auto;
  }
  
  .xzt-option-card {
    position: relative; background: #fff; border-radius: 20px; 
    border: 2px solid #e2e8f0;
    box-shadow: 0 4px 6px rgba(0,0,0,0.02), 0 6px 0 #cbd5e1; 
    cursor: pointer; transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex; align-items: center; justify-content: center;
    padding: 16px 20px; min-height: 72px;
    transform: translateY(0);
    user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
    pointer-events: auto;
  }
  .xzt-option-card:active { transform: translateY(4px); box-shadow: 0 1px 2px rgba(0,0,0,0.02), 0 2px 0 #cbd5e1; background: #f8fafc; }
  .xzt-option-card.selected { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 6px 0 #ddd6fe; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; box-shadow: 0 6px 0 #bbf7d0; animation: bounce 0.4s; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; box-shadow: 0 6px 0 #fecaca; animation: shake 0.4s; }

  .opt-content { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .opt-py { font-size: 0.85rem; color: #94a3b8; line-height: 1; margin-bottom: 4px; font-family: monospace; }
  .opt-txt { font-size: 1.25rem; font-weight: 600; color: #334155; }
  
  .fixed-bottom-area {
    position: fixed; bottom: 12vh; left: 0; right: 0;
    display: flex; flex-direction: column-reverse; align-items: center;
    pointer-events: none; z-index: 200; gap: 20px;
  }

  .bottom-actions-container {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    width: 100%;
    pointer-events: auto; 
  }

  .share-buttons-group {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background-color: #fff;
    border-radius: 99px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    pointer-events: auto;
  }
  .share-icon {
    font-size: 1.5rem; 
    color: #4b5563; 
    cursor: pointer;
    transition: transform 0.2s;
  }
  .share-icon:active {
    transform: scale(0.9);
  }
  .share-icon.facebook:hover { color: #1877F2; }
  .share-icon.telegram:hover { color: #0088cc; }
  .share-icon.tiktok:hover { color: #000000; }
  .share-icon.link:hover { color: #6d28d9; }

  .submit-btn {
    pointer-events: auto; width: auto; min-width: 180px; padding: 14px 40px;
    border-radius: 99px; font-size: 1.1rem; font-weight: 700; color: white; border: none;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
    transition: all 0.2s; user-select: none;
    z-index: 210;
    -webkit-tap-highlight-color: transparent;
  }
  .submit-btn:active { transform: scale(0.95); }
  .submit-btn:disabled { background: #e2e8f0; color: #94a3b8; box-shadow: none; opacity: 0.8; }
  .submit-btn.hidden-btn { opacity: 0; pointer-events: none; }

  .explanation-card {
    pointer-events: auto;
    background: #fff1f2; color: #be123c;
    border: 1px solid #fecaca;
    padding: 16px 20px; 
    border-radius: 16px;
    width: 88%; max-width: 450px;
    font-size: 1.05rem;
    line-height: 1.5;
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15);
    animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex; gap: 12px; align-items: flex-start;
    cursor: pointer;
    position: fixed;
    bottom: calc(12vh + 96px);
    z-index: 300; 
    left: 50%;
    transform: translateX(-50%);
  }
  .explanation-card > * { pointer-events: none; }

  .tap-hint {
    font-size: 0.8rem; color: #f87171; opacity: 0.7; margin-top: 8px; font-weight: 400;
  }

  @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
`;


// --- 4. 文本解析逻辑 (无修改) ---
const parseTitleText = (text) => {
  if (!text) return [];
  const result = [];
  const regex = /([\p{Script=Han}]+)|([^\p{Script=Han}]+)/gu;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const segment = match[0];
    if (/\p{Script=Han}/u.test(segment)) {
      const pinyins = pinyin(segment, { type: 'array', toneType: 'symbol' });
      const chars = segment.split('');
      chars.forEach((char, i) => {
        result.push({ type: 'zh', char, pinyin: pinyins[i] || '' });
      });
    } else {
      result.push({ type: 'other', text: segment });
    }
  }
  return result;
};

const parseOptionText = (text) => {
  const isZh = /[\u4e00-\u9fa5]/.test(text);
  if (!isZh) return { isZh: false, text };
  const pinyins = pinyin(text, { type: 'array', toneType: 'symbol', nonZh: 'consecutive' });
  return { isZh: true, text, pinyins: pinyins.join(' ') };
};


// --- 5. 组件主体 (包含所有修改和修复) ---
const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, onIncorrect, onNext }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [titleSegments, setTitleSegments] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeExplanation = (question.explanation || '').trim();
  
  const autoNextTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const transitioningRef = useRef(false);

  const executeNext = (isCorrect) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    audioController.stop();
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }

    if (isCorrect) {
      try { onCorrect && onCorrect(); } catch (e) { console.warn(e); }
    } else {
      try { onIncorrect && onIncorrect(question); } catch (e) { console.warn(e); }
    }
    
    try { onNext && onNext(); } catch (e) { console.warn(e); }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    const preventPullToRefresh = (e) => {
      if (document.body.scrollTop === 0 && e.touches[0].clientY > (window.innerHeight * 0.1) ) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });

    return () => { 
      mountedRef.current = false; 
      document.removeEventListener('touchmove', preventPullToRefresh);
    };
  }, []);

  useEffect(() => {
    audioController.stop();
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    
    transitioningRef.current = false;

    setIsPlaying(false);
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    setTitleSegments(parseTitleText(question.text || ''));
    setOrderedOptions((options || []).map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    if (question.text) {
      setTimeout(() => {
        if (!mountedRef.current || transitioningRef.current) return;
        handleTitlePlay(null, true);
      }, 500);
    }

    return () => {
      audioController.stop();
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
        autoNextTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, options]);

  const handleTitlePlay = (e, isAuto = false) => {
    if (e) e.stopPropagation();
    if (transitioningRef.current) return;
    if (!isAuto && navigator.vibrate) navigator.vibrate(40);

    audioController.playMixed(
      question.text || '',
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  };

  const handleGlobalClick = (e) => {
    if (!isSubmitted || transitioningRef.current) return;
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));
    executeNext(isCorrect);
  };

  const handleCardClick = (option, e) => {
    if (isSubmitted || transitioningRef.current) return;
    if (e) e.stopPropagation();
    setSelectedId(option.id);
    if (navigator.vibrate) navigator.vibrate(20);
    audioController.playMixed(option.text || '');
  };

  const triggerCorrectAndNext = () => {
    if (transitioningRef.current) return;
    
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
    new Audio('/sounds/correct.mp3').play().catch(()=>{});

    autoNextTimerRef.current = setTimeout(() => {
      executeNext(true); 
    }, 1500);
  };

  const triggerIncorrectAndNext = () => {
    if (transitioningRef.current) return;

    new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
    if (navigator.vibrate) navigator.vibrate([50,50,50]);

    if (activeExplanation) {
      setShowExplanation(true);
      setTimeout(() => {
        if (transitioningRef.current) return;
        audioController.playMixed(activeExplanation, () => {}, () => {});
      }, 400);
    }

    autoNextTimerRef.current = setTimeout(() => {
      executeNext(false); 
    }, 8000);
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted || transitioningRef.current) return;
    setIsSubmitted(true);
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));
    if (isCorrect) {
      triggerCorrectAndNext();
    } else {
      triggerIncorrectAndNext();
    }
  };

  const handleExplanationClick = (e) => {
    e.stopPropagation();
    executeNext(false); 
  };
  
  const handleShare = (platform) => {
    const shareUrl = window.location.href;
    const shareText = `快来和我一起学习！ ${question.text}`;
    let url = '';

    switch (platform) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'telegram':
        url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        break;
      case 'tiktok':
        alert('TikTok请在App内分享');
        return;
      case 'copy':
        navigator.clipboard.writeText(shareUrl).then(() => {
          alert('လင့်ခ်ကို ကူးယူပြီးပါပြီ။'); // "链接已复制"
        }, () => {
          alert('ကူးယူရန် မအောင်မြင်ပါ။'); // "复制失败"
        });
        return;
      default:
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };


  return (
    <>
      <style>{cssStyles}</style>

      <div className="xzt-container" onClick={handleGlobalClick} role="region" aria-label="选择题区域">
        <div 
          className={`book-read-btn ${isPlaying ? 'playing' : ''}`} 
          onClick={(e) => handleTitlePlay(e, false)}
          role="button"
          aria-label="朗读题干"
          title="朗读题干"
        >
          <FaBookOpen />
        </div>

        <div className="xzt-question-area">
          {question.imageUrl && <img src={question.imageUrl} alt="" className="question-img" />}

          <div className="rich-text-container" aria-hidden="false">
            {titleSegments.map((seg, i) => {
              if (seg.type === 'zh') {
                return (
                  <div key={i} className="cn-block" aria-hidden="false">
                    <span className="pinyin-top">{seg.pinyin}</span>
                    <span className="cn-char">{seg.char}</span>
                  </div>
                );
              } else {
                return <span key={i} className="other-text-block">{seg.text}</span>;
              }
            })}
          </div>
        </div>

        <div className="xzt-options-grid" role="list" aria-label="选项列表">
          {orderedOptions.map(opt => {
            let status = '';
            const isSel = String(opt.id) === String(selectedId);
            const isRight = correctAnswer.map(String).includes(String(opt.id));
            if (isSubmitted) {
              if (isRight) status = 'correct';
              else if (isSel) status = 'incorrect';
            } else if (isSel) status = 'selected';

            return (
              <div 
                key={opt.id} 
                className={`xzt-option-card ${status}`} 
                onClick={(e) => handleCardClick(opt, e)}
                role="button"
                aria-pressed={isSel}
                aria-label={`选项 ${opt.text}`}
              >
                {opt.hasImage && <img src={opt.imageUrl} alt="" className="w-12 h-12 rounded mr-3 object-cover" style={{width:48,height:48,marginRight:12,borderRadius:8}} />}
                <div className="opt-content">
                  {opt.parsed && opt.parsed.isZh ? (
                    <>
                      <div className="opt-py">{opt.parsed.pinyins}</div>
                      <div className="opt-txt">{opt.text}</div>
                    </>
                  ) : (
                    <div className="opt-txt" style={{fontWeight:500}}>{opt.text}</div>
                  )}
                </div>
                {status === 'correct' && <FaCheckCircle style={{position:'absolute', right:16}} className="text-green-500 text-2xl" />}
                {status === 'incorrect' && <FaTimesCircle style={{position:'absolute', right:16}} className="text-red-500 text-2xl" />}
              </div>
            );
          })}
        </div>

        <div className="fixed-bottom-area" aria-hidden="false">
          <div className="bottom-actions-container">
            <div className="share-buttons-group">
                <span style={{paddingRight: '8px', color: '#6b7280', fontSize: '1rem', fontFamily: 'Padauk'}}>မျှဝေရန်</span>
                <FaFacebook className="share-icon facebook" onClick={() => handleShare('facebook')} title="Facebook တွင်မျှဝေရန်"/>
                <FaTelegram className="share-icon telegram" onClick={() => handleShare('telegram')} title="Telegram တွင်မျှဝေရန်"/>
                <FaTiktok className="share-icon tiktok" onClick={() => handleShare('tiktok')} title="Tiktok တွင်မျှဝေရန်"/>
                <FaLink className="share-icon link" onClick={() => handleShare('copy')} title="လင့်ခ်ကိုကူးယူပါ"/>
            </div>

            <button 
              className={`submit-btn ${isSubmitted ? 'hidden-btn' : ''}`} 
              onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
              disabled={!selectedId}
              aria-disabled={!selectedId}
              aria-label="တင်သွင်းသည်"
              title="တင်သွင်းသည်"
            >
              တင်သွင်းသည်
            </button>
          </div>

          {showExplanation && activeExplanation && (
            <div 
              className="explanation-card"
              onClick={handleExplanationClick}
              role="dialog"
              aria-label="အဖြေရှင်းလင်းချက်"
            >
              <FaLightbulb className="flex-shrink-0 mt-1 text-red-500 text-xl" />
              <div>
                <div>{activeExplanation}</div>
                <div className="tap-hint">ဆက်သွားရန် နေရာလွတ်တစ်ခုခုကိုနှိပ်ပါ။</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
