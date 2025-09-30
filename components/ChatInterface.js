// /components/ChatInterface.js (V17 - 全面修复和功能优化版)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Settings, X, Volume2, Pencil, Check, BookText, Search, Trash2, RotateCcw, ArrowDown } from "lucide-react";
import { pinyin } from 'pinyin-pro';

// 全局样式：修复为标准<style>标签，确保2px极细滚动条生效，并增加Firefox兼容性
const GlobalScrollbarStyle = () => (
    <style>{`
        .thin-scrollbar::-webkit-scrollbar { width: 1px; height: 1px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 20px; }
        .thin-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #9ca3af; }
        /* Firefox support */
        .thin-scrollbar { scrollbar-width: thin; scrollbar-color: #9ca3af transparent; }
    `}</style>
);


// 组件与图标
const CircleTranslateIcon = () => (
    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-600 font-bold shadow-sm border border-gray-200">
        译
    </div>
);

const PinyinText = ({ text, showPinyin }) => {
    if (!text || typeof text !== 'string') return text;
    if (showPinyin) {
        try { return pinyin(text, { type: 'array', toneType: 'none' }).join(' '); }
        catch (error) { console.error("Pinyin conversion failed:", error); return text; }
    }
    return text;
};

// 功能模块
const ttsCache = new Map();
const preloadTTS = async (text) => {
  if (ttsCache.has(text)) return;
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaxiaoMultilingualNeural&r=-20`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(text, audio);
  } catch (error) { console.error(`预加载 "${text}" 失败:`, error); }
};

const playCachedTTS = (text) => {
  // 修复：为 .play() 增加 .catch() 以处理浏览器自动播放限制导致的错误
  if (ttsCache.has(text)) {
    ttsCache.get(text).play().catch(error => console.error("TTS playback failed:", error));
  } else {
    preloadTTS(text).then(() => {
      if (ttsCache.has(text)) {
        ttsCache.get(text).play().catch(error => console.error("TTS playback failed:", error));
      }
    });
  }
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

// 新增：用于解析单一翻译结果+回译的函数
const parseSingleTranslation = (text) => {
    const translationMatch = text.match(/\*\*(.*?)\*\*/s);
    const backTranslationMatch = text.match(/回译[:：\s]*(.*)/is);

    if (translationMatch && backTranslationMatch) {
        return {
            translation: translationMatch[1].trim(),
            backTranslation: backTranslationMatch[1].trim(),
        };
    }
    console.warn("无法解析AI翻译响应:", text);
    // 如果解析失败，返回原始文本，给用户一个反馈
    return { translation: text.trim(), backTranslation: "解析失败" };
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
  const [atBottom, setAtBottom] = useState(true);
  
  // 新增: 用于存储 footer 高度的 state
  const [footerHeight, setFooterHeight] = useState(0);

  const virtuosoRef = useRef(null);
  const searchInputRef = useRef(null);
  const footerRef = useRef(null);
  const textareaRef = useRef(null);
  
  const defaultSettings = { 
      autoTranslate: false, autoPlayTTS: false,
      fontSize: 16, fontWeight: 'normal',
      sourceLang: '中文',
      targetLang: '缅甸语',
      ai: { endpoint: "https://open-gemini-api.deno.dev/v1/chat/completions", apiKey: "", model: "gemini-pro" } 
  };
  const [cfg, setCfg] = useState(() => { if (typeof window === 'undefined') return defaultSettings; try { const savedCfg = localStorage.getItem("private_chat_settings_v3"); return savedCfg ? { ...defaultSettings, ...JSON.parse(savedCfg) } : defaultSettings; } catch { return defaultSettings; } });

  useEffect(() => { if (typeof window !== 'undefined') { localStorage.setItem("private_chat_settings_v3", JSON.stringify(cfg)); } }, [cfg]);
  
  useEffect(() => {
    if (!chatId || !user) return;

    const messagesRef = collection(db, `privateChats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(5000));
    const unsub = onSnapshot(q, (snap) => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMessages(arr);
        if (arr.length > 0) { 
            const last = arr[arr.length - 1]; 
            if (last.uid !== user.uid) { 
                if (cfg.autoPlayTTS) playCachedTTS(last.text); 
                if (cfg.autoTranslate) handleTranslateMessage(last); 
            } 
        }
    }, (err) => console.error("监听消息错误:", err));
    
    return () => unsub();
  }, [chatId, user, cfg.autoPlayTTS, cfg.autoTranslate]);

  useEffect(() => { if (searchActive && searchInputRef.current) { searchInputRef.current.focus(); } }, [searchActive]);
  
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  // 新增: 测量 footer 高度并更新 state
  useEffect(() => {
    if (footerRef.current) {
        setFooterHeight(footerRef.current.offsetHeight);
    }
  }, [input, myTranslationResult]); // 当输入框内容或翻译建议变化时重新测量


  const filteredMessages = searchQuery ? messages.filter(msg => msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase())) : messages;

  const sendMessage = async (textToSend) => {
    const content = textToSend || input;
    if (!content.trim() || !user?.uid || !peerUser?.id) return;
    setSending(true);

    try {
        const chatDocRef = doc(db, "privateChats", chatId);
        const messagesRef = collection(chatDocRef, "messages");
        
        await addDoc(messagesRef, { 
            text: content.trim(), 
            uid: user.uid, 
            createdAt: serverTimestamp() 
        });

        await setDoc(chatDocRef, { 
            members: [user.uid, peerUser.id], 
            lastMessage: content.trim(),
            lastMessageAt: serverTimestamp()
        }, { merge: true });

        setInput("");
        setMyTranslationResult(null);
    } catch (e) {
        console.error("SendMessage Error:", e);
        alert(`发送失败: ${e.message}`);
    } finally {
        setSending(false);
    }
  };
  
  const handleRecallMessage = async (message) => {
    if (message.uid !== user.uid) return;
    const messageRef = doc(db, `privateChats/${chatId}/messages`, message.id);
    try {
      await updateDoc(messageRef, { text: "此消息已被撤回", recalled: true });
    } catch (error) { console.error("撤回消息失败:", error); alert("撤回失败"); }
  };

  const handleDeleteMessage = async (message) => {
    if (message.uid !== user.uid) return;
    const messageRef = doc(db, `privateChats/${chatId}/messages`, message.id);
    try {
      await deleteDoc(messageRef);
    } catch (error) { console.error("删除消息失败:", error); alert("删除失败"); }
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
    } catch (error) { console.error("发送更正失败:", error); alert("发送更正失败，请重试。"); }
  };
  
  const getMyInputPrompt = (sourceLang, targetLang) => 
    `你是一位精通${sourceLang}和${targetLang}的双语翻译专家。请将以下${sourceLang}文本翻译成${targetLang}。
要求：在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。
请严格遵循以下格式，只返回格式化的翻译结果，不要包含任何额外说明或标签：

**这里是${targetLang}翻译**
回译：这里是回译成${sourceLang}的内容`;

  const PeerMessagePrompt = `你是一位专业的缅甸语翻译家。请将以下缅甸语文本翻译成中文，要求自然直译版，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。你只需要返回翻译后的中文内容，不要包含任何额外说明、标签或原始文本。`;
  
  const handleTranslateMessage = async (message) => {
    setIsTranslating(true); setTranslationResult(null); setLongPressedMessage(null);
    try {
        const result = await callAIHelper(PeerMessagePrompt, message.text, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model);
        setTranslationResult({ messageId: message.id, text: result });
    } catch (error) { alert(error.message); } finally { setIsTranslating(false); }
  };
  
  const handleTranslateMyInput = async () => {
    if (!input.trim()) return;
    setIsTranslating(true); setMyTranslationResult(null);
    try {
        const prompt = getMyInputPrompt(cfg.sourceLang, cfg.targetLang);
        const resultText = await callAIHelper(prompt, input, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model);
        const parsedResult = parseSingleTranslation(resultText);
        setMyTranslationResult(parsedResult);
    } catch (error) { alert(error.message); } finally { setIsTranslating(false); }
  };
  
  const handleInputFocus = () => {
      // 当输入框聚焦时，通常键盘会弹出，我们延迟一小段时间来确保布局更新，然后滚动到底部
      setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'smooth' });
      }, 300);
  };

  const handleDeleteAllMessages = async () => { if (!window.confirm(`确定要删除与 ${peerUser?.displayName} 的全部聊天记录吗？此操作不可恢复！`)) return; alert("删除全部记录功能待实现。"); };
  const handleBlockUser = async () => { if (!window.confirm(`确定要拉黑 ${peerUser?.displayName} 吗？`)) return; alert("拉黑功能待实现。"); };

  const LongPressMenu = ({ message, onClose }) => {
    const mine = message.uid === user?.uid;
    const isPinyinVisible = showPinyinFor === message.id;
    return (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-2 flex flex-col gap-1 text-black border border-gray-200" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setShowPinyinFor(isPinyinVisible ? null : message.id); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><BookText size={18} /> {isPinyinVisible ? '隐藏拼音' : '显示拼音'}</button>
                {!message.recalled && <button onClick={() => { playCachedTTS(message.text); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><Volume2 size={18} /> 朗读</button>}
                {!message.recalled && <button onClick={() => { handleTranslateMessage(message); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><CircleTranslateIcon /> 翻译</button>}
                {!mine && !message.recalled && <button onClick={() => { setCorrectionMode({ active: true, message: message, text: message.text }); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><Pencil size={18} /> 改错</button>}
                {mine && !message.recalled && <button onClick={() => { handleRecallMessage(message); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full"><RotateCcw size={18} /> 撤回</button>}
                {mine && <button onClick={() => { handleDeleteMessage(message); onClose(); }} className="flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 rounded-md w-full text-red-500"><Trash2 size={18} /> 删除</button>}
            </div>
        </div>
    );
  };

  const MessageRow = ({ message, isLastMessage }) => {
    const mine = message.uid === user?.uid;
    const longPressTimer = useRef();
    const handleTouchStart = () => { longPressTimer.current = setTimeout(() => { setLongPressedMessage(message); }, 500); };
    const handleTouchEnd = () => { clearTimeout(longPressTimer.current); };
    const handleTouchMove = () => { clearTimeout(longPressTimer.current); };
    
    const messageStyle = { fontSize: `${cfg.fontSize}px`, fontWeight: cfg.fontWeight };
    const isPeersLastMessage = !mine && isLastMessage;

    return (
      <div className={`flex items-end gap-2 my-2 px-4 ${mine ? "flex-row-reverse" : ""}`}>
        <img src={mine ? user.photoURL : peerUser?.photoURL || '/img/avatar.svg'} alt="avatar" className="w-8 h-8 rounded-full mb-1 flex-shrink-0" />
        <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
          <div 
            onTouchStart={handleTouchStart} 
            onTouchEnd={handleTouchEnd} 
            onTouchMove={handleTouchMove} 
            onContextMenu={(e) => { e.preventDefault(); setLongPressedMessage(message); }} 
            className={`relative max-w-[70vw] sm:max-w-[70%] px-4 py-2 rounded-2xl ${mine ? "bg-blue-500 text-white rounded-br-none" : "bg-gray-200 text-black rounded-bl-none"}`}
          >
            {message.recalled ? (
              <p className="whitespace-pre-wrap break-words italic opacity-70 text-sm">此消息已被撤回</p>
            ) : message.correction ? (
              <div className="space-y-1">
                <p className="whitespace-pre-wrap break-words opacity-60 line-through" style={messageStyle}><PinyinText text={message.correction.originalText} showPinyin={showPinyinFor === message.id} /></p>
                <p className="whitespace-pre-wrap break-words text-green-600" style={messageStyle}><Check size={16} className="inline mr-1"/> <PinyinText text={message.correction.correctedText} showPinyin={showPinyinFor === message.id} /></p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words" style={messageStyle}><PinyinText text={message.text} showPinyin={showPinyinFor === message.id} /></p>
            )}
            {translationResult && translationResult.messageId === message.id && (
              <div className="mt-2 pt-2 border-t border-black/20">
                <p className="text-sm opacity-90 whitespace-pre-wrap">{translationResult.text}</p>
              </div>
            )}
          </div>
          {isPeersLastMessage && !message.recalled && (
              <button onClick={() => handleTranslateMessage(message)} className="self-end flex-shrink-0 active:scale-90 transition-transform duration-100" aria-label="翻译">
                  <CircleTranslateIcon />
              </button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    // 修改: 调整整体布局结构，让 footer 成为 main 的兄弟节点，而不是 main 覆盖 footer
    <div className="flex flex-col w-full h-full bg-white text-black" style={{ height: '100dvh' }}>
      <GlobalScrollbarStyle />
      
      <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 bg-gray-50 border-b border-gray-200 z-20 relative">
        <AnimatePresence>
            {searchActive ? (
                <motion.div key="search" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: '100%' }} exit={{ opacity: 0, width: 0 }} className="absolute inset-0 flex items-center px-4 bg-gray-100">
                    <input ref={searchInputRef} type="text" placeholder="搜索消息..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent text-black placeholder-gray-500 focus:outline-none" />
                    <button onClick={() => { setSearchActive(false); setSearchQuery(''); }} className="p-2 -mr-2 text-gray-600"><X/></button>
                </motion.div>
            ) : (
                <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-between w-full">
                    <div className="w-16"></div> 
                    <h1 className="font-bold text-lg text-black absolute left-1/2 -translate-x-1/2 truncate max-w-[50%]">{peerUser?.displayName || "聊天"}</h1>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setSearchActive(true)} className="p-2 text-gray-600"><Search /></button>
                        <button onClick={() => setSettingsOpen(true)} className="p-2 -mr-2 text-gray-600"><Settings /></button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </header>
      
      {/* 修改: 将 main 区域的布局改为绝对定位，并动态设置其 bottom 值 */}
      <main 
        className="absolute top-14 left-0 right-0 overflow-y-auto w-full thin-scrollbar overscroll-behavior-contain"
        style={{ bottom: `${footerHeight}px` }}
      >
         <Virtuoso 
            ref={virtuosoRef} 
            style={{ height: '100%' }} 
            data={filteredMessages} 
            atBottomStateChange={setAtBottom} 
            followOutput="auto" 
            itemContent={(index, msg) => (
                <MessageRow 
                    message={msg} 
                    key={msg.id}
                    isLastMessage={index === filteredMessages.length - 1}
                />
            )}
            // 移除这里的内部 Footer，因为我们用 padding 代替
         />
         <AnimatePresence>
            {!atBottom && (
                <motion.button 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  onClick={() => virtuosoRef.current.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'smooth' })} 
                  className="absolute bottom-4 right-4 z-10 bg-blue-500 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
                    <ArrowDown size={20}/>
                </motion.button>
            )}
         </AnimatePresence>
      </main>

      {/* 修改: 将 footer 改为绝对定位在底部 */}
      <footer ref={footerRef} className="absolute bottom-0 left-0 right-0 w-full bg-gray-50 border-t border-gray-200 z-10">
        <AnimatePresence>
            {myTranslationResult && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-gray-200 bg-white">
                    <div className="p-3 flex justify-between items-center">
                        <h4 className="text-sm font-bold text-gray-700">AI 翻译建议</h4>
                        <button onClick={() => setMyTranslationResult(null)} className="text-gray-500"><X size={18} /></button>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-3 pt-0 thin-scrollbar">
                        <div className="p-3 rounded-lg bg-gray-100 flex items-start gap-3">
                            <div className="flex-1 space-y-1">
                                <p className="font-bold text-blue-600 text-base">{myTranslationResult.translation}</p>
                                <p className="text-xs text-gray-500 font-bold">回译: {myTranslationResult.backTranslation}</p>
                            </div>
                            <button onClick={() => sendMessage(myTranslationResult.translation)} className="w-10 h-10 flex-shrink-0 bg-blue-500 text-white rounded-full flex items-center justify-center"><Send size={16}/></button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
        
        <div className="p-2">
          <div className="flex items-end w-full max-w-4xl mx-auto p-1.5 bg-gray-100 rounded-2xl border border-gray-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              onFocus={handleInputFocus}
              placeholder="输入消息..."
              className="flex-1 bg-transparent focus:outline-none text-black text-base resize-none overflow-y-auto max-h-[40vh] mx-2 py-2.5 leading-6 placeholder-gray-500 font-normal thin-scrollbar"
              rows="1"
            />
            <div className="flex items-center flex-shrink-0 ml-1 self-end">
                <button onClick={handleTranslateMyInput} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-blue-500 disabled:opacity-30" title="AI 翻译">
                    {isTranslating ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-blue-500"></div> : <CircleTranslateIcon />}
                </button>
                <button onClick={() => sendMessage()} disabled={sending || !input.trim()} className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md disabled:bg-gray-400 disabled:shadow-none transition-all ml-1">
                    <Send size={18} />
                </button>
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 z-50" onClick={() => setSettingsOpen(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="absolute bottom-0 w-full bg-gray-100 text-black p-4 rounded-t-2xl space-y-4 max-h-[80vh] overflow-y-auto thin-scrollbar border-t border-gray-200">
              <h3 className="text-lg font-semibold text-center">聊天设置</h3>
              <div className="p-3 rounded-lg bg-white space-y-3">
                    <h4 className="font-bold text-sm">样式</h4>
                    <label className="flex items-center justify-between text-sm"><span className="font-bold">字体大小 (px)</span><input type="number" value={cfg.fontSize} onChange={e => setCfg(c => ({...c, fontSize: parseInt(e.target.value)}))} className="w-20 p-1 text-center border rounded text-sm bg-white border-gray-300"/></label>
                    <label className="flex items-center justify-between text-sm"><span className="font-bold">字体粗细</span><select value={cfg.fontWeight} onChange={e => setCfg(c => ({...c, fontWeight: e.target.value}))} className="p-1 border rounded text-sm bg-white border-gray-300"><option value="400">常规</option><option value="700">粗体</option></select></label>
              </div>
              <div className="p-3 rounded-lg bg-white space-y-3">
                  <h4 className="font-bold text-sm">翻译语言</h4>
                  <label className="flex items-center justify-between text-sm">
                      <span className="font-bold">源语言 (你的语言)</span>
                      <input type="text" value={cfg.sourceLang} onChange={e => setCfg(c => ({...c, sourceLang: e.target.value}))} className="w-28 p-1 text-center border rounded text-sm bg-white border-gray-300"/>
                  </label>
                  <label className="flex items-center justify-between text-sm">
                      <span className="font-bold">目标语言 (对方语言)</span>
                      <input type="text" value={cfg.targetLang} onChange={e => setCfg(c => ({...c, targetLang: e.target.value}))} className="w-28 p-1 text-center border rounded text-sm bg-white border-gray-300"/>
                  </label>
              </div>
              <div className="p-3 rounded-lg bg-white space-y-2">
                  <h4 className="font-bold text-sm">AI翻译设置 (OpenAI兼容)</h4>
                  <input placeholder="接口地址" value={cfg.ai.endpoint} onChange={e => setCfg(c => ({...c, ai: {...c.ai, endpoint: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
                  <input placeholder="API Key" type="password" value={cfg.ai.apiKey} onChange={e => setCfg(c => ({...c, ai: {...c.ai, apiKey: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
                  <input placeholder="模型 (e.g., gemini-pro)" value={cfg.ai.model} onChange={e => setCfg(c => ({...c, ai: {...c.ai, model: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
              </div>
              <div className="p-3 rounded-lg bg-white space-y-2">
                   <h4 className="font-bold text-sm">自动化</h4>
                   <label className="flex items-center justify-between text-sm"><span className="font-bold">自动朗读对方消息</span><input type="checkbox" checked={cfg.autoPlayTTS} onChange={e => setCfg(c => ({...c, autoPlayTTS: e.target.checked}))} className="h-5 w-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"/></label>
                   <label className="flex items-center justify-between text-sm"><span className="font-bold">自动翻译对方消息</span><input type="checkbox" checked={cfg.autoTranslate} onChange={e => setCfg(c => ({...c, autoTranslate: e.target.checked}))} className="h-5 w-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"/></label>
              </div>
              <div className="p-3 rounded-lg bg-white space-y-2">
                  <h4 className="font-bold text-sm text-red-500">危险操作</h4>
                  <button onClick={handleDeleteAllMessages} className="w-full text-left p-2 hover:bg-red-500/10 rounded-md text-red-500 font-bold text-sm">删除全部聊天记录</button>
                  <button onClick={handleBlockUser} className="w-full text-left p-2 hover:bg-red-500/10 rounded-md text-red-500 font-bold text-sm">拉黑对方</button>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="w-full mt-2 p-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md">关闭</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {longPressedMessage && <LongPressMenu message={longPressedMessage} onClose={() => setLongPressedMessage(null)} />}
      
      <AnimatePresence>
          {correctionMode.active && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md bg-white text-black border border-gray-200 rounded-lg shadow-xl p-4 space-y-3">
                      <h3 className="font-bold text-lg">修改消息</h3>
                      <p className="text-sm p-3 bg-gray-100 rounded-md">{correctionMode.message.text}</p>
                      <textarea value={correctionMode.text} onChange={e => setCorrectionMode(c => ({...c, text: e.target.value}))} rows={4} className="w-full p-2 border rounded bg-white border-gray-300" />
                      <div className="flex justify-end gap-2">
                          <button onClick={() => setCorrectionMode({ active: false, message: null, text: ''})} className="px-4 py-2 rounded-md bg-gray-200 text-sm">取消</button>
                          <button onClick={sendCorrection} className="px-4 py-2 rounded-md bg-blue-500 text-white text-sm">确认修改</button>
                      </div>
                  </motion.div>
              </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
