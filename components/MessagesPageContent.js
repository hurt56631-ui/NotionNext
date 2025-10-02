// /components/MessagesPageContent.js (最终集成版 - 已绑定“语伴”功能)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, getDocs } from 'firebase/firestore';
// ✅ 导入新图标
import { HiOutlineChatBubbleLeftRight, HiOutlineBell, HiOutlineSparkles, HiOutlineUsers } from 'react-icons/hi2';
import { Send, Globe, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';
import { useUnreadCount } from '@/lib/UnreadCountContext'; 

// ===================================================================
// =============  ✅ 新增：语伴列表相关组件  =============
// ===================================================================

const PartnerCardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md animate-pulse">
        <div className="flex items-center space-x-4"><div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div><div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></div></div>
        <div className="mt-4 space-y-2"><div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div><div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div></div>
    </div>
);

const LanguagePartnerCard = ({ partner, onStartChat }) => {
    const router = useRouter();
    return (
        <div onClick={() => router.push(`/profile/${partner.uid}`)} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer border border-transparent hover:border-blue-500">
            <div className="flex items-start space-x-4">
                <div className="relative flex-shrink-0">
                    <img src={partner.photoURL || '/img/avatar.svg'} alt={partner.displayName} className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"/>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 ring-1 ring-green-300"><span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></span></div>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{partner.displayName || '新用户'}</h3>
                    <div className="mt-1 flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center"><Globe size={14} className="mr-1.5 text-gray-400"/><span>母语: <span className="font-semibold text-gray-700 dark:text-gray-300">{partner.nativeLanguage || '未知'}</span></span></div>
                    </div>
                     <div className="mt-1 flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center"><MessageCircle size={14} className="mr-1.5 text-gray-400"/><span>在学: <span className="font-semibold text-gray-700 dark:text-gray-300">{partner.learningLanguage || '未知'}</span></span></div>
                    </div>
                </div>
            </div>
            <div className="mt-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed h-10 overflow-hidden">{partner.bio || '这位语伴很神秘，什么也没留下...'}</p>
                <div className="mt-4 flex justify-end">
                    <button onClick={(e) => { e.stopPropagation(); onStartChat(partner); }} className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors active:scale-95 shadow-md">
                        <Send size={16} className="mr-2" />私信
                    </button>
                </div>
            </div>
        </div>
    );
};

const LanguagePartnerList = () => {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user: currentUser } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const fetchPartners = async () => {
            if (!db) return;
            setLoading(true);
            try {
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const q = query(collection(db, 'users'), where('lastSeen', '>=', oneDayAgo), orderBy('lastSeen', 'desc'), limit(50));
                const querySnapshot = await getDocs(q);
                const fetchedPartners = [];
                querySnapshot.forEach((doc) => {
                    if (currentUser && doc.id === currentUser.uid) return;
                    fetchedPartners.push({ uid: doc.id, ...doc.data() });
                });
                setPartners(fetchedPartners);
            } catch (error) { console.error("获取语伴列表失败:", error); } 
            finally { setLoading(false); }
        };
        fetchPartners();
    }, [currentUser]);

    const handleStartChat = (targetUser) => {
        if (!currentUser) { alert("请先登录再开始聊天"); return; }
        const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-2">发现语伴</h1>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">以下是24小时内活跃的用户</p>
            
            {/* ✅ 未来功能扩展区 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 text-center">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow">
                    <i className="fas fa-map-marker-alt text-2xl text-blue-500"></i><p className="mt-2 text-sm font-semibold">附近的人</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow">
                    <i className="fas fa-wine-bottle text-2xl text-green-500"></i><p className="mt-2 text-sm font-semibold">漂流瓶</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow">
                    <i className="fas fa-mobile-alt text-2xl text-purple-500"></i><p className="mt-2 text-sm font-semibold">摇一摇</p>
                </div>
                 <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow">
                    <i className="fas fa-globe-asia text-2xl text-yellow-500"></i><p className="mt-2 text-sm font-semibold">语伴匹配</p>
                </div>
            </div>

            <div className="space-y-6">
                {loading ? (
                    <><PartnerCardSkeleton /><PartnerCardSkeleton /><PartnerCardSkeleton /></>
                ) : partners.length > 0 ? (
                    partners.map(partner => (<LanguagePartnerCard key={partner.uid} partner={partner} onStartChat={handleStartChat}/>))
                ) : (
                    <div className="text-center py-16"><p className="text-gray-500">暂时没有找到活跃的语伴哦。</p></div>
                )}
            </div>
        </div>
    );
};

// ===================================================================
// =============  ✅ 现有组件修改  =============
// ===================================================================

const MessageHeader = ({ activeTab, setActiveTab, totalUnreadCount }) => {
  // ✅ 核心修改：更新 Tab 定义
  const tabs = [
    { key: 'messages', name: '私信', icon: <HiOutlineChatBubbleLeftRight className="w-6 h-6" /> },
    { key: 'notifications', name: '通知', icon: <HiOutlineBell className="w-6 h-6" /> },
    { key: 'partners', name: '语伴', icon: <HiOutlineSparkles className="w-6 h-6" /> }, // “发现”改为“语伴”
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
          {tab.key === 'messages' && totalUnreadCount > 0 && (<span className="absolute top-2 right-1/2 translate-x-4 block h-2 w-2 rounded-full bg-red-500" />)}
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
      {conversations.map((convo) => {
        if (!convo || !convo.otherUser) { return null; }
        return (
            <li key={convo.id} onClick={() => handleConversationClick(convo)} className="relative flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                <div className="relative"><img src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className="w-14 h-14 rounded-full object-cover"/></div>
                <div className="ml-4 flex-1 overflow-hidden">
                    <div className="flex justify-between items-center"><p className="font-semibold truncate dark:text-gray-200">{convo.otherUser.displayName || '未知用户'}</p>{convo.lastMessageAt && (<p className="text-xs text-gray-400">{new Date(convo.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>)}</div>
                    <div className="flex justify-between items-start mt-1"><p className="text-sm text-gray-500 truncate">{convo.lastMessage || '...'}</p>
                        {convo.unreadCount > 0 && (<span className="ml-2 flex-shrink-0 text-xs text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center font-semibold">{convo.unreadCount > 99 ? '99+' : convo.unreadCount}</span>)}
                    </div>
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
  const { totalUnreadCount, setTotalUnreadCount } = useUnreadCount();

  useEffect(() => {
    if (activeTab !== 'messages' || authLoading || !user) {
      if (!authLoading) setLoading(false);
      setConversations([]);
      return;
    }
    setLoading(true);
    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid), orderBy('lastMessageAt', 'desc'));
    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const chatsWithPlaceholders = snapshot.docs.map(doc => {
          const chatData = doc.data();
          const unreadCount = chatData.unreadCounts?.[user.uid] || 0;
          const otherUserId = chatData.members.find((id) => id !== user.uid);
          return { id: doc.id, ...chatData, unreadCount: unreadCount, otherUser: { id: otherUserId || null, displayName: '加载中...', photoURL: '/img/avatar.svg' } };
        });
        setConversations(chatsWithPlaceholders);
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
        setLoading(false);
      }, (error) => { console.error('获取会话列表出错:', error); setLoading(false); }
    );
    return () => unsubscribe();
  }, [user, authLoading, activeTab]);


  // ✅ 核心修改：更新内容渲染逻辑
  const renderContent = () => {
    switch (activeTab) {
      case 'messages': return <ConversationList conversations={conversations} loading={loading} user={user} authLoading={authLoading} />;
      case 'notifications': return (<div className="p-8 text-center text-gray-500">通知功能正在开发中...</div>);
      case 'partners': return <LanguagePartnerList />; // “发现”改为“语伴”
      case 'contacts': return (<div className="p-8 text-center text-gray-500">联系人功能正在开发中...</div>);
      default: return null;
    }
  };

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
        <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} totalUnreadCount={totalUnreadCount}/>
        <main className="flex-1">
          <AnimatePresence mode="wait"><motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>{renderContent()}</motion.div></AnimatePresence></main>
      </div>
    </LayoutBase>
  );
};

export default MessagesPageContent;
