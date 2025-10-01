// FullScreenChatComponent.jsx
// A full-screen, elegant chat component for NotionNext + Firebase Firestore.
// - Top header is fixed
// - Message list fills remaining space and auto-scrolls
// - Input area automatically raises when mobile keyboard appears (uses visualViewport)
// - Supports real-time messages with Firestore
// - Uses Tailwind CSS for styling (make sure Tailwind is set up in your project)
// - Replace the firebase config and init with your app's configuration

import React, { useEffect, useState, useRef } from "react";
import { getFirestore, collection, query, orderBy, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { getApp, initializeApp } from "firebase/app";

// ----------- Replace with your Firebase config or import your firebase app/init -----------
// If you already initialize Firebase elsewhere, comment out the initializeApp block and import your app.
const firebaseConfig = {
  // apiKey: "YOUR_API_KEY",
  // authDomain: "YOUR_AUTH_DOMAIN",
  // projectId: "YOUR_PROJECT_ID",
};

let app;
try {
  app = getApp();
} catch (e) {
  // initialize only if not already initialized
  app = initializeApp(firebaseConfig);
}
const db = getFirestore(app);
// -----------------------------------------------------------------------------------------

export default function FullScreenChat({ chatId = "global-chat", user = { uid: "anon", name: "游客" } }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // VisualViewport handling for mobile keyboard (auto-raise input)
  useEffect(() => {
    const vv = window.visualViewport;
    function onViewport() {
      if (!containerRef.current) return;
      const bottomOffset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      // set CSS variable to be used for bottom padding
      containerRef.current.style.setProperty("--kbd-offset", `${bottomOffset}px`);
    }
    onViewport();
    if (vv) {
      vv.addEventListener("resize", onViewport);
      vv.addEventListener("scroll", onViewport);
    }
    window.addEventListener("resize", onViewport);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", onViewport);
        vv.removeEventListener("scroll", onViewport);
      }
      window.removeEventListener("resize", onViewport);
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!listRef.current) return;
    // smooth scroll to bottom
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
      // you can show a toast here
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={containerRef} className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-white to-slate-50">
      {/* Top fixed header */}
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

      {/* spacer to account for fixed header */}
      <div className="h-20" />

      {/* Messages area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pb-[calc(96px+var(--kbd-offset,0px))]">
        <div ref={listRef} className="h-full overflow-y-auto" style={{ height: `calc(100vh - 20rem)` }}>
          <div className="flex flex-col gap-3 py-4">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 py-8">还没有消息，来发第一条吧！</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[85%] ${m.senderId === (user.uid || 'anon') ? 'self-end' : 'self-start'}`}>
                <div className={`${m.senderId === (user.uid || 'anon') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'} border px-3 py-2 rounded-2xl shadow-sm`}>
                  <div className="text-xs text-slate-500">{m.senderName}</div>
                  <div className="mt-1 text-sm whitespace-pre-wrap break-words">{m.text}</div>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 ml-1">{m.createdAt && m.createdAt.toDate ? new Date(m.createdAt.toDate()).toLocaleString() : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Input area - fixed to bottom naturally by layout and visualViewport CSS variable */}
      <form onSubmit={handleSend} className="w-full fixed bottom-0 left-0 z-40 backdrop-blur-md bg-white/70 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-end gap-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autosizeTextarea(e.target); }}
              onFocus={() => { /* optional: scroll list into view */ if (listRef.current) setTimeout(() => listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 120); }}
              placeholder="输入消息，按回车发送（Shift+Enter 换行）"
              className="w-full resize-none min-h-[44px] max-h-[200px] rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              rows={1}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button type="button" onClick={() => { setInput(''); if (inputRef.current) inputRef.current.focus(); }} className="text-xs px-2 py-1 rounded-md border">清空</button>
              <button type="submit" disabled={sending || !input.trim()} className="text-xs px-3 py-1 rounded-md bg-emerald-600 text-white disabled:opacity-50">{sending ? '发送中...' : '发送'}</button>
            </div>
          </div>

          <div className="w-12 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center">A</div>
          </div>
        </div>
      </form>
    </div>
  );
}
