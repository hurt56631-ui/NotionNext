// components/WordCard.js (最终修复版 - 修复了识别逻辑和拼音显示)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaHeart, FaRegHeart, FaPlay, FaUser, FaSyncAlt } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
// 移除了 HandwritingModal 的引用
// import HandwritingModal from '@/components/HandwritingModal';

// =================================================================================
// ===== 辅助工具 & Hooks (无改动) ===============================================
// =================================================================================
const DB_NAME = 'ChineseLearningDB'; const STORE_NAME = 'favoriteWords';
function openDB() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onerror = () => reject('数据库打开失败'); request.onsuccess = () => resolve(request.result); request.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' }); }; }); }
async function toggleFavorite(word) { const db = await openDB(); const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME); const existing = await new Promise((resolve) => { const getReq = store.get(word.id); getReq.onsuccess = () => resolve(getReq.result); getReq.onerror = () => resolve(null); }); if (existing) { store.delete(word.id); return false; } else { store.put({ id: word.id, chinese: word.chinese, burmese: word.burmese, pinyin: word.pinyin, imageUrl: word.imageUrl }); return true; } }
async function isFavorite(id) { const db = await openDB(); const tx = db.transaction(STORE_NAME, 'readonly'); const store = tx.objectStore(STORE_NAME); return new Promise((resolve) => { const getReq = store.get(id); getReq.onsuccess = () => resolve(!!getReq.result); getReq.onerror = () => resolve(false); }); }
const TTS_VOICES = [ { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' }, { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' }, ];
let _howlInstance = null;
const playTTS = async (text, voice, rate, onEndCallback, e) => { if (e && e.stopPropagation) e.stopPropagation(); if (!text || !voice) { if (onEndCallback) onEndCallback(); return; } if (_howlInstance?.playing()) _howlInstance.stop(); const apiUrl = 'https://libretts.is-an.org/api/tts'; const rateValue = Math.round(rate / 2); try { const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }), }); if (!response.ok) { console.error('TTS API 请求失败!', response.status); if (onEndCallback) onEndCallback(); return; } const audioBlob = await response.blob(); if (!audioBlob.type.startsWith('audio/')) { console.error('TTS API 未返回有效的音频文件'); if (onEndCallback) onEndCallback(); return; } const audioUrl = URL.createObjectURL(audioBlob); _howlInstance = new Howl({ src: [audioUrl], format: ['mpeg'], html5: true, onend: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); }, onloaderror: (id, err) => { console.error('Howler 加载音频错误:', err); URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); }, onplayerror: (id, err) => { console.error('Howler 播放音频错误:', err); URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); } }); _howlInstance.play(); } catch (error) { console.error('获取 TTS 音频时发生网络错误:', error); if (onEndCallback) onEndCallback(); } };
const useCardSettings = () => { const [settings, setSettings] = useState(() => { try { const savedSettings = localStorage.getItem('learningWordCardSettings'); const defaultSettings = { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0, }; return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings; } catch (error) { console.error("加载设置失败", error); return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0 }; } }); useEffect(() => { try { localStorage.setItem('learningWordCardSettings', JSON.stringify(settings)); } catch (error) { console.error("保存设置失败", error); } }, [settings]); return [settings, setSettings]; };
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => { const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); }; return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> {settings.autoBrowseDelay/1000}秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>); });

// 拼音解析函数 (无改动)
const parsePinyin = (pinyinNum) => { if (!pinyinNum) return { initial: '', final: '', tone: 0 }; const pinyinPlain = pinyinNum.slice(0, -1); const tone = parseInt(pinyinNum.slice(-1), 10) || 0; const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']; let initial = ''; let final = pinyinPlain; for (const init of initials) { if (pinyinPlain.startsWith(init)) { initial = init; final = pinyinPlain.substring(init.length); break; } } return { initial, final, tone }; };

// =================================================================================
// ===== ✅ 发音对比面板 (已修复拼音显示) ==========================================
// =================================================================================
const PronunciationComparisonPanel = ({ isOpen, onClose, correctText, userText, userAudioURL, settings }) => {
    const analysis = useMemo(() => {
        const correctPinyinArr = pinyinConverter(correctText, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyinArr = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });

        if (userPinyinArr.length === 0) return { overallScore: 0, results: [], message: "抱歉，没有识别到您的发音" };

        const maxLength = Math.max(correctPinyinArr.length, userPinyinArr.length);
        let score = 0;
        
        const results = Array.from({ length: maxLength }).map((_, index) => {
            const correctPy = correctPinyinArr[index];
            const userPy = userPinyinArr[index];
            
            if (!correctPy) return { char: '?', correct: { symbol: '' }, user: { symbol: pinyinConverter(userPy, { toneType: 'symbol' }) }, match: { initial: false, final: false, tone: false } };
            if (!userPy) return { char: correctText[index], correct: { symbol: pinyinConverter(correctPy, { toneType: 'symbol' }) }, user: { symbol: '' }, match: { initial: false, final: false, tone: false } };

            const correctParts = parsePinyin(correctPy);
            const userParts = parsePinyin(userPy);
            const match = { initial: correctParts.initial === userParts.initial, final: correctParts.final === userParts.final, tone: correctParts.tone === userParts.tone, };

            if (match.initial) score += 1;
            if (match.final) score += 1;
            if (match.tone) score += 1;

            return { char: correctText[index], correct: { symbol: pinyinConverter(correctPy, { toneType: 'symbol' }) }, user: { symbol: pinyinConverter(userPy, { toneType: 'symbol' }) }, match };
        });
        const totalPossibleScore = correctPinyinArr.length * 3;
        const overallScore = totalPossibleScore > 0 ? Math.round((score / totalPossibleScore) * 100) : 0;
        return { overallScore, results };
    }, [correctText, userText]);

    const playUserAudio = useCallback(() => { if (userAudioURL) new Audio(userAudioURL).play(); }, [userAudioURL]);
    const panelTransition = useTransition(isOpen, { from: { transform: 'translateY(100%)' }, enter: { transform: 'translateY(0%)' }, leave: { transform: 'translateY(100%)' } });

    return panelTransition((style, item) => item && (
        <animated.div style={{...styles.practicePanelOverlay, ...style}} onClick={onClose}>
            <div style={styles.practicePanel} onClick={e => e.stopPropagation()}>
                <div style={styles.panelHeader}><h3 style={styles.panelTitle}>发音分析报告</h3><div style={styles.overallScore}>得分: <span>{analysis.overallScore}</span></div></div>
                {analysis.message ? (<div style={styles.analysisMessage}>{analysis.message}</div>) : (
                    <div style={styles.analysisContainer}>
                        {analysis.results.map((res, index) => (
                            <div key={index} style={styles.charAnalysis}>
                                <div style={styles.charDisplay}>{res.char}</div>
                                <div style={styles.pinyinDisplay}><span style={{ color: res.match.initial && res.match.final && res.match.tone ? '#22c55e' : '#6c757d' }}>{res.correct.symbol}</span></div>
                                <div style={styles.userPinyinDisplay}>({res.user.symbol})</div>
                            </div>
                        ))}
                    </div>
                )}
                <div style={styles.panelActions}>
                    <button style={styles.actionButton} onClick={(e) => playTTS(correctText, settings.voiceChinese, settings.speechRateChinese, null, e)}><FaPlay/> 标准发音</button>
                    {userAudioURL && (<button style={styles.actionButton} onClick={playUserAudio}><FaUser/> 我的录音</button>)}
                    <button style={{...styles.actionButton, background: '#007BFF', color: 'white'}} onClick={onClose}><FaSyncAlt/> 再试一次</button>
                </div>
            </div>
        </animated.div>
    ));
};


// =================================================================================
// ===== 主组件: WordCard (已修复识别逻辑) =========================================
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  const storageKey = `wordCardProgress_${progressKey}`;
  const cards = useMemo(() => { const mapped = words.map(w => ({ id: w.id, chinese: w.chinese, burmese: w.burmese, pinyin: w.pinyin, imageUrl: w.imageUrl })); if (settings.order === 'random') { for (let i = mapped.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mapped[i], mapped[j]] = [mapped[j], mapped[i]]; } } return mapped.length > 0 ? mapped : [{ id: 'fallback', chinese: "暂无单词", pinyin: "zàn wú dān cí", burmese: "..." }]; }, [words, settings.order]);
  const [currentIndex, setCurrentIndex] = useState(() => { if (typeof window === 'undefined') return 0; try { const savedIndex = localStorage.getItem(storageKey); const index = savedIndex ? parseInt(savedIndex, 10) : 0; return index < cards.length ? index : 0; } catch (error) { return 0; } });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [userAudioURL, setUserAudioURL] = useState(null);
  const [isComparisonPanelOpen, setIsComparisonPanelOpen] = useState(false);
  
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const currentCard = cards[currentIndex];

  useEffect(() => { localStorage.setItem(storageKey, currentIndex); }, [currentIndex, storageKey]);
  useEffect(() => { if (currentCard?.id && currentCard.id !== 'fallback') { isFavorite(currentCard.id).then(setIsFavoriteCard); } }, [currentCard]);
  const handleToggleFavorite = async () => { if (currentCard && currentCard.id !== 'fallback') setIsFavoriteCard(await toggleFavorite(currentCard)); };
  const navigate = useCallback((direction) => { lastDirection.current = direction; setCurrentIndex(prev => (prev + direction + cards.length) % cards.length); }, [cards.length]);

  useEffect(() => { if (!isOpen) return; clearTimeout(autoBrowseTimerRef.current); const playSequence = () => { if (settings.autoPlayChinese && currentCard?.chinese) { playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => { if (settings.autoPlayBurmese && currentCard?.burmese) { playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer); } else { startAutoBrowseTimer(); } }); } else if (settings.autoPlayBurmese && currentCard?.burmese) { playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, startAutoBrowseTimer); } else { startAutoBrowseTimer(); } }; const startAutoBrowseTimer = () => { if (settings.autoBrowse) { autoBrowseTimerRef.current = setTimeout(() => { navigate(1); }, settings.autoBrowseDelay); } }; const initialPlayTimer = setTimeout(playSequence, 600); return () => { clearTimeout(initialPlayTimer); clearTimeout(autoBrowseTimerRef.current); }; }, [currentIndex, currentCard, settings, isOpen, navigate]);
  
  // ✅ 核心逻辑修复：只有成功识别后才打开面板
  useEffect(() => {
    // 当 recognizedText 状态更新为一个非空字符串时，才打开面板
    if (recognizedText) {
      setIsComparisonPanelOpen(true);
    }
  }, [recognizedText]);

  const handlePronunciationPractice = useCallback(async (e) => {
    e.stopPropagation();
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (isRecording) { recognitionRef.current?.stop(); mediaRecorderRef.current?.stop(); return; }
    if (userAudioURL) URL.revokeObjectURL(userAudioURL);
    setUserAudioURL(null); setRecognizedText(''); setIsComparisonPanelOpen(false);
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !navigator.mediaDevices?.getUserMedia) { alert('抱歉，您的浏览器不支持语音识别或录音功能。'); return; }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'zh-CN';
        recognitionRef.current.interimResults = false;
        recognitionRef.current.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，]/g, '');
            // 只有当识别到内容时才更新 state，这会触发上面的 useEffect
            if(transcript) setRecognizedText(transcript);
        };
        recognitionRef.current.onend = () => { if (mediaRecorderRef.current?.state === 'recording') { mediaRecorderRef.current.stop(); } setIsRecording(false); };
        recognitionRef.current.onerror = (event) => { console.error('语音识别错误:', event.error); setIsRecording(false); };

        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => { audioChunksRef.current.push(event.data); };
        mediaRecorderRef.current.onstop = () => { const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); const url = URL.createObjectURL(audioBlob); setUserAudioURL(url); stream.getTracks().forEach(track => track.stop()); };

        mediaRecorderRef.current.start();
        recognitionRef.current.start();
        setIsRecording(true);
    } catch (err) { console.error("无法启动录音或识别:", err); alert("无法启动录音。请确保您已授予麦克风权限。"); setIsRecording(false); }
  }, [isRecording, userAudioURL]);

  const closeComparisonPanel = useCallback(() => { setIsComparisonPanelOpen(false); }, []);

  const pageTransitions = useTransition(isOpen, { from: { opacity: 0 }, enter: { opacity: 1 }, leave: { opacity: 0 } });
  const cardTransitions = useTransition(currentIndex, { key: currentIndex, from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' } });
  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, event }) => { if (event.target.closest('[data-no-gesture]')) return; if (down) return; event.stopPropagation(); const isHorizontal = Math.abs(mx) > Math.abs(my); if (isHorizontal) { if (Math.abs(mx) > 80 || (vel > 0.5 && Math.abs(mx) > 40)) { onClose(); } } else { if (Math.abs(my) > 60 || (vel > 0.4 && Math.abs(my) > 30)) { navigate(my < 0 ? 1 : -1); } } }, { filterTaps: true, preventDefault: true, threshold: 10 });

  const cardContent = pageTransitions((style, item) => item && (
      <animated.div style={{ ...styles.fullScreen, ...style }}>
        <div style={styles.gestureArea} {...bind()} />
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        <PronunciationComparisonPanel isOpen={isComparisonPanelOpen} onClose={closeComparisonPanel} correctText={currentCard?.chinese || ''} userText={recognizedText} userAudioURL={userAudioURL} settings={settings} />
        {cardTransitions((cardStyle, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          return ( <animated.div key={i} style={{ ...styles.animatedCardShell, ...cardStyle }}> <div style={styles.cardContainer}> <div style={{ textAlign: 'center' }}> <div style={{ cursor: 'pointer' }} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}> <div style={styles.pinyin}>{pinyinConverter(cardData.pinyin || cardData.chinese, { toneType: 'symbol', separator: ' ' })}</div> <div style={styles.textWordChinese}>{cardData.chinese}</div> </div> <div style={{ cursor: 'pointer', marginTop: '2.5rem' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}> <div style={styles.textWordBurmese}>{cardData.burmese}</div> </div> </div> </div> </animated.div> );
        })}
        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={20} /></button>
                <button style={styles.rightIconButton} onClick={handlePronunciationPractice} title="发音练习">{isRecording ? <div style={styles.recordingIndicator} /> : <FaMicrophone size={20} />}</button>
                {currentCard.chinese && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && ( <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺动画"><FaPenFancy size={20} /></button> )}
                <button style={styles.rightIconButton} onClick={handleToggleFavorite} title={isFavoriteCard ? "取消收藏" : "收藏"}>{isFavoriteCard ? <FaHeart size={20} color="#f87171" /> : <FaRegHeart size={20} />}</button>
            </div>
        )}
        {cards.length > 0 && ( <div style={styles.bottomCenterCounter} data-no-gesture="true">{currentIndex + 1} / {cards.length}</div> )}
      </animated.div>
    )
  );
  if (isMounted) { return createPortal(cardContent, document.body); }
  return null;
};

// =================================================================================
// ===== 样式表 (保持不变) =========================================================
// =================================================================================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: 'url(/background.jpg) center/cover no-repeat', backgroundAttachment: 'fixed', backgroundColor: '#004d40' }, 
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent' },
    pinyin: { fontSize: '1.5rem', color: '#fcd34d', textShadow: '0 1px 4px rgba(0,0,0,0.5)', marginBottom: '1.2rem', letterSpacing: '0.05em' }, 
    textWordChinese: { fontSize: '4.5rem', fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }, 
    textWordBurmese: { fontSize: '3.5rem', color: '#fce38a', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.8, wordBreak: 'break-word', textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
    rightControls: { position: 'fixed', top: '60%', right: '15px', transform: 'translateY(-50%)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' },
    rightIconButton: { background: 'rgba(255, 255, 255, 0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'transform 0.2s', color: '#4a5568' },
    recordingIndicator: { width: '18px', height: '18px', borderRadius: '50%', background: '#f44336', animation: 'pulse 1.5s infinite' },
    bottomCenterCounter: { position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(0, 0, 0, 0.4)', color: 'white', padding: '5px 15px', borderRadius: '15px', fontSize: '1rem', fontWeight: 'bold', backdropFilter: 'blur(5px)' },
    
    practicePanelOverlay: { position: 'fixed', inset: '0', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(5px)' },
    practicePanel: { width: '100%', maxWidth: '600px', margin: '0 auto', background: '#f8f9fa', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)', padding: '20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' },
    panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #e9ecef', paddingBottom: '10px' },
    panelTitle: { margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#343a40' },
    overallScore: { fontSize: '1rem', color: '#495057', fontWeight: '500' },
    'overallScore span': { fontWeight: 'bold', fontSize: '1.4rem', color: '#007BFF' },
    analysisMessage: { textAlign: 'center', padding: '30px 10px', color: '#6c757d', fontSize: '1.1rem' },
    analysisContainer: { display: 'flex', gap: '10px', padding: '15px 5px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
    charAnalysis: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', background: 'white', padding: '10px 12px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', flexShrink: 0, border: '1px solid #dee2e6' },
    charDisplay: { fontSize: '2rem', fontWeight: 'bold', color: '#212529' },
    pinyinDisplay: { fontSize: '1.2rem' },
    userPinyinDisplay: { fontSize: '0.9rem', color: '#6c757d', fontStyle: 'italic' },
    pinyinPart: { transition: 'color 0.3s' },
    panelActions: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginTop: '20px' },
    actionButton: { padding: '12px', borderRadius: '12px', border: 'none', background: '#e9ecef', color: '#495057', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' },

    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002, backdropFilter: 'blur(5px)', padding: '15px' },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto', position: 'relative' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#aaa', lineHeight: 1 },
    settingGroup: { marginBottom: '20px' },
    settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
    settingControl: { display: 'flex', gap: '10px', alignItems: 'center' },
    settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
};

const styleSheet = typeof window !== 'undefined' ? document.styleSheets[0] : null;
try {
    if (styleSheet) {
        styleSheet.insertRule(`
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(244, 67, 54, 0); }
                100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
            }
        `, styleSheet.cssRules.length);
    }
} catch (e) {
    console.warn("无法插入 CSS 规则", e);
}

export default WordCard;
