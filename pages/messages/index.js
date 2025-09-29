// /pages/messages/index.js (已修复 self is not defined 错误)

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic'; // 引入 dynamic
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { HiOutlineChatBubbleLeftRight, HiOutlineBell, HiOutlineGlobeAlt, HiOutlineUsers } from 'react-icons/hi2';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';

// ------------------------------------------------------------------
// MessageHeader 组件 (无变动)
// ------------------------------------------------------------------
const MessageHeader = ({ activeTab, setActiveTab }) => {
    // ... 代码保持不变
    const tabs = [
        { key: 'messages', name: '私信', icon: <HiOutlineChatBubbleLeftRight className="w-6 h-6" /> },
        { key: 'notifications', name: '通知', icon: <HiOutlineBell className="w-6 h-6" /> },
        { key: 'discover', name: '发现', icon: <HiOutlineGlobeAlt className="w-6 h-6" /> },
        { key: 'contacts', name: '联系人', icon: <HiOutlineUsers className="w-6 h-6" /> },
    ];
    const baseClasses = "flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1/4 transition-colors duration-300";
    const activeClasses = "text-white scale-110";
    const inactiveClasses = "text-white/70 hover:text-white";
    return (
        <div className="flex justify-around sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 shadow-md z-10">
        {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`${baseClasses} ${activeTab === tab.key ? activeClasses : inactiveClasses}`}>
            {tab.icon}
            <span className="text-xs mt-1">{tab.name}</span>
            <div className={`w-8 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.key ? 'bg-white' : 'bg-transparent'}`}></div>
            </button>
        ))}
        </div>
    );
};

// ------------------------------------------------------------------
// 【核心修复】将 ConversationList 动态导入，并禁用 SSR
// ------------------------------------------------------------------
const ConversationListWithNoSSR = dynamic(
  () => import('@/components/ConversationList'), // 我们将把 ConversationList 的逻辑移到一个新文件
  { ssr: false } // 这行是关键！
);

// ------------------------------------------------------------------
// 主页面组件
// ------------------------------------------------------------------
const MessageListPage = () => {
  const [activeTab, setActiveTab] = useState('messages');

  const renderContent = () => {
    switch (activeTab) {
      case 'messages':
        return <ConversationListWithNoSSR />;
      case 'notifications':
        return <div className="p-8 text-center text-gray-500">通知功能正在开发中...</div>;
      case 'discover':
        return <div className="p-8 text-center text-gray-500">发现功能正在开发中...</div>;
      case 'contacts':
        return <div className="p-8 text-center text-gray-500">联系人功能正在开发中...</div>;
      default:
        return null;
    }
  };

  return (
    <LayoutBase>
        <div className="flex flex-col min-h-screen bg-white dark:bg-black">
            <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    </LayoutBase>
  );
};

export default MessageListPage;
