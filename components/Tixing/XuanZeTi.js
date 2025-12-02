import React, { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { FaVolumeUp, FaCheckCircle, FaTimesCircle, FaLightbulb } from "react-icons/fa";
import { pinyin } from "pinyin-pro";

/**
 * Duolingo 风格选择题组件 - 修复版
 * 
 * 修改内容：
 * 1. 移除了底部所有按钮（跳过/下一题）。
 * 2. 强制使用自动推进逻辑：答对 -> 自动下一题；答错 -> 显示解析 -> 自动重置供重试。
 * 3. 增强禁止下拉刷新（CSS + JS）。
 * 4. 修复选项渲染依赖问题。
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

// ========== 音频控制器 ==========
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
    // 移除特殊字符，只保留中英文数字用于生成Key
    const textToRead = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, "");
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
    // 降级处理
    return text.split("").map((c) => ({ char: c, py: "" }));
  }
};

// ========== 样式 ==========
const styles = `
/* 禁止全局下拉刷新的关键 CSS */
body, html { overscroll-behavior-y: none; overscroll-behavior: none; }

.dlg-root { width:100%; max-width:580px; margin:0 auto; padding:14px; box-sizing:border-box; -webkit-tap-highlight-color: transparent; }
.dlg-card { background: #fff; border-radius:18px; padding:16px; box-shadow: 0 8px 30px rgba(16,24,40,0.06); margin-bottom:12px; user-select:none; }
.dlg-q-image { width:100%; max-height:220px; object-fit:cover; border-radius:12px; margin-bottom:12px; background:#f8fafc; display:block; }

.dlg-pinyin-row { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; align-items:flex-end; min-height: 3rem; }
.dlg-char { display:flex; flex-direction:column; align-items:center; min-width:20px; }
.dlg-py { font-size:0.85rem; color:#6b7280; font-family:monospace; height:1.05rem; line-height:1.05rem; margin-bottom:-6px; }
.dlg-cn { font-size:1.5rem; font-weight:700; color:#0f172a; line-height:1.2; }

/* options */
.dlg-options { display:grid; gap:12px; margin-top:6px; }
.dlg-opt { display:flex; align-items:center; gap:12px; padding:12px; border-radius:14px; background:#fff; border:1px solid #e6eef7; cursor:pointer; transition: transform .12s ease, box-shadow .12s ease, background .12s ease; position: relative; }
.dlg-opt:active { transform: scale(0.98); }
.dlg-opt .opt-left { width:56px; height:56px; border-radius:10px; overflow:hidden; background:#f3f4f6; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.dlg-opt img.opt-img { width:100%; height:100%; object-fit:cover; }
.dlg-opt .opt-text { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
.dlg-opt .opt-py { font-size:0.78rem; color:#94a3b8; font-family:monospace; height:1.1rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.dlg-opt .opt-cn { font-size:1.05rem; font-weight:700; color:#0b1524; }
.dlg-opt .status-icon { margin-left: auto; display: flex; align-items: center; justify-content: center; width: 24px; }

/* 状态 */
.dlg-opt.selected { border-color: #c7b3ff; background: linear-gradient(180deg,#f8f3ff,#fbf8ff); box-shadow: 0 8px 20px rgba(139,92,246,0.12); }
.dlg-opt.correct { border-color:#34d399; background:#ecfdf5; box-shadow:0 8px 20px rgba(16,185,129,0.08); }
.dlg-opt.incorrect { border-color:#fb7185; background:#fff1f2; box-shadow:0 8px 20px rgba(242,63,63,0.06); animation: shake .36s; }

.dlg-explain { margin-top:12px; padding:12px; border-radius:12px; background:#fff7ed; border:1px solid #fee2b3; color:#92400e; display:flex; gap:8px; align-items:flex-start; animation: fadeIn 0.3s ease; }

.dlg-vol { position: absolute; top:14px; right:18px; color:#94a3b8; z-index: 10; }

@keyframes shake {
  0% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } 100% { transform: translateX(0); }
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
`;

// ========== 主组件 ==========
const DuolingoMCQ = ({
  question,
  onNext = () => {},
  ttsVoice = "zh-CN-XiaoyouMultilingualNeural",
  playRate = 0.95,
}) => {
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [selected, setSelected] = useState(null); // id
  const [state, setState] = useState("idle"); // idle | showing
  const [showExplanation, setShowExplanation] = useState(false);
  const [pinyinData, setPinyinData] = useState([]);
  const containerRef = useRef(null);
  const autoAdvanceTimeout = useRef(null);
  const isMounted = useRef(true);

  // 1. 防止下拉刷新（JS层 + CSS层配合）
  useEffect(() => {
    // 只有在非 passive 下才能 preventDefault
    const options = { passive: false };
    let startY = 0;
    
    const onTouchStart = (e) => {
      startY = e.touches?.[0]?.clientY || 0;
    };
    
    const onTouchMove = (e) => {
      const y = e.touches?.[0]?.clientY || 0;
      // document.documentElement.scrollTop 用于 PC/Mobile 兼容
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      
      // 如果处于顶部且向下拉，阻止默认行为
      if (scrollTop <= 0 && y > startY) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, options);
    document.addEventListener("touchmove", onTouchMove, options);
    
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // 2. 组件挂载/卸载追踪
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // 3. 题目初始化逻辑（当 question 变化时执行）
  useEffect(() => {
    if (!question) return;
    
    audioController.stop();

    // 准备拼音
    setPinyinData(makePinyinData(question.text || ""));

    // 准备选项（如果 options 为空则给空数组防止报错）
    const rawOptions = question.options || [];
    const processed = rawOptions.map((opt) => ({
      ...opt,
      isChinese: /[\u4e00-\u9fa5]/.test(opt.text || ""),
      pinyinData: /[\u4e00-\u9fa5]/.test(opt.text || "") ? makePinyinData(opt.text || "") : [],
      hasImage: !!opt.imageUrl,
    }));

    // 乱序算法
    const arr = [...processed];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    
    // 更新状态
    setShuffledOptions(arr);
    setSelected(null);
    setState("idle");
    setShowExplanation(false);

    // 自动读题
    setTimeout(() => {
      if (isMounted.current) {
        audioController.playWithCache(question.text || "", ttsVoice, playRate);
      }
    }, 300);

  }, [question]); // 依赖项改为整个 question 对象，确保数据更新时视图更新

  // 清理定时器
  useEffect(() => {
    return () => {
      if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
    };
  }, []);

  // 点击选项
  const handleOptionClick = (opt) => {
    if (!question || state !== "idle") return; // 判定中禁止点击
    
    setSelected(opt.id);
    
    // 读选项
    audioController.playWithCache(opt.text || "", ttsVoice, playRate);
    
    // 立即判定
    evaluateAnswer(opt.id);
  };

  const evaluateAnswer = (optId) => {
    if (!question) return;
    setState("showing");
    
    const correctIds = (question.correct || []).map(String);
    const chosen = String(optId);
    const isCorrect = correctIds.includes(chosen);

    if (isCorrect) {
      // === 正确 ===
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#a78bfa", "#34d399", "#fbbf24"] });
      try { new Audio("/sounds/correct.mp3").play().catch(()=>{}); } catch (e) {}

      // 0.8秒后自动进入下一题
      autoAdvanceTimeout.current = setTimeout(() => {
        if (!isMounted.current) return;
        onNext({ correct: true, question });
      }, 800);
    } else {
      // === 错误 ===
      try { new Audio("/sounds/incorrect.mp3").play().catch(()=>{}); } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(200);

      // 显示解析并朗读
      if (question.explanation) {
        setShowExplanation(true);
        setTimeout(() => {
          if (isMounted.current) audioController.playWithCache(question.explanation, ttsVoice, playRate);
        }, 500);
      }

      // 1.5秒后重置状态，允许用户重试（因为没有下一题按钮了，必须让用户重试）
      autoAdvanceTimeout.current = setTimeout(() => {
        if (!isMounted.current) return;
        setState("idle");
        setSelected(null);
        // 注意：这里不自动隐藏解析，让用户还能看到提示
      }, 1500);
    }
  };

  const handleRead = (e) => {
    e && e.stopPropagation();
    audioController.playWithCache(question.text || "", ttsVoice, playRate);
  };

  // 计算选项样式
  const getOptionClass = (opt) => {
    if (state === "idle") {
      // 选中态（虽然是立即判定，但在动画瞬间可能会用到）
      return String(selected) === String(opt.id) ? "selected" : "";
    }
    // 判定态
    const correctIds = (question.correct || []).map(String);
    const isThisCorrect = correctIds.includes(String(opt.id));
    const isThisSelected = String(selected) === String(opt.id);

    // 如果选了该项且对了 -> correct
    // 如果选了该项但错了 -> incorrect
    // 如果没选该项，但它是正确答案 -> (可选：提示正确答案) correct
    if (isThisSelected) {
      return isThisCorrect ? "correct" : "incorrect";
    }
    // 也可以选择在错误时显示正确答案，如下：
    // if (isThisCorrect && state === 'showing') return "correct"; 
    return "";
  };

  // 渲染空状态
  if (!question) {
    return <div className="dlg-root"></div>;
  }

  return (
    <>
      <style>{styles}</style>
      <div className="dlg-root" ref={containerRef}>
        {/* 问题卡片 */}
        <div className="dlg-card">
          <div style={{ position: "relative" }}>
            <FaVolumeUp className="dlg-vol" onClick={handleRead} style={{ fontSize: 20, cursor: "pointer" }} />
            {question.imageUrl && <img src={question.imageUrl} alt="Topic" className="dlg-q-image" />}
            
            <div className="dlg-pinyin-row" onClick={handleRead}>
              {pinyinData.map((it, i) => (
                <div className="dlg-char" key={i}>
                  <div className="dlg-py">{it.py || ""}</div>
                  <div className="dlg-cn">{it.char}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 选项区域 */}
        <div className="dlg-options">
          {shuffledOptions.map((opt) => (
            <div
              key={opt.id}
              className={`dlg-opt ${getOptionClass(opt)}`}
              onClick={() => handleOptionClick(opt)}
            >
              <div className="opt-left">
                {opt.imageUrl ? (
                  <img src={opt.imageUrl} className="opt-img" alt="" />
                ) : (
                   /* 如果没有图片显示首字或者占位 */
                   <span style={{color:'#cbd5e1', fontSize:24, fontWeight:700}}>
                     {opt.text ? opt.text.charAt(0) : "?"}
                   </span>
                )}
              </div>
              <div className="opt-text">
                {opt.isChinese ? (
                  <>
                    <div className="opt-py">{(opt.pinyinData || []).map(d => d.py).filter(Boolean).join(" ")}</div>
                    <div className="opt-cn">{opt.text}</div>
                  </>
                ) : (
                  <div className="opt-cn">{opt.text || "暂无文本"}</div>
                )}
              </div>

              {/* 结果图标 (只在判定时显示) */}
              {state !== "idle" && String(selected) === String(opt.id) && (
                 <div className="status-icon">
                    {(question.correct || []).map(String).includes(String(opt.id)) 
                      ? <FaCheckCircle style={{ color: "#10b981", fontSize: 20 }} />
                      : <FaTimesCircle style={{ color: "#ef4444", fontSize: 20 }} />
                    }
                 </div>
              )}
            </div>
          ))}
        </div>

        {/* 解析显示区域 */}
        {showExplanation && (
          <div className="dlg-explain">
            <FaLightbulb style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              <strong>解析：</strong> {question.explanation || "暂无解析"}
            </div>
          </div>
        )}
        
        {/* 按钮组已移除 */}
      </div>
    </>
  );
};

export default DuolingoMCQ;
