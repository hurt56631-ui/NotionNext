// /components/MessagesPageContent.js (已修复逻辑和路由问题)

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
  const baseClasses = "flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1-4 transition-colors duration-300";
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

// ConversationList 组件 (已修复)
const ConversationList = () => {
    const { user } = useAuth();
    const router = useRouter();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) { setLoading(false); return; }

        // 确保查询的字段存在，否则Firebase会报错
        const chatsQuery = query(
            collection(db, 'privateChats'), 
            where('members', 'array-contains', user.uid), 
            orderBy('lastMessageTimestamp', 'desc')
        );

        const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
            setLoading(true);
            const chatPromises = snapshot.docs.map(async (chatDoc) => {
                const chatData = chatDoc.data();
                const otherUserId = chatData.members.find(id => id !== user.uid);
                
                if (!otherUserId) return null;

                const userProfileDoc = await getDoc(doc(db, 'users', otherUserId));
                const otherUser = userProfileDoc.exists() 
                    ? { id: userProfileDoc.id, ...userProfileDoc.data() } 
                    : { id: otherUserId, displayName: '未知用户', photoURL: '/img/avatar.svg' };

                // 【修复 Bug】修正未读消息的判断逻辑
                const lastReadTimestamp = chatData.lastRead?.[user.uid]?.toDate();
                const lastMessageTimestamp = chatData.lastMessageTimestamp?.toDate();
                const isUnread = lastReadTimestamp && lastMessageTimestamp && lastMessageTimestamp > lastReadTimestamp;

                return { 
                    id: chatDoc.id, 
                    ...chatData, 
                    otherUser, 
                    isUnread 
                };
            });
            const resolvedChats = (await Promise.all(chatPromises)).filter(Boolean);
            setConversations(resolvedChats);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching conversations: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);
    
    // 【修复路由】导航到正确的聊天页面，并传递整个 conversation 对象
    const handleConversationClick = (convo) => {
        router.push({
            pathname: `/messages/${convo.id}`, // 正确的路径
            query: { 
                peerUid: convo.otherUser.id,
                peerDisplayName: convo.otherUser.displayName 
            }
        });
    };

    if (loading) { return <div className="p-8 text-center text-gray-500">正在加载私信...</div>; }
    if (!user) { return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>; }
    if (conversations.length === 0) { return <div className="p-8 text-center text-gray-500">还没有任何私信哦。</div>; }

    return (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {conversations.map(convo => (
                // 【修复路由】传递整个 convo 对象给点击事件
                <li key={convo.id} onClick={() => handleConversationClick(convo)} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <div className="relative">
                        <img src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className="w-14 h-14 rounded-full object-cover" />
                        {convo.isUnread && (<span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 border-2 border-white dark:border-gray-800" />)}
                    </div>
                    <div className="ml-4 flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold truncate dark:text-gray-200">{convo.otherUser.displayName || '未知用户'}</p>
                            {convo.lastMessageTimestamp && (
                                <p className="text-xs text-gray-400">
                                    {convo.lastMessageTimestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-1">{convo.lastMessage}</p>
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
