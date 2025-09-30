// /components/MessagesPageContent.js (最终修复版)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { HiOutlineChatBubbleLeftRight, HiOutlineBell, HiOutlineGlobeAlt, HiOutlineUsers } from 'react-icons/hi2';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';

// MessageHeader 组件 (无变动)
const MessageHeader = ({ activeTab, setActiveTab }) => {
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

// ConversationList 组件 (已修复查询和路由逻辑)
const ConversationList = () => {
    const { user } = useAuth();
    const router = useRouter();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) { setLoading(false); return; }

        // 【核心查询修复】移除 orderBy 子句以避免Firebase错误。我们将在客户端进行排序。
        const chatsQuery = query(
            collection(db, 'privateChats'), 
            where('members', 'array-contains', user.uid)
        );

        const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
            setLoading(true);
            const chatPromises = snapshot.docs.map(async (chatDoc) => {
                const chatData = chatDoc.data();
                const otherUserId = chatData.members.find(id => id !== user.uid);
                
                // 如果找不到对方ID，或ID无效，则跳过此会话
                if (!otherUserId || typeof otherUserId !== 'string' || otherUserId.trim() === '') return null;

                const userProfileDoc = await getDoc(doc(db, 'users', otherUserId));
                const otherUser = userProfileDoc.exists() 
                    ? { id: userProfileDoc.id, ...userProfileDoc.data() } 
                    : { id: otherUserId, displayName: '未知用户', photoURL: '/img/avatar.svg' };

                // 【修复未读逻辑】使用更安全的空值检查
                const lastReadTimestamp = chatData.lastRead?.[user.uid]?.toDate();
                const lastMessageTimestamp = chatData.lastMessageAt?.toDate(); // 使用 lastMessageAt 作为排序和判断依据
                const isUnread = !!(lastMessageTimestamp && (!lastReadTimestamp || lastMessageTimestamp > lastReadTimestamp));

                return { 
                    id: chatDoc.id, 
                    ...chatData, 
                    otherUser, 
                    isUnread,
                    sortTimestamp: lastMessageTimestamp || chatData.createdAt?.toDate() || new Date(0) // 提供一个用于排序的时间戳
                };
            });
            const resolvedChats = (await Promise.all(chatPromises)).filter(Boolean);

            // 【核心查询修复】在客户端进行排序
            resolvedChats.sort((a, b) => b.sortTimestamp - a.sortTimestamp);

            setConversations(resolvedChats);
            setLoading(false);
        }, (error) => {
            console.error("获取会话列表时出错: ", error);
            alert("无法加载会话列表，请检查您的网络连接和Firebase控制台的索引设置。");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);
    
    // 【核心路由修复】构建正确的 chatId 并跳转
    const handleConversationClick = (convo) => {
        // 安全检查，确保所有需要的信息都存在
        if (!user?.uid || !convo.otherUser?.id) {
            alert("用户信息不完整，无法进入聊天。");
            return;
        }

        const uids = [user.uid, convo.otherUser.id];

        // 再次验证UID的有效性
        if (uids.some(uid => !uid || typeof uid !== 'string' || uid.trim() === '')) {
            alert("用户ID无效，无法创建聊天。");
            return;
        }

        // 创建正确的 chatId 并跳转
        const chatId = uids.sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    if (loading) { return <div className="p-8 text-center text-gray-500">正在加载私信...</div>; }
    if (!user) { return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>; }
    if (conversations.length === 0) { return <div className="p-8 text-center text-gray-500">还没有任何私信哦。</div>; }

    return (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {conversations.map(convo => (
                <li key={convo.id} onClick={() => handleConversationClick(convo)} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <div className="relative">
                        <img src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className="w-14 h-14 rounded-full object-cover" />
                        {convo.isUnread && (<span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 border-2 border-white dark:border-gray-900" />)}
                    </div>
                    <div className="ml-4 flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold truncate dark:text-gray-200">{convo.otherUser.displayName || '未知用户'}</p>
                            {convo.sortTimestamp && (
                                <p className="text-xs text-gray-400">
                                    {new Date(convo.sortTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-1">{convo.lastMessage || '...'}</p>
                    </div>
                </li>
            ))}
        </ul>
    );
};

// 主页面组件 (无变动)
const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');

  const renderContent = () => {
    switch (activeTab) {
      case 'messages': return <ConversationList />;
      case 'notifications': return <div className="p-8 text-center text-gray-500">通知功能正在开发中...</div>;
      case 'discover': return <div className="p-8 text-center text-gray-500">发现功能正在开发中...</div>;
      case 'contacts': return <div className="p-8 text-center text-gray-500">联系人功能正在开发中...</div>;
      default: return null;
    }
  };

  return (
    <LayoutBase>
        <div className="flex flex-col min-h-screen bg-white dark:bg-black">
            <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1">
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    </LayoutBase>
  );
};

export default MessagesPageContent;
