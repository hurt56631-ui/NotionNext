// /components/ChatInterface.js (最终完美版 - 完全统一使用 senderId 以匹配规则)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { db, rtDb } from "@/lib/firebase"; 
import { ref as rtRef, onValue } from 'firebase/database';
// ✅ 引入 runTransaction 以确保写入的原子性
import { collection, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, increment, writeBatch, runTransaction } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Settings, X, Volume2, Pencil, Check, BookText, Search, Trash2, RotateCcw, ArrowDown, Image as ImageIcon, Trash, Mic } from "lucide-react";
import { pinyin } from 'pinyin-pro';

// ... (所有辅助组件和函数保持不变) ...
const GlobalScrollbarStyle = () => ( <style>{` .thin-scrollbar::-webkit-scrollbar { width: 2px; height: 2px; } .thin-scrollbar::-webkit-scrollbar-track { background: transparent; } .thin-scrollbar::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 20px; } .thin-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #9ca3af; } .thin-scrollbar { scrollbar-width: thin; scrollbar-color: #9ca3af transparent; } `}</style> );
const CircleTranslateIcon = ({ size = 6 }) => ( <div className={`w-${size} h-${size} bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-600 font-bold shadow-sm border border-gray-300 transition-colors`}>译</div> );
const PinyinText = ({ text, showPinyin }) => { if (!text || typeof text !== 'string') return text; if (showPinyin) { try { return pinyin(text, { type: 'array', toneType: 'none' }).join(' '); } catch (error) { console.error("Pinyin conversion failed:", error); return text; } } return text; };
const ttsCache = new Map();
const preloadTTS = async (text) => { if (!text || ttsCache.has(text)) return; try { const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`; const response = await fetch(url); if (!response.ok) throw new Error('API Error'); const blob = await response.blob(); const audio = new Audio(URL.createObjectURL(blob)); ttsCache.set(text, audio); } catch (error) { console.error(`预加载 "${text}" 失败:`, error); } };
const playCachedTTS = (text) => { if (ttsCache.has(text)) { ttsCache.get(text).play().catch(error => console.error("TTS playback failed:", error)); } else { preloadTTS(text).then(() => { if (ttsCache.has(text)) { ttsCache.get(text).play().catch(error => console.error("TTS playback failed:", error)); } }); } };
const callAIHelper = async (prompt, textToTranslate, apiKey, apiEndpoint, model) => { if (!apiKey || !apiEndpoint) { throw new Error("请在设置中配置AI翻译接口地址和密钥。"); } const fullPrompt = `${prompt}\n\n以下是需要翻译的文本：\n"""\n${textToTranslate}\n"""`; try { const response = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model: model, messages: [{ role: 'user', content: fullPrompt }] }) }); if (!response.ok) { const errorBody = await response.text(); throw new Error(`AI接口请求失败: ${response.status} ${errorBody}`); } const data = await response.json(); if (data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content; return JSON.stringify(data); } catch (error) { console.error("调用AI翻译失败:", error); throw error; } };
const parseSingleTranslation = (text) => { const translationMatch = text.match(/\*\*(.*?)\*\*/s); const backTranslationMatch = text.match(/回译[:：\s]*(.*)/is); if (translationMatch && backTranslationMatch) { return { translation: translationMatch[1].trim(), backTranslation: backTranslationMatch[1].trim() }; } const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || text; return { translation: firstLine.trim(), backTranslation: "解析失败" }; };
const formatLastSeen = (timestamp) => {
    if (!timestamp) return '离线';
    const now = Date.now();
    const diff = now - timestamp; 
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return '在线'; 
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return new Date(timestamp).toLocaleDateString();
};

export default function ChatInterface({ chatId, currentUser, peerUser }) {
  const user = currentUser;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [longPressedMessage, setLongPressedMessage] = useState(null);
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [myTranslationResult, setMyTranslationResult] = useState(null);
  const [correctionMode, setCorrectionMode] = useState({ active: false, message: null, text: '' });
  const [showPinyinFor, setShowPinyinFor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [peerStatus, setPeerStatus] = useState({ online: false, lastSeenTimestamp: null });
  const [unreadCount, setUnreadCount] = useState(0);
  const [background, setBackground] = useState({ dataUrl: null, opacity: 0.2 });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mainScrollRef = useRef(null);
  const searchInputRef = useRef(null);
  const textareaRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const fileInputRef = useRef(null);
  const defaultSettings = { 
      autoTranslate: false, autoPlayTTS: false, fontSize: 16, fontWeight: 'normal',
      sourceLang: '中文', targetLang: '缅甸语',
      speechLang: 'zh-CN',
      ai: { endpoint: "https://open-gemini-api.deno.dev/v1/chat/completions", apiKey: "", model: "gemini-pro" } 
  };
  const [cfg, setCfg] = useState(() => { if (typeof window === 'undefined') return defaultSettings; try { const savedCfg = localStorage.getItem("private_chat_settings_v3"); return savedCfg ? { ...defaultSettings, ...JSON.parse(savedCfg) } : defaultSettings; } catch { return defaultSettings; } });

  useEffect(() => {
    const vv = window.visualViewport;
    const footerEl = document.getElementById("chat-footer");
    const mainEl = mainScrollRef.current;
    function onViewport() { if (!footerEl || !mainEl || !vv) return; const bottomOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); footerEl.style.bottom = bottomOffset + "px"; mainEl.style.paddingBottom = `calc(5.5rem + ${bottomOffset}px)`; }
    if (vv) { vv.addEventListener("resize", onViewport); vv.addEventListener("scroll", onViewport); onViewport(); }
    return () => { if (vv) { vv.removeEventListener("resize", onViewport); vv.removeEventListener("scroll", onViewport); } };
  }, []);

  useEffect(() => { if (chatId) { try { const key = `chat_bg_v2_${chatId}`; const savedBg = localStorage.getItem(key); if (savedBg) { setBackground(JSON.parse(savedBg)); } } catch (e) { console.error('加载聊天背景失败', e); } } }, [chatId]);
  const saveBackground = (newBg) => { setBackground(newBg); try { localStorage.setItem(`chat_bg_v2_${chatId}`, JSON.stringify(newBg)); } catch (err) { console.error('保存聊天背景失败', err); alert('保存背景失败，可能是图片太大或存储空间已满。'); } };
  const onFileChange = (e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { saveBackground({ ...background, dataUrl: reader.result }); }; reader.readAsDataURL(file); e.target.value = null; };
  const clearBackground = () => { if (window.confirm("确定要清除自定义聊天背景吗？")) { saveBackground({ dataUrl: null, opacity: 0.2 }); } };
  const handleOpacityChange = (e) => { saveBackground({ ...background, opacity: parseFloat(e.target.value) }); };
  useEffect(() => { if (isAtBottomRef.current) { const timer = setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }); }, 50); return () => clearTimeout(timer); } }, [messages]);
  useEffect(() => {
    if (!peerUser?.id || typeof window === 'undefined' || !rtDb) { setPeerStatus({ online: false, lastSeenTimestamp: null }); return; }
    const peerStatusRef = rtRef(rtDb, `/status/${peerUser.id}`);
    const unsubscribeRTDB = onValue(peerStatusRef, (snapshot) => { const statusData = snapshot.val(); if (statusData && statusData.state === 'online') { setPeerStatus({ online: true, lastSeenTimestamp: statusData.last_changed }); } else if (statusData) { setPeerStatus({ online: false, lastSeenTimestamp: statusData.last_changed }); } else { const peerFirestoreRef = doc(db, 'users', peerUser.id); getDoc(peerFirestoreRef).then(docSnap => { if (docSnap.exists()) { const lastSeen = docSnap.data().lastSeen; const firestoreTime = lastSeen?.toDate()?.getTime() || null; setPeerStatus({ online: false, lastSeenTimestamp: firestoreTime }); } }); } });
    const peerFirestoreRef = doc(db, 'users', peerUser.id);
    const unsubscribeFirestore = onSnapshot(peerFirestoreRef, (docSnap) => { if (docSnap.exists()) { const lastSeen = docSnap.data().lastSeen; if (lastSeen && typeof lastSeen.toDate === 'function') { const firestoreTime = lastSeen.toDate().getTime(); setPeerStatus(prev => { if (prev.online) return prev; return { online: false, lastSeenTimestamp: firestoreTime }; }); } } });
    return () => { unsubscribeRTDB(); unsubscribeFirestore(); };
  }, [peerUser?.id]);

  useEffect(() => {
    if (!chatId || !user?.uid) return;
    const messagesRef = collection(db, `privateChats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(5000));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const oldMessagesCount = prevMessagesLengthRef.current;
      if (oldMessagesCount > 0 && arr.length > oldMessagesCount) {
        const newMessages = arr.slice(oldMessagesCount);
        const newPeerMessagesCount = newMessages.filter(m => m.senderId !== user.uid).length;
        if (newPeerMessagesCount > 0 && !isAtBottomRef.current) { setUnreadCount(prev => prev + newPeerMessagesCount); }
      }
      setMessages(arr);
      prevMessagesLengthRef.current = arr.length;
      const lastMessage = arr[arr.length - 1];
      if (lastMessage && lastMessage.senderId !== user.uid) { if (cfg.autoPlayTTS) playCachedTTS(lastMessage.text); if (cfg.autoTranslate) handleTranslateMessage(lastMessage); }
    }, (err) => console.error("监听消息错误:", err));
    return () => unsub();
  }, [chatId, user?.uid, cfg.autoPlayTTS, cfg.autoTranslate]);

  useEffect(() => { if (typeof window !== 'undefined') { localStorage.setItem("private_chat_settings_v3", JSON.stringify(cfg)); } }, [cfg]);
  useEffect(() => { if (searchActive && searchInputRef.current) { searchInputRef.current.focus(); } }, [searchActive]);
  useEffect(() => { const textarea = textareaRef.current; if (textarea) { textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight}px`; } }, [input]);
  const filteredMessages = searchQuery ? messages.filter(msg => msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase())) : messages;

  const sendMessage = async (textToSend) => {
    const content = (textToSend || input).trim();
    if (!content || !user?.uid || !peerUser?.id || !chatId) {
      console.error("SendMessage Aborted: Missing required data.");
      return;
    }
    setSending(true);

    try {
      const chatDocRef = doc(db, "privateChats", chatId);
      await runTransaction(db, async (transaction) => {
        const chatDocSnap = await transaction.get(chatDocRef);
        const newMessageRef = doc(collection(chatDocRef, "messages"));

        if (!chatDocSnap.exists()) {
          transaction.set(chatDocRef, {
            members: [user.uid, peerUser.id],
            createdAt: serverTimestamp(),
            lastMessage: content,
            lastMessageAt: serverTimestamp(),
            [`unreadCounts.${peerUser.id}`]: 1,
            [`unreadCounts.${user.uid}`]: 0
          });
        } else {
          transaction.update(chatDocRef, {
            lastMessage: content,
            lastMessageAt: serverTimestamp(),
            [`unreadCounts.${peerUser.id}`]: increment(1),
            [`unreadCounts.${user.uid}`]: 0
          });
        }
        
        transaction.set(newMessageRef, {
          text: content,
          senderId: user.uid,
          createdAt: serverTimestamp()
        });
      });

      setInput("");
      setMyTranslationResult(null);

    } catch (error) {
      console.error("SendMessage Transaction Error:", error);
      alert(`发送失败，请重试: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSpeechRecognition = () => { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { alert("抱歉，您的浏览器不支持语音识别功能。请尝试使用最新版的 Chrome 浏览器。"); return; } if (isListening) { recognitionRef.current?.stop(); return; } const recognition = new SpeechRecognition(); recognition.lang = cfg.speechLang; recognition.interimResults = true; recognition.continuous = false; recognitionRef.current = recognition; recognition.onstart = () => { setIsListening(true); setInput(''); }; recognition.onend = () => { setIsListening(false); recognitionRef.current = null; }; recognition.onerror = (event) => { console.error("语音识别错误:", event.error); setIsListening(false); setInput(''); }; recognition.onresult = (event) => { const transcript = Array.from(event.results).map(result => result[0]).map(result => result.transcript).join(''); setInput(transcript); if (event.results[0].isFinal && transcript.trim()) { sendMessage(transcript); } }; recognition.start(); };
  const handleScroll = () => { const el = mainScrollRef.current; if (el) { const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100; isAtBottomRef.current = atBottom; if (atBottom && unreadCount > 0) { setUnreadCount(0); } } };
  const handleRecallMessage = async (message) => { if (message.senderId !== user.uid) return; const messageRef = doc(db, `privateChats/${chatId}/messages`, message.id); try { await updateDoc(messageRef, { text: "此消息已被撤回", recalled: true }); } catch (error) { console.error("撤回消息失败:", error); alert("撤回失败"); } };
  const handleDeleteMessage = async (message) => { if (message.senderId !== user.uid) return; const messageRef = doc(db, `privateChats/${chatId}/messages`, message.id); try { await deleteDoc(messageRef); } catch (error) { console.error("删除消息失败:", error); alert("删除失败"); } };
  const sendCorrection = async () => { if (!correctionMode.active || !correctionMode.message || !correctionMode.text.trim()) return; const messageRef = doc(db, `privateChats/${chatId}/messages`, correctionMode.message.id); try { await updateDoc(messageRef, { correction: { originalText: correctionMode.message.text, correctedText: correctionMode.text.trim(), correctorUid: user.uid, correctedAt: serverTimestamp() } }); setCorrectionMode({ active: false, message: null, text: '' }); } catch (error) { console.error("发送更正失败:", error); alert("发送更正失败，请重试。"); } };
  const getMyInputPrompt = (sourceLang, targetLang) => `你是一位精通${sourceLang}和${targetLang}的双语翻译专家。请将以下${sourceLang}文本翻译成${targetLang}。\n要求：在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。\n请严格遵循以下格式，只返回格式化的翻译结果，不要包含任何额外说明或标签：\n\n**这里是${targetLang}翻译**\n回译：这里是回译成${sourceLang}的内容`;
  const PeerMessagePrompt = `你是一位专业的缅甸语翻译家。请将以下缅甸语文本翻译成中文，要求自然直译版，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。你只需要返回翻译后的中文内容，不要包含任何额外说明、标签或原始文本。`;
  const handleTranslateMessage = async (message) => { setIsTranslating(true); setTranslationResult(null); setLongPressedMessage(null); try { const result = await callAIHelper(PeerMessagePrompt, message.text, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model); setTranslationResult({ messageId: message.id, text: result }); } catch (error) { alert(error.message); } finally { setIsTranslating(false); } };
  const handleTranslateMyInput = async () => { if (!input.trim()) return; setIsTranslating(true); setMyTranslationResult(null); try { const prompt = getMyInputPrompt(cfg.sourceLang, cfg.targetLang); const resultText = await callAIHelper(prompt, input, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model); const parsedResult = parseSingleTranslation(resultText); setMyTranslationResult(parsedResult); } catch (error) { alert(error.message); } finally { setIsTranslating(false); } };
  const handleDeleteAllMessages = async () => { if (!window.confirm(`确定要删除与 ${peerUser?.displayName} 的全部聊天记录吗？此操作不可恢复！`)) return; alert("删除全部记录功能待实现。"); };
  const handleBlockUser = async () => { if (!window.confirm(`确定要拉黑 ${peerUser?.displayName} 吗？`)) return; alert("拉黑功能待实现。"); };
  
  const LongPressMenu = ({ message, onClose }) => { 
    const mine = message.senderId === user?.uid;
    const isPinyinVisible = showPinyinFor === message.id; 
    return ( 
      <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center" onClick={onClose}> 
        <div className="bg-white rounded-lg shadow-xl p-2 flex flex-col gap-1 text-black border border-gray-200" onClick={e => e.stopPropagation()}> 
          <button onClick={() => { setShowPinyinFor(isPinyinVisible ? null : message.id); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><BookText size={18} /> {isPinyinVisible ? '隐藏拼音' : '显示拼音'}</button> 
          {!message.recalled && <button onClick={() => { playCachedTTS(message.text); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><Volume2 size={18} /> 朗读</button>} 
          {!message.recalled && <button onClick={() => { handleTranslateMessage(message); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><div className="w-5 h-5 rounded-full flex items-center justify-center bg-gray-100 border border-gray-300 text-xs font-bold text-gray-600">译</div>翻译</button>} 
          {!mine && !message.recalled && <button onClick={() => { setCorrectionMode({ active: true, message: message, text: message.text }); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><Pencil size={18} /> 改错</button>} 
          {mine && !message.recalled && <button onClick={() => { handleRecallMessage(message); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><RotateCcw size={18} /> 撤回</button>} 
          {mine && <button onClick={() => { handleDeleteMessage(message); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full text-red-500"><Trash2 size={18} /> 删除</button>} 
        </div> 
      </div> 
    ); 
  };
  
  const MessageRow = ({ message, isLastMessage }) => { 
    const mine = message.senderId === user?.uid;
    const longPressTimer = useRef(); 
    const handleTouchStart = () => { longPressTimer.current = setTimeout(() => { setLongPressedMessage(message); }, 500); }; 
    const handleTouchEnd = () => { clearTimeout(longPressTimer.current); }; 
    const handleTouchMove = () => { clearTimeout(longPressTimer.current); }; 
    const messageStyle = { fontSize: `${cfg.fontSize}px`, fontWeight: cfg.fontWeight };
    const isPeersLastMessage = !mine && isLastMessage;

    return ( 
      <div className={`flex items-end gap-2 my-2 ${mine ? "flex-row-reverse" : ""}`}> 
        <img src={mine ? user.photoURL : peerUser?.photoURL || '/img/avatar.svg'} alt="avatar" className="w-8 h-8 rounded-full mb-1 flex-shrink-0" /> 
        <div className={`flex items-center gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}> 
          <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} onContextMenu={(e) => { e.preventDefault(); setLongPressedMessage(message); }} className={`relative max-w-[70vw] sm:max-w-[70%] px-4 py-2 rounded-2xl shadow-sm ${mine ? "bg-blue-500 text-white rounded-br-none" : "bg-white text-black rounded-bl-none"}`}> 
            {message.recalled ? ( <p className="whitespace-pre-wrap break-words italic opacity-70 text-sm">此消息已被撤回</p> ) : message.correction ? ( <div className="space-y-1"> <p className="whitespace-pre-wrap break-words opacity-60 line-through" style={messageStyle}><PinyinText text={message.correction.originalText} showPinyin={showPinyinFor === message.id} /></p> <p className="whitespace-pre-wrap break-words text-green-600" style={messageStyle}><Check size={16} className="inline mr-1"/> <PinyinText text={message.correction.correctedText} showPinyin={showPinyinFor === message.id} /></p> </div> ) : ( <p className="whitespace-pre-wrap break-words" style={messageStyle}><PinyinText text={message.text} showPinyin={showPinyinFor === message.id} /></p> )} 
            {translationResult && translationResult.messageId === message.id && ( <div className="mt-2 pt-2 border-t border-black/20"> <p className="text-sm opacity-90 whitespace-pre-wrap">{translationResult.text}</p> </div> )} 
          </div> 
          {isPeersLastMessage && !message.recalled && (<button onClick={() => handleTranslateMessage(message)} className="self-end flex-shrink-0 active:scale-90 transition-transform duration-100" aria-label="翻译"><CircleTranslateIcon size={6} /></button>)}
        </div> 
      </div> 
    ); 
  };

  return (
    <div className="h-screen w-full bg-gray-100 text-black overflow-hidden relative">
      <GlobalScrollbarStyle />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      {background.dataUrl && ( <div className="absolute inset-0 w-full h-full bg-cover bg-center z-0" style={{ backgroundImage: `url(${background.dataUrl})`, opacity: background.opacity }}/> )}
      <header className="fixed top-0 left-0 w-full flex items-center justify-between h-14 px-4 bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg z-30">
        <AnimatePresence>
            {searchActive ? (
                <motion.div key="search" className="absolute inset-0 flex items-center px-4 bg-white/90">
                    <input ref={searchInputRef} type="text" placeholder="搜索消息..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent text-black placeholder-gray-500 focus:outline-none" />
                    <button onClick={() => { setSearchActive(false); setSearchQuery(''); }} className="p-2 -mr-2 text-gray-600"><X/></button>
                </motion.div>
            ) : (
                <motion.div key="title" className="flex items-center justify-between w-full">
                    <div className="w-16"></div> 
                    <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                        <h1 className="font-bold text-lg text-white truncate max-w-[50vw]">{peerUser?.displayName || "聊天"}</h1>
                        {peerStatus.online ? ( <span className="text-xs text-white/80 font-semibold flex items-center gap-1"><div className="w-2 h-2 bg-green-400 rounded-full"></div>在线</span> ) : ( <span className="text-xs text-white/60">{formatLastSeen(peerStatus.lastSeenTimestamp)}</span> )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setSearchActive(true)} className="p-2 text-white/80 hover:text-white"><Search /></button>
                        <button onClick={() => setSettingsOpen(true)} className="p-2 -mr-2 text-white/80 hover:text-white"><Settings /></button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </header>
      <main ref={mainScrollRef} onScroll={handleScroll} className="h-full overflow-y-auto w-full thin-scrollbar px-4 pt-14 pb-20 relative z-10">
        <div>
            {filteredMessages.map((msg, index) => (
              <MessageRow message={msg} key={msg.id} isLastMessage={index === filteredMessages.length - 1} />
            ))}
            <div ref={messagesEndRef} style={{ height: '1px' }} />
        </div>
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.button 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed right-4 bottom-24 z-10 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center p-2 min-w-[40px] h-10"
              onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }} 
            >
              <div className="flex items-center gap-1.5 px-2">
                <span className="font-bold text-sm">{unreadCount}</span>
                <ArrowDown size={16}/>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </main>
      <footer id="chat-footer" className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-20 transition-all duration-150 shadow-t-lg">
        <div>
            <AnimatePresence>
                {myTranslationResult && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-gray-200 bg-white">
                        <div className="p-3 flex justify-between items-center"><h4 className="text-sm font-bold text-gray-700">AI 翻译建议</h4><button onClick={() => setMyTranslationResult(null)} className="text-gray-500"><X size={18} /></button></div>
                        <div className="max-h-60 overflow-y-auto p-3 pt-0 thin-scrollbar"><div className="p-3 rounded-lg bg-gray-100 flex items-start gap-3"><div className="flex-1 space-y-1"><p className="font-bold text-blue-600 text-base">{myTranslationResult.translation}</p><p className="text-xs text-gray-500 font-bold">回译: {myTranslationResult.backTranslation}</p></div><button onClick={() => sendMessage(myTranslationResult.translation)} className="w-10 h-10 flex-shrink-0 bg-blue-500 text-white rounded-full flex items-center justify-center"><Send size={16}/></button></div></div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="p-2">
              <div className="flex items-end w-full max-w-4xl mx-auto p-1 bg-gray-100 rounded-2xl border border-gray-200">
                <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder={isListening ? "正在聆听..." : "输入消息..."} className="flex-1 bg-transparent focus:outline-none text-black text-base resize-none overflow-y-auto max-h-[40vh] mx-2 py-2.5 leading-6 placeholder-gray-500 font-normal thin-scrollbar" rows="1" readOnly={isListening} />
                <div className="flex items-center flex-shrink-0 ml-1 self-end">
                  <button onClick={handleTranslateMyInput} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-blue-500 disabled:opacity-30" title="AI 翻译">{isTranslating ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-blue-500"></div> : <CircleTranslateIcon />}</button>
                  {input.trim() === '' ? ( <button onClick={handleSpeechRecognition} className={`w-10 h-10 flex items-center justify-center rounded-full text-white transition-all ml-1 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} title="语音输入"><Mic size={18} /></button> ) : ( <button onClick={() => sendMessage()} disabled={sending} className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md disabled:bg-gray-400 disabled:shadow-none transition-all ml-1" title="发送"><Send size={18} /></button> )}
                </div>
              </div>
            </div>
        </div>
      </footer>
      <AnimatePresence>
        {settingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 z-50" onClick={() => setSettingsOpen(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="absolute bottom-0 w-full bg-gray-100 text-black p-4 rounded-t-2xl space-y-4 max-h-[80vh] overflow-y-auto thin-scrollbar border-t border-gray-200">
              <h3 className="font-semibold text-lg text-center">聊天设置</h3>
              <div className="p-3 rounded-lg bg-white space-y-3"><h4 className="font-bold text-sm">样式</h4><label className="flex items-center justify-between text-sm"><span className="font-bold">字体大小 (px)</span><input type="number" value={cfg.fontSize} onChange={e => setCfg(c => ({...c, fontSize: parseInt(e.target.value)}))} className="w-20 p-1 text-center border rounded text-sm bg-white border-gray-300"/></label><label className="flex items-center justify-between text-sm"><span className="font-bold">字体粗细</span><select value={cfg.fontWeight} onChange={e => setCfg(c => ({...c, fontWeight: e.target.value}))} className="p-1 border rounded text-sm bg-white border-gray-300"><option value="400">常规</option><option value="700">粗体</option></select></label></div>
              <div className="p-3 rounded-lg bg-white space-y-2">
                <h4 className="font-bold text-sm">聊天背景</h4>
                <div className="flex items-center gap-3">
                    <div className="w-20 h-12 rounded overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">{background.dataUrl ? <img src={background.dataUrl} alt="bg preview" className="w-full h-full object-cover" /> : <div className="text-xs text-gray-400">无</div>}</div>
                    <div className="flex-1 flex gap-2"><button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-md border bg-white text-sm flex items-center gap-2"><ImageIcon size={16}/> 上传</button><button onClick={clearBackground} className="px-3 py-2 rounded-md border bg-white text-sm flex items-center gap-2 text-red-500"><Trash size={16}/> 清除</button></div>
                </div>
                {background.dataUrl && ( <div className="pt-2"><label className="text-xs text-gray-600 dark:text-gray-300">背景透明度</label><input type="range" min="0.1" max="1" step="0.05" value={background.opacity} onChange={handleOpacityChange} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/></div> )}
              </div>
              <div className="p-3 rounded-lg bg-white space-y-3">
                <h4 className="font-bold text-sm">语音和翻译</h4>
                <label className="flex items-center justify-between text-sm"><span className="font-bold">语音识别语言</span><select value={cfg.speechLang} onChange={e => setCfg(c => ({...c, speechLang: e.target.value}))} className="p-1 border rounded text-sm bg-white border-gray-300"><option value="zh-CN">中文 (普通话)</option><option value="en-US">英语 (美国)</option><option value="my-MM">缅甸语</option><option value="ja-JP">日语</option><option value="ko-KR">韩语</option><option value="es-ES">西班牙语 (西班牙)</option><option value="fr-FR">法语 (法国)</option></select></label>
                <label className="flex items-center justify-between text-sm"><span className="font-bold">源语言 (你的语言)</span><input type="text" value={cfg.sourceLang} onChange={e => setCfg(c => ({...c, sourceLang: e.target.value}))} className="w-28 p-1 text-center border rounded text-sm bg-white border-gray-300"/></label>
                <label className="flex items-center justify-between text-sm"><span className="font-bold">目标语言 (对方语言)</span><input type="text" value={cfg.targetLang} onChange={e => setCfg(c => ({...c, targetLang: e.target.value}))} className="w-28 p-1 text-center border rounded text-sm bg-white border-gray-300"/></label>
              </div>
              <div className="p-3 rounded-lg bg-white space-y-2">
                <h4 className="font-bold text-sm">AI翻译设置 (OpenAI兼容)</h4>
                <input placeholder="接口地址" value={cfg.ai.endpoint} onChange={e => setCfg(c => ({...c, ai: {...c.ai, endpoint: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
                <input placeholder="API Key" type="password" value={cfg.ai.apiKey} onChange={e => setCfg(c => ({...c, ai: {...c.ai, apiKey: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
                <input placeholder="模型 (e.g., gemini-pro)" value={cfg.ai.model} onChange={e => setCfg(c => ({...c, ai: {...c.ai, model: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
              </div>
              <div className="p-3 rounded-lg bg-white space-y-2"><h4 className="font-bold text-sm">自动化</h4><label className="flex items-center justify-between text-sm"><span className="font-bold">自动朗读对方消息</span><input type="checkbox" checked={cfg.autoPlayTTS} onChange={e => setCfg(c => ({...c, autoPlayTTS: e.target.checked}))} className="h-5 w-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"/></label><label className="flex items-center justify-between text-sm"><span className="font-bold">自动翻译对方消息</span><input type="checkbox" checked={cfg.autoTranslate} onChange={e => setCfg(c => ({...c, autoTranslate: e.target.checked}))} className="h-5 w-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"/></label></div>
              <div className="p-3 rounded-lg bg-white space-y-2"><h4 className="font-bold text-sm text-red-500">危险操作</h4><button onClick={handleDeleteAllMessages} className="w-full text-left p-2 hover:bg-red-500/10 rounded-md text-red-500 font-bold text-sm">删除全部聊天记录</button><button onClick={handleBlockUser} className="w-full text-left p-2 hover:bg-red-500/10 rounded-md text-red-500 font-bold text-sm">拉黑对方</button></div>
              <button onClick={() => setSettingsOpen(false)} className="w-full mt-2 p-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md">关闭</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {longPressedMessage && <LongPressMenu message={longPressedMessage} onClose={() => setLongPressedMessage(null)} />}
      {correctionMode.active && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"> <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md bg-white text-black border border-gray-200 rounded-lg shadow-xl p-4 space-y-3"> <h3 className="font-bold text-lg">修改消息</h3> <p className="text-sm p-3 bg-gray-100 rounded-md">{correctionMode.message.text}</p> <textarea value={correctionMode.text} onChange={e => setCorrectionMode(c => ({...c, text: e.target.value}))} rows={4} className="w-full p-2 border rounded bg-white border-gray-300" /> <div className="flex justify-end gap-2"> <button onClick={() => setCorrectionMode({ active: false, message: null, text: ''})} className="px-4 py-2 rounded-md bg-gray-200 text-sm">取消</button> <button onClick={sendCorrection} className="px-4 py-2 rounded-md bg-blue-500 text-white text-sm">确认修改</button> </div> </motion.div> </motion.div> )}
    </div>
  );
}
