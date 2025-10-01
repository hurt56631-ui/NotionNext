// /components/MessagesPageContent.js (已改好，支持未读提示)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { HiOutlineChatBubbleLeftRight, HiOutlineBell, HiOutlineGlobeAlt, HiOutlineUsers } from 'react-icons/hi2';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';
import { useMessages } from '@/lib/MessageContext';

const MessageHeader = ({ activeTab, setActiveTab, totalUnreadCount }) => {
  const tabs = [
    { key: 'messages', name: '私信', icon: <HiOutlineChatBubbleLeftRight className="w-6 h-6" /> },
    { key: 'notifications', name: '通知', icon: <HiOutlineBell className="w-6 h-6" /> },
    { key: 'discover', name: '发现', icon: <HiOutlineGlobeAlt className="w-6 h-6" /> },
    { key: 'contacts', name: '联系人', icon: <HiOutlineUsers className="w-6 h-6" /> }
  ];

  const baseClasses =
    'relative flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1/4 transition-colors duration-300';
  const activeClasses = 'text-white scale-110';
  const inactiveClasses = 'text-white/70 hover:text-white';

  return (
    <div className="flex justify-around sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 shadow-md z-10">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`${baseClasses} ${
            activeTab === tab.key ? activeClasses : inactiveClasses
          }`}
        >
          {tab.icon}

          {/* 顶部导航栏未读小圆点 */}
          {tab.key === 'messages' && totalUnreadCount > 0 && (
            <span className="absolute top-2 right-1/2 translate-x-4 block h-2 w-2 rounded-full bg-green-400" />
          )}

          <span className="text-xs mt-1">{tab.name}</span>
          <div
            className={`w-8 h-0.5 mt-1 rounded-full transition-all duration-300 ${
              activeTab === tab.key ? 'bg-white' : 'bg-transparent'
            }`}
          ></div>
        </button>
      ))}
    </div>
  );
};

const ConversationList = () => {
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      setConversations([]);
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
        const chatPromises = snapshot.docs.map(async (chatDoc) => {
          const chatData = chatDoc.data();
          const otherUserId = chatData.members.find((id) => id !== user.uid);
          if (!otherUserId) return null;

          try {
            const userProfileDoc = await getDoc(doc(db, 'users', otherUserId));
            if (!userProfileDoc.exists()) return null;
            const otherUser = {
              id: userProfileDoc.id,
              ...userProfileDoc.data()
            };

            // 🔹 这里从子文档里取 unreadCount
            const memberDocRef = doc(db, `privateChats/${chatDoc.id}/members`, user.uid);
            const memberDocSnap = await getDoc(memberDocRef);
            const unreadCount = memberDocSnap.data()?.unreadCount || 0;

            return { id: chatDoc.id, ...chatData, otherUser, unreadCount };
          } catch (error) {
            console.error(`处理会话 ${chatDoc.id} 出错:`, error);
            return null;
          }
        });

        const resolvedChats = (await Promise.all(chatPromises)).filter(Boolean);
        setConversations(resolvedChats);
        setLoading(false);
      },
      (error) => {
        console.error('获取会话列表出错: ', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  const handleConversationClick = (convo) => {
    if (!user?.uid || !convo.otherUser?.id) return;
    router.push(`/messages/${convo.id}`);
  };

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">正在加载...</div>;
  }
  if (!user) {
    return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>;
  }
  if (conversations.length === 0) {
    return <div className="p-8 text-center text-gray-500">还没有任何私信哦。</div>;
  }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {conversations.map((convo) => (
        <li
          key={convo.id}
          onClick={() => handleConversationClick(convo)}
          className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <div className="relative">
            <img
              src={convo.otherUser.photoURL || '/img/avatar.svg'}
              alt={convo.otherUser.displayName}
              className="w-14 h-14 rounded-full object-cover"
            />
          </div>
          <div className="ml-4 flex-1 overflow-hidden">
            <div className="flex justify-between items-center">
              <p className="font-semibold truncate dark:text-gray-200">
                {convo.otherUser.displayName || '未知用户'}
              </p>
              {convo.lastMessageAt && (
                <p className="text-xs text-gray-400">
                  {new Date(convo.lastMessageAt.toDate()).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
            <div className="flex justify-between items-start mt-1">
              <p className="text-sm text-gray-500 truncate">
                {convo.lastMessage || '...'}
              </p>

              {/* 会话未读消息角标 */}
              {convo.unreadCount > 0 && (
                <span className="ml-2 flex-shrink-0 text-xs text-white bg-green-500 rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                  {convo.unreadCount > 99 ? '99+' : convo.unreadCount}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { totalUnreadCount } = useMessages();

  const renderContent = () => {
    switch (activeTab) {
      case 'messages':
        return <ConversationList />;
      case 'notifications':
        return (
          <div className="p-8 text-center text-gray-500">通知功能正在开发中...</div>
        );
      case 'discover':
        return (
          <div className="p-8 text-center text-gray-500">发现功能正在开发中...</div>
        );
      case 'contacts':
        return (
          <div className="p-8 text-center text-gray-500">联系人功能正在开发中...</div>
        );
      default:
        return null;
    }
  };

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-white dark:bg-black">
        <MessageHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          totalUnreadCount={totalUnreadCount}
        />
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

export default MessagesPageContent;
