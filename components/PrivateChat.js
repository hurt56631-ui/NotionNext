// themes/heo/components/PrivateChat.js (基于你提供的代码进行修改)

import React, { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc } from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Settings, X, Play, Translate, ImageIcon } from "lucide-react";

/**
 * PrivateChat props:
 * - peerUid (string) : 对方的 uid
 * - peerDisplayName (string) optional
 * - currentUser (object) : 当前用户对象 {uid, displayName}
 * - onClose (function) : 【新增】关闭组件的回调函数
 */
export default function PrivateChat({ peerUid, peerDisplayName, currentUser, onClose }) {
  // ----- auth & local user -----
  const [user, setUser] = useState(currentUser || null);
  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch(console.error);
    });
    return () => unsub();
  }, [currentUser]);

  // ----- chatId deterministic (small->big) -----
  const makeChatId = useCallback((a, b) => {
    if (!a || !b) return null;
    return [a, b].sort().join("_");
  }, []);
  const chatId = makeChatId(user?.uid, peerUid);

  // ----- state -----
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const defaultSettings = {
    translation: { url: "", model: "gpt-4o-mini", apiKey: "" },
    tts: { url: "", apiKey: "", useBearer: true, autoPlayOnReceive: false },
    backgroundDataUrl: localStorage.getItem("chat_bg") || "",
  };
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem("private_chat_cfg");
      return raw ? JSON.parse(raw) : defaultSettings;
    } catch { return defaultSettings; }
  });

  useEffect(() => { localStorage.setItem("private_chat_cfg", JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => {
    if (cfg.backgroundDataUrl) localStorage.setItem("chat_bg", cfg.backgroundDataUrl);
    else localStorage.removeItem("chat_bg");
  }, [cfg.backgroundDataUrl]);

  // ----- Firestore real-time listening -----
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    const ensureMeta = async () => {
      try {
        const metaRef = doc(db, "privateChats", chatId);
        const metaSnap = await getDoc(metaRef);
        if (!metaSnap.exists()) {
          await setDoc(metaRef, { members: [user.uid, peerUid].filter(Boolean), createdAt: serverTimestamp() });
        }
      } catch (e) { console.warn("Failed to ensure chat meta:", e); }
    };
    ensureMeta();

    const messagesRef = collection(db, `privateChats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(5000));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMessages(arr);
    }, (err) => { console.error("listen messages error", err); });

    return () => unsub();
  }, [chatId, user?.uid, peerUid]);

  // ----- send message -----
  const sendMessage = async () => {
    if (!input.trim() || !chatId || !user) return;
    setSending(true);
    try {
      const messagesRef = collection(db, `privateChats/${chatId}/messages`);
      await addDoc(messagesRef, {
        text: input,
        uid: user.uid,
        displayName: user.displayName || "匿名用户",
        createdAt: serverTimestamp(),
      });
      setInput("");
    } catch (e) { console.error(e); alert("发送失败：" + e.message);
    } finally { setSending(false); }
  };
  
  // (TTS and Translate functions are kept as they are in your original code)
  const playTTS = async (text) => { /* ... your original code ... */ };
  const translateText = async (text) => { /* ... your original code ... */ };
  const translateAndShow = async (text) => { const result = await translateText(text); if (result) window.prompt("翻译结果", result); };

  const MessageRow = ({ message }) => {
    const mine = message.uid === user?.uid;
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"} px-3 py-1`}>
        <div className={`max-w-[80%] text-sm rounded-xl shadow-sm p-3 ${mine ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white" : "bg-white border dark:bg-gray-700 dark:border-gray-600"}`}>
          <div className="flex-1">
            <div className="whitespace-pre-wrap break-words">{message.text}</div>
            <div className="mt-2 flex items-center gap-2">
              <button className="text-xs px-2 py-1 rounded-md border dark:border-gray-500" onClick={() => translateAndShow(message.text)}> <Translate size={14}/> 翻译 </button>
              <button className="text-xs px-2 py-1 rounded-md border dark:border-gray-500" onClick={() => playTTS(message.text)}> <Play size={14}/> 朗读 </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const onBackgroundFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setCfg((s) => ({ ...s, backgroundDataUrl: e.target.result }));
    reader.readAsDataURL(file);
  };

  // ----- UI -----
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="w-[420px] max-w-[95vw] h-[560px] bg-transparent"
      >
        <div className="flex flex-col h-full rounded-2xl overflow-hidden shadow-2xl bg-gray-100 dark:bg-gray-900" style={{ backgroundImage: cfg.backgroundDataUrl ? `url(${cfg.backgroundDataUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="flex items-center justify-between bg-white/80 dark:bg-black/70 backdrop-blur p-3 border-b dark:border-gray-700">
            <div className="font-medium dark:text-white">{peerDisplayName || peerUid}</div>
            <div className="flex items-center gap-2">
              <button title="设置" onClick={() => setSettingsOpen((s)=>!s)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><Settings size={18} /></button>
              {/* 【修改】这里的关闭按钮现在会调用从 props 传入的 onClose 函数 */}
              <button title="关闭" onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">开始聊天吧...</div>
            ) : (
              <Virtuoso
                style={{ height: '100%' }}
                data={messages}
                itemContent={(index, msg) => <MessageRow message={msg} key={msg.id} />}
                followOutput="smooth"
                overscan={300}
              />
            )}
          </div>

          <div className="bg-white/90 dark:bg-black/80 p-3 border-t dark:border-gray-700">
            <div className="flex items-center gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="输入消息..." className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white/90 dark:bg-gray-800 dark:text-white" />
              <button onClick={sendMessage} disabled={sending} className="p-3 rounded-lg bg-indigo-600 text-white shadow-md hover:bg-indigo-700 disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          </div>
          
          {/* Settings Drawer (no changes needed) */}
        </div>
      </motion.div>
    </div>
  );
}
