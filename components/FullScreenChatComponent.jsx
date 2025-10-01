// /components/FullScreenChatComponent.jsx (最终修复版 - 支持 iOS/Android 自动抬高)

import React, { useEffect, useState, useRef } from "react";
import { db } from '@/lib/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

export default function FullScreenChat({ chatId = "global-chat", user = { uid: "anon", name: "游客" } }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // ✅ 核心修复：使用你的新 visualViewport 逻辑直接修改 form 的 bottom 样式
  useEffect(() => {
    const vv = window.visualViewport;
    // 注意：我们直接在 return 的 JSX 中给 form 添加 id，所以这里可以获取到
    const formEl = document.getElementById("chat-input-form");

    function onViewport() {
      if (!formEl || !vv) return;
      // 计算键盘的精确高度
      const bottomOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // 直接设置 form 的 bottom 样式，让它“浮”在键盘上
      formEl.style.bottom = bottomOffset + "px";
    }

    if (vv) {
      vv.addEventListener("resize", onViewport);
      vv.addEventListener("scroll", onViewport);
      onViewport(); // 初始执行一次以防万一
    }

    return () => {
      if (vv) {
        vv.removeEventListener("resize", onViewport);
        vv.removeEventListener("scroll", onViewport);
      }
      // 组件卸载时，恢复 form 的位置
      if (formEl) {
        formEl.style.bottom = "0px";
      }
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Firestore real-time subscription
  useEffect(() => {
    const col = collection(db, "chats", chatId, "messages");
    const q = query(col, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
      setMessages(docs);
    });
    return () => unsub();
  }, [chatId]);

  // Input autosize for textarea
  function autosizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(200, el.scrollHeight)}px`;
  }

  async function handleSend(e) {
    e && e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setSending(true);
    try {
      const col = collection(db, "chats", chatId, "messages");
      await addDoc(col, {
        text,
        senderId: user.uid || "anon",
        senderName: user.name || "游客",
        createdAt: serverTimestamp(),
      });
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    } catch (err) {
      console.error("send failed", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={containerRef} className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-white to-slate-50">
      <header className="w-full fixed top-0 left-0 z-30 backdrop-blur-md bg-white/60 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-semibold">汉</div>
            <div>
              <div className="text-sm font-semibold">NotionNext 中文社区</div>
              <div className="text-xs text-slate-500">实时交流 · 轻量 · 响应式</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-3 py-1 rounded-md text-sm border hover:bg-slate-100">频道</button>
            <button className="px-3 py-1 rounded-md text-sm border hover:bg-slate-100">成员</button>
            <button className="px-3 py-1 rounded-md text-sm bg-slate-800 text-white rounded-lg">发帖</button>
          </div>
        </div>
      </header>

      {/* spacer to account for fixed header, 这里的 h-20 也可以根据你的 header 高度微调 */}
      <div className="h-20 flex-shrink-0" />

      {/* Messages area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 overflow-y-auto">
         <div ref={listRef} className="h-full">
            <div className="flex flex-col gap-3 py-4">
              {messages.length === 0 && (
                <div className="text-center text-slate-400 py-8">还没有消息，来发第一条吧！</div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col max-w-[85%] ${m.senderId === (user.uid || 'anon') ? 'self-end items-end' : 'self-start items-start'}`}>
                  <div className={`${m.senderId === (user.uid || 'anon') ? 'bg-emerald-500 text-white' : 'bg-white border-slate-200 border'} px-3 py-2 rounded-2xl shadow-sm`}>
                    <div className="text-xs font-semibold mb-1">{m.senderName}</div>
                    <div className="text-base whitespace-pre-wrap break-words">{m.text}</div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 px-1">{m.createdAt && m.createdAt.toDate ? new Date(m.createdAt.toDate()).toLocaleTimeString() : ''}</div>
                </div>
              ))}
            </div>
          </div>
      </main>
      
      {/* spacer for the input form */}
      <div className="h-24 flex-shrink-0" />

      {/* ✅ 核心修复：为 form 添加 id="chat-input-form" */}
      <form
        id="chat-input-form"
        onSubmit={handleSend}
        className="w-full fixed left-0 z-40 backdrop-blur-md bg-white/70 border-t border-slate-200 transition-all duration-150"
        style={{ bottom: 0 }} // 初始 bottom 为 0
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-end gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autosizeTextarea(e.target); }}
              onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="输入消息..."
              className="w-full resize-none min-h-[44px] max-h-[200px] rounded-xl border border-slate-300 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400"
              rows={1}
            />
          </div>
          <button type="submit" disabled={sending || !input.trim()} className="w-20 h-11 flex items-center justify-center rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50 transition-all">
            {sending ? '...' : '发送'}
          </button>
        </div>
      </form>
    </div>
  );
}
