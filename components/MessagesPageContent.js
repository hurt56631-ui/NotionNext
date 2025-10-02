// /components/MessagesPageContent.js (最终美化版 - 高端语伴功能)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
// ✅ 引入 RTDB
import { db, rtDb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, getDocs } from 'firebase/firestore';
// ✅ 导入新图标
import { Compass, Briefcase, MessageSquare, Sparkles, User, Users, Heart as HeartIcon, Languages, MapPin, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';
import { useUnreadCount } from '@/lib/UnreadCountContext'; 

// ===================================================================
// =============  ✅ 新增：语伴列表相关组件 (全新美化版)  =============
// ===================================================================

// --- 时间格式化辅助函数 (用于在线状态) ---
const formatLastSeen = (timestamp) => {
    if (!timestamp) return null;
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 2) return "在线"; 
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    
    return null; // 超过24小时不显示
};

// --- 在线状态 Hook (实时从 RTDB 获取) ---
const usePartnerStatus = (partnerId) => {
    const [status, setStatus] = useState(null);
    useEffect(() => {
        if (!partnerId || !rtDb) return;
        const statusRef = ref(rtDb, `/status/${partnerId}`);
        const unsubscribe = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.state === 'online') {
                setStatus('在线');
            } else if (data?.last_changed) {
                setStatus(formatLastSeen(data.last_changed));
            } else {
                setStatus(null);
            }
        });
        return () => unsubscribe();
    }, [partnerId]);
    return status;
};

// --- 单个语伴卡片骨架屏 ---
const PartnerCardSkeleton = () => (
    <div className="relative w-full aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-2xl overflow-hidden shadow-lg animate-pulse">
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <div className="h-6 bg-gray-400 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-400 rounded w-1/3"></div>
        </div>
    </div>
);

// --- 单个语伴卡片组件 (全新美化版) ---
const LanguagePartnerCard = ({ partner, onSayHi }) => {
    const router = useRouter();
    const onlineStatus = usePartnerStatus(partner.uid);
    const interests = partner.interests || [];

    return (
        <div 
            onClick={() => router.push(`/profile/${partner.uid}`)}
            className="relative w-full aspect-[3/4] bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg group cursor-pointer"
        >
            {/* 背景图 */}
            <img 
                src={partner.profileBackground || partner.photoURL || '/img/bg_fallback.jpg'} 
                alt={`${partner.displayName} 的背景`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
            
            {/* 渐变遮罩 + 内容 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col justify-end p-4 text-white">
                {/* 打招呼按钮 */}
                <div className="absolute top-4 right-4">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onSayHi(partner); }}
                        className="w-12 h-12 rounded-full bg-blue-500/80 backdrop-blur-sm text-white flex items-center justify-center hover:bg-blue-500 shadow-lg transition-all active:scale-90"
                        aria-label="打招呼"
                    >
                        <Send size={20} />
                    </button>
                </div>

                {/* 基本信息 */}
                <div className="transform transition-transform duration-300 group-hover:-translate-y-2">
                    <h3 className="text-2xl font-bold tracking-tight">{partner.displayName || '新用户'}</h3>
                    <div className="flex items-center text-sm mt-1 opacity-90">
                        {partner.gender === 'male' && <i className="fas fa-mars text-blue-300 mr-1.5"></i>}
                        {partner.gender === 'female' && <i className="fas fa-venus text-pink-300 mr-1.5"></i>}
                        {partner.age && <span>{partner.age}岁</span>}
                        {partner.nationality && <MapPin size={14} className="ml-2 mr-1" />}
                        {partner.nationality && <span>{partner.nationality}</span>}
                    </div>
                </div>

                {/* 语言和兴趣 (默认隐藏，悬停时上浮显示) */}
                <div className="pt-2 max-h-0 opacity-0 group-hover:max-h-48 group-hover:opacity-100 transition-all duration-300 overflow-hidden">
                    <div className="mt-2 text-xs space-y-2">
                        <div className="flex items-center bg-black/30 backdrop-blur-sm rounded-full px-2 py-1 w-fit">
                            <Globe size={12} className="mr-1.5"/>
                            <span>母语: <span className="font-semibold">{partner.nativeLanguage || '未知'}</span></span>
                        </div>
                        <div className="flex items-center bg-black/30 backdrop-blur-sm rounded-full px-2 py-1 w-fit">
                            <MessageSquare size={12} className="mr-1.5"/>
                            <span>在学: <span className="font-semibold">{partner.learningLanguage || '未知'}</span></span>
                        </div>
                    </div>
                    {interests.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {interests.slice(0, 3).map(interest => (
                                <span key={interest} className="text-xs bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">{interest}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 语伴列表主组件 ---
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
                // 1. 获取过去30天内看过的用户ID
                const viewedKey = currentUser ? `viewed_partners_${currentUser.uid}` : 'viewed_partners_guest';
                const viewedData = JSON.parse(localStorage.getItem(viewedKey) || '{}');
                const recentViewedIds = [];
                const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                
                Object.keys(viewedData).forEach(id => {
                    if (viewedData[id] > oneMonthAgo) {
                        recentViewedIds.push(id);
                    }
                });
                localStorage.setItem(viewedKey, JSON.stringify(viewedData)); // 清理旧数据

                // 2. 查询24小时内活跃的用户
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const q = query(
                    collection(db, 'users'),
                    where('lastSeen', '>=', oneDayAgo),
                    orderBy('lastSeen', 'desc'),
                    limit(100) // 多获取一些用于过滤
                );

                const querySnapshot = await getDocs(q);
                const fetchedPartners = [];
                const newViewedData = { ...viewedData };

                querySnapshot.forEach((doc) => {
                    const partnerData = { uid: doc.id, ...doc.data() };
                    // 3. 过滤掉自己和30天内看过的用户
                    if (currentUser && partnerData.uid === currentUser.uid) return;
                    if (recentViewedIds.includes(partnerData.uid)) return;

                    fetchedPartners.push(partnerData);
                });

                setPartners(fetchedPartners.slice(0, 20)); // 最多显示20个
                
                // 4. 将更新后的浏览记录存回 localStorage
                fetchedPartners.slice(0, 20).forEach(p => newViewedData[p.uid] = Date.now());
                localStorage.setItem(viewedKey, JSON.stringify(newViewedData));

            } catch (error) { console.error("获取语伴列表失败:", error); } 
            finally { setLoading(false); }
        };

        // 延迟执行以确保 currentUser 可用
        setTimeout(fetchPartners, 100);
    }, [currentUser]);

    const handleSayHi = (targetUser) => {
        if (!currentUser) { alert("请先登录再打招呼"); return; }
        const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    return (
        <div className="bg-gray-100 dark:bg-black min-h-screen">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* 未来功能扩展区 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 text-center">
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow cursor-pointer hover:shadow-lg transition-shadow group"><Compass size={28} className="mx-auto text-blue-500 group-hover:scale-110 transition-transform"/><p className="mt-2 text-sm font-bold">附近的人</p></div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow cursor-pointer hover:shadow-lg transition-shadow group"><HeartIcon size={28} className="mx-auto text-red-500 group-hover:scale-110 transition-transform"/><p className="mt-2 text-sm font-bold">漂流瓶</p></div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow cursor-pointer hover:shadow-lg transition-shadow group"><Users size={28} className="mx-auto text-purple-500 group-hover:scale-110 transition-transform"/><p className="mt-2 text-sm font-bold">摇一摇</p></div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow cursor-pointer hover:shadow-lg transition-shadow group"><User size={28} className="mx-auto text-green-500 group-hover:scale-110 transition-transform"/><p className="mt-2 text-sm font-bold">语伴匹配</p></div>
                </div>

                {/* 网格布局 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {loading ? (
                        Array.from({ length: 8 }).map((_, i) => <PartnerCardSkeleton key={i} />)
                    ) : partners.length > 0 ? (
                        partners.map(partner => (
                            <LanguagePartnerCard 
                                key={partner.uid} 
                                partner={partner}
                                onSayHi={handleSayHi}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-20">
                            <p className="text-gray-500 text-lg">今天没有新的语伴了，明天再来看看吧！</p>
                        </div>
                    )}
                </div>
                 {/* ✅ 修复：增加一个空的 div 来防止底部导航栏遮挡 */}
                 <div className="h-24"></div>
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
    { key: 'messages', name: '私信', icon: <MessageSquare className="w-6 h-6" /> },
    { key: 'discover', name: '动态', icon: <Compass className="w-6 h-6" /> }, 
    { key: 'partners', name: '语伴', icon: <Sparkles className="w-6 h-6" /> }, 
    { key: 'jobs', name: '找工作', icon: <Briefcase className="w-6 h-6" /> } 
  ];
  const baseClasses = 'relative flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1/4 transition-colors duration-300';
  const activeClasses = 'text-white scale-110';
  const inactiveClasses = 'text-white/70 hover:text-white';
  return (
    <div className="flex justify-around sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 shadow-md z-10">
      {tabs.map((tab) => (
        <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`${baseClasses} ${activeTab === tab.key ? activeClasses : inactiveClasses}`}>
          {tab.icon}
          {tab.key === 'messages' && totalUnreadCount > 0 && (<span className="absolute top-2 right-1/2 translate-x-4 block w-2 h-2 rounded-full bg-red-500" />)}
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
  const { totalUnreadCount } = useUnreadCount();

  // ✅ 核心修复：简化 useEffect 依赖
  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      setConversations([]);
      return;
    }

    // 只在 activeTab 为 messages 时才启动加载
    if (activeTab !== 'messages') {
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


  const renderContent = () => {
    switch (activeTab) {
      case 'messages': return <ConversationList conversations={conversations} loading={loading} user={user} authLoading={authLoading} />;
      case 'discover': return (<div className="p-8 text-center text-gray-500">动态功能正在开发中...</div>);
      case 'partners': return <LanguagePartnerList />;
      case 'jobs': return (<div className="p-8 text-center text-gray-500">找工作功能正在开发中...</div>);
      default: return null;
    }
  };

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-black">
        <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} totalUnreadCount={totalUnreadCount}/>
        <main className="flex-1">
          <AnimatePresence mode="wait"><motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>{renderContent()}</motion.div></AnimatePresence></main>
      </div>
    </LayoutBase>
  );
};

export default MessagesPageContent;
