// components/Tixing/CiDianKa.js (V26 - Fixed & Improved)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaUpload } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 音效资源（复用 Howl 实例） =====================
const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.7 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;
const playTTS = (text, e) => {
  if (e && e.stopPropagation) e.stopPropagation();
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (err) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};

// ===================== 随机渐变色 =====================
const gradients = [
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(135deg, #a3bded 0%, #6991c7 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
];
const getRandomGradient = () => gradients[Math.floor(Math.random() * gradients.length)];

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2000px' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' },
  cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
  glassOverlay: { position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px) brightness(1.1)', WebkitBackdropFilter: 'blur(8px) brightness(1.1)', zIndex: 0 },
  backFace: { transform: 'rotateY(180deg)', background: '#f0f2f5', justifyContent: 'center' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab', padding: '10px', zIndex: 1 },
  header: { textAlign: 'center' },
  pinyin: { fontSize: '1.6rem', color: 'white', marginBottom: 6, textShadow: '0 0 5px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)' },
  hanzi: { fontSize: '6rem', fontWeight: 800, lineHeight: 1.1, color: 'white', textShadow: '0 0 8px rgba(0,0,0,0.5), 0 0 3px rgba(0,0,0,0.8)' },
  footer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', margin: '0 -28px -28px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  iconButton: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px' },
  settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 },
  settingsContent: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' },
  uploadButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' },
  listeningText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.2rem', marginTop: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' },
  pronunciationChecker: { width: 'calc(100% - 20px)', padding: '20px', marginTop: '16px', borderTop: '4px solid #3b82f6', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', color: '#1a202c', zIndex: 2 },
};

// ===================== 拼音/声母表辅助函数 =====================
// 常见汉语声母（包含复合声母）
const INITIALS = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s','y','w'];

// 将带数字声调形式的拼音（例如: shi4, shì 或 shi）拆分为 initial / final / tone
function splitSyllable(pinyinWithToneNumeric) {
  if (!pinyinWithToneNumeric) return { initial: '', final: '', tone: null, raw: '' };
  // 先把可能的空白去掉
  const raw = pinyinWithToneNumeric.trim();
  // 如果末尾有数字 1-5，取出声调；否则设为 null
  const toneMatch = raw.match(/([1-5])$/);
  const tone = toneMatch ? Number(toneMatch[1]) : null;
  const base = toneMatch ? raw.slice(0, -1) : raw;

  // 找最长匹配声母（优先复合声母）
  let initial = '';
  for (const init of INITIALS.sort((a,b)=>b.length - a.length)) {
    if (base.startsWith(init)) { initial = init; break; }
  }
  const final = initial ? base.slice(initial.length) : base;
  return { initial, final, tone, raw };
}

// 将中文词/句转换为按字/音节的带数字声调拼音数组（优先用 pinyin-pro 输出数字声调）
function toPinyinNumberArray(chineseText) {
  if (!chineseText || typeof chineseText !== 'string') return [];
  try {
    // 尝试让 pinyin-pro 返回用数字表示声调并用空格分隔音节
    const pinyinStr = pinyinConverter(chineseText, { toneType: 'num', heteronym: false, separator: ' ' });
    // split by whitespace，去掉多余空项
    return pinyinStr.split(/\s+/).filter(Boolean);
  } catch (err) {
    console.error('toPinyinNumberArray error', err);
    return [];
  }
}

// ===================== 发音比对逻辑（返回逐音节对比结果） =====================
function analyzePronunciation(correctWord, userText) {
  try {
    if (!correctWord) return null;
    // 把标准和用户发音都转为数字声调形式的拼音数组
    const correctPys = toPinyinNumberArray(correctWord); // e.g. ['shi4','li4']
    const userPys = toPinyinNumberArray(userText); // recognition 输出通常是汉字 -> pinyin-pro 能解析

    if (userPys.length === 0 && userText && userText.length > 0) {
      // 用户语音识别到非汉字或未能解析成拼音
      return { error: '无法解析您的发音为可比拼音，请尝试更清晰朗读或检查识别结果', userRaw: userText };
    }

    const length = Math.max(correctPys.length, userPys.length);
    let overallCorrect = true;
    const details = [];
    for (let i = 0; i < length; i++) {
      const correctPy = correctPys[i] || '';
      const userPy = userPys[i] || '';
      const c = splitSyllable(correctPy);
      const u = splitSyllable(userPy);
      const initialCorrect = c.initial === u.initial;
      const finalCorrect = c.final === u.final;
      // 如果任意一方 tone 为 null，则用严格比较（null != number -> 不同）
      const toneCorrect = (c.tone === u.tone);
      if (!(initialCorrect && finalCorrect && toneCorrect)) overallCorrect = false;
      details.push({
        correct: { raw: c.raw, initial: c.initial, final: c.final, tone: c.tone },
        user: { raw: u.raw, initial: u.initial, final: u.final, tone: u.tone },
        flags: { initialCorrect, finalCorrect, toneCorrect }
      });
    }

    return { details, overallCorrect, correctRaw: correctPys.join(' '), userRaw: userPys.join(' ') };
  } catch (err) {
    console.error('analyzePronunciation error', err);
    return { error: '发音分析时发生错误' };
  }
}

// ===================== 发音分析组件 =====================
const DetailedPronunciationChecker = ({ correctWord, userText }) => {
  const result = useMemo(() => analyzePronunciation(correctWord, userText), [correctWord, userText]);

  useEffect(() => {
    if (!result) return;
    if (result.error) return;
    (result.overallCorrect ? sounds.correct : sounds.incorrect).play();
  }, [result]);

  if (!result) return null;

  return (
    <div style={styles.pronunciationChecker} onClick={(e)=>e.stopPropagation()} data-no-flip="true">
      <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#1a202c' }}>发音分析</h3>
      {result.error ? (
        <p style={{ marginTop: 8, color: '#dc2626' }}>{result.error}</p>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={{ fontWeight: 600, width: 90, color: '#4a5568', display: 'inline-block' }}>标准发音:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', color: '#16a34a', wordBreak: 'break-all' }}>
              {result.correctRaw}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: 600, width: 90, color: '#4a5568', display: 'inline-block' }}>你的发音:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', wordBreak: 'break-all' }}>
              {result.details.map((d, idx) => {
                // 显示：声母(红)/韵母(红)/声调(红) 的组合（错误时红色）
                const initialColor = d.flags.initialCorrect ? '#1a202c' : '#dc2626';
                const finalColor = d.flags.finalCorrect ? '#1a202c' : '#dc2626';
                const toneColor = d.flags.toneCorrect ? '#1a202c' : '#dc2626';
                return (
                  <span key={idx} style={{ display: 'inline-block', marginRight: 10 }}>
                    <span style={{ color: initialColor }}>{d.user.initial}</span>
                    <span style={{ color: finalColor }}>{d.user.final}</span>
                    <sup style={{ marginLeft: 4, color: toneColor }}>{d.user.tone ?? ''}</sup>
                  </span>
                );
              })}
            </span>
          </div>
          {!result.overallCorrect && (
            <p style={{ paddingTop: 8, color: '#ca8a04', borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
              提示：红色为不匹配项（声母/韵母/声调），请对比标准发音并重试。
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ===================== 带拼音的文本组件（展示用） =====================
const TextWithPinyin = ({ text }) => {
  const pinyinResult = useMemo(() => {
    try {
      if (typeof text !== 'string' || !text) return text ? [{ surface: text, pinyin: null }] : [];
      // 使用 pinyin-pro 分词并得到拼音（带声调标记）
      const resultFromLib = pinyinConverter(text, { toneType: 'mark', segment: true, group: true });
      // resultFromLib 有时返回字符串或数组，兼容处理
      if (!Array.isArray(resultFromLib)) {
        // fallback：整个句子的拼音
        const whole = pinyinConverter(text, { toneType: 'mark', separator: ' ' });
        return [{ surface: text, pinyin: whole }];
      }
      return resultFromLib.map(segment => (segment.type === 'other') ? { surface: segment.surface, pinyin: null } : { surface: segment.surface, pinyin: segment.pinyin.join(' ') });
    } catch (error) {
      console.error("TextWithPinyin Error:", error, { text });
      return [{ surface: text, pinyin: null }];
    }
  }, [text]);

  return (
    <span style={{ lineHeight: 2.2 }}>
      {pinyinResult.map((item, index) => (item.pinyin ? (
        <ruby key={index} style={{ margin: '0 2px' }}>
          <rt style={{ fontSize: '0.8em', userSelect: 'none' }}>{item.pinyin}</rt>
          {item.surface}
        </ruby>
      ) : (
        <span key={index}>{item.surface}</span>
      )))}
    </span>
  );
};

// ===================== 主组件 CiDianKa (V26) =====================
const CiDianKa = ({ flashcards = [] }) => {
  const processedCards = useMemo(() => {
    try {
      if (!Array.isArray(flashcards)) return [];
      return flashcards
        .filter(card => card && typeof card === 'object' && typeof card.word === 'string' && card.word)
        .map(card => ({ ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' }) }));
    } catch (error) {
      console.error("CRITICAL ERROR processing 'flashcards':", error, flashcards);
      return [];
    }
  }, [flashcards]);

  const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "数据加载中或为空...", example: "请检查数据源或稍后再试。" }];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [adKey, setAdKey] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [currentBg, setCurrentBg] = useState(() => getRandomGradient());
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const recognitionRef = useRef(null);
  const [swipeDirection, setSwipeDirection] = useState(1);

  const transitions = useTransition(currentIndex, {
    from: { opacity: 0, transform: `translateX(${swipeDirection * 50}%) scale(0.8) rotateY(${-swipeDirection * 90}deg)` },
    enter: { opacity: 1, transform: `translateX(0%) scale(1) rotateY(0deg)` },
    leave: { opacity: 0, transform: `translateX(${-swipeDirection * 50}%) scale(0.8) rotateY(${swipeDirection * 90}deg)` },
    config: { mass: 1, tension: 210, friction: 20 },
    onStart: () => { if (currentIndex !== 0) { sounds.switch.play(); } },
    onRest: () => { setIsFlipped(false); setRecognizedText(''); },
  });

  const navigate = (direction) => {
    setSwipeDirection(direction);
    setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  };

  // 手势：分离 tap(翻转) 与 swipe(切换)
  const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
    // tap -> 仅在非标记为 data-no-flip 元素时触发翻转
    if (tap) {
      if (event && event.target && event.target.closest && event.target.closest('[data-no-flip="true"]')) return;
      if (recognizedText) return;
      setIsFlipped(prev => !prev);
      return;
    }

    // swipe trigger: 更灵敏（根据你的反馈，这里提高灵敏度）
    const trigger = (vx > 0.5) || (Math.abs(mx) > 70);
    if (!down && trigger) {
      const dir = xDir < 0 ? 1 : -1; // 左滑 xDir < 0 -> 下一张(1)
      if (isFlipped) {
        // 如果背面打开，先合回正面再切换，给视觉连贯性
        setIsFlipped(false);
        setTimeout(() => navigate(dir), 150);
      } else {
        navigate(dir);
      }
    }
  });

  // 前面自动朗读词（打开正面时）
  useEffect(() => {
    const currentCard = cards[currentIndex];
    if (currentCard && !isFlipped) {
      const timer = setTimeout(() => playTTS(currentCard.word), 600);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isFlipped, cards]);

  // 背面打开时朗读释义（短延迟）
  useEffect(() => {
    if (isFlipped) {
      const currentCard = cards[currentIndex];
      if (currentCard && currentCard.meaning) {
        const timer = setTimeout(() => playTTS(currentCard.meaning), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [isFlipped, currentIndex, cards]);

  useEffect(() => {
    setAdKey(k => k + 1);
    if (backgroundImages.length > 0) {
      setCurrentBg(backgroundImages[Math.floor(Math.random() * backgroundImages.length)]);
    } else {
      setCurrentBg(getRandomGradient());
    }
  }, [currentIndex, backgroundImages]);

  useEffect(() => {
    return () => { if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e){}; recognitionRef.current = null; } };
  }, []);

  // 语音识别
  const handleListen = () => {
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('抱歉，您的浏览器不支持语音识别。'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    recognition.onstart = () => { setIsListening(true); setRecognizedText(''); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
      setRecognizedText(transcript);
    };
    recognition.onerror = (event) => {
      let errorMessage = `识别出错: ${event.error}`;
      if (event.error === 'network') errorMessage = '网络错误';
      else if (event.error === 'no-speech') errorMessage = '未检测到语音';
      setRecognizedText(`[错误: ${errorMessage}]`);
    };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.start();
  };

  // 处理背景图片上传
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      const imageUrls = files.map(file => URL.createObjectURL(file));
      setBackgroundImages(prev => [...prev, ...imageUrls]);
      // 立刻设置当前背景为最新上传的第一张
      setCurrentBg(imageUrls[0]);
      setIsSettingsOpen(false);
    }
  };
  const fileInputRef = useRef(null);

  const handleScreenClick = (e) => {
    if (recognizedText) {
      e.stopPropagation();
      setRecognizedText('');
    }
  };

  // 背景渲染助手：支持 linear-gradient 或 图片 URL
  const getBgStyle = (bgValue) => {
    if (!bgValue) return {};
    if (typeof bgValue === 'string' && bgValue.startsWith('linear-gradient')) {
      return { backgroundImage: bgValue };
    }
    // 可能是 image url
    return { backgroundImage: `url(${bgValue})` };
  };

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
      {isSettingsOpen && (
        <div style={styles.settingsModal} onClick={() => setIsSettingsOpen(false)}>
          <div style={styles.settingsContent} onClick={(e)=>e.stopPropagation()}>
            <button style={styles.closeButton} onClick={() => setIsSettingsOpen(false)}><FaTimes /></button>
            <h3>自定义卡片背景</h3>
            <p>上传的图片仅在您的浏览器中生效。</p>
            <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
            <button style={styles.uploadButton} onClick={() => fileInputRef.current && fileInputRef.current.click()}><FaUpload /> 选择图片</button>
          </div>
        </div>
      )}
      <div style={styles.container}>
        {transitions((style, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          const backgroundStyle = getBgStyle(currentBg);
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...style, zIndex: cards.length - i }}>
              <div style={styles.cardContainer}>
                <div style={{ width: '100%', height: '100%', flex: 1 }} {...bind()} onClickCapture={handleScreenClick}>
                  <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                    {/* 正面 */}
                    <div style={{ ...styles.face, ...backgroundStyle }}>
                      <div style={styles.glassOverlay}></div>
                      <div style={styles.mainContent}>
                        <div style={styles.header}>
                          <div style={styles.pinyin}>{cardData.pinyin}</div>
                          <div style={styles.hanzi}>{cardData.word}</div>
                        </div>
                        {isListening && <div style={styles.listeningText}>正在听...</div>}
                        {recognizedText && <DetailedPronunciationChecker correctWord={cardData.word} userText={recognizedText} />}
                      </div>
                    </div>

                    {/* 背面 */}
                    <div style={{ ...styles.face, ...styles.backFace }}>
                      <div style={styles.mainContent}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#2d3748', fontSize: '1.2rem' }}>
                            <div style={{ flex: 1, paddingRight: 10 }}>
                              <TextWithPinyin text={cardData.meaning} />
                            </div>
                            <FaVolumeUp
                              data-no-flip="true"
                              style={{ cursor: 'pointer', color: '#667eea' }}
                              size={24}
                              onPointerDown={(e) => { e.stopPropagation(); }}
                              onClick={(e) => { e.stopPropagation(); playTTS(cardData.meaning, e); }}
                              title="朗读释义"
                            />
                          </div>

                          {cardData.example && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#4a5568', fontSize: '1.1rem', borderTop: '1px solid #ddd', paddingTop: 20 }}>
                              <div style={{ flex: 1, paddingRight: 10 }}>
                                <TextWithPinyin text={cardData.example} />
                              </div>
                              <FaVolumeUp
                                data-no-flip="true"
                                style={{ cursor: 'pointer', color: '#667eea' }}
                                size={24}
                                onPointerDown={(e) => { e.stopPropagation(); }}
                                onClick={(e) => { e.stopPropagation(); playTTS(cardData.example, e); }}
                                title="朗读例句"
                              />
                            </div>
                          )}
                        </div>
                        <AdComponent key={adKey + '_back'} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 底部控制 */}
                <div style={styles.footer}>
                  <button style={styles.iconButton} onClick={() => setIsSettingsOpen(true)} title="设置" data-no-flip="true"><FaCog size={20} /></button>
                  <button style={{ ...styles.button, background: isListening ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,0,0.1)' }} onClick={(e) => { e.stopPropagation(); handleListen(); }} data-no-flip="true"><FaMicrophone /> {isListening ? '停止' : '发音练习'}</button>
                  <button style={styles.iconButton} onClick={(e) => { e.stopPropagation(); setWriterChar(cardData.word); }} title="笔顺" data-no-flip="true"><FaPenFancy size={20} /></button>
                  <button style={styles.iconButton} onClick={(e) => { e.stopPropagation(); playTTS(cardData.word, e); }} title="朗读" data-no-flip="true"><FaVolumeUp size={20} /></button>
                </div>

                <AdComponent key={adKey + '_front'} />
              </div>
            </animated.div>
          );
        })}
      </div>
    </div>
  );
};

export default CiDianKa;
