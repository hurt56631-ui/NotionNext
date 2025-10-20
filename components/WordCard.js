// components/WordCard.js (最终优雅降级方案 - 稳定可靠版)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaHeart, FaRegHeart, FaPlayCircle } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal'; // 确保您项目中存在此汉字笔顺组件

// =================================================================================
// ===== IndexedDB 收藏管理模块 (保持不变) =========================================
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject('数据库打开失败');
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function toggleFavorite(word) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const existing = await new Promise((resolve) => {
    const getReq = store.get(word.id);
    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => resolve(null);
  });
  if (existing) {
    store.delete(word.id);
    return false;
  } else {
    const wordToStore = {
      id: word.id,
      chinese: word.chinese,
      burmese: word.burmese,
      pinyin: word.pinyin,
      imageUrl: word.imageUrl,
    };
    store.put(wordToStore);
    return true;
  }
}

async function isFavorite(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => resolve(!!getReq.result);
    getReq.onerror = () => resolve(false);
  });
}

// =================================================================================
// ===== 辅助工具 & 常量 (保持不变) ================================================
// =================================================================================
const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];
const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;

const playTTS = async (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; }
    if (_howlInstance?.playing()) _howlInstance.stop();
    const apiUrl = 'https://libretts.is-an.org/api/tts';
    const rateValue = Math.round(rate / 2);
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }),
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const audioBlob = await response.blob();
        if (!audioBlob.type.startsWith('audio/')) throw new Error('Invalid audio type');
        const audioUrl = URL.createObjectURL(audioBlob);
        _howlInstance = new Howl({
            src: [audioUrl], format: ['mpeg'], html5: true,
            onend: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); },
            onloaderror: (id, err) => { console.error('Howler load error:', err); URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); },
            onplayerror: (id, err) => { console.error('Howler play error:', err); URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); }
        });
        _howlInstance.play();
    } catch (error) { console.error('TTS fetch error:', error); if (onEndCallback) onEndCallback(); }
};

const playSoundEffect = (type) => {
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (sounds[type]) sounds[type].play();
};

const parsePinyin = (pinyinNum) => {
    if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' };
    const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, '');
    let pinyinPlain = rawPinyin.replace(/[1-5]$/, '');
    const toneMatch = rawPinyin.match(/[1-5]$/);
    const tone = toneMatch ? toneMatch[0] : '0';
    const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' });
    const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
    let initial = ''; let final = pinyinPlain;
    for (const init of initials) {
        if (pinyinPlain.startsWith(init)) { initial = init; final = pinyinPlain.slice(init.length); break; }
    }
    return { initial, final, tone, pinyinMark, rawPinyin };
};

// =================================================================================
// ===== 子组件 (PronunciationComparison 已更新) ===================================
// =================================================================================

const useCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('learningWordCardSettings'); 
      const defaultSettings = {
        order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, autoBrowseDelay: 6000,
        voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0,
      };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) { return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0 }; }
  });
  useEffect(() => { try { localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) { console.error("保存设置失败", error); } }, [settings]);
  return [settings, setSettings];
};

const PinyinVisualizer = React.memo(({ analysis, isCorrect }) => {
    const { parts, errors } = analysis;
    const initialStyle = !isCorrect && parts.initial && errors.initial ? styles.wrongPart : {};
    const finalStyle = !isCorrect && parts.final && errors.final ? styles.wrongPart : {};
    const toneStyle = !isCorrect && parts.tone !== '0' && errors.tone ? styles.wrongPart : {};
    let finalDisplay = parts.pinyinMark.replace(parts.initial, '').replace(' ', '');
    if (!finalDisplay || parts.pinyinMark === parts.rawPinyin) { finalDisplay = parts.final; }
    finalDisplay = finalDisplay.replace(/[1-5]$/, '');
    return (
        <div style={styles.pinyinVisualizerContainer}>
            <span style={{...styles.pinyinPart, ...initialStyle}}>{parts.initial || ''}</span>
            <span style={{...styles.pinyinPart, ...finalStyle}}>{finalDisplay}</span>
            <span style={{...styles.pinyinPart, ...styles.toneNumber, ...toneStyle}}>{parts.tone}</span>
        </div>
    );
});

// ✅ [组件更新] 此组件现在可以处理语音识别失败的情况
const PronunciationComparison = ({ correctWord, userText, userAudioURL, settings, onContinue, onClose }) => {
    const hasRecognitionResult = userText && userText.length > 0;

    const analysis = useMemo(() => {
        if (!hasRecognitionResult) return null; // 如果没有识别结果，不进行分析

        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });
        if (correctPinyin.length === 0 || userPinyin.length === 0) return { isCorrect: false, error: 'NO_PINYIN', message: '无法识别有效发音' };
        if (correctPinyin.length !== userPinyin.length) return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
        
        const results = correctPinyin.map((correctPy, index) => {
            const userPy = userPinyin[index];
            const correctParts = parsePinyin(correctPy);
            const userParts = parsePinyin(userPy);
            const errors = {
                initial: (correctParts.initial || userParts.initial) && (correctParts.initial !== userParts.initial),
                final: correctParts.final !== userParts.final,
                tone: correctParts.tone !== userParts.tone,
            };
            const pinyinMatch = !errors.initial && !errors.final && !errors.tone;
            return { char: correctWord[index], pinyinMatch, correct: { parts: correctParts }, user: { parts: userParts, errors } };
        });
        const isCorrect = results.every(r => r.pinyinMatch);
        const accuracy = (results.filter(r => r.pinyinMatch).length / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText, hasRecognitionResult]);

    useEffect(() => { 
        if (analysis) {
             playSoundEffect(analysis.isCorrect ? 'correct' : 'incorrect');
        }
    }, [analysis]);

    const playUserAudio = useCallback(() => {
        if (userAudioURL) {
            if (_howlInstance?.playing()) _howlInstance.stop();
            const sound = new Howl({ src: [userAudioURL], html5: true });
            sound.play();
        }
    }, [userAudioURL]);

    const playCorrectTTS = useCallback(() => {
        playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese);
    }, [correctWord, settings]);

    const headerContent = useMemo(() => {
        if (!hasRecognitionResult) {
            return {
                icon: '🤔',
                title: '未能识别语音',
                subtitle: '请听录音自行对比',
                gradient: 'linear-gradient(135deg, #6b7280, #4b5563)'
            };
        }
        if (analysis.isCorrect) {
            return {
                icon: '🎉',
                title: '发音完美！',
                subtitle: '太棒了！',
                gradient: 'linear-gradient(135deg, #10b981, #059669)'
            };
        }
        return {
            icon: '💪',
            title: `准确率: ${analysis.accuracy}%`,
            subtitle: '再接再厉！',
            gradient: 'linear-gradient(135deg, #ef4444, #dc2626)'
        };
    }, [analysis, hasRecognitionResult]);

    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: headerContent.gradient}}>
                    <div style={{ fontSize: '2.5rem' }}>{headerContent.icon}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{headerContent.title}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>{headerContent.subtitle}</div>
                </div>

                <div style={styles.errorDetailsContainer}>
                    {hasRecognitionResult && analysis ? (
                        analysis.error ? (
                            <div style={styles.lengthError}><h3>{analysis.message}</h3></div>
                        ) : (
                            <div style={styles.comparisonGrid}>
                                {analysis.results.map((result, index) => (
                                    <div key={index} style={styles.comparisonCell}>
                                        <div style={styles.comparisonChar}>{result.char}</div>
                                        <div style={styles.comparisonPinyinGroup}>
                                            <div style={styles.pinyinLabel}>标准</div>
                                            <PinyinVisualizer analysis={result.correct} isCorrect={true} />
                                        </div>
                                        <div style={styles.comparisonPinyinGroup}>
                                            <div style={styles.pinyinLabel}>你的发音</div>
                                            <PinyinVisualizer analysis={result.user} isCorrect={result.pinyinMatch} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <div style={styles.noRecognitionResult}>
                            <p>请点击下方的播放按钮，</p>
                            <p>听录音并与标准发音对比。</p>
                        </div>
                    )}
                </div>

                <div style={styles.audioComparisonSection}>
                    <button style={styles.audioPlayerButton} onClick={playCorrectTTS}><FaPlayCircle size={18} /> 标准发音</button>
                    {userAudioURL && <button style={styles.audioPlayerButton} onClick={playUserAudio}><FaPlayCircle size={18} /> 你的录音</button>}
                </div>

                <div style={styles.comparisonActions}>
                    {(analysis && analysis.isCorrect) ? 
                        (<button style={{...styles.actionButton, ...styles.continueButton}} onClick={onContinue}>继续下一个 <FaArrowRight /></button>) : 
                        (<button style={{...styles.actionButton, ...styles.retryButton}} onClick={onClose}>再试一次</button>)
                    }
                </div>
            </div>
        </div>
    );
};

// ... 其他子组件 (SettingsPanel, JumpModal) 保持不变 ...
const SettingsPanel = React.memo(/* ... */);
const JumpModal = ({ max, current, onJump, onClose }) => { /* ... */ };


// =================================================================================
// ===== 主组件: WordCard ==========================================================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  const storageKey = `wordCardProgress_${progressKey}`;

  const processedCards = useMemo(() => {
    try {
        const mapped = words.map(w => ({ id: w.id, chinese: w.chinese, burmese: w.burmese, pinyin: w.pinyin, imageUrl: w.imageUrl }));
        if (settings.order === 'random') {
            for (let i = mapped.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mapped[i], mapped[j]] = [mapped[j], mapped[i]]; }
        }
        return mapped;
    } catch (error) { console.error("处理卡片数据出错:", error); return []; }
  }, [words, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "暂无单词", burmese: "..." }];
  
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window !== 'undefined') {
        try { const savedIndex = localStorage.getItem(storageKey); const index = savedIndex ? parseInt(savedIndex, 10) : 0; return index < cards.length ? index : 0; }
        catch (error) { console.error("读取进度失败", error); return 0; }
    }
    return 0;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [userAudioURL, setUserAudioURL] = useState(null);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [showComparison, setShowComparison] = useState(false); // ✅ 新状态，控制对比面板的显示

  const lastDirection = useRef(0);
  const autoBrowseTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentCard = cards[currentIndex];

  useEffect(() => { if (typeof window !== 'undefined') { localStorage.setItem(storageKey, currentIndex); } }, [currentIndex, storageKey]);
  useEffect(() => { if (currentCard?.id && currentCard.id !== 'fallback') { isFavorite(currentCard.id).then(setIsFavoriteCard); } }, [currentCard]);
  
  const handleToggleFavorite = async () => { if (!currentCard || currentCard.id === 'fallback') return; setIsFavoriteCard(await toggleFavorite(currentCard)); };
  const navigate = useCallback((direction) => { lastDirection.current = direction; setCurrentIndex(prev => (prev + direction + cards.length) % cards.length); }, [cards.length]);
  const handleJumpToCard = (index) => { if (index >= 0 && index < cards.length) { lastDirection.current = index > currentIndex ? 1 : -1; setCurrentIndex(index); } setIsJumping(false); };

  useEffect(() => {
    if (!isOpen) return;
    clearTimeout(autoBrowseTimerRef.current);
    const playSequence = () => {
        if (settings.autoPlayChinese && currentCard?.chinese) {
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => {
                if (settings.autoPlayBurmese && currentCard?.burmese) { playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer); } else { startAutoBrowseTimer(); }
            });
        } else if (settings.autoPlayBurmese && currentCard?.burmese) { playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer); } else { startAutoBrowseTimer(); }
    };
    const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };
    const initialPlayTimer = setTimeout(playSequence, 600);
    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate]);
  
  // ✅ [核心逻辑] 最终版 handleListen，集成了优雅降级
  const handleListen = useCallback(async (e) => {
      e.stopPropagation();
      if (_howlInstance?.playing()) _howlInstance.stop();

      if (isListening) { recognitionRef.current?.stop(); return; }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; }
      
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = stream;

          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          recognition.lang = 'zh-CN';
          recognition.interimResults = false;
          
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          let tempTranscript = '';
          
          recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
          recorder.onstop = () => {
              if (audioChunksRef.current.length > 0) {
                  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                  setUserAudioURL(URL.createObjectURL(audioBlob));
              }
              // 关键：在录音结束后，才最终设置文本并显示面板
              setRecognizedText(tempTranscript);
              setShowComparison(true); 
          };
          
          recognition.onstart = () => {
              if (userAudioURL) URL.revokeObjectURL(userAudioURL);
              setRecognizedText('');
              setUserAudioURL(null);
              setShowComparison(false);
              setIsListening(true);
              recorder.start();
          };

          recognition.onresult = (event) => {
              tempTranscript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，]/g, '');
          };

          recognition.onend = () => {
              if (recorder.state === 'recording') recorder.stop();
              if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(track => track.stop());
              recognitionRef.current = null;
              mediaRecorderRef.current = null;
              audioStreamRef.current = null;
              setIsListening(false);
          };

          recognition.onerror = (event) => {
              console.error('语音识别错误:', event.error);
              if (event.error !== 'no-speech') {
                  alert(`语音识别出错: ${event.error}`);
              }
              // 无论什么错误，onend 都会被调用来清理资源
          };
          
          recognition.start();

      } catch (err) {
          console.error("无法获取麦克风权限:", err);
          alert("无法获取麦克风权限，请检查您的浏览器设置。");
          setIsListening(false);
      }
  }, [isListening, userAudioURL]);

  const handleCloseComparison = useCallback(() => { setShowComparison(false); }, []);
  const handleNavigateToNext = useCallback(() => { setShowComparison(false); setTimeout(() => navigate(1), 100); }, [navigate]);
  
  useEffect(() => {
      return () => {
          if (recognitionRef.current) recognitionRef.current.abort();
          if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(track => track.stop());
      };
  }, []);
  
  const pageTransitions = useTransition(isOpen, { from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 }, });
  const cardTransitions = useTransition(currentIndex, { key: currentIndex, from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, config: { mass: 1, tension: 280, friction: 30 }, onStart: () => playSoundEffect('switch'), });
  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => { if (event.target.closest('[data-no-gesture]')) return; if (down) return; event.stopPropagation(); const isHorizontal = Math.abs(mx) > Math.abs(my); if (isHorizontal) { if (Math.abs(mx) > 80 || (vel > 0.5 && Math.abs(mx) > 40)) onClose(); } else { if (Math.abs(my) > 60 || (vel > 0.4 && Math.abs(my) > 30)) navigate(yDir < 0 ? 1 : -1); } }, { filterTaps: true, preventDefault: true, threshold: 10 });

  const cardContent = pageTransitions((style, item) =>
    item && (
      <animated.div style={{ ...styles.fullScreen, ...style }}>
        <div style={styles.gestureArea} {...bind()} />
        
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {/* ✅ 使用新状态来控制面板显示 */}
        {showComparison && currentCard && (<PronunciationComparison correctWord={currentCard.chinese} userText={recognizedText} userAudioURL={userAudioURL} settings={settings} onContinue={handleNavigateToNext} onClose={handleCloseComparison} />)}
        {isJumping && <JumpModal max={cards.length} current={currentIndex} onJump={handleJumpToCard} onClose={() => setIsJumping(false)} />}
        
        {cardTransitions((cardStyle, i) => {
          const cardData = cards[i]; if (!cardData) return null;
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...cardStyle }}>
              <div style={styles.cardContainer}>
                  <div style={{ textAlign: 'center' }}>
                      <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                          <div style={styles.pinyin}>{pinyinConverter(cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                          <div style={styles.textWordChinese}>{cardData.chinese}</div> 
                      </div>
                      <div style={{ cursor: 'pointer', marginTop: '2.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                          <div style={styles.textWordBurmese}>{cardData.burmese}</div>
                      </div>
                  </div>
              </div>
            </animated.div>
          );
        })}

        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={20} /></button>
                <button style={styles.rightIconButton} onClick={handleListen} title="发音练习"><FaMicrophone size={20} color={isListening ? '#dc2626' : '#4a5568'} /></button>
                {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺"><FaPenFancy size={20} /></button> )}
                <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>{isFavoriteCard ? <FaHeart size={20} color="#f87171" /> : <FaRegHeart size={20} />}</button>
            </div>
        )}
        
        {cards.length > 0 && (<div style={styles.bottomCenterCounter} data-no-gesture="true" onClick={() => setIsJumping(true)}>{currentIndex + 1} / {cards.length}</div>)}
      </animated.div>
    )
  );

  if (isMounted) return createPortal(cardContent, document.body);
  return null;
};

// =================================================================================
// ===== 样式表 (comparisonPanel 部分有新增) =========================================
// =================================================================================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: 'url(/background.jpg) center/cover no-repeat', backgroundAttachment: 'fixed', backgroundColor: '#004d40' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '4.5rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    textWordBurmese: { fontSize: '2.2rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    rightControls: { position: 'fixed', bottom: '50%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', transform: 'translateY(50%)' },
    rightIconButton: { background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'transform 0.2s, background 0.2s', color: '#4a5568', backdropFilter: 'blur(4px)' },
    bottomCenterCounter: { position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(0, 0, 0, 0.3)', color: 'white', padding: '8px 18px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(5px)', cursor: 'pointer', userSelect: 'none' },
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '15px' },
    comparisonPanel: { width: '100%', maxWidth: '500px', maxHeight: '90vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
    resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
    errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: 1 },
    lengthError: { textAlign: 'center', color: '#b91c1c', padding: '10px 0' },
    comparisonGrid: { display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' },
    comparisonCell: { flex: '1 1 120px', padding: '12px', borderRadius: '12px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' },
    comparisonChar: { fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' },
    comparisonPinyinGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' },
    pinyinVisualizerContainer: { display: 'flex', alignItems: 'baseline', fontSize: '1.5rem', height: '1.8rem', color: '#333' },
    pinyinPart: { transition: 'color 0.3s', fontWeight: 500 },
    toneNumber: { fontSize: '1.1rem', fontWeight: 'bold', marginLeft: '2px' },
    wrongPart: { color: '#dc2626', fontWeight: 'bold' },
    pinyinLabel: { fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' },
    // ✅ 新增样式，用于显示识别失败后的提示
    noRecognitionResult: { textAlign: 'center', color: '#4b5563', padding: '30px 20px', fontSize: '1.1rem', lineHeight: '1.6' },
    audioComparisonSection: { display: 'flex', gap: '15px', justifyContent: 'center', padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8f9fa' },
    audioPlayerButton: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderRadius: '12px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151', fontWeight: 600 },
    comparisonActions: { padding: '20px' },
    actionButton: { width: '100%', padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    continueButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    retryButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    // ... 其他样式保持不变 ...
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)', padding: '15px' },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto', position: 'relative' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#aaa', lineHeight: 1 },
    settingGroup: { marginBottom: '20px' },
    settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
    settingControl: { display: 'flex', gap: '10px', alignItems: 'center' },
    settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002 },
    jumpModalContent: { background: 'white', padding: '25px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    jumpModalTitle: { marginTop: 0, marginBottom: '15px', color: '#333' },
    jumpModalInput: { width: '100px', padding: '10px', fontSize: '1.2rem', textAlign: 'center', border: '2px solid #ccc', borderRadius: '8px', marginBottom: '15px' },
    jumpModalButton: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#4299e1', color: 'white', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};

export default WordCard;
