// /components/ChatInterface.js (最终调试版 - 集成详细日志)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { db, rtDb } from "@/lib/firebase"; 
import { ref as rtRef, onValue } from 'firebase/database';
// ✅ 引入 runTransaction
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

  // ==================== 【集成详细日志的 sendMessage 函数】 ====================
  const sendMessage = async (textToSend) => {
    console.group("🚀 [sendMessage] 开始执行");

    const content = (textToSend || input).trim();
    
    // --- 日志点 1: 检查所有前提条件 ---
    console.log("1. 检查前提条件...");
    console.log(`  - 消息内容 (content): "${content}"`);
    console.log("  - 当前用户 (currentUser):", currentUser);
    console.log("  - 当前用户的UID (user.uid):", user?.uid);
    console.log("  - 对方用户 (peerUser):", peerUser);
    console.log("  - 对方用户的ID (peerUser.id):", peerUser?.id);
    console.log(`  - 聊天ID (chatId): "${chatId}"`);

    if (!content || !user?.uid || !peerUser?.id || !chatId) {
      console.error("❌ [sendMessage] 失败：前提条件不满足！函数提前退出。");
      console.groupEnd();
      alert("发送失败：缺少关键信息（用户、聊天对象或内容）。");
      return;
    }
    
    console.log("✅ 1. 前提条件满足。");
    setSending(true);

    try {
      const chatDocRef = doc(db, "privateChats", chatId);
      
      console.log("2. 准备执行 Firestore Transaction...");
      
      await runTransaction(db, async (transaction) => {
        console.log("  - [Transaction] 事务内部开始...");
        const chatDocSnap = await transaction.get(chatDocRef);
        const newMessageRef = doc(collection(chatDocRef, "messages"));

        if (!chatDocSnap.exists()) {
          console.log("  - [Transaction] 聊天文档不存在，准备创建...");
          const newChatData = {
            members: [user.uid, peerUser.id],
            createdAt: serverTimestamp(),
            lastMessage: content,
            lastMessageAt: serverTimestamp(),
            [`unreadCounts.${peerUser.id}`]: 1,
            [`unreadCounts.${user.uid}`]: 0
          };
          console.log("    - [Transaction] 将要创建的新聊天文档数据:", newChatData);
          transaction.set(chatDocRef, newChatData);
        } else {
          console.log("  - [Transaction] 聊天文档已存在，准备更新...");
          const updateData = {
            lastMessage: content,
            lastMessageAt: serverTimestamp(),
            [`unreadCounts.${peerUser.id}`]: increment(1),
            [`unreadCounts.${user.uid}`]: 0
          };
          console.log("    - [Transaction] 将要更新的数据:", updateData);
          transaction.update(chatDocRef, updateData);
        }
        
        const newMessageData = {
          text: content,
          senderId: user.uid,
          createdAt: serverTimestamp()
        };
        console.log("  - [Transaction] 准备创建新消息...");
        console.log("    - [Transaction] 将要创建的新消息数据:", newMessageData);
        transaction.set(newMessageRef, newMessageData);
        console.log("  - [Transaction] 事务内部操作定义完毕。");
      });

      console.log("✅ 3. Firestore Transaction 执行成功！");

      setInput("");
      setMyTranslationResult(null);

    } catch (error) {
      console.error("❌ [sendMessage] 失败：在执行 Transaction 时捕获到错误！");
      console.error("  - 错误代码 (error.code):", error.code);
      console.error("  - 错误信息 (error.message):", error.message);
      console.error("  - 完整错误对象 (error):", error);
      alert(`发送失败，请检查浏览器控制台获取详细错误信息。\n错误: ${error.message}`);
    } finally {
      setSending(false);
      console.log("🏁 [sendMessage] 执行完毕。");
      console.groupEnd();
    }
  };
  // =========================================================================

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
        {/* ... (所有 JSX 保持不变) ... */}
    </div>
  );
}
