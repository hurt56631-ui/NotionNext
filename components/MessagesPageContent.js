// /components/MessagesPageContent.js (最终完整版 - 包含所有原始代码 + 漂流瓶功能)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db, rtDb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { Compass, Briefcase, MessageSquare, Sparkles, User, Users, Heart as HeartIcon, Languages, MapPin, Send, Search, BookOpen, Globe, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';
import { useUnreadCount } from '@/lib/UnreadCountContext'; 
import { useSwipeable } from 'react-swipeable';

// ✅ 核心修改 1: 引入我们需要的漂流瓶组件
// 请确保这些组件的路径相对于 MessagesPageContent.js 是正确的
import ThrowBottleModal from './bottle/ThrowBottleModal'; 
import PickedBottleModal from './bottle/PickedBottleModal';

// ===================================================================
// =============  语伴列表相关组件 (恢复所有原始代码)  =============
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
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 flex items-center space-x-4 animate-pulse">
        <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
        <div className="flex-grow space-y-3">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
        </div>
        <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
    </div>
);


// --- 单个语伴卡片组件 ---
const LanguagePartnerCard = ({ partner, onSayHi }) => {
    const router = useRouter();
    const onlineStatus = usePartnerStatus(partner.uid);
    const interests = partner.interests || [];

    const getBio = (name) => {
        const bios = {
            '兰妮': '你好, 我来自越南😗',
            '想摸鱼': '想交可爱的朋友, 你可以找我👩‍🎤',
            'Helly': 'Mình là Helly rất vui được làm quen với mọi người ❤️❤️'
        };
        return bios[name] || `很高兴认识你！`;
    };

    return (
        <div 
            onClick={() => router.push(`/profile/${partner.uid}`)}
            className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 flex items-center space-x-4 cursor-pointer transition-transform hover:scale-[1.02]"
        >
            <div className="relative flex-shrink-0">
                <img className="w-16 h-16 rounded-full object-cover" src={partner.photoURL || '/img/avatar.svg'} alt={partner.displayName} />
                {onlineStatus === '在线' && (<span className="absolute bottom-0 right-0 block h-4 w-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-800"></span>)}
            </div>
            <div className="flex-grow overflow-hidden">
                <p className="text-lg font-bold text-black dark:text-white truncate">{partner.displayName || '新用户'}</p>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span className="font-semibold">{partner.nativeLanguage || 'VI'}</span>
                    <Languages size={16} className="mx-1.5 text-gray-400" />
                    <span className="font-semibold">{partner.learningLanguage || 'CN'}</span>
                </div>
                {onlineStatus && onlineStatus !== '在线' && (<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{onlineStatus}活跃</p>)}
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 truncate">{getBio(partner.displayName)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">新加入</span>
                    <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">同龄人</span>
                    {interests.slice(0, 2).map(interest => (<span key={interest} className="text-xs font-medium rounded-full px-2.5 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{interest}</span>))}
                </div>
            </div>
            <div className="flex-shrink-0 self-center">
                <button onClick={(e) => { e.stopPropagation(); onSayHi(partner); }} className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center hover:bg-purple-600 shadow-lg transition-all active:scale-90" aria-label="打招呼">
                    <Send size={20} />
                </button>
            </div>
        </div>
    );
};

// --- 语伴列表主组件 (✅ 核心修改: 增加 onBottleClick) ---
const LanguagePartnerList = ({ onBottleClick }) => { // 接收新 prop
    const [allPartners, setAllPartners] = useState([]);
    const [filteredPartners, setFilteredPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { user: currentUser } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const fetchAndCachePartners = async () => {
            if (!currentUser) return;
            setLoading(true);
            const cacheKey = `daily_partners_${currentUser.uid}`;
            const today = new Date().toISOString().split('T')[0];
            try {
                const cachedData = JSON.parse(localStorage.getItem(cacheKey));
                if (cachedData && cachedData.date === today) {
                    setAllPartners(cachedData.partners);
                } else {
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    const q = query(collection(db, 'users'), where('lastSeen', '>=', oneDayAgo), orderBy('lastSeen', 'desc'), limit(50));
                    const querySnapshot = await getDocs(q);
                    const fetchedPartners = [];
                    querySnapshot.forEach((doc) => {
                        const partnerData = { uid: doc.id, ...doc.data() };
                        if (partnerData.uid !== currentUser.uid) { fetchedPartners.push(partnerData); }
                    });
                    setAllPartners(fetchedPartners);
                    localStorage.setItem(cacheKey, JSON.stringify({ date: today, partners: fetchedPartners }));
                }
            } catch (error) { console.error("获取语伴列表失败:", error); } 
            finally { setLoading(false); }
        };
        if (currentUser) { fetchAndCachePartners(); }
    }, [currentUser]);
    
    useEffect(() => {
        if (!searchTerm) { setFilteredPartners(allPartners); } 
        else {
            const lowercasedFilter = searchTerm.toLowerCase();
            const filtered = allPartners.filter(partner => partner.displayName?.toLowerCase().includes(lowercasedFilter));
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
                {/* ✅ 核心修改: 绑定 onClick 事件 */}
                <div 
                    onClick={onBottleClick}
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
                <div className="mb-8 px-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="搜索用户名..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
                    </div>
                </div>
                <div className="flex flex-col items-center space-y-4">
                    {loading ? (Array.from({ length: 4 }).map((_, i) => <PartnerCardSkeleton key={i} />)) 
                    : filteredPartners.length > 0 ? (filteredPartners.map(partner => (<LanguagePartnerCard key={partner.uid} partner={partner} onSayHi={handleSayHi} />))) 
                    : (<div className="col-span-full text-center py-20"><p className="text-gray-500 text-lg">{searchTerm ? "找不到匹配的用户" : "今天没有新的语伴了，明天再来看看吧！"}</p></div>)}
                </div>
                 <div className="h-24"></div>
            </div>
        </div>
    );
};

// ===================================================================
// =============  ✅ 新增：漂流瓶消息列表组件  =============
// ===================================================================
const BottleConversationList = ({ bottles, onBottleClick, loading }) => {
    if (loading) {
        return <div className="p-8 text-center text-gray-500">正在加载瓶子...</div>;
    }
    if (bottles.length === 0) {
        return <div className="p-8 text-center text-gray-500">你还没有捞到任何瓶子哦。</div>;
    }

    return (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {bottles.map((bottle) => (
                <li key={bottle.id} onClick={() => onBottleClick(bottle)} className="relative flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <div className="relative"><img src={bottle.throwerAvatar || '/img/avatar.svg'} alt={bottle.throwerName} className="w-14 h-14 rounded-full object-cover"/></div>
                    <div className="ml-4 flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold truncate dark:text-gray-200">{bottle.throwerName || '一位旅行者'}</p>
                            {bottle.pickedAt && (<p className="text-xs text-gray-400">{new Date(bottle.pickedAt.toDate()).toLocaleDateString()}</p>)}
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-1">{bottle.content || '...'}</p>
                    </div>
                </li>
            ))}
        </ul>
    );
};


// ===================================================================
// =============  私信列表组件 (增加子标签切换)  =============
// ===================================================================
const PrivateMessageList = ({ conversations, loading, user, authLoading }) => {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredConversations = useMemo(() => {
        if (!searchTerm) { return conversations; }
        return conversations.filter(convo => convo.otherUser?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, conversations]);

    const handleConversationClick = (convo) => {
        if (!user?.uid || !convo.otherUser?.id) return;
        router.push(`/messages/${convo.id}`);
    };

    if (authLoading || loading) { return <div className="p-8 text-center text-gray-500">正在加载...</div>; }
    if (!user) { return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>; }

    return (
        <div>
            <div className="p-4 bg-gray-100 dark:bg-black sticky top-[48px] z-5"> {/* Adjust top positioning */}
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input type="text" placeholder="搜索好友和聊天记录..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
                </div>
            </div>
            {conversations.length === 0 && !loading && (<div className="p-8 text-center text-gray-500">还没有任何私信哦。</div>)}
            {filteredConversations.length === 0 && conversations.length > 0 && (<div className="p-8 text-center text-gray-500">找不到匹配的聊天记录。</div>)}
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredConversations.map((convo) => {
                    if (!convo || !convo.otherUser) { return null; }
                    return (
                        <li key={convo.id} onClick={() => handleConversationClick(convo)} className="relative flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                            <div className="relative"><img src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className="w-14 h-14 rounded-full object-cover"/></div>
                            <div className="ml-4 flex-1 overflow-hidden">
                                <div className="flex justify-between items-center"><p className="font-semibold truncate dark:text-gray-200">{convo.otherUser.displayName || '未知用户'}</p>{convo.lastMessageAt && (<p className="text-xs text-gray-400">{new Date(convo.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>)}</div>
                                <div className="flex justify-between items-start mt-1"><p className="text-sm text-gray-500 truncate">{convo.lastMessage || '...'}</p> {convo.unreadCount > 0 && (<span className="ml-2 flex-shrink-0 text-xs text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center font-semibold">{convo.unreadCount > 99 ? '99+' : convo.unreadCount}</span>)}</div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};


// ===================================================================
// =============  现有组件修改 (恢复所有原始代码)  =============
// ===================================================================
const MessageHeader = ({ activeTab, setActiveTab, totalUnreadCount }) => {
  const tabs = [{ key: 'messages', name: '私信', icon: <MessageSquare className="w-6 h-6" /> }, { key: 'discover', name: '动态', icon: <Compass className="w-6 h-6" /> }, { key: 'partners', name: '语伴', icon: <Sparkles className="w-6 h-6" /> }, { key: 'jobs', name: '找工作', icon: <Briefcase className="w-6 h-6" /> }, { key: 'bookshelf', name: '书柜', icon: <BookOpen className="w-6 h-6" /> }];
  const baseClasses = 'relative flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1/5 transition-colors duration-300';
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

// ===================================================================
// =============  ✅ 页面主组件 (集成所有功能)  =============
// ===================================================================
const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { user, authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const { totalUnreadCount } = useUnreadCount();

  // ✅ 新增：漂流瓶功能相关 state
  const [isThrowModalOpen, setThrowModalOpen] = useState(false);
  const [pickedBottle, setPickedBottle] = useState(null);
  const [bottleConversations, setBottleConversations] = useState([]);
  const [loadingBottles, setLoadingBottles] = useState(true);

  const tabKeys = ['messages', 'discover', 'partners', 'jobs', 'bookshelf'];

  // 获取私信列表的 useEffect (恢复原始代码)
  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoadingConversations(false);
      setConversations([]);
      return;
    }
    if (activeTab !== 'messages') return;
    setLoadingConversations(true);
    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid), orderBy('lastMessageAt', 'desc'), limit(30));
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
                if (userProfileDoc.exists()) { chat.otherUser = { id: userProfileDoc.id, ...userProfileDoc.data() }; } 
                else { chat.otherUser.displayName = '未知用户'; }
            } catch (error) {
                console.error(`获取用户 ${chat.otherUser.id} 信息失败:`, error);
                chat.otherUser.displayName = '加载失败';
            }
            return chat;
        }));
        setConversations(resolvedChats.filter(Boolean));
        setLoadingConversations(false);
      }, (error) => { console.error('获取会话列表出错:', error); setLoadingConversations(false); }
    );
    return () => unsubscribe();
  }, [user, authLoading, activeTab]);

  // ✅ 新增：获取捞到的瓶子列表的 useEffect
  useEffect(() => {
      if (!user) {
          setBottleConversations([]);
          setLoadingBottles(false);
          return;
      }
      setLoadingBottles(true);
      const bottlesQuery = query(collection(db, 'bottles'), where('pickedBy', '==', user.uid), orderBy('pickedAt', 'desc'));
      const unsubscribe = onSnapshot(bottlesQuery, (snapshot) => {
          const fetchedBottles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setBottleConversations(fetchedBottles);
          setLoadingBottles(false);
      }, (error) => {
          console.error("获取漂流瓶消息失败:", error);
          setLoadingBottles(false);
      });
      return () => unsubscribe();
  }, [user]);

  // 手势滑动处理 (恢复原始代码)
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
        const currentIndex = tabKeys.indexOf(activeTab);
        if (currentIndex < tabKeys.length - 1) { setActiveTab(tabKeys[currentIndex + 1]); }
    },
    onSwipedRight: () => {
        const currentIndex = tabKeys.indexOf(activeTab);
        if (currentIndex > 0) { setActiveTab(tabKeys[currentIndex - 1]); }
    },
    preventDefaultTouchmoveEvent: true, trackMouse: true, delta: 50
  });

  // ✅ 修改：新的子标签页 state
  const [messageType, setMessageType] = useState('private'); // 'private' or 'bottle'

  const renderContent = () => {
    switch (activeTab) {
      case 'messages': 
        return (
            <div>
                {/* 子标签切换 */}
                <div className="p-2 bg-gray-100 dark:bg-black sticky top-0 z-5 flex justify-center gap-4">
                    <button onClick={() => setMessageType('private')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${messageType === 'private' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>私信</button>
                    <button onClick={() => setMessageType('bottle')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${messageType === 'bottle' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>瓶子消息</button>
                </div>
                {messageType === 'private' ? 
                    (<PrivateMessageList conversations={conversations} loading={loadingConversations} user={user} authLoading={authLoading} />) : 
                    (<BottleConversationList bottles={bottleConversations} loading={loadingBottles} onBottleClick={(bottle) => setPickedBottle(bottle)} />)
                }
            </div>
        );
      case 'discover': return (<div className="p-8 text-center text-gray-500">动态功能正在开发中...</div>);
      case 'partners': return <LanguagePartnerList onBottleClick={() => setThrowModalOpen(true)} />;
      case 'jobs': return (<div className="p-8 text-center text-gray-500">找工作功能正在开发中...</div>);
      case 'bookshelf': return (<div className="p-8 text-center text-gray-500">书柜功能正在开发中...</div>);
      default: return null;
    }
  };

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-black">
        <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} totalUnreadCount={totalUnreadCount}/>
        <main className="flex-1" {...swipeHandlers}>
          <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {renderContent()}
              </motion.div>
          </AnimatePresence>
        </main>
      </div>
      
      {/* ✅ 核心修改: 在页面底部添加模态框组件 */}
      <ThrowBottleModal isOpen={isThrowModalOpen} onClose={() => setThrowModalOpen(false)} />
      {pickedBottle && (<PickedBottleModal bottle={pickedBottle} onClose={() => setPickedBottle(null)} />)}
    </LayoutBase>
  );
};

export default MessagesPageContent;
