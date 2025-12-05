import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { 
    FaMicrophone, FaPenFancy, FaCog, FaHeart, FaRegHeart, 
    FaVolumeUp, FaTimes, FaFacebookMessenger 
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// ===== 1. 数据库配置 =====
const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 2;
const STORE_FAVORITES = 'favoriteWords';

function openDB() {
    if (typeof window === 'undefined') return Promise.reject("Server side");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('DB Error');
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_FAVORITES)) db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
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

// ===== 2. 拼音解析工具 (修复第一声显示) =====
const parsePinyin = (pinyinNum) => {
    if (!pinyinNum) return { initial: '', final: '', tone: '0', pinyinMark: '', rawPinyin: '' };
    const rawPinyin = pinyinNum.toLowerCase().replace(/[^a-z0-9]/g, '');
    let pinyinPlain = rawPinyin.replace(/[1-5]$/, '');
    const toneMatch = rawPinyin.match(/[1-5]$/);
    const tone = toneMatch ? toneMatch[0] : '0';
    const pinyinMark = pinyinConverter(rawPinyin, { toneType: 'symbol' });
    const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
    let initial = '';
    let final = pinyinPlain;
    for (const init of initials) {
        if (pinyinPlain.startsWith(init)) {
            initial = init; final = pinyinPlain.slice(init.length); break;
        }
    }
    return { initial, final, tone, pinyinMark, rawPinyin };
};

const PinyinVisualizer = React.memo(({ pinyinStr }) => {
    if (!pinyinStr) return null;
    const parts = parsePinyin(pinyinConverter(pinyinStr, { toneType: 'num' }));
    return (
        <div style={styles.pinyinVisualizerContainer}>
            <span style={styles.pinyinPart}>{parts.initial}</span>
            <span style={styles.pinyinPart}>{parts.pinyinMark.replace(parts.initial, '')}</span>
        </div>
    );
});

// ===== 3. TTS 逻辑 (修复朗读) =====
const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声(幼)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

let _howlInstance = null;

const playTTS = (text, voice, rate, source, onEndCallback) => {
    if (!text) { if (onEndCallback) onEndCallback(); return; }
    console.log(`[TTS] 播放: ${text}`);

    if (_howlInstance?.playing()) _howlInstance.stop();
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();

    const playNative = () => {
        console.log('[TTS] 切换到本地语音');
        const u = new SpeechSynthesisUtterance(text);
        u.lang = voice?.includes('my') ? 'my-MM' : 'zh-CN';
        u.rate = rate >= 0 ? 1 + (rate / 100) : 0.8;
        u.onend = onEndCallback;
        u.onerror = onEndCallback;
        window.speechSynthesis.speak(u);
    };

    if (source === 'browser') { playNative(); return; }

    try {
        const rateValue = Math.round(rate / 2);
        const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;
        _howlInstance = new Howl({ 
            src: [ttsUrl], html5: true, 
            onend: onEndCallback,
            onloaderror: () => { console.warn('[TTS] API加载失败'); playNative(); },
            onplayerror: () => { _howlInstance.once('unlock', () => _howlInstance.play()); }
        });
        _howlInstance.play();
    } catch (err) {
        console.error('[TTS] Error', err);
        playNative();
    }
};

const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        const defaults = { order: 'sequential', ttsSource: 'server', autoPlayChinese: true, autoPlayBurmese: true, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0 };
        if (typeof window === 'undefined') return defaults;
        try { return JSON.parse(localStorage.getItem('wc_settings')) || defaults; } catch (e) { return defaults; }
    });
    useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('wc_settings', JSON.stringify(settings)); }, [settings]);
    return [settings, setSettings];
};

// ===== 4. 子组件 =====
const PronunciationComparison = ({ correctWord, onClose }) => {
    const [status, setStatus] = useState('idle');
    const [userText, setUserText] = useState('');
    const [score, setScore] = useState(0);

    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert("浏览器不支持语音识别"); return; }
        
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.onstart = () => setStatus('listening');
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setUserText(transcript);
            const cleanCorrect = correctWord.replace(/[^\u4e00-\u9fa5]/g, '');
            const cleanUser = transcript.replace(/[^\u4e00-\u9fa5]/g, '');
            setScore(cleanCorrect === cleanUser ? 100 : 50);
            setStatus('result');
        };
        recognition.onerror = () => { alert("识别失败"); setStatus('idle'); };
        recognition.start();
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}><h3>发音评测</h3><FaTimes onClick={onClose}/></div>
                <div style={{padding:20, textAlign:'center'}}>
                    <h2 style={{fontSize:'2rem', marginBottom:20}}>{correctWord}</h2>
                    {status === 'result' ? (
                        <div>
                            <div style={{fontSize:'3rem', color: score===100?'#10b981':'#f59e0b'}}>{score}分</div>
                            <p>识别: {userText}</p>
                            <button style={styles.btnPrimary} onClick={() => setStatus('idle')}>再试一次</button>
                        </div>
                    ) : (
                        <button onClick={startListening} style={{...styles.recordBtn, animation: status==='listening'?'pulse 1.5s infinite':'none'}}>
                            <FaMicrophone size={32} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const SettingsPanel = ({ settings, setSettings, onClose }) => (
    <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}><h3>设置</h3><FaTimes onClick={onClose}/></div>
            <div style={{padding:20}}>
                <div style={styles.settingRow}>
                    <label>中文发音</label>
                    <select value={settings.voiceChinese} onChange={e=>setSettings(s=>({...s, voiceChinese:e.target.value}))} style={styles.select}>
                        {TTS_VOICES.filter(v=>v.value.startsWith('zh')).map(v=><option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                </div>
                <div style={styles.settingRow}>
                    <label>语速 ({settings.speechRateChinese})</label>
                    <input type="range" min="-50" max="50" step="10" value={settings.speechRateChinese} onChange={e=>setSettings(s=>({...s, speechRateChinese:parseInt(e.target.value)}))} style={{flex:1}}/>
                </div>
                <div style={styles.settingRow}>
                    <label>自动播放</label>
                    <div>
                        <label><input type="checkbox" checked={settings.autoPlayChinese} onChange={e=>setSettings(s=>({...s, autoPlayChinese:e.target.checked}))}/>中文</label>
                        <label style={{marginLeft:10}}><input type="checkbox" checked={settings.autoPlayBurmese} onChange={e=>setSettings(s=>({...s, autoPlayBurmese:e.target.checked}))}/>缅语</label>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// ===== 5. 主组件 =====
const WordCard = ({ words = [], isOpen, onClose }) => {
    const [isMounted, setIsMounted] = useState(false);
    
    // 注入动画样式
    useEffect(() => {
        setIsMounted(true);
        if (typeof document !== 'undefined' && !document.getElementById('wc-style')) {
            const s = document.createElement('style');
            s.id = 'wc-style';
            s.innerText = `@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }`;
            document.head.appendChild(s);
        }
    }, []);

    const [settings, setSettings] = useCardSettings();

    // 数据清洗
    const initialCards = useMemo(() => {
        if (!Array.isArray(words)) return [];
        return words.map(w => ({
            id: w.id || Math.random().toString(36).substr(2, 9),
            chinese: w.chinese || w.chineseWord || w.word || '',
            audioText: w.audioText || w.tts_text || w.chinese || '',
            burmese: w.burmese || w.burmeseTranslation || w.translation || '', 
            example: w.example || '',
        })).filter(w => w.chinese);
    }, [words]);

    const [activeCards, setActiveCards] = useState([]);
    
    // 初始化卡片队列
    useEffect(() => {
        let list = [...initialCards];
        if (settings.order === 'random') list.sort(() => Math.random() - 0.5);
        setActiveCards(list);
    }, [initialCards, settings.order]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showRecord, setShowRecord] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [isFav, setIsFav] = useState(false);
    
    const currentCard = activeCards[currentIndex];

    // 收藏状态
    useEffect(() => {
        if (currentCard?.id) isFavorite(currentCard.id).then(setIsFav);
    }, [currentCard]);

    const handleShare = useCallback((e) => {
        e.stopPropagation();
        if (!currentCard) return;
        const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) window.location.href = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
        else window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    }, [currentCard]);

    const handleFav = async (e) => {
        e.stopPropagation();
        if (!currentCard) return;
        const res = await toggleFavorite(currentCard);
        setIsFav(res);
    };

    // 核心逻辑：认识 -> 移除
    const handleKnow = (e) => {
        e.stopPropagation();
        const newCards = activeCards.filter((_, i) => i !== currentIndex);
        setActiveCards(newCards);
        setIsRevealed(false);
        if (currentIndex >= newCards.length) setCurrentIndex(0);
    };

    const handleDontKnow = (e) => {
        e.stopPropagation();
        if (isRevealed) {
            setCurrentIndex(prev => (prev + 1) % activeCards.length);
            setIsRevealed(false);
        } else {
            setIsRevealed(true);
        }
    };

    // 自动播放
    useEffect(() => {
        if (!isOpen || !currentCard) return;
        if (settings.autoPlayChinese) {
            playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource, () => {
                if (settings.autoPlayBurmese && isRevealed) {
                    playTTS(currentCard.burmese, settings.voiceBurmese, 0, settings.ttsSource);
                }
            });
        }
    }, [currentIndex, isRevealed, settings, isOpen]);

    // 动画
    const transitions = useTransition(currentCard, {
        key: currentCard?.id,
        from: { opacity: 0, transform: `translateY(100%)` },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: `translateY(-50%)`, position: 'absolute' },
        config: { tension: 280, friction: 30 }
    });

    const pageTransition = useTransition(isOpen, {
        from: { opacity: 0, transform: 'translateY(100%)' },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: 'translateY(100%)' },
    });

    // 手势
    const bind = useDrag(({ down, movement: [mx, my], velocity: [vx, vy], direction: [xDir, yDir], event }) => {
        if (down) return;
        if (my > 100 && vy > 0.5) onClose(); // 下滑关闭
        if (mx < -50 && Math.abs(mx) > Math.abs(my)) handleDontKnow(event); // 左滑下一张
    }, { filterTaps: true });

    const content = pageTransition((style, item) => item && (
        <animated.div style={{ ...styles.fullScreen, ...style }}>
            <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(p => !p)} />
            
            {/* 弹窗 */}
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
            {showRecord && <PronunciationComparison correctWord={currentCard.chinese} onClose={() => setShowRecord(false)} />}

            {/* 卡片内容 */}
            {activeCards.length > 0 ? (
                transitions((cardStyle, item) => item && (
                    <animated.div style={{ ...styles.cardShell, ...cardStyle }}>
                        <div style={styles.cardContent}>
                            <div onClick={e => { e.stopPropagation(); playTTS(item.audioText, settings.voiceChinese, settings.speechRateChinese, settings.ttsSource); }}>
                                <PinyinVisualizer pinyinStr={item.audioText || item.chinese} />
                                <div style={styles.chinese}>{item.chinese}</div>
                            </div>
                            
                            {isRevealed && (
                                <div style={{ marginTop: 30 }} onClick={e => { e.stopPropagation(); playTTS(item.burmese, settings.voiceBurmese, 0, settings.ttsSource); }}>
                                    <div style={styles.burmese}>{item.burmese}</div>
                                    {item.example && <div style={styles.example}>{item.example}</div>}
                                </div>
                            )}
                        </div>
                    </animated.div>
                ))
            ) : (
                <div style={styles.centerMsg}>
                    <h2>🎉 恭喜！</h2>
                    <p>您已学完本组所有单词</p>
                    <button style={styles.btnPrimary} onClick={onClose}>返回列表</button>
                </div>
            )}

            {/* 侧边栏 */}
            {activeCards.length > 0 && (
                <div style={styles.rightBar}>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setShowSettings(true)}}><FaCog /></button>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); playTTS(currentCard.audioText, settings.voiceChinese, settings.speechRateChinese)}}><FaVolumeUp /></button>
                    <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setShowRecord(true)}}><FaMicrophone /></button>
                    <button style={{...styles.iconBtn, color:'#0084FF'}} onClick={handleShare}><FaFacebookMessenger /></button>
                    {currentCard?.chinese.length <= 4 && (
                        <button style={styles.iconBtn} onClick={(e)=>{e.stopPropagation(); setWriterChar(currentCard.chinese)}}><FaPenFancy /></button>
                    )}
                    <button style={{...styles.iconBtn, color: isFav?'red':'gray'}} onClick={handleFav}>
                        {isFav ? <FaHeart /> : <FaRegHeart />}
                    </button>
                </div>
            )}

            {/* 底部按钮 */}
            {activeCards.length > 0 && (
                <div style={styles.bottomBar}>
                    <button style={{...styles.btn, background:'#f59e0b'}} onClick={handleDontKnow}>
                        {isRevealed ? '下一张' : '不认识'}
                    </button>
                    <button style={{...styles.btn, background:'#22c55e'}} onClick={handleKnow}>
                        认识 (移除)
                    </button>
                </div>
            )}
        </animated.div>
    ));

    if (isMounted) return createPortal(content, document.body);
    return null;
};

// ===== 6. 样式 (浅色系 + 修复) =====
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, background: '#f8fafc', overflow: 'hidden', touchAction: 'none' },
    gestureArea: { position: 'absolute', inset: 0, zIndex: 1 },
    cardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
    cardContent: { pointerEvents: 'auto', textAlign: 'center', width: '90%', maxWidth: 500, paddingBottom: 100 },
    
    // 文字样式
    pinyinVisualizerContainer: { display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 10 },
    pinyinPart: { fontSize: '1.8rem', color: '#475569', fontWeight: 500 },
    chinese: { fontSize: '4rem', fontWeight: 'bold', color: '#1e293b' },
    burmese: { fontSize: '2.2rem', color: '#059669', marginTop: 15, fontWeight: 500 },
    example: { fontSize: '1.2rem', color: '#64748b', marginTop: 20, padding: 15, background: '#e2e8f0', borderRadius: 12 },

    // 控件
    bottomBar: { position: 'fixed', bottom: 30, left: 20, right: 20, display: 'flex', gap: 20, zIndex: 10, maxWidth: 500, margin: '0 auto' },
    btn: { flex: 1, padding: 18, border: 'none', borderRadius: 16, color: 'white', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
    
    rightBar: { position: 'fixed', right: 20, bottom: '25%', display: 'flex', flexDirection: 'column', gap: 15, zIndex: 10 },
    iconBtn: { width: 48, height: 48, borderRadius: '50%', border: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', color: '#475569' },

    centerMsg: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, color: '#333' },
    btnPrimary: { marginTop: 20, padding: '12px 30px', background: '#3b82f6', color:'white', border:'none', borderRadius: 8, fontSize: 18 },

    // 弹窗
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { background: 'white', padding: 0, borderRadius: 20, width: '85%', maxWidth: 350, overflow: 'hidden' },
    modalHeader: { padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    recordBtn: { width: 80, height: 80, borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    
    // 设置
    settingRow: { marginBottom: 20 },
    select: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }
};

export default WordCard;
