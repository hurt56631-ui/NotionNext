// XuanZeTi.jsx
import React, { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { FaVolumeUp, FaCheckCircle, FaTimesCircle, FaLightbulb } from "react-icons/fa";
import { pinyin } from "pinyin-pro";

/**
 * Duolingo 风格选择题组件（移动端优先）
 *
 * Props:
 *  - question: {
 *      id: string|number,
 *      text: string,
 *      imageUrl?: string,
 *      options: [{ id, text, imageUrl? }],
 *      correct: [id,...]
 *    }
 *  - autoAdvance?: boolean (默认 true) - 正确 / 错误后是否自动进入下一题
 *  - onNext?: (nextWhen?) => void - 当进入下一题时回调（例如通知父组件加载下一题）
 *  - ttsVoice?: string - tts 引擎 id（可选）
 *  - playRate?: number - tts 播放速度
 *
 * 特点：
 *  - 点击整张卡片即选中并立即判定（避免“点右侧才生效”的问题）
 *  - 题目切换时立即乱序选项（保证每题一次乱序）
 *  - IndexedDB 缓存 TTS 音频
 *  - 阻止手机下拉刷新（安卓 Chrome）
 */

const DB_NAME = "LessonCacheDB";
const STORE_NAME = "tts_audio_v2";
const DB_VERSION = 1;

// ========== 简易 IndexedDB 封装 ==========
const idb = {
  db: null,
  async init() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    await this.init();
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },
  async set(key, blob) {
    await this.init();
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  },
};

// ========== 音频控制器（限一个播放实例） ==========
const audioController = {
  currentAudio: null,
  latestRequestId: 0,
  async stop() {
    this.latestRequestId++;
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
  },
  async playWithCache(text, voice = "zh-CN-XiaoyouMultilingualNeural", rate = 1.0) {
    if (!text || !text.trim()) return;
    const textToRead = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\u1000-\u109F]/g, "");
    if (!textToRead.trim()) return;

    const myReq = ++this.latestRequestId;
    const cacheKey = `tts-${voice}-${rate}-${textToRead}`;
    try {
      const cached = await idb.get(cacheKey);
      if (myReq !== this.latestRequestId) return;
      let audioUrl;
      if (cached) {
        audioUrl = URL.createObjectURL(cached);
      } else {
        // 注意：这里使用你的 tts 代理接口（和你原先的类似）
        const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=${encodeURIComponent(voice)}&r=${rate > 1 ? 20 : 0}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("tts fetch failed");
        const blob = await res.blob();
        if (myReq !== this.latestRequestId) return;
        await idb.set(cacheKey, blob);
        audioUrl = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      this.currentAudio = audio;
      // play() 可能会被浏览器阻止，需要 catch
      audio.play().catch(() => {});
      audio.onended = () => {
        if (this.currentAudio === audio) this.currentAudio = null;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      };
    } catch (e) {
      console.error("TTS play error", e);
    }
  },
};

// ========== 辅助：拼音生成 ==========
const isChineseChar = (ch) => /[\u4e00-\u9fa5]/.test(ch);
const makePinyinData = (text) => {
  if (!text) return [];
  try {
    const pyArr = pinyin(text, { type: "array", toneType: "symbol" }) || [];
    const chars = text.split("");
    let idx = 0;
    return chars.map((ch) => {
      if (isChineseChar(ch)) {
        const py = pyArr[idx] || "";
        idx++;
        return { char: ch, py };
      }
      return { char: ch, py: "" };
    });
  } catch (e) {
    return text.split("").map((c) => ({ char: c, py: "" }));
  }
};

// ========== 样式（内联 CSS 字符串） ==========
const styles = `
/* Container */
.dlg-root { width:100%; max-width:580px; margin:0 auto; padding:14px; box-sizing:border-box; -webkit-tap-highlight-color: transparent; }
.dlg-card { background: #fff; border-radius:18px; padding:16px; box-shadow: 0 8px 30px rgba(16,24,40,0.06); margin-bottom:12px; user-select:none; }
.dlg-q-image { width:100%; max-height:220px; object-fit:cover; border-radius:12px; margin-bottom:12px; background:#f8fafc; }

/* pinyin/char */
.dlg-pinyin-row { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; align-items:flex-end; }
.dlg-char { display:flex; flex-direction:column; align-items:center; min-width:20px; }
.dlg-py { font-size:0.85rem; color:#6b7280; font-family:monospace; height:1.05rem; line-height:1.05rem; margin-bottom:-6px; }
.dlg-cn { font-size:1.5rem; font-weight:700; color:#0f172a; line-height:1.2; }

/* options */
.dlg-options { display:grid; gap:12px; margin-top:6px; }
.dlg-opt { display:flex; align-items:center; gap:12px; padding:12px; border-radius:14px; background:#fff; border:1px solid #e6eef7; cursor:pointer; transition: transform .12s ease, box-shadow .12s ease, background .12s ease; }
.dlg-opt:active { transform: scale(0.985); }
.dlg-opt .opt-left { width:56px; height:56px; border-radius:10px; overflow:hidden; background:#f3f4f6; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.dlg-opt img.opt-img { width:100%; height:100%; object-fit:cover; }
.dlg-opt .opt-text { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
.dlg-opt .opt-py { font-size:0.78rem; color:#94a3b8; font-family:monospace; height:1.1rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.dlg-opt .opt-cn { font-size:1.05rem; font-weight:700; color:#0b1524; }

/* 状态 */
.dlg-opt.selected { border-color: #c7b3ff; background: linear-gradient(180deg,#f8f3ff,#fbf8ff); box-shadow: 0 8px 20px rgba(139,92,246,0.12); }
.dlg-opt.correct { border-color:#34d399; background:#ecfdf5; box-shadow:0 8px 20px rgba(16,185,129,0.08); }
.dlg-opt.incorrect { border-color:#fb7185; background:#fff1f2; box-shadow:0 8px 20px rgba(242,63,63,0.06); animation: shake .36s; }

.dlg-btn-row { display:flex; gap:12px; margin-top:14px; align-items:center; justify-content:center; }
.dlg-btn { padding:12px 20px; border-radius:999px; font-weight:800; font-size:1rem; border:none; cursor:pointer; }
.dlg-btn.primary { background: linear-gradient(135deg,#8b5cf6 0%, #5b6df6 100%); color:white; box-shadow: 0 10px 28px rgba(99,102,241,0.22); }
.dlg-btn.ghost { background:transparent; border:1px solid #e6eef7; color:#334155; }

.dlg-explain { margin-top:12px; padding:12px; border-radius:12px; background:#fff7ed; border:1px solid #fee2b3; color:#92400e; display:flex; gap:8px; align-items:flex-start; }

/* icons */
.dlg-vol { position: absolute; top:14px; right:18px; color:#94a3b8; }

/* small animation */
@keyframes shake {
  0% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } 100% { transform: translateX(0); }
}
`;

// ========== 主组件 ==========
const DuolingoMCQ = ({
  question,
  autoAdvance = true,
  onNext = () => {},
  ttsVoice = "zh-CN-XiaoyouMultilingualNeural",
  playRate = 0.95,
}) => {
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [selected, setSelected] = useState(null); // id
  const [state, setState] = useState("idle"); // idle | showing (判定中) | waitingNext
  const [showExplanation, setShowExplanation] = useState(false);
  const [pinyinData, setPinyinData] = useState([]);
  const containerRef = useRef(null);
  const lastQuestionIdRef = useRef(null);
  const autoAdvanceTimeout = useRef(null);
  const isMounted = useRef(true);

  // 防止下拉刷新（安卓）
  useEffect(() => {
    let startY = 0;
    const onTouchStart = (e) => {
      startY = e.touches?.[0]?.clientY || 0;
    };
    const onTouchMove = (e) => {
      const y = e.touches?.[0]?.clientY || 0;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop === 0 && y - startY > 10) {
        // 在页面顶端向下滑动，阻止浏览器下拉刷新的默认行为
        e.preventDefault();
      }
    };
    document.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // 初始化/题目切换：乱序并生成拼音。只在 question.id 改变时触发。
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!question) return;
    // 停音
    audioController.stop();

    // 生成拼音
    setPinyinData(makePinyinData(question.text || ""));

    // 处理并乱序选项（每次题目切换都乱序）
    const processed = (question.options || []).map((opt) => ({
      ...opt,
      isChinese: /[\u4e00-\u9fa5]/.test(opt.text || ""),
      pinyinData: /[\u4e00-\u9fa5]/.test(opt.text || "") ? makePinyinData(opt.text || "") : [],
      hasImage: !!opt.imageUrl,
    }));

    // Fisher-Yates shuffle
    const arr = [...processed];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffledOptions(arr);

    // 重置状态
    setSelected(null);
    setState("idle");
    setShowExplanation(false);

    // 自动读题（短延迟以避免自动播放被浏览器阻止）
    setTimeout(() => {
      audioController.playWithCache(question.text || "", ttsVoice, playRate);
    }, 220);

    lastQuestionIdRef.current = question.id;
  }, [question?.id]);

  // 清理自动推进定时器
  useEffect(() => {
    return () => {
      if (autoAdvanceTimeout.current) {
        clearTimeout(autoAdvanceTimeout.current);
      }
    };
  }, []);

  // 点击选项：立即选中并判定（立即反馈）
  const handleOptionClick = (opt) => {
    if (!question || state !== "idle") return;
    setSelected(opt.id);
    // 立刻给出音频（选项文本）
    audioController.playWithCache(opt.text || "", ttsVoice, playRate);
    // 立刻判定
    evaluateAnswer(opt.id);
  };

  const evaluateAnswer = (optId) => {
    if (!question) return;
    setState("showing");
    const correctIds = (question.correct || []).map(String);
    const chosen = String(optId);
    const isCorrect = correctIds.includes(chosen);

    if (isCorrect) {
      // 成功动画与音效
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#a78bfa", "#60a5fa", "#fbbf24"] });
      // 播放成功音（尝试内置声音或静默失败）
      try {
        new Audio("/sounds/correct.mp3").play().catch(()=>{});
      } catch (e) {}

      // 短暂展示正确状态，然后自动 next（或等用户触发）
      if (autoAdvance) {
        autoAdvanceTimeout.current = setTimeout(() => {
          if (!isMounted.current) return;
          setState("waitingNext");
          onNext && onNext({ correct: true, question });
        }, 700);
      } else {
        setState("waitingNext");
      }
    } else {
      // 错误音与振动
      try {
        new Audio("/sounds/incorrect.mp3").play().catch(()=>{});
      } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(180);

      // 如果有解析文本，显示并朗读解析
      if (question.explanation) {
        setShowExplanation(true);
        setTimeout(() => audioController.playWithCache(question.explanation || "", ttsVoice, playRate), 700);
      }

      // 错误后给用户一个短暂查看期，然后恢复为可重试（不乱序）
      autoAdvanceTimeout.current = setTimeout(() => {
        if (!isMounted.current) return;
        setState("idle");
        // 保留 selected（显示错）或清空 selected 以便用户重新选
        setSelected(null);
      }, 1200);
    }
  };

  // 手动读题
  const handleRead = (e) => {
    e && e.stopPropagation();
    audioController.playWithCache(question.text || "", ttsVoice, playRate);
  };

  // 渲染 option 卡片状态类名
  const optionClassFor = (opt) => {
    const s = [];
    if (selected !== null) {
      const corr = (question.correct || []).map(String);
      if (state !== "idle") {
        if (corr.includes(String(opt.id))) s.push("correct");
        else if (String(opt.id) === String(selected) && !corr.includes(String(opt.id))) s.push("incorrect");
      } else {
        if (String(opt.id) === String(selected)) s.push("selected");
      }
    }
    return s.join(" ");
  };

  // 如果没有 question，渲染空占位
  if (!question) {
    return (
      <>
        <style>{styles}</style>
        <div className="dlg-root">
          <div className="dlg-card">
            <div style={{ textAlign: "center", color: "#64748b" }}>暂无题目</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="dlg-root" ref={containerRef}>
        <div className="dlg-card" onClick={() => { /* 点击卡片不触发其他行为 */ }}>
          {/* 读题按钮 */}
          <div style={{ position: "relative" }}>
            <FaVolumeUp className="dlg-vol" onClick={handleRead} style={{ fontSize: 18, cursor: "pointer" }} />
            {question.imageUrl && <img src={question.imageUrl} alt="q" className="dlg-q-image" />}
            <div className="dlg-pinyin-row" aria-hidden>
              {pinyinData.map((it, i) => (
                <div className="dlg-char" key={i}>
                  <div className="dlg-py">{it.py || ""}</div>
                  <div className="dlg-cn">{it.char}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 选项列表 */}
        <div className="dlg-options" role="list">
          {shuffledOptions.map((opt) => (
            <div
              key={opt.id}
              role="button"
              tabIndex={0}
              aria-pressed={String(selected) === String(opt.id)}
              onClick={() => handleOptionClick(opt)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOptionClick(opt); } }}
              className={`dlg-opt ${optionClassFor(opt)}`}
            >
              <div className="opt-left">
                {opt.imageUrl ? <img src={opt.imageUrl} className="opt-img" alt="" /> : <div style={{ width: "100%", height: "100%" }} />}
              </div>
              <div className="opt-text">
                {opt.isChinese ? (
                  <>
                    <div className="opt-py">{(opt.pinyinData || []).map(d => d.py).filter(Boolean).join(" ")}</div>
                    <div className="opt-cn">{opt.text}</div>
                  </>
                ) : (
                  <div className="opt-cn">{opt.text}</div>
                )}
              </div>

              {/* 状态图标 */}
              {state !== "idle" && ((question.correct || []).map(String).includes(String(opt.id))) && (
                <FaCheckCircle style={{ color: "#10b981", fontSize: 18 }} />
              )}
              {state !== "idle" && String(selected) === String(opt.id) && !((question.correct || []).map(String).includes(String(opt.id))) && (
                <FaTimesCircle style={{ color: "#ef4444", fontSize: 18 }} />
              )}
            </div>
          ))}
        </div>

        {/* 解析 + 按钮 */}
        <div style={{ marginTop: 12 }}>
          {showExplanation && question.explanation && (
            <div className="dlg-explain">
              <FaLightbulb style={{ marginTop: 2 }} />
              <div style={{ fontSize: 14, lineHeight: 1.45 }}>{question.explanation}</div>
            </div>
          )}

          <div className="dlg-btn-row">
            {/* 手动下一题（当 autoAdvance=false 或者用户想跳过） */}
            <button
              className="dlg-btn ghost"
              onClick={() => {
                // 允许父组件决定下一题
                audioController.stop();
                onNext && onNext({ correct: (question.correct || []).map(String).includes(String(selected)), question });
              }}
            >
              跳过 / 下一题
            </button>

            <button
              className="dlg-btn primary"
              onClick={() => {
                // 当用户希望手动提交（只在未自动提交场景下有用）
                if (state === "idle" && selected !== null) {
                  evaluateAnswer(selected);
                } else if (state === "waitingNext") {
                  // 已判定并等待下一步，直接触发下一题
                  audioController.stop();
                  onNext && onNext({ correct: (question.correct || []).map(String).includes(String(selected)), question });
                }
              }}
            >
              {state === "waitingNext" ? "下一题" : "确认"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DuolingoMCQ;
