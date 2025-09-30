// /components/ChatInterface.js (V9 - 全面重构版)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from 'next/router';
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Settings, ArrowLeft, X, Volume2, Pencil, Check, Trash2, RotateCcw } from "lucide-react";

// 全局样式，用于美化滚动条 (极细样式)
const GlobalScrollbarStyle = () => (
    <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar {
            width: 2px;
        }
        .thin-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb {
            background-color: #cccccc;
            border-radius: 20px;
        }
        .thin-scrollbar:hover::-webkit-scrollbar-thumb {
            background-color: #aaaaaa;
        }
    `}</style>
);


// 组件与图标
const CircleTranslateIcon = () => (
    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm text-gray-600 font-bold shadow-sm border border-gray-200">
        译
    </div>
);

// 功能模块
const callAIHelper = async (prompt, textToTranslate, apiKey, apiEndpoint, model) => {
    if (!apiKey || !apiEndpoint) { throw new Error("请在设置中配置AI翻译接口地址和密钥。"); }
    const fullPrompt = `${prompt}\n\n需要翻译的文本如下：\n"""\n${textToTranslate}\n"""`;
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

// 【新】简化版翻译解析函数
const parseSimpleTranslation = (text) => {
    const translatedMatch = text.match(/【翻译】\s*[:：]?\s*(.*)/);
    const backTranslationMatch = text.match(/【回译】\s*[:：]?\s*(.*)/);

    return {
        translatedText: translatedMatch ? translatedMatch[1].trim() : "翻译解析失败",
        backTranslation: backTranslationMatch ? backTranslationMatch[1].trim() : "回译解析失败",
    };
};

export default function ChatInterface({ chatId, currentUser }) {
  const router = useRouter();
  const user = currentUser;

  // ----- State -----
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [peerUser, setPeerUser] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [longPressedMessage, setLongPressedMessage] = useState(null);
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [myTranslation, setMyTranslation] = useState(null);
  const [correctionMode, setCorrectionMode] = useState({ active: false, message: null, text: '' });
  
  const virtuosoRef = useRef(null);
  const textareaRef = useRef(null);
  const footerRef = useRef(null);
  const [footerHeight, setFooterHeight] = useState(80); // 预估初始高度

  // 【新】默认设置，简化并适配白色主题
  const defaultSettings = { 
      autoPlayTTS: false, 
      autoTranslate: false, 
      translationDirection: 'zh-my', // 'zh-my' 或 'my-zh'
      fontSize: 16,
      fontWeight: 'normal',
      ai: { 
          endpoint: "https://open-gemini-api.deno.dev/v1/chat/completions", 
          apiKey: "", 
          model: "gemini-pro",
      } 
  };
  const [cfg, setCfg] = useState(() => { if (typeof window === 'undefined') return defaultSettings; try { const savedCfg = localStorage.getItem("private_chat_settings_v2"); return savedCfg ? { ...defaultSettings, ...JSON.parse(savedCfg) } : defaultSettings; } catch { return defaultSettings; } });

  useEffect(() => { if (typeof window !== 'undefined') { localStorage.setItem("private_chat_settings_v2", JSON.stringify(cfg)); } }, [cfg]);

  // 获取聊天对象信息 & 监听消息
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    
    const members = chatId.split('_');
    const peerUid = members.find(uid => uid !== user.uid);

    if (peerUid) {
        getDoc(doc(db, 'users', peerUid)).then(userDoc => {
            if (userDoc.exists()) {
                setPeerUser({ id: userDoc.id, ...userDoc.data() });
            }
        });
    }

    const messagesRef = collection(db, `privateChats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(5000));
    const unsub = onSnapshot(q, async (snap) => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMessages(arr);
    }, (err) => { console.error("监听消息错误:", err); });
    
    return () => unsub();
  }, [chatId, user?.uid]);
  
  // 动态计算footer高度以修复消息遮挡问题
  useEffect(() => {
    if (footerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          setFooterHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(footerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const sendMessage = async (textToSend) => {
    const content = textToSend || input;
    if (!content.trim() || !chatId || !user || !user.uid) return;
    setSending(true);
    try {
      const messagesRef = collection(db, `privateChats/${chatId}/messages`);
      await addDoc(messagesRef, { text: content.trim(), uid: user.uid, createdAt: serverTimestamp() });
      setInput("");
      setMyTranslation(null); // 发送后清除翻译结果
    } catch (e) { console.error(e); alert("发送失败：" + e.message); }
    finally { setSending(false); }
  };
  
  // 【新】简化后的翻译提示词
  const translationPrompt = `你是一位专业的翻译家。请将用户提供的文本进行自然直译，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。你的回复必须严格遵循以下格式，不要添加任何额外的解释或内容：
【翻译】：[这里是翻译后的内容]
【回译】：[这里是将翻译内容再翻译回源语言的内容]`;
  
  const getPromptForDirection = (direction) => {
      if (direction === 'zh-my') return `请将以下中文文本翻译成缅甸语。${translationPrompt}`;
      return `请将以下缅甸语文本翻译成中文。${translationPrompt}`;
  };

  const handleTranslateMessage = async (message) => {
    setIsTranslating(true); setTranslationResult(null); setLongPressedMessage(null);
    try {
        const prompt = getPromptForDirection('my-zh'); // 对方消息总是缅译中
        const resultText = await callAIHelper(prompt, message.text, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model);
        const parsed = parseSimpleTranslation(resultText);
        setTranslationResult({ messageId: message.id, text: parsed.translatedText });
    } catch (error) { alert(error.message); } finally { setIsTranslating(false); }
  };
  
  const handleTranslateMyInput = async () => {
    if (!input.trim()) return;
    setIsTranslating(true); setMyTranslation(null);
    try {
        const prompt = getPromptForDirection(cfg.translationDirection);
        const resultText = await callAIHelper(prompt, input, cfg.ai.apiKey, cfg.ai.endpoint, cfg.ai.model);
        const parsed = parseSimpleTranslation(resultText);
        setMyTranslation(parsed);
    } catch (error) { alert(error.message); } finally { setIsTranslating(false); }
  };

  const MessageRow = ({ message }) => {
    const mine = message.uid === user?.uid;

    const messageStyle = {
      fontSize: `${cfg.fontSize}px`,
      fontWeight: cfg.fontWeight,
    };

    return (
      <div className={`flex items-end gap-2 my-2 ${mine ? "flex-row-reverse" : ""}`}>
        <img src={mine ? user.photoURL : peerUser?.photoURL || '/img/avatar.svg'} alt="avatar" className="w-8 h-8 rounded-full mb-1 flex-shrink-0" />
        <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
          <div className={`relative max-w-[70vw] sm:max-w-[70%] px-4 py-2 rounded-2xl ${mine ? "bg-blue-500 text-white rounded-br-none" : "bg-gray-200 text-black rounded-bl-none"}`}>
            <p className="whitespace-pre-wrap break-words" style={messageStyle}>{message.text}</p>
            {translationResult && translationResult.messageId === message.id && (
              <div className="mt-2 pt-2 border-t border-black/20">
                <p className="text-sm opacity-90 whitespace-pre-wrap">{translationResult.text}</p>
              </div>
            )}
          </div>
          {!mine && (
              <button onClick={() => handleTranslateMessage(message)} className="self-end flex-shrink-0 active:scale-90 transition-transform duration-100" aria-label="翻译">
                  <CircleTranslateIcon />
              </button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full w-full bg-white">
      <GlobalScrollbarStyle />
      
      <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 bg-gray-50 border-b border-gray-200 z-20 relative">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-600"><ArrowLeft /></button>
          <h1 className="font-bold text-lg text-black absolute left-1/2 -translate-x-1/2 truncate max-w-[60%]">{peerUser?.displayName || "聊天"}</h1>
          <button onClick={() => setSettingsOpen(true)} className="p-2 -mr-2 text-gray-600"><Settings /></button>
      </header>

      <main className="flex-1 overflow-hidden relative" style={{ paddingBottom: `${footerHeight}px`}}>
         <Virtuoso ref={virtuosoRef} className="thin-scrollbar" style={{ height: '100%' }} data={messages} itemContent={(index, msg) => <MessageRow message={msg} key={msg.id} />} followOutput="auto" />
      </main>

      <footer ref={footerRef} className="absolute bottom-0 left-0 right-0 w-full flex-shrink-0 bg-gray-50 border-t border-gray-200 z-10">
        <AnimatePresence>
            {myTranslation && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-3 border-b border-gray-200 bg-white">
                    <div className="p-3 rounded-lg bg-gray-100 flex items-start gap-3">
                        <div className="flex-1 space-y-1">
                            <p className="font-bold text-blue-600 text-base">{myTranslation.translatedText}</p>
                            <p className="text-xs text-gray-500 font-bold">回译: {myTranslation.backTranslation}</p>
                        </div>
                        <button onClick={() => sendMessage(myTranslation.translatedText)} className="w-10 h-10 flex-shrink-0 bg-blue-500 text-white rounded-full flex items-center justify-center"><Send size={16}/></button>
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
              placeholder="输入消息..."
              className="flex-1 bg-transparent focus:outline-none text-black text-base resize-none overflow-y-auto max-h-40 mx-2 py-2.5 leading-6 placeholder-gray-500 font-normal thin-scrollbar"
              rows="1"
            />
            <div className="flex items-center flex-shrink-0 ml-1 self-end">
                <button onClick={handleTranslateMyInput} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-blue-500 disabled:opacity-30" title="AI翻译">
                    {isTranslating ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-blue-500"></div> : '译'}
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
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="absolute bottom-0 w-full bg-gray-100 text-black p-4 rounded-t-2xl space-y-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-center">聊天设置</h3>
              <div className="p-3 rounded-lg bg-white space-y-2">
                  <h4 className="font-bold text-sm">AI翻译设置 (OpenAI兼容)</h4>
                  <input placeholder="接口地址" value={cfg.ai.endpoint} onChange={e => setCfg(c => ({...c, ai: {...c.ai, endpoint: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
                  <input placeholder="API Key" type="password" value={cfg.ai.apiKey} onChange={e => setCfg(c => ({...c, ai: {...c.ai, apiKey: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
                  <input placeholder="模型 (e.g., gemini-pro)" value={cfg.ai.model} onChange={e => setCfg(c => ({...c, ai: {...c.ai, model: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-white border-gray-300 placeholder-gray-400"/>
              </div>
              <div className="p-3 rounded-lg bg-white space-y-3">
                   <h4 className="font-bold text-sm">翻译方向 (输入框)</h4>
                   <div className="flex space-x-4">
                        <label className="flex items-center gap-2 text-sm"><input type="radio" name="translationDirection" value="zh-my" checked={cfg.translationDirection === 'zh-my'} onChange={e => setCfg(c => ({...c, translationDirection: e.target.value}))} /> 中文 → 缅甸语</label>
                        <label className="flex items-center gap-2 text-sm"><input type="radio" name="translationDirection" value="my-zh" checked={cfg.translationDirection === 'my-zh'} onChange={e => setCfg(c => ({...c, translationDirection: e.target.value}))} /> 缅甸语 → 中文</label>
                   </div>
              </div>
              <div className="p-3 rounded-lg bg-white space-y-2">
                   <label className="flex items-center justify-between text-sm"><span className="font-bold">自动朗读对方消息</span><input type="checkbox" checked={cfg.autoPlayTTS} onChange={e => setCfg(c => ({...c, autoPlayTTS: e.target.checked}))} className="h-5 w-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"/></label>
                   <label className="flex items-center justify-between text-sm"><span className="font-bold">自动翻译对方消息</span><input type="checkbox" checked={cfg.autoTranslate} onChange={e => setCfg(c => ({...c, autoTranslate: e.target.checked}))} className="h-5 w-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"/></label>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="w-full mt-2 p-2 text-sm bg-gray-200 rounded-md">关闭</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
