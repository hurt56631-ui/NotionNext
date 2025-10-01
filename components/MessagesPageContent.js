// /components/MessagesPageContent.js (最终健壮版 - 已添加ID显示器和数据处理优化)

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
      {conversations.map((convo) => (
        <li key={convo.id} onClick={() => handleConversationClick(convo)} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
          <div className="relative"><img src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className="w-14 h-14 rounded-full object-cover"/></div>
          <div className="ml-4 flex-1 overflow-hidden">
            <div className="flex justify-between items-center"><p className="font-semibold truncate dark:text-gray-200">{convo.otherUser.displayName || '未知用户'}</p>{convo.lastMessageAt && (<p className="text-xs text-gray-400">{new Date(convo.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>)}</div>
            <div className="flex justify-between items-start mt-1"><p className="text-sm text-gray-500 truncate">{convo.lastMessage || '...'}</p>{convo.unreadCount > 0 && (<span className="ml-2 flex-shrink-0 text-xs text-white bg-green-500 rounded-full w-5 h-5 flex items-center justify-center font-semibold">{convo.unreadCount > 99 ? '99+' : convo.unreadCount}</span>)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
};

// --- 最终健壮性优化版本 ---
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
        
        // 核心优化：并行获取所有会话的对方用户信息，并处理未读数
        const resolvedChats = await Promise.all(snapshot.docs.map(async (chatDoc) => {
            const chatData = chatDoc.data();
            const otherUserId = chatData.members.find((id) => id !== user.uid);
            
            // 立即计算未读数，即使对方用户信息获取失败，未读数也不会丢失
            const unreadCount = chatData.unreadCounts?.[user.uid] || 0;
            currentTotalUnread += unreadCount;
            
            if (!otherUserId) return null;

            let otherUser = null;
            try {
                const userProfileDoc = await getDoc(doc(db, 'users', otherUserId));
                if (userProfileDoc.exists()) {
                    otherUser = { id: userProfileDoc.id, ...userProfileDoc.data() };
                }
            } catch (error) {
                // 即使获取对方用户信息失败，我们仍然返回会话和未读数
                console.error(`处理会话 ${chatDoc.id} (用户 ${otherUserId}) 获取用户信息失败:`, error);
            }
            
            // 如果无法获取对方用户信息，我们返回一个默认对象，以便列表项能够渲染（如显示“未知用户”）
            if (!otherUser) {
                otherUser = { id: otherUserId, displayName: '未知用户', photoURL: '/img/avatar.svg' };
            }
            
            return { id: chatDoc.id, ...chatData, otherUser, unreadCount };
        }));

        const validChats = resolvedChats.filter(Boolean);
        
        setConversations(validChats);
        setTotalUnreadCount(currentTotalUnread);
        setLoading(false);
      },
      (error) => { 
        console.error('获取会话列表出错:', error); 
        setLoading(false); 
        // 遇到错误时，将未读数清零，以免显示错误状态
        setTotalUnreadCount(0);
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
      {/* 保持 ID 显示器，以防万一 */}
      <div style={{
        position: 'fixed',
        top: '80px',
        left: '10px',
        zIndex: 9999,
        background: 'rgba(255, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        maxWidth: '90vw',
        wordBreak: 'break-all',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <h4 style={{ margin: 0, padding: 0, fontWeight: 'bold' }}>当前登录用户 (UID):</h4>
        {authLoading ? '正在加载认证...' : user ? user.uid : '未登录 (null)'}
      </div>

      <div className="flex flex-col min-h-screen bg-white dark:bg-black">
        <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} totalUnreadCount={totalUnreadCount}/>
        <main className="flex-1">
          <AnimatePresence mode="wait"><motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>{renderContent()}</motion.div></AnimatePresence></main>
      </div>
    </LayoutBase>
  );
};

export default MessagesPageContent;
