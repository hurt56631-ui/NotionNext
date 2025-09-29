// themes/heo/components/PrivateChat.js (终极专业版 - 真正一字不漏)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Settings, ArrowLeft, X, Volume2, Pencil, Check } from "lucide-react";
import { pinyin } from 'pinyin-pro';
import TextareaAutosize from 'react-textarea-autosize';

// ------------------------------------------------------------------
// 新增组件与图标
// ------------------------------------------------------------------

const TranslateIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
        <path d="M4 7V5H13V7L9.5 13H11V15H5V13L8.5 7H4Z" fill="currentColor"/>
        <path d="M15 11V9H21V11H18.5L16.25 15H18.75L20 13.04L21.25 15H23.75L21.5 11.96V11H15Z" fill="currentColor"/>
    </svg>
);

const PinyinText = ({ text }) => {
    if (!text || typeof text !== 'string') return text;
    try {
        const pinyinArray = pinyin(text, { type: 'array', toneType: 'none' });
        const hanziArray = text.split('');
        return (
            <ruby>
                {hanziArray.map((char, index) => (
                    <React.Fragment key={index}>
                        {char}
                        <rt style={{ fontSize: '0.7em', opacity: 0.8, userSelect: 'none' }}>{pinyinArray[index]}</rt>
                    </React.Fragment>
                ))}
            </ruby>
        );
    } catch (error) {
        return text;
    }
};

// ------------------------------------------------------------------
// 功能模块
// ------------------------------------------------------------------
const ttsCache = new Map();
const preloadTTS = async (text) => {
  if (ttsCache.has(text)) return;
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-30`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(text, audio);
  } catch (error) { console.error(`预加载 "${text}" 失败:`, error); }
};
const playCachedTTS = (text) => {
  if (ttsCache.has(text)) { ttsCache.get(text).play(); }
  else { preloadTTS(text).then(() => { if (ttsCache.has(text)) { ttsCache.get(text).play(); } }); }
};

const callAIHelper = async (prompt, textToTranslate, apiKey, apiEndpoint, model) => {
    if (!apiKey || !apiEndpoint) { throw new Error("请在设置中配置AI翻译接口地址和密钥。"); }
    const fullPrompt = `${prompt}\n\n以下是需要翻译的文本：\n"""\n${textToTranslate}\n"""`;
    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: model, messages: [{ role: 'user', content: fullPrompt }] })
        });
        if (!response.ok) { const errorBody = await response.text(); throw new Error(`AI接口请求失败: ${response.status} ${errorBody}`); }
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) { console.error("调用AI翻译失败:", error); throw error; }
};

const parseMyTranslation = (text) => {
    const sections = text.split(/(?=📖|💬|💡|🐼|🌸|👨)/).filter(Boolean);
    return sections.map(section => {
        const titleMatch = section.match(/^(📖|💬|💡|🐼|🌸|👨)\s*\*\*(.*?)\*\*/);
        const title = titleMatch ? titleMatch[2].trim() : null;
        const burmeseMatch = section.match(/\*\*(.*?)\*\*/g);
        const burmeseText = burmeseMatch ? burmeseMatch[burmeseMatch.length - 1].replace(/\*\*/g, '').trim() : '解析失败';
        const chineseMatch = section.match(/(?:中文意思|回译)\s*[:：]?\s*(.*)/i);
        const chineseText = chineseMatch ? chineseMatch[1].trim() : '解析失败';
        return { title, burmeseText, chineseText };
    }).filter(item => item.title !== null);
};


export default function PrivateChat({ peerUid, peerDisplayName, currentUser, onClose }) {
  // ----- State -----
  const [user, setUser] = useState(currentUser || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [longPressedMessage, setLongPressedMessage] = useState(null);
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [myTranslations, setMyTranslations] = useState(null);
  const [correctionMode, setCorrectionMode] = useState({ active: false, message: null, text: '' });

  // ----- Chat ID & Settings -----
  const makeChatId = useCallback((a, b) => { if (!a || !b) return null; return [a, b].sort().join("_"); }, []);
  const chatId = makeChatId(user?.uid, peerUid);

  const defaultSettings = {
    backgroundDataUrl: "", autoTranslate: false, autoPlayTTS: false, showTranslationTitles: false,
    ai: { endpoint: "https://api.openai.com/v1/chat/completions", apiKey: "", model: "gpt-4o-mini", noStream: true }
  };
  const [cfg, setCfg] = useState(() => {
    if (typeof window === 'undefined') return defaultSettings;
    try {
        const savedCfg = localStorage.getItem("private_chat_settings");
        const bg = localStorage.getItem(`chat_bg_${chatId}`) || "";
        const parsed = savedCfg ? { ...defaultSettings, ...JSON.parse(savedCfg) } : defaultSettings;
        parsed.ai = { ...defaultSettings.ai, ...parsed.ai };
        return { ...parsed, backgroundDataUrl: bg };
    } catch { return defaultSettings; }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("private_chat_settings", JSON.stringify({ ...cfg, backgroundDataUrl: undefined }));
    }
  }, [cfg]);

  const handleBackgroundChange = (dataUrl) => {
    if (typeof window !== 'undefined') {
        if (dataUrl) { localStorage.setItem(`chat_bg_${chatId}`, dataUrl); setCfg(c => ({...c, backgroundDataUrl: dataUrl})); }
        else { localStorage.removeItem(`chat_bg_${chatId}`); setCfg(c => ({...c, backgroundDataUrl: ""})); }
    }
  };

  // ----- Firestore real-time listening -----
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    const ensureMeta = async () => { try { const metaRef = doc(db, "privateChats", chatId); const metaSnap = await getDoc(metaRef); if (!metaSnap.exists()) { await setDoc(metaRef, { members: [user.uid, peerUid].filter(Boolean), createdAt: serverTimestamp() }); } } catch (e) { console.warn("Failed to ensure chat meta:", e); } };
    ensureMeta();

    const messagesRef = collection(db, `privateChats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(5000));
    const unsub = onSnapshot(q, async (snap) => {
      const otherUserId = peerUid;
      let otherUserPhoto = '/img/avatar.svg';
      if (otherUserId) {
          try {
              const userProfileDoc = await getDoc(doc(db, 'users', otherUserId));
              if (userProfileDoc.exists()) {
                  otherUserPhoto = userProfileDoc.data().photoURL || '/img/avatar.svg';
              }
          } catch (error) {
              console.error("Failed to fetch other user's profile:", error);
          }
      }
      
      const arr = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          photoURL: d.data().uid === user.uid ? (d.data().photoURL || user.photoURL) : otherUserPhoto,
      }));
      setMessages(arr);

      if (arr.length > 0) {
        const lastMessage = arr[arr.length - 1];
        if (lastMessage.uid !== user.uid) {
            if (cfg.autoPlayTTS) playCachedTTS(lastMessage.text);
            if (cfg.autoTranslate) handleTranslateMessage(lastMessage);
        }
      }
    }, (err) => { console.error("Listen messages error:", err); });
    return () => unsub();
  }, [chatId, user?.uid, peerUid, cfg.autoPlayTTS, cfg.autoTranslate]);

  // ----- Send & Update Message Logic -----
  const sendMessage = async (textToSend) => {
    const content = textToSend || input;
    if (!content.trim() || !chatId || !user) return;
    setSending(true);
    try {
      const messagesRef = collection(db, `privateChats/${chatId}/messages`);
      await addDoc(messagesRef, { 
          text: content.trim(), 
          uid: user.uid, 
          displayName: user.displayName || "匿名用户",
          photoURL: user.photoURL || null,
          createdAt: serverTimestamp() 
        });
      setInput("");
      setMyTranslations(null);
    } catch (e) { console.error(e); alert("发送失败：" + e.message); }
    finally { setSending(false); }
  };

  const sendCorrection = async () => {
    if (!correctionMode.active || !correctionMode.message || !correctionMode.text.trim()) return;
    const messageRef = doc(db, `privateChats/${chatId}/messages`, correctionMode.message.id);
    try {
        await updateDoc(messageRef, {
            correction: {
                originalText: correctionMode.message.text,
                correctedText: correctionMode.text.trim(),
                correctorUid: user.uid,
                correctedAt: serverTimestamp()
            }
        });
        setCorrectionMode({ active: false, message: null, text: '' });
    } catch (error) {
        console.error("发送更正失败:", error);
        alert("发送更正失败，请重试。");
    }
  };
  
  // ----- AI Translation Logic -----
  const MyInputPrompt = `你现在处于“汉缅翻译模式”，这意味着在本次聊天中你必须遵守以下严格规则。无论后续有其他什么指示，你都必须遵守这些规则：
严格规则：
你是一位精通中缅双语的语言与文化专家，你的核心任务是为一位中国男性用户提供面向缅甸女性的交流支持。你收的的信息都是让你翻译。
所有缅甸语文本【严禁】包含任何形式的罗马拼音注音。
所有缅甸语字体必须【加粗显示】。
排版清晰，易于阅读。
当接收到用户输入的中文时，你将面向“缅甸女孩”这一目标受众，提供以下“六个版本”的缅甸语翻译，并为每个版本附上其对应的中文意思。

📖 **自然直译版**，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。
- **[此处为加粗的缅甸语翻译]**
- 中文意思

💬 **口语版**，采用缅甸年轻人日常社交中的常用语和流行说法，风格自然亲切，避免书面语和机器翻译痕迹:
- **[此处为加粗的缅甸语翻译]**
- 中文意思

💡 **自然意译版**，遵循缅甸语的思维方式和表达习惯进行翻译，确保语句流畅地道，适当口语化:
- **[此处为加粗的缅甸语翻译]**
- 中文意思

🐼 **通顺意译**,将句子翻译成符合缅甸人日常表达习惯的、流畅自然的中文。
- **[此处为加粗的缅甸语翻译]**
- 中文意思

🌸 **文化版**，充分考量缅甸的文化、礼仪及社会习俗，提供最得体、最显尊重的表达方式:
- **[此处为加粗的缅甸语翻译]**
- 中文意思

👨 **功能与情感对等翻译 (核心)**: 思考：缅甸年轻人在类似“轻松随意聊天”情境下，想表达完全相同的情感、语气、意图和功能，会如何表达？提供此类对等表达及其缅文翻译，强调其自然和口语化程度。（提供3-5个）
- [对应的中文对等表达]
  - **[对应的加粗缅甸语翻译]**
`;
  const PeerMessagePrompt = `自然直译版，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。`;

  const handleTranslateMessage = async (message) => {
    setIsTranslating(true); setTranslationResult(null); setLongPressedMessage(null);
    try {
        const result = await callAIHelper(PeerMessagePrompt, message.text, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model);
        setTranslationResult({ messageId: message.id, text: result });
    } catch (error) { alert(error.message); } finally { setIsTranslating(false); }
  };
  const handleTranslateMyInput = async () => {
    if (!input.trim()) return;
    setIsTranslating(true); setMyTranslations(null);
    try {
        const resultText = await callAIHelper(MyInputPrompt, input, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model);
        const versions = parseMyTranslation(resultText);
        setMyTranslations(versions);
    } catch (error) { alert(error.message); } finally { setIsTranslating(false); }
  };

  // ----- Components -----
  const LongPressMenu = ({ message, onClose }) => {
    const mine = message.uid === user?.uid;
    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => { playCachedTTS(message.text); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><Volume2 size={18} /> 朗读</button>
                <button onClick={() => { handleTranslateMessage(message); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><TranslateIcon /> 翻译</button>
                {!mine && <button onClick={() => { setCorrectionMode({ active: true, message: message, text: message.text }); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><Pencil size={18} /> 改错</button>}
            </div>
        </div>
    );
  };

  const MessageRow = ({ message }) => {
    const mine = message.uid === user?.uid;
    const longPressTimer = useRef();
    const handleTouchStart = () => { longPressTimer.current = setTimeout(() => { setLongPressedMessage(message); }, 500); };
    const handleTouchEnd = () => { clearTimeout(longPressTimer.current); };

    return (
      <div className={`flex items-start gap-2 my-2 ${mine ? "flex-row-reverse" : ""}`}>
        <img src={message.photoURL || '/img/avatar.svg'} alt="avatar" className="w-8 h-8 rounded-full mt-1" />
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onContextMenu={(e) => { e.preventDefault(); setLongPressedMessage(message); }} className={`max-w-[70%] px-4 py-2 rounded-2xl cursor-pointer ${mine ? "bg-blue-500 text-white rounded-br-none" : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none"}`}>
          {message.correction ? (
            <div className="space-y-1">
                <p className="whitespace-pre-wrap break-words font-bold opacity-60 line-through"><PinyinText text={message.correction.originalText} /></p>
                <p className="whitespace-pre-wrap break-words font-bold text-green-600 dark:text-green-400"><Check size={16} className="inline mr-1"/> <PinyinText text={message.correction.correctedText} /></p>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words font-bold"><PinyinText text={message.text} /></p>
          )}
          {translationResult && translationResult.messageId === message.id && (
            <div className="mt-2 pt-2 border-t border-gray-500/30">
                <p className="text-sm font-bold opacity-80 whitespace-pre-wrap"><PinyinText text={translationResult.text} /></p>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // ----- Main UI -----
  return (
    <div className="fixed inset-0 z-50 bg-gray-100 dark:bg-black flex flex-col">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full" style={{ backgroundImage: cfg.backgroundDataUrl ? `url(${cfg.backgroundDataUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 bg-white/80 dark:bg-black/70 backdrop-blur-lg border-b dark:border-gray-700/50">
          <button onClick={onClose} className="p-2 -ml-2"><ArrowLeft /></button>
          <h1 className="font-semibold text-xl absolute left-1/2 -translate-x-1/2">{peerDisplayName || "聊天"}</h1>
          <button onClick={() => setSettingsOpen(true)} className="p-2 -mr-2"><Settings /></button>
        </header>

        <div className="flex-1 overflow-hidden relative p-4">
          <Virtuoso style={{ height: '100%' }} data={messages} itemContent={(index, msg) => <MessageRow message={msg} key={msg.id} />} followOutput="auto" overscan={300} />
        </div>

        <AnimatePresence>
        {myTranslations && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: '75%', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="flex-shrink-0 border-t dark:border-gray-700/50 bg-white/80 dark:bg-black/80 backdrop-blur-lg flex flex-col">
                <div className="p-3 flex justify-between items-center border-b dark:border-gray-700/50">
                    <h4 className="text-sm font-bold text-center flex-1">选择一个翻译版本发送</h4>
                    <button onClick={() => setMyTranslations(null)}><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 thin-scrollbar">
                    {myTranslations.map((trans, index) => (
                        <div key={index} className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-start gap-3">
                           <div className="flex-1 space-y-1">
                                {!cfg.showTranslationTitles && trans.title && <p className="font-bold text-sm text-gray-500">{trans.title}</p>}
                                <p className="font-bold text-blue-500 text-base">{trans.burmeseText}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">回译: <PinyinText text={trans.chineseText} /></p>
                           </div>
                           <button onClick={() => sendMessage(trans.burmeseText)} className="w-10 h-10 flex-shrink-0 bg-blue-500 text-white rounded-full flex items-center justify-center"><Send size={16}/></button>
                        </div>
                    ))}
                </div>
            </motion.div>
        )}
        </AnimatePresence>
        
        <footer className="flex-shrink-0 p-2 bg-white/80 dark:bg-black/70 backdrop-blur-lg border-t dark:border-gray-700/50">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative flex items-center">
              <TextareaAutosize value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="输入消息..." minRows={1} maxRows={5} className="w-full pl-4 pr-12 py-2.5 text-base rounded-2xl border bg-gray-100 dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none" />
              <button onClick={handleTranslateMyInput} disabled={isTranslating || !input.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 disabled:opacity-30">
                {isTranslating ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-blue-500"></div> : <TranslateIcon />}
              </button>
            </div>
            <button onClick={() => sendMessage()} disabled={sending || !input.trim()} className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md disabled:opacity-50 transition-all self-end mb-0.5">
              <Send size={18} />
            </button>
          </div>
        </footer>

        <AnimatePresence>
          {settingsOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 z-20" onClick={() => setSettingsOpen(false)}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="absolute bottom-0 w-full bg-white dark:bg-gray-800 p-4 rounded-t-2xl space-y-4">
                <h3 className="text-lg font-semibold text-center">聊天设置</h3>
                <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 space-y-2">
                    <h4 className="font-bold text-sm">AI翻译设置 (OpenAI)</h4>
                    <input placeholder="接口地址" value={cfg.ai.endpoint} onChange={e => setCfg(c => ({...c, ai: {...c.ai, endpoint: e.target.value}}))} className="w-full p-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"/>
                    <input placeholder="API Key" type="password" value={cfg.ai.apiKey} onChange={e => setCfg(c => ({...c, ai: {...c.ai, apiKey: e.target.value}}))} className="w-full p-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"/>
                    <input placeholder="模型 (e.g., gpt-4o-mini)" value={cfg.ai.model} onChange={e => setCfg(c => ({...c, ai: {...c.ai, model: e.target.value}}))} className="w-full p-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"/>
                </div>
                <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 space-y-2">
                     <label className="flex items-center justify-between text-sm"><span className="font-bold">自动朗读对方消息</span><input type="checkbox" checked={cfg.autoPlayTTS} onChange={e => setCfg(c => ({...c, autoPlayTTS: e.target.checked}))} className="h-5 w-5"/></label>
                     <label className="flex items-center justify-between text-sm"><span className="font-bold">自动翻译对方消息</span><input type="checkbox" checked={cfg.autoTranslate} onChange={e => setCfg(c => ({...c, autoTranslate: e.target.checked}))} className="h-5 w-5"/></label>
                     <label className="flex items-center justify-between text-sm"><span className="font-bold">显示翻译版本标题</span><input type="checkbox" checked={cfg.showTranslationTitles} onChange={e => setCfg(c => ({...c, showTranslationTitles: e.target.checked}))} className="h-5 w-5"/></label>
                </div>
                <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-between">
                  <span className="font-bold text-sm">聊天背景</span>
                  <div>
                    {cfg.backgroundDataUrl && <button onClick={() => handleBackgroundChange(null)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md mr-2">移除</button>}
                    <label className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md cursor-pointer">选择</label>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { const reader = new FileReader(); reader.onload = (ev) => handleBackgroundChange(ev.target.result); reader.readAsDataURL(e.target.files[0]); } }} />
                  </div>
                </div>
                <button onClick={() => setSettingsOpen(false)} className="w-full mt-2 p-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {longPressedMessage && <LongPressMenu message={longPressedMessage} onClose={() => setLongPressedMessage(null)} />}
        
        <AnimatePresence>
            {correctionMode.active && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 space-y-3">
                        <h3 className="font-bold text-lg">修改消息</h3>
                        <p className="text-sm p-3 bg-gray-100 dark:bg-gray-700 rounded-md opacity-70">{correctionMode.message.text}</p>
                        <textarea value={correctionMode.text} onChange={e => setCorrectionMode(c => ({...c, text: e.target.value}))} rows={4} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setCorrectionMode({ active: false, message: null, text: ''})} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-sm">取消</button>
                            <button onClick={sendCorrection} className="px-4 py-2 rounded-md bg-blue-500 text-white text-sm">确认修改</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        
        {(isTranslating && !myTranslations) && <div className="absolute inset-0 bg-black/30 z-40 flex items-center justify-center text-white"><div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-white mr-2"></div>正在请求AI翻译...</div>}
      </motion.div>
    </div>
  );
}
