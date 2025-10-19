// components/WordCard.js (发音功能重构版)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaHeart, FaRegHeart, FaPencilAlt, FaPlay, FaStop, FaWaveSquare, FaSyncAlt } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import HandwritingModal from '@/components/HandwritingModal'; // 确保您已创建此文件

// =================================================================================
// ===== IndexedDB & 辅助工具 (保持不变) =========================================
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';
function openDB() { /* ... 此处代码未变 ... */ 
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
async function toggleFavorite(word) { /* ... 此处代码未变 ... */ 
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
    return false; // 已取消收藏
  } else {
    const wordToStore = {
      id: word.id,
      chinese: word.chinese,
      burmese: word.burmese,
      pinyin: word.pinyin,
      imageUrl: word.imageUrl,
    };
    store.put(wordToStore);
    return true; // 收藏成功
  }
}
async function isFavorite(id) { /* ... 此处代码未变 ... */
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => resolve(!!getReq.result);
    getReq.onerror = () => resolve(false);
  });
}
const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];
let _howlInstance = null;
const playTTS = async (text, voice, rate, onEndCallback, e) => { /* ... 此处代码未变 ... */
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
        if (!response.ok) { console.error('TTS API 请求失败!', response.status); if (onEndCallback) onEndCallback(); return; }
        const audioBlob = await response.blob();
        if (!audioBlob.type.startsWith('audio/')) { console.error('TTS API 未返回有效的音频文件'); if (onEndCallback) onEndCallback(); return; }
        const audioUrl = URL.createObjectURL(audioBlob);
        _howlInstance = new Howl({
            src: [audioUrl], format: ['mpeg'], html5: true,
            onend: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); },
            onloaderror: (id, err) => { console.error('Howler 加载音频错误:', err); URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); },
            onplayerror: (id, err) => { console.error('Howler 播放音频错误:', err); URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); }
        });
        _howlInstance.play();
    } catch (error) { console.error('获取 TTS 音频时发生网络错误:', error); if (onEndCallback) onEndCallback(); }
};
const useCardSettings = () => { /* ... 此处代码未变 ... */ 
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('learningWordCardSettings'); 
      const defaultSettings = {
        order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, autoBrowseDelay: 6000,
        voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0,
      };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) {
        console.error("加载设置失败", error);
        return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0 };
    }
  });
  useEffect(() => { try { localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) { console.error("保存设置失败", error); } }, [settings]);
  return [settings, setSettings];
};
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => { /* ... 此处代码未变 ... */ 
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>);
});


// =================================================================================
// ===== ✅ 新的发音练习面板组件 ===================================================
// =================================================================================
const PronunciationPracticePanel = ({ isOpen, onClose, currentCard, settings }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [userAudioURL, setUserAudioURL] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // 清理函数：当面板关闭或卡片切换时，清除旧的录音
    useEffect(() => {
        return () => {
            if (userAudioURL) {
                URL.revokeObjectURL(userAudioURL);
                setUserAudioURL(null);
            }
        };
    }, [isOpen, currentCard]);

    const handleStartRecording = async () => {
        if (isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                setUserAudioURL(audioUrl);
                // 停止媒体流，关闭麦克风指示灯
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("无法获取麦克风权限:", err);
            alert("无法启动录音。请确保您已授予麦克风权限。");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const playUserRecording = () => {
        if (userAudioURL) {
            const audio = new Audio(userAudioURL);
            audio.play();
        }
    };
    
    const panelTransition = useTransition(isOpen, {
        from: { transform: 'translateY(100%)', opacity: 0 },
        enter: { transform: 'translateY(0%)', opacity: 1 },
        leave: { transform: 'translateY(100%)', opacity: 0 },
        config: { tension: 300, friction: 30 },
    });

    return panelTransition((style, item) =>
        item && (
            <animated.div style={{...styles.practicePanelOverlay, ...style}}>
                <div style={styles.practicePanel}>
                    <div style={styles.panelHeader}>
                        <h3 style={styles.panelTitle}>发音练习</h3>
                        <button style={styles.panelCloseButton} onClick={onClose}><FaTimes /></button>
                    </div>
                    
                    <div style={styles.wordDisplay}>
                        <div style={styles.pinyinSmall}>{pinyinConverter(currentCard.pinyin || currentCard.chinese, { toneType: 'symbol', separator: ' ' })}</div>
                        <div style={styles.chineseBig}>{currentCard.chinese}</div>
                    </div>
                    
                    <div style={styles.audioControls}>
                        {/* 标准发音按钮 */}
                        <div style={styles.controlButtonContainer}>
                            <button 
                                style={{...styles.playButton, ...styles.standardPlayButton}}
                                onClick={(e) => playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}
                            >
                                <FaPlay />
                            </button>
                            <div style={styles.buttonLabel}>标准发音</div>
                        </div>

                        {/* 用户录音按钮 */}
                        {userAudioURL && (
                             <div style={styles.controlButtonContainer}>
                                <button 
                                    style={{...styles.playButton, ...styles.userPlayButton}}
                                    onClick={playUserRecording}
                                >
                                    <FaWaveSquare />
                                </button>
                                <div style={styles.buttonLabel}>我的录音</div>
                            </div>
                        )}
                    </div>
                    
                    <div style={styles.recordSection}>
                        {isRecording ? (
                            <button style={{...styles.recordButton, ...styles.stopRecordButton}} onClick={handleStopRecording}>
                                <FaStop size={24} />
                                <span>停止录音</span>
                            </button>
                        ) : (
                             <button style={{...styles.recordButton, ...styles.startRecordButton}} onClick={userAudioURL ? handleStartRecording : handleStartRecording}>
                                {userAudioURL ? <FaSyncAlt size={22} /> : <FaMicrophone size={22} />}
                                <span>{userAudioURL ? "重新录制" : "按住说话"}</span>
                            </button>
                        )}
                    </div>
                </div>
            </animated.div>
        )
    );
};


// =================================================================================
// ===== 主组件: WordCard (已重构) =================================================
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
    } catch (error) { console.error("处理卡片数据出错:", error, words); return []; }
  }, [words, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "暂无单词", pinyin: "zàn wú dān cí", burmese: "..." }];
  
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window !== 'undefined') {
        try { const savedIndex = localStorage.getItem(storageKey); return savedIndex ? parseInt(savedIndex, 10) : 0; } 
        catch (error) { console.error("读取进度失败", error); return 0; }
    }
    return 0;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isHandwritingModalOpen, setIsHandwritingModalOpen] = useState(false);
  // ✅ 新增：控制发音练习面板的状态
  const [isPracticePanelOpen, setIsPracticePanelOpen] = useState(false);

  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const currentCard = cards[currentIndex];

  useEffect(() => {
    if (currentIndex >= cards.length && cards.length > 0) {
        const newIndex = 0; setCurrentIndex(newIndex); localStorage.setItem(storageKey, newIndex);
    } else { localStorage.setItem(storageKey, currentIndex); }
  }, [currentIndex, cards, storageKey]);

  useEffect(() => {
    if (currentCard?.id && currentCard.id !== 'fallback') { isFavorite(currentCard.id).then(setIsFavoriteCard); }
  }, [currentCard]);
  
  const handleToggleFavorite = async () => {
    if (!currentCard || currentCard.id === 'fallback') return;
    const result = await toggleFavorite(currentCard); setIsFavoriteCard(result);
  };

  const navigate = useCallback((direction) => {
      lastDirection.current = direction; setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);

  useEffect(() => {
    if (!isOpen) return;
    clearTimeout(autoBrowseTimerRef.current);
    const playSequence = () => {
        if (settings.autoPlayChinese && currentCard?.chinese) {
            playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => {
                if (settings.autoPlayBurmese && currentCard?.burmese) { playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer); } 
                else { startAutoBrowseTimer(); }
            });
        } else if (settings.autoPlayBurmese && currentCard?.burmese) { playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer); } 
        else { startAutoBrowseTimer(); }
    };
    const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } };
    const initialPlayTimer = setTimeout(playSequence, 600);
    return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); };
  }, [currentIndex, currentCard, settings, isOpen, navigate]);
  
  // ✅ 修改：发音练习按钮现在只打开面板
  const handlePronunciationPractice = useCallback((e) => {
      e.stopPropagation();
      setIsPracticePanelOpen(true);
  }, []);
  
  const pageTransitions = useTransition(isOpen, {
    from: { opacity: 0, transform: 'translateY(100%)' },
    enter: { opacity: 1, transform: 'translateY(0%)' },
    leave: { opacity: 0, transform: 'translateY(100%)' },
    config: { tension: 220, friction: 25 },
  });

  const cardTransitions = useTransition(currentIndex, {
      key: currentIndex,
      from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` },
      enter: { opacity: 1, transform: 'translateY(0%)' },
      leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
      config: { mass: 1, tension: 280, friction: 30 },
  });
  
  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
      if (event.target.closest('[data-no-gesture]')) return;
      if (down) return;
      event.stopPropagation(); 
      const isHorizontal = Math.abs(mx) > Math.abs(my);
      if (isHorizontal) {
          const isSignificant = Math.abs(mx) > 80 || (vel > 0.5 && Math.abs(mx) > 40);
          if (isSignificant) { onClose(); }
      } else {
          const isSignificant = Math.abs(my) > 60 || (vel > 0.4 && Math.abs(my) > 30);
          if (isSignificant) { navigate(yDir < 0 ? 1 : -1); }
      }
  }, { filterTaps: true, preventDefault: true, threshold: 10 });

  const cardContent = pageTransitions((style, item) =>
    item && (
      <animated.div style={{ ...styles.fullScreen, ...style }}>
        <div style={styles.gestureArea} {...bind()} />
        
        {/* Modals & Panels */}
        <HandwritingModal isOpen={isHandwritingModalOpen} onClose={() => setIsHandwritingModalOpen(false)} />
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {/* ✅ 新增：渲染新的发音练习面板 */}
        <PronunciationPracticePanel 
            isOpen={isPracticePanelOpen} 
            onClose={() => setIsPracticePanelOpen(false)}
            currentCard={currentCard}
            settings={settings}
        />
        
        {cardTransitions((cardStyle, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...cardStyle }}>
              <div style={styles.cardContainer}>
                  <div style={{ textAlign: 'center' }}>
                      <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                          <div style={styles.pinyin}>{pinyinConverter(cardData.pinyin || cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div>
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
                {/* ✅ 修改：麦克风按钮现在调用新的函数 */}
                <button style={styles.rightIconButton} onClick={handlePronunciationPractice} title="发音练习">
                    <FaMicrophone size={20} />
                </button>
                <button style={styles.rightIconButton} onClick={() => setIsHandwritingModalOpen(true)} title="手写练习"><FaPencilAlt size={20} /></button>
                {currentCard.chinese && currentCard.chinese.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( 
                    <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺动画"><FaPenFancy size={20} /></button>
                )}
                <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>
                  {isFavoriteCard ? <FaHeart size={20} color="#f87171" /> : <FaRegHeart size={20} />}
                </button>
            </div>
        )}
        
        {cards.length > 0 && (
            <div style={styles.bottomCenterCounter} data-no-gesture="true">{currentIndex + 1} / {cards.length}</div>
        )}
      </animated.div>
    )
  );

  if (isMounted) { return createPortal(cardContent, document.body); }
  return null;
};

// =================================================================================
// ===== 样式表 (已更新) =========================================================
// =================================================================================
const styles = {
    // --- 核心布局 & 卡片内容 (保持不变) ---
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: 'url(/background.jpg) center/cover no-repeat', backgroundAttachment: 'fixed', backgroundColor: '#004d40' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', borderRadius: '24px', overflow: 'hidden' },
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '4.5rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    textWordBurmese: { fontSize: '3.5rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    rightControls: { position: 'fixed', bottom: '25%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' },
    rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s', color: '#4a5568' },
    bottomCenterCounter: { position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(255, 255, 255, 0.2)', color: 'white', padding: '5px 15px', borderRadius: '15px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(3px)' },
    
    // --- ✅ 新增：发音练习面板样式 ---
    practicePanelOverlay: { position: 'fixed', inset: '0', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' },
    practicePanel: {
        width: '100%',
        background: 'white',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        padding: '20px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', // 适配 iPhone X 等设备
    },
    panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    panelTitle: { margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#333' },
    panelCloseButton: { background: 'none', border: 'none', fontSize: '1.5rem', color: '#aaa', cursor: 'pointer' },
    wordDisplay: { textAlign: 'center', marginBottom: '20px' },
    pinyinSmall: { fontSize: '1rem', color: '#666' },
    chineseBig: { fontSize: '2.5rem', fontWeight: 'bold', color: '#111', marginTop: '5px' },
    audioControls: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '25px' },
    controlButtonContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    playButton: {
        width: '60px', height: '60px', borderRadius: '50%',
        border: 'none', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'transform 0.2s ease'
    },
    standardPlayButton: { background: 'linear-gradient(145deg, #2196F3, #1976D2)' },
    userPlayButton: { background: 'linear-gradient(145deg, #4CAF50, #388E3C)' },
    buttonLabel: { fontSize: '0.8rem', color: '#555' },
    recordSection: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
    recordButton: {
        width: '80%', maxWidth: '300px',
        padding: '15px', borderRadius: '30px',
        border: 'none', color: 'white',
        fontSize: '1.1rem', fontWeight: 'bold',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '12px', cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    },
    startRecordButton: { background: 'linear-gradient(145deg, #007BFF, #0056b3)' },
    stopRecordButton: { background: 'linear-gradient(145deg, #f44336, #d32f2f)' },
    
    // --- 设置面板样式 (保持不变) ---
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)', padding: '15px' },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto', position: 'relative' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#aaa', lineHeight: 1 },
    settingGroup: { marginBottom: '20px' },
    settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
    settingControl: { display: 'flex', gap: '10px', alignItems: 'center' },
    settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
};

export default WordCard;
