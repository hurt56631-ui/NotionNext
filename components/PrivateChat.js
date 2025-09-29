// themes/heo/components/PrivateChat.js (最终修复完整版)

import React, { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc } from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
// 【修复】将 'Translate' 修改为正确的图标名 'Languages'
import { Send, Settings, X, Play, Languages, ImageIcon } from "lucide-react";

export default function PrivateChat({ peerUid, peerDisplayName, currentUser, onClose }) {
  // ----- Auth & User State -----
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

  // ----- Chat ID -----
  const makeChatId = useCallback((a, b) => {
    if (!a || !b) return null;
    return [a, b].sort().join("_");
  }, []);
  const chatId = makeChatId(user?.uid, peerUid);

  // ----- Component State -----
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // ----- Settings State with localStorage -----
  const defaultSettings = {
    translation: { url: "", model: "gpt-4o-mini", apiKey: "" },
    tts: { url: "", apiKey: "", useBearer: true, autoPlayOnReceive: false },
    backgroundDataUrl: "",
  };
  const [cfg, setCfg] = useState(() => {
    if (typeof window === 'undefined') return defaultSettings; // 安全检查
    try {
      const bg = localStorage.getItem("chat_bg") || "";
      const raw = localStorage.getItem("private_chat_cfg");
      const parsed = raw ? JSON.parse(raw) : defaultSettings;
      return { ...parsed, backgroundDataUrl: bg };
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("private_chat_cfg", JSON.stringify({ ...cfg, backgroundDataUrl: undefined }));
    }
  }, [cfg]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (cfg.backgroundDataUrl) localStorage.setItem("chat_bg", cfg.backgroundDataUrl);
      else localStorage.removeItem("chat_bg");
    }
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
    }, (err) => { console.error("Listen messages error:", err); });

    return () => unsub();
  }, [chatId, user?.uid, peerUid]);

  // ----- Send Message -----
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
  
  // ----- Placeholder functions for TTS/Translate -----
  const playTTS = async (text) => { alert("TTS 功能待配置"); };
  const translateAndShow = async (text) => { alert("翻译功能待配置"); };

  // ----- Message Row Component -----
  const MessageRow = ({ message }) => {
    const mine = message.uid === user?.uid;
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"} px-3 py-1`}>
        <div className={`max-w-[80%] text-sm rounded-xl shadow-sm p-3 ${mine ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white" : "bg-white border dark:bg-gray-700 dark:border-gray-600"}`}>
          <div className="flex-1">
            <div className="whitespace-pre-wrap break-words">{message.text}</div>
            <div className="mt-2 flex items-center gap-2">
              <button className="text-xs px-2 py-1 rounded-md border dark:border-gray-500" onClick={() => translateAndShow(message.text)}> <Languages size={14}/> 翻译 </button>
              <button className="text-xs px-2 py-1 rounded-md border dark:border-gray-500" onClick={() => playTTS(message.text)}> <Play size={14}/> 朗读 </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // ----- Background Image Handler -----
  const onBackgroundFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setCfg((s) => ({ ...s, backgroundDataUrl: e.target.result }));
    reader.readAsDataURL(file);
  };

  // ----- Main UI -----
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="w-[420px] max-w-[95vw] h-[560px]"
      >
        <div className="flex flex-col h-full rounded-2xl overflow-hidden shadow-2xl bg-gray-100 dark:bg-gray-900" style={{ backgroundImage: cfg.backgroundDataUrl ? `url(${cfg.backgroundDataUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          {/* Header */}
          <div className="flex items-center justify-between bg-white/80 dark:bg-black/70 backdrop-blur p-3 border-b dark:border-gray-700">
            <div className="font-medium dark:text-white">{peerDisplayName || peerUid}</div>
            <div className="flex items-center gap-2">
              <button title="设置" onClick={() => setSettingsOpen((s)=>!s)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><Settings size={18} /></button>
              <button title="关闭" onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
            </div>
          </div>

          {/* Messages Area */}
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

          {/* Input Area */}
          <div className="bg-white/90 dark:bg-black/80 p-3 border-t dark:border-gray-700">
            <div className="flex items-center gap-2">
              <label className="p-2 rounded-md border cursor-pointer" title="设置背景">
                <input type="file" accept="image/*" className="hidden" onChange={(e)=>{ if(e.target.files?.[0]) onBackgroundFile(e.target.files[0]) }} />
                <ImageIcon size={18} />
              </label>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="输入消息..." className="flex-1 w-full px-4 py-3 rounded-xl border dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white/90 dark:bg-gray-800 dark:text-white" />
              <button onClick={sendMessage} disabled={sending} className="p-3 rounded-lg bg-indigo-600 text-white shadow-md hover:bg-indigo-700 disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          </div>
          
          {/* 【修复】补全了完整的 Settings Drawer (设置抽屉) 代码 */}
          <AnimatePresence>
            {settingsOpen && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-16 right-4 w-[360px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-40 border dark:border-gray-700">
                <div className="text-sm font-medium mb-3 dark:text-white">聊天设置</div>

                <div className="mb-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">翻译接口（OpenAI-like）</div>
                  <input placeholder="翻译 URL" value={cfg.translation.url || ""} onChange={(e)=>setCfg(s=>({...s, translation:{...s.translation, url:e.target.value}}))} className="w-full p-2 border rounded mb-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                  <div className="flex gap-2">
                    <input placeholder="模型" value={cfg.translation.model || ""} onChange={(e)=>setCfg(s=>({...s, translation:{...s.translation, model:e.target.value}}))} className="flex-1 p-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                    <input placeholder="API Key" value={cfg.translation.apiKey || ""} onChange={(e)=>setCfg(s=>({...s, translation:{...s.translation, apiKey:e.target.value}}))} className="flex-1 p-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">TTS 接口</div>
                  <input placeholder="TTS URL" value={cfg.tts.url || ""} onChange={(e)=>setCfg(s=>({...s, tts:{...s.tts, url:e.target.value}}))} className="w-full p-2 border rounded mb-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                  <div className="flex gap-2">
                    <input placeholder="API Key" value={cfg.tts.apiKey || ""} onChange={(e)=>setCfg(s=>({...s, tts:{...s.tts, apiKey:e.target.value}}))} className="flex-1 p-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                    <label className="flex items-center gap-2 text-sm dark:text-gray-300"><input type="checkbox" checked={cfg.tts.useBearer} onChange={(e)=>setCfg(s=>({...s, tts:{...s.tts, useBearer:e.target.checked}}))}/> 使用 Bearer</label>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-sm dark:text-gray-300"><input type="checkbox" checked={cfg.tts.autoPlayOnReceive} onChange={(e)=>setCfg(s=>({...s, tts:{...s.tts, autoPlayOnReceive:e.target.checked}}))}/> 接收消息自动朗读</label>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">聊天背景（本地上传）</div>
                  <input type="file" accept="image/*" onChange={(e)=>{ if(e.target.files?.[0]) onBackgroundFile(e.target.files[0]) }} className="text-sm dark:text-gray-300" />
                  {cfg.backgroundDataUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <button className="px-3 py-1 border rounded text-sm dark:border-gray-600 dark:text-gray-300" onClick={()=>setCfg(s=>({...s, backgroundDataUrl:''}))}>移除背景</button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button className="px-3 py-1 rounded border dark:border-gray-600 dark:text-gray-300 text-sm" onClick={()=>setSettingsOpen(false)}>关闭</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
  }
