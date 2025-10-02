// /components/MessagesPageContent.js (最终美化版 - 高端语伴功能)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
// ✅ 引入 RTDB
import { db, rtDb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, getDocs } from 'firebase/firestore';
// ✅ 导入新图标和手势库
import { Compass, Briefcase, MessageSquare, Sparkles, User, Users, Heart as HeartIcon, Languages, MapPin, Send, Search, BookOpen, Globe } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';
import { useUnreadCount } from '@/lib/UnreadCountContext'; 
import { useSwipeable } from 'react-swipeable'; // ✅ 新增：手势库

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
    <div className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-2xl overflow-hidden shadow-lg animate-pulse">
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <div className="h-6 bg-gray-400 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-400 rounded w-1/3"></div>
        </div>
    </div>
);

// --- 单个语伴卡片组件 (全新美化版 - 适配单列) ---
const LanguagePartnerCard = ({ partner, onSayHi }) => {
    const router = useRouter();
    const onlineStatus = usePartnerStatus(partner.uid);
    const interests = partner.interests || [];

    return (
        <div 
            onClick={() => router.push(`/profile/${partner.uid}`)}
            className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg group cursor-pointer"
        >
            {/* 背景图 */}
            <img 
                src={partner.profileBackground || partner.photoURL || '/img/bg_fallback.jpg'} 
                alt={`${partner.displayName} 的背景`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
             {/* 在线状态 */}
             {onlineStatus && (
                <div className="absolute top-4 left-4 flex items-center bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                    <span className={`w-2 h-2 rounded-full mr-1.5 ${onlineStatus === '在线' ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                    {onlineStatus}
                </div>
            )}
            
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

// --- 语伴列表主组件 (已改造) ---
const LanguagePartnerList = () => {
    const [allPartners, setAllPartners] = useState([]);
    const [filteredPartners, setFilteredPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { user: currentUser } = useAuth();
    const router = useRouter();

    // ✅ 全新数据获取和缓存逻辑
    useEffect(() => {
        const fetchAndCachePartners = async () => {
            if (!currentUser) return;
            setLoading(true);

            const cacheKey = `daily_partners_${currentUser.uid}`;
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            try {
                const cachedData = JSON.parse(localStorage.getItem(cacheKey));
                if (cachedData && cachedData.date === today) {
                    setAllPartners(cachedData.partners);
                } else {
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    const q = query(
                        collection(db, 'users'),
                        where('lastSeen', '>=', oneDayAgo),
                        orderBy('lastSeen', 'desc'),
                        limit(50) // 获取足够数量的用户
                    );

                    const querySnapshot = await getDocs(q);
                    const fetchedPartners = [];
                    querySnapshot.forEach((doc) => {
                        const partnerData = { uid: doc.id, ...doc.data() };
                        if (partnerData.uid !== currentUser.uid) {
                            fetchedPartners.push(partnerData);
                        }
                    });
                    
                    setAllPartners(fetchedPartners);
                    localStorage.setItem(cacheKey, JSON.stringify({ date: today, partners: fetchedPartners }));
                }
            } catch (error) {
                console.error("获取语伴列表失败:", error);
            } finally {
                setLoading(false);
            }
        };

        if (currentUser) {
            fetchAndCachePartners();
        }
    }, [currentUser]);
    
    // ✅ 搜索过滤逻辑
    useEffect(() => {
        if (!searchTerm) {
            setFilteredPartners(allPartners);
        } else {
            const lowercasedFilter = searchTerm.toLowerCase();
            const filtered = allPartners.filter(partner =>
                partner.displayName?.toLowerCase().includes(lowercasedFilter)
            );
            setFilteredPartners(filtered);
        }
    }, [searchTerm, allPartners]);


    const handleSayHi = (targetUser) => {
        if (!currentUser) { alert("请先登录再打招呼"); return; }
        const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    return (
        <div className="bg-gray-100 dark:bg-black min-h-screen">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* 漂流瓶功能区 */}
                <div 
                    className="relative rounded-2xl shadow-xl overflow-hidden mb-10 h-48 flex items-center justify-center text-center p-4 cursor-pointer group bg-cover bg-center"
                    style={{backgroundImage: "url('https://images.pexels.com/photos/163872/sunrise-sunset-sea-horizon-163872.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')"}}
                >
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
                    <div className="relative z-10">
                        <HeartIcon size={36} className="mx-auto text-white/80 group-hover:text-white group-hover:scale-110 transition-transform"/>
                        <p className="mt-2 text-xl font-bold text-white tracking-wider">漂流瓶</p>
                        <p className="text-sm text-white/80">扔一个瓶子，邂逅一段缘分</p>
                    </div>
                </div>

                {/* ✅ 搜索栏 */}
                <div className="mb-8 px-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="搜索用户名..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                    </div>
                </div>

                {/* ✅ 单列网格布局 */}
                <div className="flex flex-col items-center space-y-6">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => <PartnerCardSkeleton key={i} />)
                    ) : filteredPartners.length > 0 ? (
                        filteredPartners.map(partner => (
                            <LanguagePartnerCard 
                                key={partner.uid} 
                                partner={partner}
                                onSayHi={handleSayHi}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-20">
                            <p className="text-gray-500 text-lg">
                                {searchTerm ? "找不到匹配的用户" : "今天没有新的语伴了，明天再来看看吧！"}
                            </p>
                        </div>
                    )}
                </div>
                 <div className="h-24"></div>
            </div>
        </div>
    );
};


// ===================================================================
// =============  ✅ 现有组件修改  =============
// ===================================================================

const MessageHeader = ({ activeTab, setActiveTab, totalUnreadCount }) => {
  // ✅ 核心修改：更新 Tab 定义，增加书柜
  const tabs = [
    { key: 'messages', name: '私信', icon: <MessageSquare className="w-6 h-6" /> },
    { key: 'discover', name: '动态', icon: <Compass className="w-6 h-6" /> }, 
    { key: 'partners', name: '语伴', icon: <Sparkles className="w-6 h-6" /> }, 
    { key: 'jobs', name: '找工作', icon: <Briefcase className="w-6 h-6" /> },
    { key: 'bookshelf', name: '书柜', icon: <BookOpen className="w-6 h-6" /> }
  ];
  const baseClasses = 'relative flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1/5 transition-colors duration-300'; // w-1/4 -> w-1/5
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

// ✅ 改造：私信列表组件，增加搜索功能
const ConversationList = ({ conversations: initialConversations, loading, user, authLoading }) => {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredConversations = useMemo(() => {
        if (!searchTerm) {
            return initialConversations;
        }
        return initialConversations.filter(convo => 
            convo.otherUser?.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, initialConversations]);

    const handleConversationClick = (convo) => {
        if (!user?.uid || !convo.otherUser?.id) return;
        router.push(`/messages/${convo.id}`);
    };

    if (authLoading || loading) { return <div className="p-8 text-center text-gray-500">正在加载...</div>; }
    if (!user) { return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>; }

    return (
        <div>
            {/* ✅ 搜索框 */}
            <div className="p-4 bg-gray-100 dark:bg-black sticky top-0 z-5">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="搜索好友和聊天记录..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                </div>
            </div>

            {initialConversations.length === 0 && !loading && (
                 <div className="p-8 text-center text-gray-500">还没有任何私信哦。</div>
            )}
            
            {filteredConversations.length === 0 && initialConversations.length > 0 && (
                <div className="p-8 text-center text-gray-500">找不到匹配的聊天记录。</div>
            )}

            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredConversations.map((convo) => {
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
        </div>
    );
};

// ===================================================================
// =============  ✅ 页面主组件 (集成所有功能)  =============
// ===================================================================

const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { user, authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { totalUnreadCount } = useUnreadCount();

  // ✅ 新增：用于手势滑动的标签页顺序
  const tabKeys = ['messages', 'discover', 'partners', 'jobs', 'bookshelf'];

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
    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid), orderBy('lastMessageAt', 'desc'), limit(30)); // 初始加载30条
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

  // ✅ 新增：手势滑动处理
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
        const currentIndex = tabKeys.indexOf(activeTab);
        if (currentIndex < tabKeys.length - 1) {
            setActiveTab(tabKeys[currentIndex + 1]);
        }
    },
    onSwipedRight: () => {
        const currentIndex = tabKeys.indexOf(activeTab);
        if (currentIndex > 0) {
            setActiveTab(tabKeys[currentIndex - 1]);
        }
    },
    preventDefaultTouchmoveEvent: true, // 阻止浏览器默认行为，如页面返回
    trackMouse: true, // 在桌面上也能用鼠标拖动
    delta: 50 // 更灵敏的滑动检测
  });


  const renderContent = () => {
    switch (activeTab) {
      case 'messages': return <ConversationList conversations={conversations} loading={loading} user={user} authLoading={authLoading} />;
      case 'discover': return (<div className="p-8 text-center text-gray-500">动态功能正在开发中...</div>);
      case 'partners': return <LanguagePartnerList />;
      case 'jobs': return (<div className="p-8 text-center text-gray-500">找工作功能正在开发中...</div>);
      case 'bookshelf': return (<div className="p-8 text-center text-gray-500">书柜功能正在开发中...</div>);
      default: return null;
    }
  };

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-black">
        <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} totalUnreadCount={totalUnreadCount}/>
        {/* ✅ 应用手势绑定 */}
        <main className="flex-1" {...swipeHandlers}>
          <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab} 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }} 
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
