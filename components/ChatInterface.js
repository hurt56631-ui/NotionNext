// /components/ChatInterface.js (极简测试版)

import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react'; // 只保留一个图标用于测试

export default function ChatInterface({ chatId, currentUser, peerUser }) {
  // 我们不再从 Firebase 加载消息，而是使用一些假的静态消息来填充界面
  const [messages, setMessages] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      text: `这是一条测试消息 ${i + 1}。当软键盘弹出时，布局应该保持不变。`,
      // 模拟你和他人的消息
      isMine: i % 4 === 0,
    }))
  );

  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // 一个简单的发送函数，只在前端追加消息，不连接数据库
  const handleSendMessage = () => {
    if (input.trim()) {
      setMessages([...messages, { id: Date.now(), text: input.trim(), isMine: true }]);
      setInput('');
    }
  };

  // 每次消息列表变化时，自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    // 1. 最外层容器：这是解决问题的关键！
    // - `flex flex-col`：启用 Flexbox 垂直布局。
    // - `h-screen`：强制容器占据整个屏幕的可视高度。
    // - `overflow-hidden`：【核心】禁止这个容器本身滚动，强制内部滚动。
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100 text-black">

      {/* 2. 固定的顶部面板 (Header) */}
      {/* - `flex-shrink-0`：确保其高度恒定，不会被压缩。 */}
      <header className="flex items-center justify-center p-4 bg-white shadow-md flex-shrink-0 z-10">
        {/* 我们仍然使用从页面传过来的 peerUser 数据来显示名字 */}
        <h1 className="text-lg font-bold">{peerUser?.displayName || '聊天'}</h1>
      </header>

      {/* 3. 可滚动的消息列表区域 (Main) */}
      {/* - `flex-1`：让此区域占据所有剩余的可用空间。 */}
      {/* - `overflow-y-auto`：内容超出时，只在此区域内部滚动。 */}
      <main className="flex-1 overflow-y-auto p-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex mb-3 ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-xs shadow ${msg.isMine ? 'bg-blue-500 text-white' : 'bg-white'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {/* 这是一个用于自动滚动的隐形锚点 */}
        <div ref={messagesEndRef} />
      </main>

      {/* 4. 固定的底部输入框 (Footer) */}
      {/* - `flex-shrink-0`：同样，确保其高度恒定。 */}
      <footer className="bg-white p-2 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="输入消息..."
            className="flex-1 p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="1"
          />
          <button
            onClick={handleSendMessage}
            className="ml-2 w-12 h-10 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
