// components/WordCard.js (最终修复版：浅色背景 + 移除列表逻辑 + 旧版拼音修复 + 语音识别修复)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaRandom, FaSortAmountDown, 
    FaHeart, FaRegHeart, FaVolumeUp, FaArrowRight, FaTimes,
    FaFacebookMessenger 
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// ===== 1. 数据库配置 =====
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 2;
const STORE_FAVORITES = 'favoriteWords';

function openDB() {
    if (typeof window === 'undefined') return Promise.reject("Server side");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('数据库打开失败');
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
                db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
            }
        };
    });
}

async function toggleFavorite(word) {
    if (typeof window === 'undefined') return false;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FAVORITES, 'readwrite');
        const store = tx.objectStore(STORE_FAVORITES);
        return new Promise((resolve) => {
            const getReq = store.get(word.id);
            getReq.onsuccess = () => {
                if (getReq.result) { store.delete(word.id); resolve(false); }
                else { store.put({ ...word }); resolve(true); }
            };
            getReq.onerror = () => resolve(false);
        });
    } catch (e) { return false; }
}

async function isFavorite(id) {
    if (typeof window === 'undefined' || !id) return false;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FAVORITES, 'readonly');
        const store = tx.objectStore(STORE_FAVORITES);
        return new Promise((resolve) => {
            const getReq = store.get(id);
            getReq.onsuccess = () => resolve(!!getReq.result);
            getReq.onerror = () => resolve(false);
        });
    } catch (e) { return false; }
}

// =================================================================================
// ===== 2. 拼音解析工具 (从旧代码移植，修复声调显示) =====
// =================================================================================
const parsePinyin = (pinyinNum) => {
    if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' };
    // 简单清洗
    const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, '');
    let pinyinPlain = rawPinyin.replace(/[1-5]$/, '');
    const toneMatch = rawPinyin.match(/[1-5]$/);
    const tone = toneMatch ? toneMatch[0] : '0';
    // 转换为带声调符号的
    const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' });
    
    // 声母表
    const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
    let initial = '';
    let final = pinyinPlain;
    
    for (const init of initials) {
        if (pinyinPlain.startsWith(init)) {
            initial = init;
            final = pinyinPlain.slice(init.length);
            break;
        }
    }
    return { initial, final, tone, pinyinMark, rawPinyin };
};

// 拼音可视化组件
const PinyinVisualizer = React.memo(({ pinyinStr }) => {
    // 假设 pinyinStr 是类似 "ni3" 这样的数字拼音，或者 "nǐ"
    // 为了兼容，我们先转成数字格式再解析
    const parts = parsePinyin(pinyinConverter(pinyinStr, { toneType: 'num' }));
    
    // 样式：声母深色，韵母深色，声调红色
    return (
        <div style={styles.pinyinVisualizerContainer}>
            <span style={styles.pinyinPart}>{parts.initial}</span>
            <span style={styles.pinyinPart}>{parts.pinyinMark.replace(parts.initial, '')}</span>
        </div>
    );
});

// =================================================================================
// ===== 3. TTS 逻辑 (修复版：使用旧版 API) =====
// =================================================================================
const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

let sounds = null;
const initSounds = () => {
    if (!sounds && typeof window !== 'undefined') {
        sounds = {
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
            correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
            incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
        };
    }
};

let _howlInstance = null;

const playTTS = (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text) { if (onEndCallback) onEndCallback(); return; }

    console.log(`[TTS Log] Playing: ${text}, Voice: ${voice}, Rate: ${rate}`);

    if (_howlInstance?.playing()) _howlInstance.stop();
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();

    // 1. 尝试使用旧版 API (leftsite.cn)
    try {
        const rateValue = Math.round(rate / 2); // 转换语速
        const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;
        
        _howlInstance = new Howl({ 
            src: [ttsUrl], 
            html5: true, 
            onend: onEndCallback,
            onloaderror: () => {
                console.warn('[TTS] API Load Error, switching to native.');
                playNativeTTS(text, voice, rate, onEndCallback);
            },
            onplayerror: () => {
                console.warn('[TTS] Play Error, unlocking audio context.');
                _howlInstance.once('unlock', function() { _howlInstance.play(); });
            }
        });
        _howlInstance.play();
    } catch (err) {
        console.error('[TTS] API Logic Fail', err);
        playNativeTTS(text, voice, rate, onEndCallback);
    }
};

// 浏览器原生 TTS 兜底
const playNativeTTS = (text, voice, rate, onEndCallback) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice.includes('my') ? 'my-MM' : 'zh-CN';
    u.rate = rate >= 0 ? 1 + (rate / 100) : 0.8;
    u.onend = onEndCallback;
    u.onerror = onEndCallback;
    window.speechSynthesis.speak(u);
};

const playSoundEffect = (type) => {
    if (typeof window !== 'undefined') {
        initSounds();
        if (sounds && sounds[type]) sounds[type].play();
    }
};

// =================================================================================
// ===== 4. 设置 Hook =====
// =================================================================================
const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        const defaults = { 
            order: 'sequential', 
            autoPlayChinese: true, 
            autoPlayBurmese: true, 
            autoBrowse: false, 
            autoBrowseDelay: 6000, 
            voiceChinese: 'zh-CN-XiaoyouNeural', 
            voiceBurmese: 'my-MM-NilarNeural', 
            speechRateChinese: 0, 
            speechRateBurmese: 0 
        };
        if (typeof window === 'undefined') return defaults;
        try {
            const saved = localStorage.getItem('learningWordCardSettings');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch (e) { return defaults; }
    });
    useEffect(() => {
        if (typeof window !== 'undefined') localStorage.setItem('learningWordCardSettings', JSON.stringify(settings));
    }, [settings]);
    return [settings, setSettings];
};

// =================================================================================
// ===== 5. 子组件 (设置 & 录音) =====
// =================================================================================

// 修复后的录音组件：使用 SpeechRecognition (非 404 的 Blob 方式)
const PronunciationComparison = ({ correctWord, onClose }) => {
    const [status, setStatus] = useState('idle'); // idle, listening, processing, result
    const [userText, setUserText] = useState('');
    const [score, setScore] = useState(0);

    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("您的浏览器不支持语音识别");
            return;
        }
        
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setStatus('listening');
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setUserText(transcript);
            
            // 简单对比打分
            const cleanCorrect = correctWord.replace(/[^\u4e00-\u9fa5]/g, '');
            const cleanUser = transcript.replace(/[^\u4e00-\u9fa5]/g, '');
            
            if (cleanCorrect === cleanUser) {
                setScore(100);
                playSoundEffect('correct');
            } else {
                setScore(50);
                playSoundEffect('incorrect');
            }
            setStatus('result');
        };

        recognition.onerror = (e) => {
            console.error(e);
            alert("识别错误，请重试");
            setStatus('idle');
        };

        recognition.onend = () => {
            if (status === 'listening') setStatus('processing');
        };

        recognition.start();
    };

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}>
                    <h3>发音评测</h3>
                    <button onClick={onClose} style={{border:'none',background:'none',fontSize:20}}><FaTimes/></button>
                </div>
                <div style={styles.recordContent}>
                    <div style={{fontSize: '2rem', fontWeight: 'bold', marginBottom: 20}}>{correctWord}</div>
                    
                    {status === 'result' ? (
                        <div style={{textAlign: 'center'}}>
                            <div style={{fontSize: '3rem', color: score === 100 ? '#10b981' : '#f59e0b'}}>{score}分</div>
                            <div style={{color: '#666'}}>识别结果: {userText}</div>
                            <button style={{marginTop: 20, padding: '10px 20px', background: '#3b82f6', color: 'white', border:'none', borderRadius: 8}} onClick={() => setStatus('idle')}>再试一次</button>
                        </div>
                    ) : (
                        <div style={{textAlign: 'center'}}>
                            <button 
                                onClick={startListening}
                                style={{
                                    width: 80, height: 80, borderRadius: '50%', 
                                    background: status === 'listening' ? '#ef4444' : '#3b82f6',
                                    color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                    animation: status === 'listening' ? 'pulse 1.5s infinite' : 'none'
                                }}
                            >
                                <FaMicrophone size={32} />
                            </button>
                            <p style={{marginTop: 15, color: '#666'}}>
                                {status === 'listening' ? '正在听...' : '点击麦克风开始朗读'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SettingsPanel = ({ settings, setSettings, onClose }) => {
    const handleSettingChange = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom: 20}}>
                    <h3 style={{margin:0}}>学习设置</h3>
                    <button onClick={onClose} style={{border:'none', background:'none', fontSize: 20}}><FaTimes/></button>
                </div>
                
                {/* 恢复了语速和发音人设置 */}
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>发音人 (中文)</label>
                    <select 
                        style={styles.settingSelect} 
                        value={settings.voiceChinese} 
                        onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}
                    >
                        {TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>中文语速 ({settings.speechRateChinese})</label>
                    <input 
                        type="range" min="-50" max="50" step="10" 
                        value={settings.speechRateChinese} 
                        onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value))}
                        style={{width: '100%'}} 
                    />
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>自动播放</label>
                    <div style={{display:'flex', gap: 15}}>
                        <label><input type="checkbox" checked={settings.autoPlayChinese} onChange={e=>handleSettingChange('autoPlayChinese', e.target.checked)}/> 中文</label>
                        <label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={e=>handleSettingChange('autoPlayBurmese', e.target.checked)}/> 缅语</label>
                    </div>
                </div>
            </div>
        </div>
    );
};

// =================================================================================
// ===== 6. 主组件 WordCard =====
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default' }) => {
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
        // 注入动画 Keyframes
        if (typeof document !== 'undefined' && !document.getElementById('pulse-style')) {
            const s = document.createElement("style");
            s.id = 'pulse-style';
            s.innerText = `@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }`;
            document.head.appendChild(s);
        }
    }, []);

    const [settings, setSettings] = useCardSettings();

    // ✅ 数据处理：兼容各种字段名
    const initialCards = useMemo(() => {
        if (!Array.isArray(words)) return [];
        return words.map(w => ({
            id: w.id || Math.random().toString(36).substr(2, 9),
            chinese: w.chinese || w.chineseWord || w.word || '',
            audioText: w.audioText || w.tts_text || w.chinese || '',
            burmese: w.burmese || w.burmeseTranslation || w.translation || '', 
            mnemonic: w.mnemonic || '',
            example: w.example || '',
        })).filter(w => w.chinese); 
    }, [words]);

    // 使用 State 管理当前的卡片列表（为了支持“移除”功能）
    const [activeCards, setActiveCards] = useState([]);
    
    // 初始化列表（支持乱序）
    useEffect(() => {
        let cards = [...initialCards];
        if (settings.order === 'random') {
            cards.sort(() => Math.random() - 0.5);
        }
        setActiveCards(cards);
    }, [initialCards, settings.order]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRecordingOpen, setIsRecordingOpen] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [isFavoriteCard, setIsFavoriteCard] = useState(false);
    
    const autoBrowseTimerRef = useRef(null);
    const lastDirection = useRef(0);
    
    const currentCard = activeCards[currentIndex];

    // 收藏状态检查
    useEffect(() => {
        if (currentCard?.id) isFavorite(currentCard.id).then(setIsFavoriteCard);
    }, [currentCard]);

    // 分享逻辑
    const handleFacebookShare = useCallback((e) => {
        e.stopPropagation();
        if (!currentCard) return;
        const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''; // 去掉 hash
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) window.location.href = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
        else window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    }, [currentCard]);

    // 收藏切换
    const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        if (!currentCard) return;
        const res = await toggleFavorite(currentCard);
        setIsFavoriteCard(res);
    };

    // ✅ 核心逻辑：“认识” -> 移除卡片
    const handleKnow = (e) => {
        e.stopPropagation();
        if (!currentCard) return;

        // 移除当前卡片
        const newCards = activeCards.filter((_, index) => index !== currentIndex);
        setActiveCards(newCards);
        setIsRevealed(false);

        // 如果还有卡片，调整 index（防止越界）
        if (newCards.length > 0) {
            if (currentIndex >= newCards.length) {
                setCurrentIndex(0); // 如果删的是最后一个，回到第一个
            }
            // 否则保持 index 不变，自动显示下一张
        }
    };

    // “不认识” -> 下一张（不移除，循环）
    const handleDontKnow = (e) => {
        e.stopPropagation();
        if (isRevealed) {
            lastDirection.current = 1;
            setCurrentIndex(prev => (prev + 1) % activeCards.length);
            setIsRevealed(false);
        } else {
            setIsRevealed(true); // 先看答案
        }
    };

    // 自动播放逻辑
    useEffect(() => {
        if (!isOpen || !currentCard) return;
        clearTimeout(autoBrowseTimerRef.current);
        
        console.log('[AutoPlay] Start for:', currentCard.chinese);

        if (settings.autoPlayChinese) {
            playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese, 'api', () => {
                if (settings.autoPlayBurmese && isRevealed) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, 'api', startTimer);
                } else { startTimer(); }
            });
        } else { startTimer(); }

        function startTimer() {
            if (settings.autoBrowse) {
                autoBrowseTimerRef.current = setTimeout(() => {
                    setCurrentIndex(prev => (prev + 1) % activeCards.length);
                }, settings.autoBrowseDelay);
            }
        }
        return () => clearTimeout(autoBrowseTimerRef.current);
    }, [currentIndex, isRevealed, settings, isOpen, activeCards.length]);

    // 动画
    const transitions = useTransition(currentCard, {
        key: currentCard?.id,
        from: { opacity: 0, transform: `translateY(100%)` },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: `translateY(-100%)`, position: 'absolute' },
        config: { tension: 280, friction: 30 },
        onStart: () => playSoundEffect('switch'),
    });

    const pageTransition = useTransition(isOpen, {
        from: { opacity: 0, transform: 'translateY(100%)' },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: 'translateY(100%)' },
    });

    // 划屏手势
    const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
        if (event.target.closest('[data-no-gesture]')) return;
        if (down) return;
        event.stopPropagation();
        
        // 下滑关闭
        if (my > 100 && vel > 0.5) onClose();
        // 左滑下一张
        if (mx < -50 && Math.abs(mx) > Math.abs(my)) handleDontKnow(event);

    }, { filterTaps: true, preventDefault: true });

    const content = pageTransition((style, item) => item && (
        <animated.div style={{ ...styles.fullScreen, ...style }}>
            <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(p => !p)} />
            
            {/* 弹窗们 */}
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
            {isRecordingOpen && <PronunciationComparison correctWord={currentCard.chinese} onClose={() => setIsRecordingOpen(false)} />}

            {/* 卡片区域 */}
            {activeCards.length > 0 ? (
                transitions((cardStyle, item) => item && (
                    <animated.div style={{ ...styles.cardShell, ...cardStyle }}>
                        <div style={styles.cardContent}>
                            <div onClick={e => {
                                e.stopPropagation();
                                playTTS(item.audioText, settings.voiceChinese, settings.speechRateChinese, 'api');
                            }}>
                                {/* ✅ 修复：使用 PinyinVisualizer 显示正确的音调 */}
                                <PinyinVisualizer pinyinStr={pinyinConverter(item.chinese, { toneType: 'num' })} />
                                <div style={styles.chinese}>{item.chinese}</div>
                            </div>
                            
                            {(isRevealed) && (
                                <animated.div style={{ marginTop: 30 }} onClick={e => {
                                    e.stopPropagation();
                                    playTTS(item.burmese, settings.voiceBurmese, 0, 'api');
                                }}>
                                    <div style={styles.burmese}>{item.burmese}</div>
                                    {item.example && <div style={styles.example}>{item.example}</div>}
                                </animated.div>
                            )}
                        </div>
                    </animated.div>
                ))
            ) : (
                <div style={styles.completionContainer}>
                    <h2>🎉 全部完成！</h2>
                    <p>您已学完本组单词</p>
                    <button style={styles.closeBigBtn} onClick={onClose}>返回列表</button>
                </div>
            )}

            {/* 右侧工具栏 */}
            {activeCards.length > 0 && (
                <div style={styles.rightBar} data-no-gesture="true">
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setIsSettingsOpen(true)}}><FaCog /></button>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese)}}><FaVolumeUp /></button>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setIsRecordingOpen(true)}}><FaMicrophone /></button>
                    <button style={{...styles.iconBtn, color: '#0084FF'}} onClick={handleFacebookShare}><FaFacebookMessenger /></button>
                    {currentCard?.chinese && currentCard.chinese.length <= 4 && (
                        <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setWriterChar(currentCard.chinese)}}><FaPenFancy /></button>
                    )}
                    <button style={{...styles.iconBtn, color: isFavoriteCard ? 'red' : 'gray'}} onClick={handleToggleFavorite}>
                        {isFavoriteCard ? <FaHeart /> : <FaRegHeart />}
                    </button>
                </div>
            )}

            {/* 底部按钮 */}
            {activeCards.length > 0 && (
                <div style={styles.bottomBar} data-no-gesture="true">
                    <div style={styles.buttons}>
                        <button style={{...styles.btn, background:'#f59e0b'}} onClick={handleDontKnow}>
                            {isRevealed ? '下一张' : '不认识'}
                        </button>
                        <button style={{...styles.btn, background:'#22c55e'}} onClick={handleKnow}>认识 (移除)</button>
                    </div>
                </div>
            )}

        </animated.div>
    ));

    if (isMounted) return createPortal(content, document.body);
    return null;
};

// =================================================================================
// ===== 样式表 (浅色系 + 大字体) =====
// =================================================================================
const styles = {
    // 浅色背景
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, background: '#f8fafc', overflow: 'hidden', touchAction: 'none' },
    gestureArea: { position: 'absolute', inset: 0, zIndex: 1 },
    
    // 卡片布局
    cardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' },
    cardContent: { pointerEvents: 'auto', textAlign: 'center', width: '100%', maxWidth: 500, paddingBottom: 100 },
    
    // 文字样式 (浅色背景用深色字)
    pinyinVisualizerContainer: { display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 10 },
    pinyinPart: { fontSize: '1.8rem', color: '#4b5563', fontWeight: 500 }, // 灰色拼音
    chinese: { fontSize: '4rem', fontWeight: 'bold', color: '#1f2937' }, // 黑色汉字
    burmese: { fontSize: '2.2rem', color: '#059669', marginTop: 15, fontWeight: 500 }, // 绿色缅语
    example: { fontSize: '1.2rem', color: '#4b5563', marginTop: 20, padding: 15, background: '#e5e7eb', borderRadius: 12 },

    // 底部栏
    bottomBar: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: 30, zIndex: 10, background: 'linear-gradient(to top, #fff, transparent)' },
    buttons: { display: 'flex', gap: 20, width: '100%', maxWidth: 400, margin: '0 auto' },
    btn: { flex: 1, padding: 18, border: 'none', borderRadius: 16, color: 'white', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
    
    // 右侧栏
    rightBar: { position: 'fixed', right: 20, bottom: '25%', display: 'flex', flexDirection: 'column', gap: 15, zIndex: 10 },
    iconBtn: { width: 48, height: 48, borderRadius: '50%', border: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', color: '#4b5563' },
    
    // 完成页
    completionContainer: { position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:5, color: '#333' },
    closeBigBtn: { marginTop: 20, padding: '12px 30px', background: '#3b82f6', color:'white', border:'none', borderRadius: 8, fontSize: 18 },

    // 弹窗
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    settingsContent: { background: 'white', padding: 25, borderRadius: 20, width: '85%', maxWidth: 350, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
    settingGroup: { marginBottom: 20 },
    settingLabel: { display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#333' },
    settingSelect: { width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' },
    
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    comparisonPanel: { background: 'white', borderRadius: 20, width: '90%', maxWidth: 350, overflow: 'hidden' },
    recordHeader: { padding: 15, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems:'center' },
    recordContent: { padding: 20, textAlign: 'center' },
    idleStateContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 },
    instructionText: { color: '#666' },
};

export default WordCard;
