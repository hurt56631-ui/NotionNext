// /components/MessagesPageContent.js (最终数据验证版 - 完整代码)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { HiOutlineChatBubbleLeftRight, HiOutlineBell, HiOutlineGlobeAlt, HiOutlineUsers } from 'react-icons/hi2';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';

const MessageHeader = ({ activeTab, setActiveTab, totalUnreadCount }) => {
  const tabs = [
    { key: 'messages', name: '私信', icon: <HiOutlineChatBubbleLeftRight className="w-6 h-6" /> },
    { key: 'notifications', name: '通知', icon: <HiOutlineBell className="w-6 h-6" /> },
    { key: 'discover', name: '发现', icon: <HiOutlineGlobeAlt className="w-6 h-6" /> },
    { key: 'contacts', name: '联系人', icon: <HiOutlineUsers className="w-6 h-6" /> }
  ];
  const baseClasses = 'relative flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1/4 transition-colors duration-300';
  const activeClasses = 'text-white scale-110';
  const inactiveClasses = 'text-white/70 hover:text-white';
  return (
    <div className="flex justify-around sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 shadow-md z-10">
      {tabs.map((tab) => (
        <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`${baseClasses} ${activeTab === tab.key ? activeClasses : inactiveClasses}`}>
          {tab.icon}
          {tab.key === 'messages' && totalUnreadCount > 0 && (<span className="absolute top-2 right-1/2 translate-x-4 block h-2 w-2 rounded-full bg-green-400" />)}
          <span className="text-xs mt-1">{tab.name}</span>
          <div className={`w-8 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.key ? 'bg-white' : 'bg-transparent'}`}></div>
        </button>
      ))}
    </div>
  );
};

// ✅ ---【核心修改：在 ConversationList 内部添加数据验证】--- ✅
const ConversationList = ({ conversations, loading, user, authLoading }) => {
  const router = useRouter();
  const handleConversationClick = (convo) => {
    if (!user?.uid || !convo.otherUser?.id) return;
    router.push(`/messages/${convo.id}`);
  };

  if (authLoading || loading) { return <div className="p-8 text-center text-gray-500">正在加载...</div>; }
  if (!user) { return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>; }
  if (conversations.length === 0) { return <div className="p-8 text-center text-gray-500">还没有任何私信哦。</div>; }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {conversations.map((convo) => {
        if (!convo || !convo.otherUser) {
            return null; 
        }
        return (
            <li key={convo.id} onClick={() => handleConversationClick(convo)} className="relative flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                <div className="relative"><img src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className="w-14 h-14 rounded-full object-cover"/></div>
                <div className="ml-4 flex-1 overflow-hidden">
                    <div className="flex justify-between items-center"><p className="font-semibold truncate dark:text-gray-200">{convo.otherUser.displayName || '未知用户'}</p>{convo.lastMessageAt && (<p className="text-xs text-gray-400">{new Date(convo.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>)}</div>
                    <div className="flex justify-between items-start mt-1"><p className="text-sm text-gray-500 truncate">{convo.lastMessage || '...'}</p>
                        
                        {/* 原始角标逻辑 */}
                        {convo.unreadCount > 0 && (<span className="ml-2 flex-shrink-0 text-xs text-white bg-green-500 rounded-full w-5 h-5 flex items-center justify-center font-semibold">{convo.unreadCount > 99 ? '99+' : convo.unreadCount}</span>)}
                    </div>
                </div>

                {/* ‼️ ---【最终数据验证】--- ‼️ */}
                {/* 我们在这里无条件地显示从数据库读到的 unreadCount 值 */}
                <div style={{ 
                    position: 'absolute', 
                    right: '10px', 
                    bottom: '5px', 
                    background: 'rgba(255, 204, 0, 0.8)', 
                    color: 'black', 
                    padding: '2px 5px', 
                    borderRadius: '4px', 
                    fontSize: '10px', 
                    fontWeight: 'bold',
                    zIndex: 10
                }}>
                    DB_Unread: {typeof convo.unreadCount === 'number' ? convo.unreadCount : 'N/A'}
                </div>
            </li>
        );
      })}
    </ul>
  );
};

const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { user, authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      setConversations([]);
      setTotalUnreadCount(0);
      return;
    }

    const chatsQuery = query(
      collection(db, 'privateChats'),
      where('members', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        let currentTotalUnread = 0;
        
        const chatsWithPlaceholders = snapshot.docs.map(doc => {
          const chatData = doc.data();
          const unreadCount = chatData.unreadCounts?.[user.uid] || 0;
          currentTotalUnread += unreadCount;
          const otherUserId = chatData.members.find((id) => id !== user.uid);
          
          return {
            id: doc.id,
            ...chatData,
            unreadCount: unreadCount,
            otherUser: { id: otherUserId || null, displayName: '加载中...', photoURL: '/img/avatar.svg' }
          };
        });

        setConversations(chatsWithPlaceholders);
        setTotalUnreadCount(currentTotalUnread);
        setLoading(false);

        const resolvedChats = await Promise.all(chatsWithPlaceholders.map(async (chat) => {
            if (!chat.otherUser.id) return chat;
            try {
                const userProfileDoc = await getDoc(doc(db, 'users', chat.otherUser.id));
                if (userProfileDoc.exists()) {
                    chat.otherUser = { id: userProfileDoc.id, ...userProfileDoc.data() };
                } else {
                    chat.otherUser.displayName = '未知用户';
                }
            } catch (error) {
                console.error(`获取用户 ${chat.otherUser.id} 信息失败:`, error);
                chat.otherUser.displayName = '加载失败';
            }
            return chat;
        }));
        
        setConversations(resolvedChats.filter(Boolean));
      },
      (error) => { 
        console.error('获取会话列表出错:', error); 
        setLoading(false); 
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);


  const renderContent = () => {
    switch (activeTab) {
      case 'messages': return <ConversationList conversations={conversations} loading={loading} user={user} authLoading={authLoading} />;
      case 'notifications': return (<div className="p-8 text-center text-gray-500">通知功能正在开发中...</div>);
      case 'discover': return (<div className="p-8 text-center text-gray-500">发现功能正在开发中...</div>);
      case 'contacts': return (<div className="p-8 text-center text-gray-500">联系人功能正在开发中...</div>);
      default: return null;
    }
  };

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-white dark:bg-black">
        <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} totalUnreadCount={totalUnreadCount}/>
        <main className="flex-1">
          <AnimatePresence mode="wait"><motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>{renderContent()}</motion.div></AnimatePresence></main>
      </div>
    </LayoutBase>
  );
};

export default MessagesPageContent;
