// components/Tixing/PhraseCard.js (新组件：词组-翻译展示卡片)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaStar, FaRegStar, FaArrowRight, FaLanguage } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// ===== Utilities: 音频播放, 拼音解析 (从 CiDianKa.js 复制，确保独立性) ===============
// =================================================================================

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
    { value: 'zh-CN-YunjianNeural', label: '中文男声 (云间)' }, { value: 'zh-CN-YunxiNeural', label: '中文男声 (云希)' },
    { value: 'vi-VN-HoaiMyNeural', label: '越南语女声' }, { value: 'vi-VN-NamMinhNeural', label: '越南语男声' },
    { value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' },
];

const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;

const playTTS = (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !voice) { if (onEndCallback) onEndCallback(); return; }
    Object.values(sounds).forEach(sound => sound.stop());
    if (_howlInstance?.playing()) _howlInstance.stop();
    const rateValue = Math.round(rate / 2);
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;
    _howlInstance = new Howl({ src: [ttsUrl], html5: true, onend: onEndCallback });
    _howlInstance.play();
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
    let initial = '';
    let final = pinyinPlain;
    
    for (const init of initials) {
        if (pinyinPlain.startsWith(init)) {
            initial = init;
            final = pinyinPlain.slice(init.length);
            if (initial === 'y' && final.startsWith('i')) final = final.slice(1);
            if (initial === 'w' && final.startsWith('u')) final = final.slice(1);
            break;
        }
    }
    
    if (pinyinPlain === 'er') { initial = ''; final = 'er'; }
    if (initial === '' && initials.some(i => pinyinPlain.startsWith(i))) { initial = pinyinPlain; final = ''; } 

    return { initial, final, tone, pinyinMark, rawPinyin };
};

// =================================================================================
// ===== Custom Hooks: 用户设置 (针对短语卡片新增缅甸语设置) ==========================
// =================================================================================
const usePhraseCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('phraseCardSettings');
      const defaultSettings = { 
        order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoBrowse: false,
        voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRate: 0,
      };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) { 
        console.error("Failed to load settings", error);
        return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoBrowse: false, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRate: 0 };
    }
  });
  useEffect(() => { try { localStorage.setItem('phraseCardSettings', JSON.stringify(settings)); } catch (error) { console.error("Failed to save settings", error); } }, [settings]);
  return [settings, setSettings];
};

// =================================================================================
// ===== Component: 设置面板 (针对短语卡片进行简化和修改) ============================
// =================================================================================
const PhraseCardSettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
  return (<div style={styles.settingsModal} onClick={onClose}><div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}><button style={styles.closeButton} onClick={onClose}><FaTimes /></button><h2 style={{marginTop: 0}}>常规设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div><div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> 6秒后自动切换</label></div></div><h2 style={{marginTop: '30px'}}>发音设置</h2><div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><div style={styles.settingGroup}><label style={styles.settingLabel}>全局语速: {settings.speechRate}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRate} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRate', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div></div></div>);
});


// =================================================================================
// ===== Component: 词组-翻译组件的核心展示部分 ========================================
// =================================================================================
const PhraseContent = ({ cardData, isRevealed }) => {
    // 确保 pinyin 字段可用，使用 pinyin-pro 处理
    const pinyin = useMemo(() => {
        return pinyinConverter(cardData.chinese, { toneType: 'mark', separator: ' ' });
    }, [cardData.chinese]);

    const detailsTransitions = useTransition(isRevealed, { 
        from: { opacity: 0, transform: 'translateY(20px)' }, 
        enter: { opacity: 1, transform: 'translateY(0px)' }, 
        leave: { opacity: 0, transform: 'translateY(20px)' }, 
        config: { mass: 1, tension: 280, friction: 30 },
    });
    
    return (
        <div style={styles.phraseContentContainer}>
            {/* 1. 中文（多字一排显示） */}
            <div style={styles.phraseHeader}>
                <div style={styles.phrasePinyin}>{pinyin}</div>
                <div style={styles.phraseHanzi}>{cardData.chinese}</div>
            </div>

            {/* 2. 缅甸语翻译 (翻转后显示) */}
            {detailsTransitions((style, item) => item && (
                <animated.div style={{...style, ...styles.burmeseContainer}}>
                    <div style={styles.burmeseText}>{cardData.burmese}</div>
                </animated.div>
            ))}
            
            {/* 3. 图片 (如果未翻转，并且有图片) */}
            {!isRevealed && cardData.imageUrl && <LazyImageWithSkeleton src={cardData.imageUrl} alt={cardData.chinese} />}
            
        </div>
    );
};

// =================================================================================
// ===== Component: LazyImageWithSkeleton (复用 CiDianKa.js 中的实现) ==============
// =================================================================================
const LazyImageWithSkeleton = React.memo(({ src, alt }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const optimizedSrc = useMemo(() => src ? `${src}?quality=70` : null, [src]);

  useEffect(() => { setImageLoaded(false); }, [src]);
  
  const transition = useTransition(imageLoaded, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    config: { duration: 500 }
  });

  return (
    <div style={styles.imageWrapper}>
      {!imageLoaded && (<div style={styles.skeleton}><div style={styles.shimmer} /></div>)}
      {transition((style, item) => item ? (
        <animated.img 
            src={optimizedSrc} 
            alt={alt} 
            onLoad={() => setImageLoaded(true)} 
            style={{...styles.cardImage, ...style}} 
            loading="lazy" 
            decoding="async"
        />
      ) : (
          <img 
              src={optimizedSrc} 
              alt={alt} 
              onLoad={() => setImageLoaded(true)} 
              style={{ display: 'none' }} 
              loading="lazy" 
              decoding="async"
          />
      ))}
    </div>
  );
});

// =================================================================================
// ===== 主组件: PhraseCard (入口文件) ==============================================
// =================================================================================
const PhraseCard = ({ flashcards = [] }) => {
  const [settings, setSettings] = usePhraseCardSettings();
  
  // 确保卡片有中文和缅甸语字段
  const processedCards = useMemo(() => {
    try { 
        if (!Array.isArray(flashcards)) return []; 
        const validCards = flashcards.filter(card => card && typeof card.chinese === 'string' && card.chinese && typeof card.burmese === 'string' && card.burmese); 
        if (settings.order === 'random') { for (let i = validCards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [validCards[i], validCards[j]] = [validCards[j], validCards[i]]; } } 
        return validCards; 
    } catch (error) { console.error("CRITICAL ERROR processing 'flashcards':", error, flashcards); return []; }
  }, [flashcards, settings.order]);

  const cards = processedCards.length > 0 ? processedCards : [{ chinese: "你好，世界", burmese: "မင်္ဂလာပါကမ္ဘာလောကကြီး", imageUrl: null }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  
  const navigate = useCallback((direction) => { lastDirection.current = direction; setCurrentIndex(prev => (prev + direction + cards.length) % cards.length); }, [cards.length]);
  
  const resetAutoBrowseTimer = useCallback(() => { 
      clearTimeout(autoBrowseTimerRef.current); 
      if (settings.autoBrowse && !isRevealed && !writerChar) { 
          autoBrowseTimerRef.current = setTimeout(() => navigate(1), 6000); 
      } 
  }, [settings.autoBrowse, isRevealed, writerChar, navigate]);
  
  // 翻转逻辑：翻转后自动播放缅语
  const handleToggleReveal = () => {
      setIsRevealed(r => {
          const newState = !r;
          if (!r && newState && settings.autoPlayBurmese) { // 翻转到背面时自动朗读缅语
               const currentCard = cards[currentIndex];
               if (currentCard?.burmese) {
                   playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRate);
               }
          }
          return newState;
      });
  };

  const cardTransitions = useTransition(currentIndex, { 
      key: currentIndex, 
      from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, 
      enter: { opacity: 1, transform: 'translateY(0%)' }, 
      leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, 
      config: { mass: 1, tension: 280, friction: 30 }, 
      onStart: () => { playSoundEffect('switch'); }, 
      onRest: () => { setIsRevealed(false); }, 
  });

  const bind = useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], tap, event }) => { 
      if (event.target.closest('[data-no-gesture]')) return; 
      if (tap) { 
          handleToggleReveal(); 
          return; 
      } 
      if (!down) { 
          const isSignificantDrag = Math.abs(my) > 60 || (Math.abs(vy) > 0.4 && Math.abs(my) > 30); 
          if (isSignificantDrag) { 
              navigate(yDir < 0 ? 1 : -1); 
          } 
      } 
  }, { axis: 'y', filterTaps: true, taps: true });
  
  // 自动朗读中文（卡片出现时）
  useEffect(() => { 
      const currentCard = cards[currentIndex]; 
      if (settings.autoPlayChinese && currentCard) { 
          const ttsTimer = setTimeout(() => playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRate), 600); 
          return () => clearTimeout(ttsTimer); 
      } 
  }, [currentIndex, cards, settings.autoPlayChinese, settings.voiceChinese, settings.speechRate]);

  // 自动切换计时器
  useEffect(() => { 
      resetAutoBrowseTimer(); 
      return () => clearTimeout(autoBrowseTimerRef.current); 
  }, [currentIndex, resetAutoBrowseTimer]);

  const handleReadChinese = (e) => { e.stopPropagation(); playTTS(cards[currentIndex]?.chinese, settings.voiceChinese, settings.speechRate, null, e); };
  const handleReadBurmese = (e) => { e.stopPropagation(); playTTS(cards[currentIndex]?.burmese, settings.voiceBurmese, settings.speechRate, null, e); };
  
  // 笔顺处理：只针对中文（将短语拆开）
  const handleWriterClick = (e) => {
      e.stopPropagation();
      const chineseText = cards[currentIndex]?.chinese || '';
      // 简单地取第一个汉字作为笔顺练习对象
      const firstHanzi = chineseText.match(/[\u4e00-\u9fa5]/)?.[0];
      if (firstHanzi) {
          setWriterChar(firstHanzi);
      } else {
          alert('当前短语中没有汉字可供笔顺练习。');
      }
  };


  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
      {isSettingsOpen && <PhraseCardSettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}

      <div style={styles.gestureArea} {...bind()} />
      {cardTransitions((style, i) => {
        const cardData = cards[i];
        if (!cardData) return null;
        return (
          <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
            <div style={styles.cardContainer}>
              <PhraseContent cardData={cardData} isRevealed={isRevealed} />
            </div>
          </animated.div>
        );
      })}

      <div style={styles.rightControls} data-no-gesture="true">
        <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={28} color="#4a5568"/></button>
        <button style={styles.rightIconButton} onClick={handleWriterClick} title="笔顺练习 (只针对中文首字)"><FaPenFancy size={28} color="#4a5568"/></button>
        <button style={styles.rightIconButton} onClick={handleReadChinese} title="朗读中文"><FaVolumeUp size={28} color="#000000"/></button>
        {isRevealed && (
            <button style={{...styles.rightIconButton, background: '#4299e1'}} onClick={handleReadBurmese} title="朗读缅甸语">
                <FaLanguage size={28} color="white"/>
            </button>
        )}
      </div>
    </div>
  );
};


// =================================================================================
// ===== Styles: 样式表 (针对 PhraseCard 进行调整) ===================================
// =================================================================================
const styles = {
  // --- 主布局 (大部分复用) ---
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: '#f8fafc' },
  gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', padding: '60px 20px 20px' },
  
  // --- PhraseCard 核心内容样式 ---
  phraseContentContainer: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '40px', width: '90%', maxWidth: '600px', marginBottom: '15%' },
  
  phraseHeader: { textAlign: 'center' },
  phrasePinyin: { fontSize: '1.4rem', color: '#64748b', marginBottom: '10px' },
  // **中文短语/句子样式:** 小字体，一行显示
  phraseHanzi: { fontSize: '2.5rem', fontWeight: 700, color: '#1f2937', lineHeight: 1.5, wordBreak: 'break-word' }, 

  // **缅甸语翻译样式:** 
  burmeseContainer: { 
    background: 'white', 
    padding: '25px', 
    borderRadius: '16px', 
    width: '100%', 
    boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
    textAlign: 'center'
  },
  burmeseText: {
    fontSize: '1.6rem',
    fontWeight: 500,
    color: '#005a9c', // 缅语使用不一样的颜色
    lineHeight: 1.8,
  },
  
  // --- 图片样式 (复用) ---
  imageWrapper: { width: '90%', maxHeight: '30vh', position: 'relative', marginTop: '20px' },
  cardImage: { maxWidth: '100%', maxHeight: '30vh', objectFit: 'contain', borderRadius: '12px', transition: 'opacity 0.5s ease-in-out' }, 
  skeleton: { position: 'absolute', inset: 0, background: '#e2e8f0', borderRadius: '12px', overflow: 'hidden' },
  shimmer: { position: 'absolute', inset: 0, transform: 'translateX(-100%)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'shimmer 2s infinite' },
  
  // --- 右侧控制按钮 (复用并新增缅语按钮) ---
  rightControls: { position: 'absolute', bottom: '15%', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' },
  rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s' },
  
  // --- 设置面板 (复用) ---
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

const shimmerAnimation = `@keyframes shimmer { 100% { transform: translateX(100%); } }`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = shimmerAnimation;
document.head.appendChild(styleSheet);

export default PhraseCard;
