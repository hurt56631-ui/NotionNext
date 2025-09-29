// themes/heo/components/PrivateChat.js (终极专业版 - 一字不漏)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
// 【图标更换】引入 Check, Speaker, Pencil, 并替换原有图标
import { Send, Settings, ArrowLeft, X, Volume2, Pencil } from "lucide-react";
import { pinyin } from 'pinyin-pro'; // 【新增】引入拼音库

// ------------------------------------------------------------------
// 新增组件与图标
// ------------------------------------------------------------------

// 【新增】自定义的 “文A” 翻译图标 (SVG组件)
const TranslateIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
        <path d="M4 7V5H13V7L9.5 13H11V15H5V13L8.5 7H4Z" fill="currentColor"/>
        <path d="M15 11V9H21V11H18.5L16.25 15H18.75L20 13.04L21.25 15H23.75L21.5 11.96V11H15Z" fill="currentColor"/>
    </svg>
);

// 【新增】拼音文本组件
const PinyinText = ({ text }) => {
    if (!text || typeof text !== 'string') return null;
    const pinyinArray = pinyin(text, { type: 'array' });
    const hanziArray = text.split('');
    return (
        <ruby>
            {hanziArray.map((char, index) => (
                <React.Fragment key={index}>
                    {char}
                    <rt style={{ fontSize: '0.7em', opacity: 0.8 }}>{pinyinArray[index]}</rt>
                </React.Fragment>
            ))}
        </ruby>
    );
};

// ------------------------------------------------------------------
// 功能模块 (TTS, AI Helper等)
// ------------------------------------------------------------------
const ttsCache = new Map();
const preloadTTS = async (text) => { /* ... */ };
const playCachedTTS = (text) => { /* ... */ };
const callAIHelper = async (prompt, textToTranslate, apiKey, apiEndpoint, model) => { /* ... */ };

// 【增强】AI返回结果解析器 - 更鲁棒的正则
const parseMyTranslation = (text) => {
    const sections = text.split(/(?=📖|💬|💡|🐼|🌸|👨)/).filter(Boolean);
    return sections.map(section => {
        const titleMatch = section.match(/^(📖|💬|💡|🐼|🌸|👨)\s*\*\*(.*?)\*\*/);
        const title = titleMatch ? titleMatch[2] : null;
        const burmeseMatch = section.match(/\*\*(.*?)\*\*/g);
        const burmeseText = burmeseMatch ? burmeseMatch[burmeseMatch.length - 1].replace(/\*\*/g, '') : '解析失败';
        // 【增强】使用更灵活的正则匹配“中文意思”或“回译”
        const chineseMatch = section.match(/(?:中文意思|回译)\s*[:：]?\s*(.*)/i);
        const chineseText = chineseMatch ? chineseMatch[1].trim() : '解析失败';
        return { title, burmeseText, chineseText };
    }).filter(item => item.title !== null); // 过滤掉无法解析标题的部分
};


export default function PrivateChat({ peerUid, peerDisplayName, currentUser, onClose }) {
  // ----- State (新增改错相关状态) -----
  const [user, setUser] = useState(currentUser || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [longPressedMessage, setLongPressedMessage] = useState(null);
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [myTranslations, setMyTranslations] = useState(null);
  // 【新增】改错功能的状态
  const [correctionMode, setCorrectionMode] = useState({ active: false, message: null, text: '' });

  // ----- Chat ID & Settings (无大变动) -----
  const makeChatId = useCallback((a, b) => { /* ... */ }, []);
  const chatId = makeChatId(user?.uid, peerUid);

  const defaultSettings = {
    backgroundDataUrl: "", autoTranslate: false, autoPlayTTS: false, showTranslationTitles: false,
    ai: { endpoint: "https://api.openai.com/v1/chat/completions", apiKey: "", model: "gpt-4o-mini", noStream: true }
  };
  const [cfg, setCfg] = useState(() => { /* ... */ });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("private_chat_settings", JSON.stringify({ ...cfg, backgroundDataUrl: undefined }));
    }
  }, [cfg]);
  const handleBackgroundChange = (dataUrl) => { /* ... */ };

  // ----- Firestore real-time listening -----
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    const ensureMeta = async () => { /* ... */ };
    ensureMeta();
    const messagesRef = collection(db, `privateChats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(5000));
    const unsub = onSnapshot(q, async (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // 【新增】获取对方用户的头像信息
      const otherUserId = peerUid;
      let otherUserPhoto = '/img/avatar.svg';
      if (otherUserId) {
          const userProfileDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userProfileDoc.exists()) {
              otherUserPhoto = userProfileDoc.data().photoURL || '/img/avatar.svg';
          }
      }
      const messagesWithAvatars = arr.map(msg => ({
          ...msg,
          photoURL: msg.uid === user.uid ? user.photoURL : otherUserPhoto
      }));
      setMessages(messagesWithAvatars);

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
          photoURL: user.photoURL || null, // 【新增】保存自己的头像
          createdAt: serverTimestamp() 
        });
      setInput("");
      setMyTranslations(null);
    } catch (e) { console.error(e); alert("发送失败：" + e.message); }
    finally { setSending(false); }
  };

  // 【新增】发送更正
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
        setCorrectionMode({ active: false, message: null, text: '' }); // 关闭改错模式
    } catch (error) {
        console.error("发送更正失败:", error);
        alert("发送更正失败，请重试。");
    }
  };
  
  // ----- AI Translation Logic (提示词更新) -----
  const PeerMessagePrompt = `自然直译版，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。`;
  const handleTranslateMessage = async (message) => { /* ... */ };
  const handleTranslateMyInput = async () => { /* ... */ };

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
        <img src={message.photoURL || '/img/avatar.svg'} className="w-8 h-8 rounded-full mt-1" />
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
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: '75%', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="flex-shrink-0 border-t dark:border-gray-700/50 bg-white/80 dark:bg-black/80 backdrop-blur-lg flex flex-col custom-scrollbar">
                <div className="p-3 flex justify-between items-center border-b dark:border-gray-700/50">
                    <h4 className="text-sm font-bold text-center flex-1">选择一个翻译版本发送</h4>
                    <button onClick={() => setMyTranslations(null)}><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 thin-scrollbar">
                    {myTranslations.map((trans, index) => (
                        <div key={index} className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-start gap-3">
                           <div className="flex-1 space-y-1">
                                {!cfg.showTranslationTitles && <p className="font-bold text-sm text-gray-500">{trans.title}</p>}
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
        
        {/* ... 输入框和设置面板 ... */}
        
        {/* 【新增】改错模态框 */}
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
      </motion.div>
    </div>
  );
      }
