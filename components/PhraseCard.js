// components/Tixing/CombinedPhraseCard.js (支持手机本地多图上传版)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight, FaImage, FaTrash } from 'react-icons/fa'; // 新增图标
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// ===== Utilities & Constants =====================================================
// =================================================================================

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' },
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
// ===== Custom Hooks & Sub-Components =============================================
// =================================================================================

const usePhraseCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('phraseCardSettings');
      const defaultSettings = {
        order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false,
        voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0,
      };
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) {
        console.error("Failed to load settings", error);
        return { order: 'sequential', autoPlayChinese: true, autoPlayBurmese: false, autoBrowse: false, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: 0, speechRateBurmese: 0 };
    }
  });
  useEffect(() => { try { localStorage.setItem('phraseCardSettings', JSON.stringify(settings)); } catch (error) { console.error("Failed to save settings", error); } }, [settings]);
  return [settings, setSettings];
};

const PinyinVisualizer = React.memo(({ analysis }) => {
    const { parts, errors } = analysis;
    const initialStyle = parts.initial && errors.initial ? styles.wrongPart : styles.correctPart;
    const finalStyle = parts.final && errors.final ? styles.wrongPart : styles.correctPart;
    const toneStyle = parts.tone !== '0' && errors.tone ? styles.wrongPart : styles.correctPart;
    let finalDisplay = parts.pinyinMark.replace(parts.initial, '').replace(' ', '');
    if (!finalDisplay || parts.pinyinMark === parts.rawPinyin) { finalDisplay = parts.final; }
    finalDisplay = finalDisplay.replace(/[1-5]$/, '');
    return (
        <div style={styles.pinyinVisualizerContainer}>
            <span style={{...styles.pinyinPart, ...initialStyle}}>{parts.initial || '' }</span>
            <span style={{...styles.pinyinPart, ...finalStyle}}>{finalDisplay}</span>
            <span style={{...styles.pinyinPart, ...styles.toneNumber, ...toneStyle}}>{parts.tone}</span>
        </div>
    );
});

const PronunciationComparison = ({ correctWord, userText, onContinue, onClose }) => {
    const analysis = useMemo(() => {
        const correctPinyin = pinyinConverter(correctWord, { toneType: 'num', type: 'array', removeNonHan: true });
        const userPinyin = pinyinConverter(userText, { toneType: 'num', type: 'array', removeNonHan: true });
        if (correctPinyin.length !== userPinyin.length) {
            return { isCorrect: false, error: 'LENGTH_MISMATCH', message: `字数不对：应为 ${correctPinyin.length} 字，你读了 ${userPinyin.length} 字` };
        }
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
            return { char: correctWord[index], pinyinMatch, correct: { parts: correctParts, errors: {} }, user: { parts: userParts, errors: errors } };
        });
        const isCorrect = results.every(r => r.pinyinMatch);
        const accuracy = (results.filter(r => r.pinyinMatch).length / results.length * 100).toFixed(0);
        return { isCorrect, results, accuracy };
    }, [correctWord, userText]);

    useEffect(() => { if (analysis) playSoundEffect(analysis.isCorrect ? 'correct' : 'incorrect'); }, [analysis]);

    if (!analysis) return null;

    return (
        <div style={styles.comparisonOverlay}>
            <div style={styles.comparisonPanel}>
                <div style={{...styles.resultHeader, background: analysis.isCorrect ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'}}>
                    <div style={{ fontSize: '2.5rem' }}>{analysis.isCorrect ? '🎉' : '💪'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysis.isCorrect ? '发音完美！' : '再接再厉！'}</div>
                    <div style={{ fontSize: '1rem', marginTop: '8px' }}>准确率: {analysis.accuracy}%</div>
                </div>
                <div style={styles.errorDetailsContainer}>
                    {analysis.error === 'LENGTH_MISMATCH' ? (
                        <div style={styles.lengthError}><h3>{analysis.message}</h3></div>
                    ) : (
                        <div style={styles.comparisonGrid}>
                            {analysis.results.map((result, index) => (
                                <div key={index} style={styles.comparisonCell}>
                                    <div style={styles.comparisonChar}>{result.char}</div>
                                    <div style={styles.comparisonPinyinSide}><PinyinVisualizer analysis={result.correct} /><span style={styles.pinyinLabel}>标准</span></div>
                                    <div style={{...styles.comparisonPinyinSide, opacity: result.pinyinMatch ? 0.6 : 1}}><PinyinVisualizer analysis={result.user} /><span style={styles.pinyinLabel}>你的发音</span></div>
                                    {!result.pinyinMatch && (<div style={styles.errorHint}>{result.user.errors.initial && <span style={styles.hintTag}>声母错</span>}{result.user.errors.final && <span style={styles.hintTag}>韵母错</span>}{result.user.errors.tone && <span style={styles.hintTag}>声调错</span>}</div>)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={styles.comparisonActions}>
                    {analysis.isCorrect ? (<button style={{...styles.actionButton, ...styles.continueButton}} onClick={onContinue}>继续下一个 <FaArrowRight /></button>) : (<button style={{...styles.actionButton, ...styles.retryButton}} onClick={onClose}>再试一次</button>)}
                </div>
            </div>
        </div>
    );
};

const LazyImageWithSkeleton = React.memo(({ src, alt }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  // 如果是本地图片(blob)，不加参数；如果是网络图片，可以加优化参数
  const optimizedSrc = useMemo(() => src?.startsWith('blob:') ? src : (src ? `${src}?quality=30` : null), [src]);
  useEffect(() => { setImageLoaded(false); }, [src]);
  return (
    <div style={styles.imageWrapper}>
      {!imageLoaded && (<div style={styles.skeleton}><div style={styles.shimmer} /></div>)}
      <img src={optimizedSrc} alt={alt} onLoad={() => setImageLoaded(true)} style={{...styles.cardImage, opacity: imageLoaded ? 1 : 0}} loading="lazy" decoding="async"/>
    </div>
  );
});

// MODIFIED: 增加了图片上传功能的设置面板
const PhraseCardSettingsPanel = React.memo(({ settings, setSettings, onClose, localImages, setLocalImages }) => {
  const fileInputRef = useRef(null);

  const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };

  // 处理图片选择
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    // 创建本地预览链接
    const newImageUrls = files.map(file => URL.createObjectURL(file));
    setLocalImages(newImageUrls);
  };

  const handleClearImages = () => {
    setLocalImages([]);
  };

  return (
    <div style={styles.settingsModal} onClick={onClose}>
        <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
            <h2 style={{marginTop: 0}}>常规设置</h2>
            
            {/* 新增：自定义图片上传区 */}
            <div style={{...styles.settingGroup, background: '#f0f9ff', padding: '15px', borderRadius: '10px', border: '1px solid #bae6fd'}}>
                <label style={{...styles.settingLabel, color: '#0369a1'}}>使用手机/本地图片</label>
                <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '10px'}}>
                   请按单词顺序选择图片（第一张图对应第一个词）。
                </div>
                <div style={styles.settingControl}>
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        ref={fileInputRef} 
                        style={{display: 'none'}} 
                        onChange={handleImageUpload}
                    />
                    <button 
                        onClick={() => fileInputRef.current.click()} 
                        style={{...styles.settingButton, background: '#3b82f6', color: 'white'}}
                    >
                        <FaImage /> 选择图片
                    </button>
                    {localImages.length > 0 && (
                        <button 
                            onClick={handleClearImages} 
                            style={{...styles.settingButton, background: '#ef4444', color: 'white', flex: 0.5}}
                            title="清除本地图片"
                        >
                            <FaTrash />
                        </button>
                    )}
                </div>
                {localImages.length > 0 && (
                    <div style={{marginTop: '8px', color: '#059669', fontSize: '0.9rem', fontWeight: 'bold'}}>
                        已加载 {localImages.length} 张本地图片
                    </div>
                )}
            </div>

            <div style={styles.settingGroup}><label style={styles.settingLabel}>学习顺序</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'sequential' ? 'white' : '#4a5568' }}><FaSortAmountDown/> 顺序</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : 'rgba(0,0,0,0.1)', color: settings.order === 'random' ? 'white' : '#4a5568' }}><FaRandom/> 随机</button></div></div>
            <div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayChinese} onChange={(e) => handleSettingChange('autoPlayChinese', e.target.checked)} /> 自动朗读中文</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoPlayBurmese} onChange={(e) => handleSettingChange('autoPlayBurmese', e.target.checked)} /> 自动朗读缅语</label></div><div style={styles.settingControl}><label><input type="checkbox" checked={settings.autoBrowse} onChange={(e) => handleSettingChange('autoBrowse', e.target.checked)} /> 6秒后自动切换</label></div></div>
            <h2 style={{marginTop: '30px'}}>发音设置</h2>
            <div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
            <div style={styles.settingGroup}><label style={styles.settingLabel}>中文语速: {settings.speechRateChinese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateChinese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateChinese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div>
            <div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语发音人</label><select style={styles.settingSelect} value={settings.voiceBurmese} onChange={(e) => handleSettingChange('voiceBurmese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
            <div style={styles.settingGroup}><label style={styles.settingLabel}>缅甸语语速: {settings.speechRateBurmese}%</label><div style={styles.settingControl}><span style={{marginRight: '10px'}}>-100</span><input type="range" min="-100" max="100" step="10" value={settings.speechRateBurmese} style={styles.settingSlider} onChange={(e) => handleSettingChange('speechRateBurmese', parseInt(e.target.value, 10))} /><span style={{marginLeft: '10px'}}>+100</span></div></div>
        </div>
    </div>
  );
});


// =================================================================================
// ===== 主组件: CombinedPhraseCard ===============================================
// =================================================================================
const CombinedPhraseCard = ({ flashcards = [] }) => {
  const [settings, setSettings] = usePhraseCardSettings();
  
  // MODIFIED: 存储本地上传的图片 Blob URL
  const [localImages, setLocalImages] = useState([]);

  // 内存清理：组件销毁时释放 Blob URL
  useEffect(() => {
    return () => {
        localImages.forEach(url => URL.revokeObjectURL(url));
    };
  }, [localImages]);

  const processedCards = useMemo(() => {
    try {
        if (!Array.isArray(flashcards)) return [];
        
        // MODIFIED: 将本地图片按照顺序合并到数据中
        // 逻辑：如果上传了第N张本地图，就用第N张，否则用原来的
        let validCards = flashcards
            .filter(card => card && card.chinese && card.burmese)
            .map((card, index) => {
                const customImage = localImages[index];
                return {
                    ...card,
                    imageUrl: customImage || card.imageUrl // 优先使用本地图片
                };
            });

        // 随机逻辑保持不变，但因为已经在上面绑定了图片，所以图片会跟着单词走
        if (settings.order === 'random') { 
            for (let i = validCards.length - 1; i > 0; i--) { 
                const j = Math.floor(Math.random() * (i + 1)); 
                [validCards[i], validCards[j]] = [validCards[j], validCards[i]]; 
            } 
        }
        return validCards;
    } catch (error) { console.error("处理 'flashcards' 出错:", error, flashcards); return []; }
  }, [flashcards, settings.order, localImages]); // 依赖项加入 localImages

  const cards = processedCards.length > 0 ? processedCards : [{ chinese: "示例短语", pinyin: "shì lì duǎn yǔ", burmese: "နမူနာစကားစု", burmesePhonetic: "နမူနာ", imageUrl: null }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [writerChar, setWriterChar] = useState(null);

  const recognitionRef = useRef(null);
  const lastDirection = useRef(0);
  const currentCard = cards[currentIndex];

  const navigate = useCallback((direction) => {
      lastDirection.current = direction;
      setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);

  useEffect(() => {
      const autoPlayTimer = setTimeout(() => {
          if (settings.autoPlayChinese && currentCard?.chinese) {
              playTTS(currentCard.chinese, settings.voiceChinese, settings.speechRateChinese, () => {
                  if (settings.autoPlayBurmese && currentCard?.burmese) {
                      playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese);
                  }
              });
          }
      }, 600);
      return () => clearTimeout(autoPlayTimer);
  }, [currentIndex, currentCard, settings]);

  useEffect(() => {
    return () => { if (recognitionRef.current) { recognitionRef.current.stop(); } };
  }, []);

  const cardTransitions = useTransition(currentIndex, {
      key: currentIndex,
      from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` },
      enter: { opacity: 1, transform: 'translateY(0%)' },
      leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' },
      config: { mass: 1, tension: 280, friction: 30 },
      onStart: () => playSoundEffect('switch'),
  });

  const handleListen = useCallback((e) => {
      e.stopPropagation();
      if (_howlInstance?.playing()) _howlInstance.stop();

      if (isListening) {
          recognitionRef.current?.stop();
          return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert('抱歉，您的浏览器不支持语音识别。');
          return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;

      recognition.onstart = () => {
          setIsListening(true);
          setRecognizedText('');
      };

      recognition.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript.trim().replace(/[.,。，]/g, '');
          if (transcript) {
              setRecognizedText(transcript);
          }
      };

      recognition.onerror = (event) => {
          console.error('Speech Recognition Error:', event.error);
          alert(`语音识别出错: ${event.error}`);
          setRecognizedText('');
      };

      recognition.onend = () => {
          setIsListening(false);
          recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
  }, [isListening]);

  const handleCloseComparison = useCallback(() => { setRecognizedText(''); }, []);
  const handleNavigateToNext = useCallback(() => { handleCloseComparison(); setTimeout(() => navigate(1), 100); }, [handleCloseComparison, navigate]);

  const phoneticDisplay = useMemo(() => currentCard?.burmesePhonetic?.replace(/\s*\(.*?\)\s*/g, ''), [currentCard]);

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
      
      {/* MODIFIED: 传递图片相关Props给设置面板 */}
      {isSettingsOpen && (
          <PhraseCardSettingsPanel 
              settings={settings} 
              setSettings={setSettings} 
              onClose={() => setIsSettingsOpen(false)} 
              localImages={localImages}
              setLocalImages={setLocalImages}
          />
      )}

      <div style={styles.gestureArea} {...useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], event }) => { if (event.target.closest('[data-no-gesture]')) return; if (!down) { const isSignificantDrag = Math.abs(my) > 60 || (Math.abs(vy) > 0.4 && Math.abs(my) > 30); if (isSignificantDrag) { navigate(yDir < 0 ? 1 : -1); } } }, { axis: 'y' })()} />

      {cardTransitions((style, i) => {
        const cardData = cards[i];
        if (!cardData) return null;
        return (
          <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
            <div style={styles.cardContainer}>
              <div style={styles.contentBox}>
                  <div onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                      <div style={styles.pinyin}>{cardData.pinyin || pinyinConverter(cardData.chinese, { toneType: 'mark', separator: ' ' })}</div>
                      <div style={styles.textChinese}>{cardData.chinese}</div>
                  </div>
                  <div style={{ marginTop: '40px' }} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                      {phoneticDisplay && <div style={styles.burmesePhonetic}>{phoneticDisplay}</div>}
                      <div style={styles.textBurmese}>{cardData.burmese}</div>
                  </div>
              </div>
              {/* 图片区域，会自动处理网络URL或本地Blob */}
              {cardData.imageUrl && <LazyImageWithSkeleton src={cardData.imageUrl} alt={cardData.chinese} />}
            </div>
          </animated.div>
        );
      })}

      {!!recognizedText && currentCard && (
          <PronunciationComparison
              correctWord={currentCard.chinese}
              userText={recognizedText}
              onContinue={handleNavigateToNext}
              onClose={handleCloseComparison}
          />
      )}

      {currentCard && (
          <div style={styles.topRightControls} data-no-gesture="true">
            <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置">
                <FaCog size={20} />
            </button>
            <button style={styles.rightIconButton} onClick={handleListen} title="发音练习">
                <FaMicrophone size={20} color={isListening ? '#dc2626' : '#4a5568'} />
            </button>
            <button style={styles.rightIconButton} onClick={(e) => { e.stopPropagation(); setWriterChar(currentCard.chinese); }} title="笔顺">
                <FaPenFancy size={20} />
            </button>
          </div>
      )}
    </div>
  );
};

// =================================================================================
// ===== Styles ====================================================================
// =================================================================================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: '#f8fafc' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
    cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box', gap: '20px' },
    contentBox: { width: '100%', textAlign: 'center', order: 1, boxSizing: 'border-box', cursor: 'pointer' },
    imageWrapper: { width: '100%', maxWidth: '500px', maxHeight: '35vh', position: 'relative', order: 2, marginTop: '20px', boxSizing: 'border-box', maskImage: 'radial-gradient(circle, black 80%, transparent 100%)' },
    cardImage: { width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s ease-in-out' },
    skeleton: { position: 'absolute', inset: 0, background: '#e2e8f0', overflow: 'hidden' },
    shimmer: { position: 'absolute', inset: 0, transform: 'translateX(-100%)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'shimmer 2s infinite' },
    pinyin: { fontSize: '1.2rem', color: '#475569', marginBottom: '8px' },
    textChinese: { fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937', textShadow: '1px 1px 3px rgba(0,0,0,0.1)', wordBreak: 'break-word' },
    burmesePhonetic: { fontSize: '1.2rem', color: '#8b5cf6', marginBottom: '8px', fontFamily: 'sans-serif' },
    textBurmese: { fontSize: '2.2rem', color: '#1f2937', textShadow: '1px 1px 3px rgba(0,0,0,0.1)', fontFamily: '"Padauk", "Myanmar Text", sans-serif', wordBreak: 'break-word', lineHeight: 1.8 },
    
    topRightControls: { position: 'fixed', top: '20px', right: '15px', zIndex: 100, display: 'flex', flexDirection: 'row', gap: '15px' },
    
    rightIconButton: { background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s', color: '#4a5568' },
    
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
    comparisonPanel: { width: '90%', maxWidth: '500px', maxHeight: '90vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
    resultHeader: { color: 'white', padding: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', textAlign: 'center' },
    errorDetailsContainer: { padding: '20px', overflowY: 'auto', flex: 1 },
    lengthError: { textAlign: 'center', color: '#b91c1c', padding: '10px 0' },
    comparisonGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' },
    comparisonCell: { flex: '1 1 120px', padding: '12px', borderRadius: '12px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    comparisonChar: { fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937' },
    comparisonPinyinSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    pinyinVisualizerContainer: { display: 'flex', alignItems: 'baseline', fontSize: '1.6rem', height: '2.0rem' },
    pinyinPart: { transition: 'color 0.3s', fontWeight: 500 },
    toneNumber: { fontSize: '1.2rem', fontWeight: 'bold', marginLeft: '2px' },
    correctPart: { color: '#16a34a' },
    wrongPart: { color: '#dc2626' },
    pinyinLabel: { fontSize: '0.75rem', color: '#6b7280' },
    errorHint: { display: 'flex', gap: '5px', marginTop: '5px' },
    hintTag: { fontSize: '0.65rem', padding: '2px 6px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' },
    comparisonActions: { padding: '20px', borderTop: '1px solid #e2e8f0' },
    actionButton: { width: '100%', padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    continueButton: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    retryButton: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
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

export default CombinedPhraseCard;
