// components/Tixing/CiDianKa.js (V8.1 - 已修复语法错误和交互逻辑)

import React, { useState, useEffect, useRef, forwardRef, useCallback } from 'react';
import { useSprings, animated, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziWriter from 'hanzi-writer';

// ===================== 样式 =====================
const styles = {
  fullScreen: {
    position: 'fixed', inset: 0, zIndex: 9999, background: '#f5f7fb',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    perspective: '1400px',
  },
  container: {
    position: 'relative', width: '100%', height: '100%',
    touchAction: 'none',
  },
  cardShell: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', willChange: 'transform',
  },
  cardInner: {
    width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px',
    transformStyle: 'preserve-3d',
  },
  face: {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
    borderRadius: '20px',
    background: 'linear-gradient(180deg,#ffffff,#eef6ff)',
    boxShadow: '0 30px 60px rgba(10,30,80,0.12)',
    display: 'flex', flexDirection: 'column', padding: '28px',
    paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 20px))',
  },
  backFace: { transform: 'rotateY(180deg)' },
  header: { textAlign: 'center', marginBottom: 8 },
  pinyin: { fontSize: '1.4rem', color: '#5b6b82', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: '#102035' },
  practiceArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 12, marginTop: 12, borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: 12,
  },
  leftButtons: { display: 'flex', gap: 10 },
  button: {
    background: '#eef2ff', color: '#0f172a', border: 'none', padding: '10px 14px',
    borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center'
  },
  ttsButton: {
    background: '#e2e8f0', borderRadius: 14, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center'
  },
  example: {
    background: 'rgba(240,244,255,0.9)', padding: 12, borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center'
  },
  meaning: { fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' },
  explanation: { marginTop: 10, fontStyle: 'italic', color: '#415161', borderLeft: '3px solid #3b82f6', paddingLeft: 10 },
  tiny: { fontSize: 12, color: '#6b7280' },
  feedbackRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 },
  feedbackSyll: { fontSize: 16, padding: '4px 7px', borderRadius: 8 },
  modalBackdrop: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 10000 },
  modalBox: { background: '#fff', padding: 18, borderRadius: 12, width: '92%', maxWidth: 380 }
};

// ===================== TTS 单例管理（Howl） =====================
let _howlInstance = null;
const playTTS = (urlOrText) => {
  if (!urlOrText) return;
  try { if (_howlInstance && _howlInstance.playing()) _howlInstance.stop(); } catch (e) {}
  const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(urlOrText)}&v=zh-CN-XiaoyouNeural&r=-15`;
  _howlInstance = new Howl({ src: [ttsUrl] });
  _howlInstance.play();
};
const preloadTTS = async (text) => {
  if (!text) return;
  try {
    const h = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`] });
    h.once('load', () => { h.unload(); });
  } catch (e) {}
};

// ===================== 拼音智能比对 =====================
const comparePinyin = (correctStr, spokenStr) => {
  const correctArr = pinyinConverter(correctStr, { type: 'array' }) || [];
  const userArr = pinyinConverter(spokenStr || '', { type: 'array' }) || [];
  return correctArr.map((c, i) => {
    const u = userArr[i] || '';
    const cp = parsePinyin(c || '');
    const up = parsePinyin(u || '');
    const initial = cp.initial === up.initial ? 'ok' : 'bad';
    const final = cp.final === up.final ? 'ok' : 'bad';
    const tone = (cp.tone || '') === (up.tone || '') ? 'ok' : 'bad';
    return { correct: c, spoken: u || '—', initial, final, tone };
  });
};

// ===================== HanziWriter Modal =====================
const HanziModal = ({ char, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    let writer = null;
    const tid = setTimeout(() => {
      if (!ref.current) return;
      ref.current.innerHTML = '';
      try {
        writer = HanziWriter.create(ref.current, char, { width: 260, height: 260, padding: 10, showOutline: true });
        writer.animateCharacter();
      } catch (e) { console.error(e); }
    }, 80);
    return () => { clearTimeout(tid); };
  }, [char]);
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div ref={ref} />
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button style={styles.button} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

// ===================== PronunciationPractice 子组件 =====================
const PronunciationPractice = ({ word, onResult }) => {
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState([]);
  const recognitionRef = useRef(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('浏览器不支持语音识别。');
      return;
    }
    if (status === 'listening') {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    rec.onstart = () => setStatus('listening');
    rec.onresult = (ev) => {
      setStatus('loading');
      const t = ev.results[0][0].transcript || '';
      const cmp = comparePinyin(word, t);
      setFeedback(cmp);
      setStatus('feedback');
      if (onResult) onResult({ transcript: t, cmp });
    };
    rec.onerror = () => setStatus('idle');
    rec.onend = () => { if (status === 'listening') setStatus('idle'); };
    rec.start();
    recognitionRef.current = rec;
  }, [status, word, onResult]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button onClick={startListening} style={{ ...styles.button, background: status === 'listening' ? '#ffefef' : '#eef2ff' }}>
        <FaMicrophone /> {status === 'listening' ? '正在听...' : '开始练习'}
      </button>
      <div style={{ marginTop: 8 }}>
        {status === 'feedback' && (
          <div style={styles.feedbackRow}>
            {feedback.map((s, idx) => (
              <div key={idx} style={{...styles.feedbackSyll, background: (s.initial === 'ok' && s.final === 'ok' && s.tone === 'ok') ? '#dcfce7' : '#fee2e2', color: (s.initial === 'ok' && s.final === 'ok' && s.tone === 'ok') ? '#166534' : '#991b1b' }}>
                {parsePinyin(s.correct).initial}{parsePinyin(s.correct).final}
                <div style={{ fontSize: 12 }}>{s.spoken}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ===================== CardView =====================
const CardView = forwardRef(({ data, onOpenWriter, onPronounceClick, renderPractice }, ref) => {
  const { word, pinyin, meaning, example, aiExplanation } = data;
  return (
    <div style={styles.cardInner} ref={ref}>
      <animated.div style={{ ...styles.face }}>
        <div style={styles.header}><div style={styles.pinyin}>{pinyin}</div><div style={styles.hanzi}>{word}</div></div>
        <div style={styles.practiceArea}>{renderPractice ? renderPractice() : <div style={styles.tiny}>点击底部「发音练习」开始</div>}</div>
        <div style={styles.footer} onPointerDown={(e) => e.stopPropagation()}>
          <div style={styles.leftButtons}><button style={styles.button} onClick={(e) => { e.stopPropagation(); }}><FaMicrophone /> 发音练习</button><button style={styles.button} onClick={(e) => { e.stopPropagation(); onOpenWriter && onOpenWriter(word); }}><FaPenFancy /> 笔顺</button></div>
          <div><button style={styles.ttsButton} onClick={(e) => { e.stopPropagation(); onPronounceClick && onPronounceClick(word); }}><FaVolumeUp /></button></div>
        </div>
      </animated.div>
      <animated.div style={{ ...styles.face, ...styles.backFace }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={styles.meaning}>{meaning}</div>
          <div style={styles.example}><FaVolumeUp style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onPronounceClick && onPronounceClick(example); }} /><div style={styles.exampleText}>{example}</div></div>
          {aiExplanation && <div style={styles.explanation}>{aiExplanation}</div>}
        </div>
      </animated.div>
    </div>
  );
});
CardView.displayName = 'CardView';

// ===================== 主组件 CiDianKa =====================
const CiDianKa = ({ flashcards = [] }) => {
  const cards = Array.isArray(flashcards) && flashcards.length ? flashcards : [];
  const [springs, api] = useSprings(cards.length, i => ({
    x: 0, rot: 0, scale: 1, rotateY: 0, zIndex: cards.length - i, config: { mass: 1, tension: 300, friction: 30 }
  }));
  const topIndexRef = useRef(0);
  const [currentTop, setCurrentTop] = useState(0);
  topIndexRef.current = currentTop;

  const getRotateY = (i) => {
    try { return springs[i]?.rotateY?.get() ?? 0; } catch { return 0; }
  };

  useEffect(() => {
    cards.forEach(c => { if (c.word) preloadTTS(c.word); if (c.example) preloadTTS(c.example); });
  }, [cards]);

  useEffect(() => {
    if (!cards.length) return;
    const w = cards[currentTop]?.word;
    if (w) {
      const t = setTimeout(() => playTTS(w), 180);
      return () => clearTimeout(t);
    }
  }, [currentTop, cards]);

  const [writerChar, setWriterChar] = useState(null);

  const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx], tap }) => {
    if (index !== topIndexRef.current) return;
    const rotateYVal = getRotateY(index);
    if (rotateYVal && Math.abs(rotateYVal) > 10) {
      if (tap) api.start(i => (i === index ? { rotateY: 0 } : undefined));
      return;
    }

    if (down) {
      api.start(i => i === index ? { x: mx, rot: mx / 20, scale: 1.04 } : undefined);
    } else {
      // *** 核心修复区域：补全了这里的逻辑 ***
      const trigger = vx > 0.2; // 滑动速度阈值
      if (tap) {
        api.start(i => (i === index ? { rotateY: 180, x: 0, rot: 0, scale: 1 } : undefined));
      } else if (trigger) {
        const dir = xDir < 0 ? -1 : 1;
        api.start(i => {
          if (i !== index) return;
          const x = (200 + window.innerWidth) * dir;
          const rot = mx / 10 + dir * 10 * vx;
          return { x, rot, config: { friction: 50, tension: 200 } };
        });
        setCurrentTop((prev) => (prev + 1) % cards.length);
      } else {
        api.start(i => i === index ? { x: 0, rot: 0, scale: 1 } : undefined);
      }
    }
  });

  if (!cards.length) return null;

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal char={writerChar} onClose={() => setWriterChar(null)} />}
      <div style={styles.container}>
        {springs.map((props, i) => (
          <animated.div
            key={i}
            style={{
              ...styles.cardShell,
              zIndex: props.zIndex,
              transform: to([props.x, props.scale, props.rot], (x, s, r) => `translateX(${x}px) scale(${s}) rotateZ(${r}deg)`)
            }}
            {...bind(i)}
          >
            <animated.div style={{ width: '100%', height: '100%', transform: props.rotateY.to(r => `rotateY(${r}deg)`) }}>
              <CardView
                data={cards[i]}
                onOpenWriter={setWriterChar}
                onPronounceClick={playTTS}
                renderPractice={() => <PronunciationPractice word={cards[i].word} />}
              />
            </animated.div>
          </animated.div>
        ))}
      </div>
    </div>
  );
};

export default CiDianKa;
