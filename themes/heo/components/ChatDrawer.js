// themes/heo/components/ChatDrawer.js

import React from 'react';
import ChatWindow from './ChatWindow'; // 导入我们强大的聊天窗口组件

const ChatDrawer = ({ isOpen, onClose, conversation }) => {
  return (
    <>
      {/* 遮罩层 */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* 抽屉内容 */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '85dvh' }} // 使用 dvh 获得最佳体验
      >
        {/* 我们不需要顶部横条，因为ChatWindow有自己的头部 */}
        {isOpen && conversation && (
          <ChatWindow chatId={conversation.id} conversation={conversation} />
        )}
      </div>
    </>
  );
};

export default ChatDrawer;
