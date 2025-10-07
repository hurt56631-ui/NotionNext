// components/Tixing/PhraseCard.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaVolumeUp, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaStar, FaRegStar } from 'react-icons/fa';

// =================================================================================
// ===== 辅助工具: 音频播放 ========================================================
// =================================================================================

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' },
    { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'zh-CN-YunjianNeural', label: '中文男声 (云间)' },
    { value: 'zh-CN-YunxiNeural', label: '中文男声 (云希)' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' },
    { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

const sounds = {
    switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
};
let _howlInstance = null;

const playTTS = (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) { 
        if (onEndCallback) onEndCallback();
        return;
    }
    Object.values(sounds).forEach(sound => sound.stop());
    if (_howlInstance?.playing()) _howlInstance.stop();
    
    // 语速从 -100 to 100 映射到 TTS 服务需要的格式
    const rateValue = Math.round(rate / 2); 
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;
    
    _howlInstance = new Howl({ src: [ttsUrl], html5: true, onend: onEndCallback });
    _howlInstance.play();
};

const playSoundEffect = (type) => {
    if (_howlInstance?.playing()) _howlInstance.stop();
    if (sounds[type]) sounds[type].play();
};

// =================================================================================
// ===== 自定义钩子: 用户设置 ======================================================
// =================================================================================
const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        try {
            const savedSettings = localStorage.getItem('ciDianKaCnMySettings');
            const defaultSettings = {
                order: 'sequential',
                autoPlay: true,
                autoBrowse: false,
                voiceChinese: 'zh-CN-XiaoyouNeural',
                voiceBurmese: 'my-MM-NilarNeural',
                speechRateChinese: 0,
                speechRateBurmese: 0,
            };
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
        } catch (error) {
            console.error("加载设置失败", error);
            return {
                order: 'sequential', autoPlay: true, autoBrowse: false,
                voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural',
                speechRateChinese: 0, speechRateBurmese: 0
            };
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('ciDianKaCnMySettings', JSON.stringify(settings));
        } catch (error) {
            console.error("保存设置失败", error);
        }
    }, [settings]);

    return [settings, setSettings];
};

// =================================================================================
// ===== 子组件: 图片加载、设置面板 ================================================
// =================================================================================
const LazyImageWithSkeleton = React.memo(({ src, alt }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const optimizedSrc = useMemo(() => src ? `${src}?quality=30` : null, [src]);

    useEffect(() => { setImageLoaded(false); }, [src]);

    return (
        <div style={styles.imageWrapper}>
            {!imageLoaded && (<div style={styles.skeleton}><div style={styles.shimmer} /></div>)}
            <img
                src={optimizedSrc}
                alt={alt}
                onLoad={() => setImageLoaded(true)}
                style={{ ...styles.cardImage, opacity: imageLoaded ? 1 : 0 }}
                loading="lazy"
                decoding="async"
            />
        </div>
    );
});

const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{ marginTop: 0 }}>常规设置</h2>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>学习顺序</label>
                    <div style={styles.settingControl}>
                        <button onClick={() => handleSettingChange('order', 'sequential')} style={{ ...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown /> 顺序</button>
                        <button onClick={() => handleSettingChange('order', 'random')} style={{ ...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom /> 随机</button>
                    </div>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>自动播放</label>
                     <div style={styles.settingControl}>
                        <label><input type="checkbox" checked={settings.autoPlay} onChange={(e) => handleSettingChange('autoPlay', e.target.checked)} /> 自动朗读中/缅文</label>
                    </div>
                    <div style={styles.settingControl}>
                        <label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> 8秒后自动切换</label>
                    </div>
                </div>
                
                <h2 style={{ marginTop: '30px' }}>发音设置</h2>
                {/* 中文发音设置 */}
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>中文发音人</label>
                    <select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>
                        {TTS_VOICES.filter(v => v.value.startsWith('zh-CN')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                </div>
                 <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label>
                    <div style={styles.settingControl}>
                        <span>-100</span>
                        <input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} />
                        <span>+100</span>
                    </div>
                </div>

                {/* 缅文发音设置 */}
                 <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>缅文发音人</label>
                    <select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>
                        {TTS_VOICES.filter(v => v.value.startsWith('my-MM')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                </div>
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>缅文语速: {settings.speechRateBurmese}%</label>
                    <div style={styles.settingControl}>
                        <span>-100</span>
                        <input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} />
                        <span>+100</span>
                    </div>
                </div>
            </div>
        </div>
    );
});


// =================================================================================
// ===== 主组件: CiDianKaCnMy =======================================================
// =================================================================================
const CiDianKaCnMy = ({ flashcards = [], user = null, isFavorite = false, onToggleFavorite = () => {} }) => {
    const [settings, setSettings] = useCardSettings();

    const processedCards = useMemo(() => {
        try {
            if (!Array.isArray(flashcards)) return [];
            // 确保数据有效
            const validCards = flashcards.filter(card => card && card.chinese && card.burmese);
            // 随机排序
            if (settings.order === 'random') {
                for (let i = validCards.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [validCards[i], validCards[j]] = [validCards[j], validCards[i]];
                }
            }
            return validCards;
        } catch (error) {
            console.error("处理 'flashcards' 数据时出错:", error, flashcards);
            return [];
        }
    }, [flashcards, settings.order]);

    // 提供默认卡片数据，防止在加载时崩溃
    const cards = processedCards.length > 0 ? processedCards : [{ 
        pinyin: "shì lì duǎn jù", 
        chinese: "示例短句", 
        burmese: "ဥပမာ ဝါကျ", 
        burmesePhonetic: "u-pa-ma wà-kya", 
        imageUrl: null 
    }];

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const autoBrowseTimerRef = useRef(null);
    const lastDirection = useRef(0);

    const navigate = useCallback((direction) => {
        lastDirection.current = direction;
        setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
    }, [cards.length]);

    const resetAutoBrowseTimer = useCallback(() => {
        clearTimeout(autoBrowseTimerRef.current);
        if (settings.autoBrowse) {
            autoBrowseTimerRef.current = setTimeout(() => navigate(1), 8000); // 8秒切换
        }
    }, [settings.autoBrowse, navigate]);
    
    // 卡片切换动画
    const cardTransitions = useTransition(currentIndex, {
        key: currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` },
        enter: { opacity: 1, transform: 'translateY(0%)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
        config: { mass: 1, tension: 280, friction: 30 },
        onStart: () => { playSoundEffect('switch'); },
    });
    
    // 拖拽手势
    const bind = useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], event }) => {
        if (event.target.closest('[data-no-gesture]')) return;
        if (!down) {
            const isSignificantDrag = Math.abs(my) > 60 || (Math.abs(vy) > 0.4 && Math.abs(my) > 30);
            if (isSignificantDrag) {
                navigate(yDir < 0 ? 1 : -1);
            }
        }
    }, { axis: 'y', filterTaps: true, taps: true });
    
    // 自动播放逻辑
    useEffect(() => {
        const currentCard = cards[currentIndex];
        if (settings.autoPlay && currentCard) {
            const playBurmese = () => playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese);
            // 延迟播放中文，结束后播放缅文
            const ttsTimer = setTimeout(() => {
                playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, playBurmese);
            }, 600);
            return () => clearTimeout(ttsTimer);
        }
    }, [currentIndex, cards, settings]);

    // 自动翻页计时器
    useEffect(() => {
        resetAutoBrowseTimer();
        return () => clearTimeout(autoBrowseTimerRef.current);
    }, [currentIndex, resetAutoBrowseTimer]);
    
    // 预加载下一张图片
    useEffect(() => {
        const nextIndex = (currentIndex + 1) % cards.length;
        const nextCard = cards[nextIndex];
        if (nextCard?.imageUrl) {
            const nextOptimizedSrc = `${nextCard.imageUrl}?quality=30`;
            const img = new Image();
            img.src = nextOptimizedSrc;
        }
    }, [currentIndex, cards]);

    const handleFavoriteClick = (e) => {
        e.stopPropagation();
        onToggleFavorite(cards[currentIndex]);
    };

    return (
        <div style={styles.fullScreen}>
            {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
            
            <div style={styles.gestureArea} {...bind()} />

            {cardTransitions((style, i) => {
                const cardData = cards[i];
                if (!cardData) return null;
                return (
                    <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
                        <div style={styles.cardContainer}>
                            
                            {cardData.imageUrl && <LazyImageWithSkeleton src={cardData.imageUrl} alt={cardData.chinese} />}
                            
                            <div style={styles.contentBox}>
                                {/* 中文部分 */}
                                <div style={styles.languageSection} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                                    <div style={styles.pinyin}>{cardData.pinyin}</div>
                                    <div style={styles.textChinese}>{cardData.chinese}</div>
                                    <button style={styles.playButton}><FaVolumeUp size={22} /></button>
                                </div>

                                {/* 缅文部分 */}
                                <div style={styles.languageSection} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                                    <div style={styles.burmesePhonetic}>{cardData.burmesePhonetic}</div>
                                    <div style={styles.textBurmese}>{cardData.burmese}</div>
                                     <button style={styles.playButton}><FaVolumeUp size={22} /></button>
                                </div>
                            </div>
                        </div>
                    </animated.div>
                );
            })}

            <div style={styles.rightControls} data-no-gesture="true">
                {user && (
                    <button style={styles.rightIconButton} onClick={handleFavoriteClick} title={isFavorite ? '取消收藏' : '收藏单词'}>
                        {isFavorite ? <FaStar size={28} color="#f59e0b" /> : <FaRegStar size={28} color="#4a5568" />}
                    </button>
                )}
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置">
                    <FaCog size={28} color="#4a5568" />
                </button>
            </div>
        </div>
    );
};

// =================================================================================
// ===== 样式表 ====================================================================
// =================================================================================
const styles = {
    // --- 主布局 ---
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: '#f8fafc' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: '25px' },
    
    // --- 内容 ---
    imageWrapper: { width: '90%', maxWidth: '450px', height: '30vh', position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 25px rgba(0,0,0,0.1)' },
    cardImage: { width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s ease-in-out' },
    skeleton: { position: 'absolute', inset: 0, background: '#e2e8f0', overflow: 'hidden' },
    shimmer: { position: 'absolute', inset: 0, transform: 'translateX(-100%)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'shimmer 2s infinite' },
    
    contentBox: { width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '20px' },
    languageSection: { background: 'white', borderRadius: '16px', padding: '20px', position: 'relative', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', transition: 'transform 0.2s', textAlign: 'center' },
    
    pinyin: { fontSize: '1.2rem', color: '#64748b', marginBottom: '8px' },
    textChinese: { fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937', textShadow: '1px 1px 3px rgba(0,0,0,0.1)' },

    burmesePhonetic: { fontSize: '1.2rem', color: '#64748b', marginBottom: '8px', fontFamily: 'sans-serif' },
    textBurmese: { fontSize: '2.2rem', color: '#1f2937', textShadow: '1px 1px 3px rgba(0,0,0,0.1)', fontFamily: '"Padauk", "Myanmar Text", sans-serif' },

    playButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' },

    // --- 右侧控制按钮 ---
    rightControls: { position: 'absolute', bottom: '50px', right: '20px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' },
    rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s' },

    // --- 设置面板 ---
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(5px)' },
    settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
    settingGroup: { marginBottom: '20px' },
    settingLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
    settingControl: { display: 'flex', gap: '10px', alignItems: 'center' },
    settingButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
    settingSelect: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
    settingSlider: { flex: 1 },
};

// 注入动画 keyframes
const shimmerAnimation = `@keyframes shimmer { 100% { transform: translateX(100%); } }`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = shimmerAnimation;
document.head.appendChild(styleSheet);

export default PhraseCard;
