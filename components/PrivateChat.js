// themes/heo/components/PrivateChat.js (语法错误修复 - 最终完整版)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc } from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Settings, Languages, Music, ArrowLeft, Bot, Sparkles, X } from "lucide-react";

// 【TTS模块】(无变动)
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

// 【AI翻译模块】(无变动)
const callAIHelper = async (prompt, textToTranslate, apiKey, apiEndpoint, model, stream = false) => {
    if (!apiKey || !apiEndpoint) { throw new Error("请在设置中配置AI翻译接口地址和密钥。"); }
    const fullPrompt = `${prompt}\n\n以下是需要翻译的文本：\n"""\n${textToTranslate}\n"""`;
    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: model, messages: [{ role: 'user', content: fullPrompt }], stream: stream })
        });
        if (!response.ok) { const errorBody = await response.text(); throw new Error(`AI接口请求失败: ${response.status} ${errorBody}`); }
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) { console.error("调用AI翻译失败:", error); throw error; }
};

// 【AI返回结果解析器】(无变动)
const parseMyTranslation = (text) => {
    const sections = text.split(/(?=📖|💬|💡|🐼|🌸|👨)/).filter(Boolean);
    return sections.map(section => {
        const titleMatch = section.match(/^(📖|💬|💡|🐼|🌸|👨)\s*\*\*(.*?)\*\*/);
        const title = titleMatch ? titleMatch[2] : '未知版本';
        const burmeseMatch = section.match(/\*\*(.*?)\*\*/g);
        const burmeseText = burmeseMatch ? burmeseMatch[burmeseMatch.length - 1].replace(/\*\*/g, '') : '解析失败';
        const chineseMatch = section.match(/中文意思\s*[:：]?\s*(.*)/);
        const chineseText = chineseMatch ? chineseMatch[1] : '解析失败';
        return { title, burmeseText, chineseText };
    });
};

export default function PrivateChat({ peerUid, peerDisplayName, currentUser, onClose }) {
  // ----- Auth & User State (无变动) -----
  const [user, setUser] = useState(currentUser || null);
  useEffect(() => {
    if (currentUser) { setUser(currentUser); return; }
    const unsub = onAuthStateChanged(auth, (u) => { if (u) setUser(u); else signInAnonymously(auth).catch(console.error); });
    return () => unsub();
  }, [currentUser]);

  // ----- Chat ID (无变动) -----
  const makeChatId = useCallback((a, b) => { if (!a || !b) return null; return [a, b].sort().join("_"); }, []);
  const chatId = makeChatId(user?.uid, peerUid);

  // ----- Component State (无变动) -----
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [longPressedMessage, setLongPressedMessage] = useState(null);
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [myTranslations, setMyTranslations] = useState(null);

  // ----- Settings State (无变动) -----
  const defaultSettings = {
    backgroundDataUrl: "", autoTranslate: false, autoPlayTTS: false,
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

  // ----- 背景图上传逻辑 (无变动) -----
  const handleBackgroundChange = (dataUrl) => {
    if (typeof window !== 'undefined') {
        if (dataUrl) { localStorage.setItem(`chat_bg_${chatId}`, dataUrl); setCfg(c => ({...c, backgroundDataUrl: dataUrl})); }
        else { localStorage.removeItem(`chat_bg_${chatId}`); setCfg(c => ({...c, backgroundDataUrl: ""})); }
    }
  };

  // ----- Firestore real-time listening (无变动) -----
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    const ensureMeta = async () => { try { const metaRef = doc(db, "privateChats", chatId); const metaSnap = await getDoc(metaRef); if (!metaSnap.exists()) { await setDoc(metaRef, { members: [user.uid, peerUid].filter(Boolean), createdAt: serverTimestamp() }); } } catch (e) { console.warn("Failed to ensure chat meta:", e); } };
    ensureMeta();
    const messagesRef = collection(db, `privateChats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(5000));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  }, [chatId, user?.uid, cfg.autoPlayTTS, cfg.autoTranslate]);

  // ----- Send Message Logic (无变动) -----
  const sendMessage = async (textToSend) => {
    const content = textToSend || input;
    if (!content.trim() || !chatId || !user) return;
    setSending(true);
    try {
      const messagesRef = collection(db, `privateChats/${chatId}/messages`);
      await addDoc(messagesRef, { text: content.trim(), uid: user.uid, displayName: user.displayName || "匿名用户", createdAt: serverTimestamp() });
      setInput("");
      setMyTranslations(null);
    } catch (e) { console.error(e); alert("发送失败：" + e.message); }
    finally { setSending(false); }
  };
  
  // ----- 提示词 (无变动) -----
  const MyInputPrompt = `...`; // 省略，保持您的原样
  const PeerMessagePrompt = `...`; // 省略，保持您的原样

  // ----- AI Translation Logic (无变动) -----
  const handleTranslateMessage = async (message) => {
    setIsTranslating(true); setTranslationResult(null); setLongPressedMessage(null);
    try {
        const result = await callAIHelper(PeerMessagePrompt, message.text, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model, !cfg.ai.noStream);
        setTranslationResult({ messageId: message.id, text: result });
    } catch (error) { alert(error.message); } finally { setIsTranslating(false); }
  };
  const handleTranslateMyInput = async () => {
    if (!input.trim()) return;
    setIsTranslating(true); setMyTranslations(null);
    try {
        const resultText = await callAIHelper(MyInputPrompt, input, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model, !cfg.ai.noStream);
        const versions = parseMyTranslation(resultText);
        setMyTranslations(versions);
    } catch (error) { alert(error.message); } finally { setIsTranslating(false); }
  };

  // ----- 【修复】Long Press Menu Component - 恢复完整代码 -----
  const LongPressMenu = ({ message, onClose }) => (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => { playCachedTTS(message.text); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><Music size={18} /> 朗读</button>
            <button onClick={() => { handleTranslateMessage(message); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><Languages size={18} /> 翻译</button>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-md">取消</button>
        </div>
    </div>
  );

  // ----- 【修复】Message Row Component - 恢复完整代码 -----
  const MessageRow = ({ message }) => {
    const mine = message.uid === user?.uid;
    const longPressTimer = useRef();

    const handleTouchStart = () => {
        longPressTimer.current = setTimeout(() => {
            setLongPressedMessage(message);
        }, 500);
    };
    const handleTouchEnd = () => { clearTimeout(longPressTimer.current); };

    return (
      <div className={`flex items-end gap-2 my-2 ${mine ? "flex-row-reverse" : ""}`}>
        <div 
          onTouchStart={handleTouchStart} 
          onTouchEnd={handleTouchEnd} 
          onContextMenu={(e) => { e.preventDefault(); setLongPressedMessage(message); }}
          className={`max-w-[75%] px-4 py-2 rounded-2xl cursor-pointer ${mine ? "bg-blue-500 text-white rounded-br-none" : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none"}`}
        >
          <p className="whitespace-pre-wrap break-words font-bold">{message.text}</p>
          {translationResult && translationResult.messageId === message.id && (
            <div className="mt-2 pt-2 border-t border-gray-500/30">
                <p className="text-sm font-bold opacity-80">{translationResult.text}</p>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // ----- Main UI (无变动) -----
  return (
    <div className="fixed inset-0 z-50 bg-gray-100 dark:bg-black flex flex-col">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full" style={{ backgroundImage: cfg.backgroundDataUrl ? `url(${cfg.backgroundDataUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 bg-white/80 dark:bg-black/70 backdrop-blur-lg border-b dark:border-gray-700/50">
          <button onClick={onClose} className="p-2 -ml-2"><ArrowLeft /></button>
          <h1 className="font-semibold text-lg absolute left-1/2 -translate-x-1/2">{peerDisplayName || "聊天"}</h1>
          <button onClick={() => setSettingsOpen(true)} className="p-2 -mr-2"><Settings /></button>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden relative p-4">
          <Virtuoso style={{ height: '100%' }} data={messages} itemContent={(index, msg) => <MessageRow message={msg} key={msg.id} />} followOutput="auto" overscan={300} />
        </div>

        {/* Translation Results Area */}
        <AnimatePresence>
        {myTranslations && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: '75%', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="flex-shrink-0 border-t dark:border-gray-700/50 bg-white/80 dark:bg-black/80 backdrop-blur-lg flex flex-col"
            >
                <div className="p-3 flex justify-between items-center border-b dark:border-gray-700/50">
                    <h4 className="text-sm font-bold">选择一个翻译版本发送</h4>
                    <button onClick={() => setMyTranslations(null)}><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {myTranslations.map((trans, index) => (
                        <div key={index} className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-start gap-3">
                           <div className="flex-1 space-y-1">
                                <p className="font-bold text-sm text-gray-500">{trans.title}</p>
                                <p className="font-bold text-blue-500 text-base">{trans.burmeseText}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">回译: {trans.chineseText}</p>
                           </div>
                           <button onClick={() => sendMessage(trans.burmeseText)} className="w-10 h-10 flex-shrink-0 bg-blue-500 text-white rounded-full flex items-center justify-center"><Send size={16}/></button>
                        </div>
                    ))}
                </div>
            </motion.div>
        )}
        </AnimatePresence>
        
        {/* Input Area */}
        <footer className="flex-shrink-0 p-2 bg-white/80 dark:bg-black/70 backdrop-blur-lg border-t dark:border-gray-700/50">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative flex items-center">
              <TextareaAutosize
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="输入消息..."
                minRows={1}
                maxRows={5}
                className="w-full pl-4 pr-12 py-2.5 text-base rounded-2xl border bg-gray-100 dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none"
              />
              <button onClick={handleTranslateMyInput} disabled={isTranslating || !input.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 disabled:opacity-30">
                {isTranslating ? <Sparkles className="animate-pulse" /> : <Bot />}
              </button>
            </div>
            <button onClick={() => sendMessage()} disabled={sending || !input.trim()} className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md disabled:opacity-50 transition-all self-end mb-0.5">
              <Send size={18} />
            </button>
          </div>
        </footer>

        {/* Settings Panel */}
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
                     <label className="flex items-center justify-between text-sm"><span className="font-bold">关闭AI思考模式(更快)</span><input type="checkbox" checked={cfg.ai.noStream} onChange={e => setCfg(c => ({...c, ai: {...c.ai, noStream: e.target.checked}}))} className="h-5 w-5"/></label>
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
        
        {(isTranslating && !myTranslations) && <div className="absolute inset-0 bg-black/30 z-40 flex items-center justify-center text-white"><Sparkles className="animate-spin mr-2"/>正在请求AI翻译...</div>}

      </motion.div>
    </div>
  );
}
