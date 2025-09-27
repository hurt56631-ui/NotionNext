// components/Tixing/CiDianKa.js (V28 - 设置面板增强版)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaTimes, FaUpload } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';

// ===================== 音效 =====================
const sounds = {
  switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.7 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
};
let _howlInstance = null;
const playTTS = (text, e) => {
  if (e?.stopPropagation) e.stopPropagation();
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};

// ===================== 背景 =====================
const bgImages = Array.from({ length: 6 }, (_, i) => `/images/dancibeijingtu-${i + 1}.jpg`);
const getRandomBg = () => bgImages[Math.floor(Math.random() * bgImages.length)];

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '2000px' },
  cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 1s ease-in-out' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' },
  backFace: { transform: 'rotateY(180deg)', background: '#f0f2f5', justifyContent: 'center' },
  hanzi: (s) => ({ fontSize: `${s.hanziSize}px`, fontWeight: 800, color: s.hanziColor, textShadow: s.hanziShadow ? '2px 2px 4px black' : 'none' }),
  pinyin: (s) => ({ fontSize: `${s.pinyinSize}px`, color: s.pinyinColor, textShadow: s.pinyinShadow ? '1px 1px 3px black' : 'none' }),
  meaning: (s) => ({ fontSize: `${s.meaningSize}px`, color: s.meaningColor }),
  example: (s) => ({ fontSize: `${s.exampleSize}px`, color: s.exampleColor, fontStyle: 'italic' }),
  iconBtn: { cursor: 'pointer', marginLeft: 8 },
  settingsBtn: { position: 'absolute', top: 12, right: 12, cursor: 'pointer', fontSize: 22, zIndex: 10 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
  modalContent: { background: 'white', padding: 20, borderRadius: 10, width: '90%', maxWidth: 500, maxHeight: '90%', overflowY: 'auto' },
  modalSection: { marginBottom: 15 },
};

// ===================== 设置面板 =====================
const SettingsModal = ({ isOpen, onClose, settings, setSettings }) => {
  if (!isOpen) return null;
  const handleChange = (field, value) => setSettings(prev => ({ ...prev, [field]: value }));

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3>设置</h3>
          <FaTimes style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>

        {/* 学习顺序 */}
        <div style={styles.modalSection}>
          <label>学习顺序：</label>
          <select value={settings.order} onChange={e => handleChange('order', e.target.value)}>
            <option value="sequential">按顺序</option>
            <option value="random">随机</option>
          </select>
        </div>

        {/* 自动朗读 */}
        <div style={styles.modalSection}>
          <label>
            <input type="checkbox" checked={settings.autoTTS} onChange={e => handleChange('autoTTS', e.target.checked)} />
            自动朗读
          </label>
        </div>

        {/* 背景设置 */}
        <div style={styles.modalSection}>
          <label>背景：</label>
          <select value={settings.bgMode} onChange={e => handleChange('bgMode', e.target.value)}>
            <option value="random">随机</option>
            <option value="fixed">固定</option>
            <option value="upload">上传</option>
          </select>
          {settings.bgMode === 'fixed' && (
            <select value={settings.fixedBg} onChange={e => handleChange('fixedBg', e.target.value)}>
              {bgImages.map((img, idx) => <option key={idx} value={img}>{`背景 ${idx+1}`}</option>)}
            </select>
          )}
          {settings.bgMode === 'upload' && (
            <input type="file" accept="image/*" onChange={(e)=>{
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = ()=> handleChange('uploadedBg', reader.result);
                reader.readAsDataURL(file);
              }
            }}/>
          )}
        </div>

        {/* 字体设置 */}
        <div style={styles.modalSection}>
          <label>汉字大小：</label>
          <input type="number" value={settings.hanziSize} onChange={e=>handleChange('hanziSize', e.target.value)} /> px
          <input type="color" value={settings.hanziColor} onChange={e=>handleChange('hanziColor', e.target.value)} />
          <label><input type="checkbox" checked={settings.hanziShadow} onChange={e=>handleChange('hanziShadow', e.target.checked)} />描边</label>
        </div>

        <div style={styles.modalSection}>
          <label>拼音大小：</label>
          <input type="number" value={settings.pinyinSize} onChange={e=>handleChange('pinyinSize', e.target.value)} /> px
          <input type="color" value={settings.pinyinColor} onChange={e=>handleChange('pinyinColor', e.target.value)} />
          <label><input type="checkbox" checked={settings.pinyinShadow} onChange={e=>handleChange('pinyinShadow', e.target.checked)} />描边</label>
        </div>

        <div style={styles.modalSection}>
          <label>释义大小：</label>
          <input type="number" value={settings.meaningSize} onChange={e=>handleChange('meaningSize', e.target.value)} /> px
          <input type="color" value={settings.meaningColor} onChange={e=>handleChange('meaningColor', e.target.value)} />
        </div>

        <div style={styles.modalSection}>
          <label>例句大小：</label>
          <input type="number" value={settings.exampleSize} onChange={e=>handleChange('exampleSize', e.target.value)} /> px
          <input type="color" value={settings.exampleColor} onChange={e=>handleChange('exampleColor', e.target.value)} />
        </div>
      </div>
    </div>
  );
};

// ===================== 主组件 =====================
const CiDianKa = ({ flashcards = [] }) => {
  const cards = useMemo(() => flashcards.length > 0 ? flashcards : [
    { word: "学习", pinyin: "xué xí", meaning: "study, learn", example: "我喜欢学习汉语。" }
  ], [flashcards]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentBg, setCurrentBg] = useState(getRandomBg());
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('ciDianKaSettings');
    return saved ? JSON.parse(saved) : {
      order: "sequential",
      autoTTS: false,
      bgMode: "random",
      fixedBg: bgImages[0],
      uploadedBg: "",
      hanziSize: 96,
      hanziColor: "#ffffff",
      hanziShadow: true,
      pinyinSize: 28,
      pinyinColor: "#ffffff",
      pinyinShadow: true,
      meaningSize: 22,
      meaningColor: "#2d3748",
      exampleSize: 20,
      exampleColor: "#4a5568"
    };
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(()=> localStorage.setItem('ciDianKaSettings', JSON.stringify(settings)), [settings]);

  // 动画
  const transitions = useTransition(currentIndex, {
    from: { opacity: 0, transform: 'translateX(50%) scale(0.8)' },
    enter: { opacity: 1, transform: 'translateX(0%) scale(1)' },
    leave: { opacity: 0, transform: 'translateX(-50%) scale(0.8)' },
    config: { tension: 200, friction: 20 },
    onRest: () => setIsFlipped(false),
  });

  const navigate = (dir) => {
    setCurrentIndex(prev => {
      if (settings.order === "random") {
        return Math.floor(Math.random() * cards.length);
      }
      return (prev + dir + cards.length) % cards.length;
    });
    let bg = currentBg;
    if (settings.bgMode === "random") bg = getRandomBg();
    if (settings.bgMode === "fixed") bg = settings.fixedBg;
    if (settings.bgMode === "upload") bg = settings.uploadedBg;
    setCurrentBg(bg);
    if (settings.autoTTS) {
      const card = cards[currentIndex];
      playTTS(isFlipped ? card.meaning : card.word);
    }
  };

  // 手势
  const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity: [vx], tap, event }) => {
    if (tap) {
      if (event.target.closest('[data-no-flip="true"]')) return;
      setIsFlipped(prev => !prev);
      return;
    }
    const trigger = (vx > 0.4) || (Math.abs(mx) > 60);
    if (!down && trigger) {
      navigate(xDir < 0 ? 1 : -1);
    }
  });

  // 语音识别
  const handleListen = () => {
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("不支持语音识别"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      if (transcript === cards[currentIndex].word) {
        sounds.correct.play();
        navigate(1);
      } else {
        sounds.incorrect.play();
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  return (
    <div style={styles.fullScreen}>
      <div style={styles.container}>
        <FaCog style={styles.settingsBtn} onClick={()=>setSettingsOpen(true)} />
        {transitions((style, i) => {
          const card = cards[i];
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...style }}>
              <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }} {...bind()}>
                {/* 正面 */}
                <div style={{ ...styles.face, backgroundImage: `url(${currentBg})` }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={styles.pinyin(settings)}>{card.pinyin}</div>
                    <div style={styles.hanzi(settings)}>{card.word}</div>
                  </div>
                  <div>
                    <FaMicrophone style={styles.iconBtn} onClick={handleListen} data-no-flip="true" />
                    <FaVolumeUp style={styles.iconBtn} onClick={(e)=>playTTS(card.word,e)} data-no-flip="true" />
                  </div>
                </div>
                {/* 背面 */}
                <div style={{ ...styles.face, ...styles.backFace }}>
                  <div style={styles.meaning(settings)}>{card.meaning}</div>
                  <div style={styles.example(settings)}>{card.example}</div>
                  <div>
                    <FaVolumeUp style={styles.iconBtn} onClick={(e)=>playTTS(card.meaning,e)} data-no-flip="true" />
                    {card.example && (
                      <FaVolumeUp style={styles.iconBtn} onClick={(e)=>playTTS(card.example,e)} data-no-flip="true" />
                    )}
                  </div>
                </div>
              </div>
            </animated.div>
          );
        })}
      </div>
      <SettingsModal isOpen={settingsOpen} onClose={()=>setSettingsOpen(false)} settings={settings} setSettings={setSettings} />
    </div>
  );
};

export default CiDianKa;
