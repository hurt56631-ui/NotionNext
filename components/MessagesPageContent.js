// /components/MessagesPageContent.js (最终修复版 - 结合了健壮的数据逻辑和完整UI)

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
      (snapshot) => {
        // ✅ 采用最健壮的方式：先同步处理所有快照数据，再异步获取用户信息
        // 这样可以确保即使 getDoc 延迟，核心的 unreadCount 也已经计算完毕
        
        let currentTotalUnread = 0;
        const chatsWithUnread = snapshot.docs.map(doc => {
          const chatData = doc.data();
          const unreadCount = chatData.unreadCounts?.[user.uid] || 0;
          currentTotalUnread += unreadCount;
          return {
            id: doc.id,
            ...chatData,
            unreadCount: unreadCount,
          };
        });

        // 立即更新一次状态，让未读数尽快反映出来
        // 此时 otherUser 可能还是空的，但 unreadCount 是最新的
        setConversations(prev => {
            // 合并新旧数据，防止用户信息丢失
            return chatsWithUnread.map(newChat => {
                const oldChat = prev.find(c => c.id === newChat.id);
                return { ...oldChat, ...newChat };
            });
        });
        setTotalUnreadCount(currentTotalUnread);
        setLoading(false); // 此时可以结束加载状态，因为核心数据已在

        // 然后，异步地、不阻塞UI地去获取所有对方用户的信息
        Promise.all(chatsWithUnread.map(async (chat) => {
          const otherUserId = chat.members.find((id) => id !== user.uid);
          if (!otherUserId) return chat; // 如果找不到对方，返回原数据

          try {
            const userProfileDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userProfileDoc.exists()) {
              chat.otherUser = { id: userProfileDoc.id, ...userProfileDoc.data() };
            } else {
              chat.otherUser = { id: otherUserId, displayName: '未知用户', photoURL: '/img/avatar.svg' };
            }
          } catch (error) {
            console.error(`获取用户 ${otherUserId} 信息失败:`, error);
            chat.otherUser = { id: otherUserId, displayName: '加载失败', photoURL: '/img/avatar.svg' };
          }
          return chat;
        })).then(resolvedChats => {
            // 当所有用户信息都获取完毕后，再次更新状态，补全用户信息
            setConversations(resolvedChats.filter(Boolean));
        });
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
