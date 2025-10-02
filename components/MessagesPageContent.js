// /components/MessagesPageContent.js (最终美化版 - 高端语伴功能)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
// ✅ 引入 RTDB
import { db, rtDb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, getDocs } from 'firebase/firestore';
// ✅ 导入新图标
import { Compass, Briefcase, MessageSquare, Sparkles, User, Users, Heart, Languages } from 'lucide-react';
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
    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg w-full animate-pulse">
        <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="flex-1 space-y-3">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
        </div>
        <div className="mt-4 h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="mt-2 h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
);

// --- 单个语伴卡片组件 (全新美化版) ---
const LanguagePartnerCard = ({ partner, onStartChat }) => {
    const router = useRouter();
    const onlineStatus = usePartnerStatus(partner.uid);

    return (
        <div 
            onClick={() => router.push(`/profile/${partner.uid}`)}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transform hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
            {/* 卡片头部：背景图 + 头像 + 在线状态 */}
            <div className="relative h-28 bg-gradient-to-r from-purple-400 to-blue-500">
                <img src={partner.photoURL || '/img/avatar.svg'} alt={partner.displayName} className="absolute top-16 left-4 w-20 h-20 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md"/>
                <div className="absolute top-4 right-4">
                     <button onClick={(e) => { e.stopPropagation(); onStartChat(partner); }} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white backdrop-blur-sm font-semibold text-sm hover:bg-white/30 transition-colors active:scale-95">
                        <MessageSquare size={16} />打个招呼
                    </button>
                </div>
                {onlineStatus && (
                     <div className="absolute top-24 left-20">
                         <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${onlineStatus === '在线' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                             <div className={`w-2 h-2 rounded-full ${onlineStatus === '在线' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                             {onlineStatus}
                         </div>
                     </div>
                )}
            </div>
            
            {/* 卡片内容区 */}
            <div className="pt-12 p-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{partner.displayName || '新用户'}</h3>
                
                {/* 年龄和国籍 */}
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>{partner.age || '年龄未知'}岁</span>
                    <span className="mx-2">·</span>
                    <span>{partner.nationality || '国籍未知'}</span>
                </div>

                {/* 语言信息 */}
                <div className="mt-3 text-sm space-y-2">
                     <div className="flex items-center text-gray-600 dark:text-gray-300"><Languages size={16} className="mr-2 text-blue-500"/>母语: <span className="font-semibold ml-1">{partner.nativeLanguage || '未填写'}</span></div>
                     <div className="flex items-center text-gray-600 dark:text-gray-300"><Sparkles size={16} className="mr-2 text-yellow-500"/>在学: <span className="font-semibold ml-1">{partner.learningLanguage || '未填写'}</span></div>
                </div>

                {/* 兴趣爱好 */}
                {partner.hobbies && partner.hobbies.length > 0 && (
                     <div className="mt-4 flex flex-wrap gap-2">
                        {partner.hobbies.slice(0, 4).map(hobby => (
                            <span key={hobby} className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                {hobby}
                            </span>
                        ))}
                    </div>
                )}
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

            // 1. 获取本地缓存的已浏览用户ID
            const viewedPartners = JSON.parse(localStorage.getItem('viewedPartners') || '{}');
            const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

            // 清理超过一个月的旧缓存
            Object.keys(viewedPartners).forEach(uid => {
                if (viewedPartners[uid] < oneMonthAgo) {
                    delete viewedPartners[uid];
                }
            });
            localStorage.setItem('viewedPartners', JSON.stringify(viewedPartners));

            try {
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const q = query(
                    collection(db, 'users'),
                    where('lastSeen', '>=', oneDayAgo),
                    orderBy('lastSeen', 'desc'),
                    limit(100) // 多获取一些用于过滤
                );
                const querySnapshot = await getDocs(q);
                let fetchedPartners = [];
                querySnapshot.forEach((doc) => {
                    // 排除自己和已浏览的用户
                    if ((currentUser && doc.id === currentUser.uid) || viewedPartners[doc.id]) return;
                    fetchedPartners.push({ uid: doc.id, ...doc.data() });
                });
                
                // 最终只显示20个
                setPartners(fetchedPartners.slice(0, 20));

                // 更新缓存
                const newViewed = {...viewedPartners};
                fetchedPartners.slice(0, 20).forEach(p => newViewed[p.uid] = Date.now());
                localStorage.setItem('viewedPartners', JSON.stringify(newViewed));
            } catch (error) { 
                console.error("获取语伴列表失败:", error); 
            } finally { setLoading(false); }
        };

        // 延迟执行以确保 currentUser 可用
        setTimeout(fetchPartners, 100);
    }, [currentUser]);

    const handleStartChat = (targetUser) => {
        if (!currentUser) { alert("请先登录再打招呼"); return; }
        const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    return (
        <div className="bg-gray-100 dark:bg-black min-h-screen">
            <div className="max-w-3xl mx-auto px-4 py-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 text-center">
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow cursor-pointer hover:shadow-lg transition-shadow group"><Compass size={28} className="mx-auto text-blue-500 group-hover:scale-110 transition-transform"/><p className="mt-2 text-sm font-bold">附近的人</p></div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow cursor-pointer hover:shadow-lg transition-shadow group"><Heart size={28} className="mx-auto text-red-500 group-hover:scale-110 transition-transform"/><p className="mt-2 text-sm font-bold">缘分匹配</p></div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow cursor-pointer hover:shadow-lg transition-shadow group"><Users size={28} className="mx-auto text-purple-500 group-hover:scale-110 transition-transform"/><p className="mt-2 text-sm font-bold">语伴</p></div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow cursor-pointer hover:shadow-lg transition-shadow group"><User size={28} className="mx-auto text-green-500 group-hover:scale-110 transition-transform"/><p className="mt-2 text-sm font-bold">摇一摇</p></div>
                </div>

                <div className="space-y-6">
                    {loading ? (
                        <><PartnerCardSkeleton /><PartnerCardSkeleton /></>
                    ) : partners.length > 0 ? (
                        partners.map(partner => (<LanguagePartnerCard key={partner.uid} partner={partner} onStartChat={handleStartChat}/>))
                    ) : (
                        <div className="text-center py-20"><p className="text-gray-500">暂时没有新的语伴推荐哦，明天再来看看吧！</p></div>
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
  // ... (ConversationList 代码保持不变)
};

const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { user, authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { totalUnreadCount } = useUnreadCount();

  useEffect(() => {
    if (activeTab !== 'messages' || authLoading || !user) {
      if (!authLoading) setLoading(false);
      setConversations([]);
      return;
    }
    // ... (加载会话列表的逻辑保持不变)
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
