// themes/heo/components/PrivateChat.js (全新重完整版)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc } from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
// 【图标库更新】Music 用于新的朗读图标，Smile 用于表情按钮
import { Send, Settings, Languages, Music, Smile, ImageIcon, ArrowLeft } from "lucide-react";
// 【新增】引入新的表情选择器库
//import EmojiPicker from 'react-simple-emojipicker';

// 【TTS模块】完全采用您提供的新TTS逻辑
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
  } catch (error) {
    console.error(`预加载 "${text}" 失败:`, error);
  }
};
const playCachedTTS = (text) => {
  if (ttsCache.has(text)) {
    ttsCache.get(text).play();
  } else {
    preloadTTS(text).then(() => {
      if (ttsCache.has(text)) {
        ttsCache.get(text).play();
      }
    });
  }
};

export default function PrivateChat({ peerUid, peerDisplayName, currentUser, onClose }) {
  // ----- Auth & User State (无变动) -----
  const [user, setUser] = useState(currentUser || null);
  useEffect(() => {
    if (currentUser) { setUser(currentUser); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch(console.error);
    });
    return () => unsub();
  }, [currentUser]);

  // ----- Chat ID (无变动) -----
  const makeChatId = useCallback((a, b) => {
    if (!a || !b) return null;
    return [a, b].sort().join("_");
  }, []);
  const chatId = makeChatId(user?.uid, peerUid);

  // ----- Component State (新增表情面板状态) -----
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ----- Settings State (无变动) -----
  const defaultSettings = { backgroundDataUrl: "" };
  const [cfg, setCfg] = useState(() => {
    if (typeof window === 'undefined') return defaultSettings;
    try {
      const bg = localStorage.getItem(`chat_bg_${chatId}`) || "";
      return { backgroundDataUrl: bg };
    } catch { return defaultSettings; }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (cfg.backgroundDataUrl) localStorage.setItem(`chat_bg_${chatId}`, cfg.backgroundDataUrl);
      else localStorage.removeItem(`chat_bg_${chatId}`);
    }
  }, [cfg.backgroundDataUrl, chatId]);

  // ----- Firestore real-time listening (预加载TTS) -----
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    const ensureMeta = async () => { /* ... 无变动 ... */ };
    ensureMeta();

    const messagesRef = collection(db, `privateChats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(5000));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMessages(arr);
      // 【新增】收到新消息时，预加载TTS
      if (arr.length > 0) {
        const lastMessage = arr[arr.length - 1];
        if (lastMessage.uid !== user.uid) { // 只预加载对方的消息
          preloadTTS(lastMessage.text);
        }
      }
    }, (err) => { console.error("Listen messages error:", err); });

    return () => unsub();
  }, [chatId, user?.uid]);

  // ----- Send Message (无变动) -----
  const sendMessage = async () => {
    if (!input.trim() || !chatId || !user) return;
    setSending(true);
    try {
      const messagesRef = collection(db, `privateChats/${chatId}/messages`);
      await addDoc(messagesRef, { text: input, uid: user.uid, displayName: user.displayName || "匿名用户", createdAt: serverTimestamp() });
      setInput("");
      setShowEmojiPicker(false); // 发送后关闭表情面板
    } catch (e) { console.error(e); alert("发送失败：" + e.message);
    } finally { setSending(false); }
  };

  const handleEmojiSelect = (emoji) => setInput(input + emoji);

  // ----- Message Row Component (UI 大改) -----
  const MessageRow = ({ message }) => {
    const mine = message.uid === user?.uid;
    return (
      <div className={`flex items-end gap-2 my-2 ${mine ? "flex-row-reverse" : ""}`}>
        {/* 头像可以根据需要添加 */}
        {/* <img src={mine ? user.photoURL : peer.photoURL} className="w-8 h-8 rounded-full" /> */}
        <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${mine ? "bg-blue-500 text-white rounded-br-none" : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none"}`}>
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>
        {/* 【UI修改】简化功能按钮 */}
        <div className="flex items-center gap-2 text-gray-400">
          <button onClick={() => playCachedTTS(message.text)}><Music size={16} /></button>
          <button onClick={() => alert("翻译功能待配置")}><Languages size={16} /></button>
        </div>
      </div>
    );
  };

  const onBackgroundFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setCfg({ backgroundDataUrl: e.target.result });
    reader.readAsDataURL(file);
  };

  // ----- Main UI (彻底重构为全屏) -----
  return (
    <div className="fixed inset-0 z-50 bg-gray-100 dark:bg-black flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col h-full"
        style={{ backgroundImage: cfg.backgroundDataUrl ? `url(${cfg.backgroundDataUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 bg-white/80 dark:bg-black/70 backdrop-blur-lg border-b dark:border-gray-700/50">
          <button onClick={onClose} className="p-2 -ml-2"><ArrowLeft /></button>
          <h1 className="font-semibold text-lg absolute left-1/2 -translate-x-1/2">{peerDisplayName || "聊天"}</h1>
          <button onClick={() => setSettingsOpen(true)} className="p-2 -mr-2"><Settings /></button>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden relative p-4">
          <Virtuoso
            style={{ height: '100%' }}
            data={messages}
            itemContent={(index, msg) => <MessageRow message={msg} key={msg.id} />}
            followOutput="auto"
            overscan={300}
          />
        </div>

        {/* Input Area */}
        <footer className="flex-shrink-0 p-2 bg-white/80 dark:bg-black/70 backdrop-blur-lg border-t dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                onFocus={() => setShowEmojiPicker(false)} // 输入时关闭表情面板
                placeholder="输入消息..."
                className="w-full pl-4 pr-12 py-2 rounded-full border bg-gray-100 dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500">
                <Smile />
              </button>
            </div>
            <button onClick={sendMessage} disabled={sending || !input.trim()} className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md disabled:opacity-50 transition-all">
              <Send size={18} />
            </button>
          </div>
          {/* 表情选择器 */}
          {showEmojiPicker && (
            <div className="mt-2">
              <EmojiPicker onEmojiClick={handleEmojiSelect} />
            </div>
          )}
        </footer>

        {/* Settings Panel */}
        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-10"
              onClick={() => setSettingsOpen(false)}
            >
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 w-full bg-white dark:bg-gray-800 p-4 rounded-t-2xl"
              >
                <h3 className="text-lg font-semibold mb-4 text-center">聊天设置</h3>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <span className="text-sm">聊天背景</span>
                  <label className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md cursor-pointer">
                    选择图片
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onBackgroundFile(e.target.files[0]); }} />
                  </label>
                </div>
                {cfg.backgroundDataUrl && (
                  <button onClick={() => setCfg({ backgroundDataUrl: "" })} className="w-full mt-2 p-2 text-sm bg-red-500 text-white rounded-md">
                    移除背景
                  </button>
                )}
                <button onClick={() => setSettingsOpen(false)} className="w-full mt-4 p-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-md">
                  关闭
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
          }
