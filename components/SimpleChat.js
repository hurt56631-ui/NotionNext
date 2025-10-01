// /components/SimpleChat.js
// 这是一个极简化的聊天布局组件，用于隔离和解决移动端软键盘问题。
import React, { useState } from 'react';

export default function SimpleChat() {
  const [messages, setMessages] = useState(() => 
    Array.from({ length: 30 }, (_, i) => ({ id: i, text: `这是消息 ${i + 1}` }))
  );
  const [input, setInput] = useState('');

  const handleSendMessage = () => {
    if (input.trim()) {
      setMessages([...messages, { id: Date.now(), text: input.trim() }]);
      setInput('');
      // 实际应用中，发送后需要滚动到底部
    }
  };

  return (
    // 1. 最外层容器：这是解决问题的关键
    // - `h-screen` (或 style={{ height: '100dvh' }})：强制容器占据整个屏幕的可视高度。
    // - `flex flex-col`：启用 Flexbox 垂直布局。
    // - `overflow-hidden`：【核心】禁止这个容器本身滚动。这会强制浏览器在容器内部解决溢出问题，而不是滚动整个页面。
    // - `bg-gray-200`：设置背景色以便清晰地看到边界。
    <div className="flex flex-col h-screen overflow-hidden bg-gray-200 text-black">

      {/* 2. 顶部面板 (Header) */}
      {/* - `flex-shrink-0`：禁止此元素在空间不足时被压缩，确保其高度恒定。 */}
      <header className="flex items-center justify-center p-4 bg-white shadow-md flex-shrink-0 z-10">
        <h1 className="text-lg font-bold">固定的用户名</h1>
      </header>

      {/* 3. 消息列表区域 (Main) */}
      {/* - `flex-1`：让此元素占据所有剩余的可用空间。
      {/* - `overflow-y-auto`：当内容超出此区域的高度时，为此区域提供一个内部的垂直滚动条。 */}
      <main className="flex-1 overflow-y-auto p-4">
        {messages.map(msg => (
          <div key={msg.id} className="p-2 mb-2 bg-blue-500 text-white rounded-lg max-w-xs">
            {msg.text}
          </div>
        ))}
        {/* 这是一个占位符，用于滚动到底部 */}
        <div id="messages-end" style={{ height: '1px' }} />
      </main>

      {/* 4. 底部输入框 (Footer) */}
      {/* - `flex-shrink-0`：同样，禁止此元素被压缩。 */}
      <footer className="bg-white p-2 border-t border-gray-300 flex-shrink-0">
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
            className="flex-1 p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="1"
          />
          <button
            onClick={handleSendMessage}
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md font-semibold"
          >
            发送
          </button>
        </div>
      </footer>

    </div>
  );
}
