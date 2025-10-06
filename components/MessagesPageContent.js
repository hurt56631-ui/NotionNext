// /components/MessagesPageContent.js (最终优化版)

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db, rtDb } from '@/lib/firebase';
// [OPTIMIZATION] 引入 get, onValue 以便更精细地控制 RTDB
import { ref, onValue, get } from 'firebase/database';
// [OPTIMIZATION] 引入 Timestamp 用于更安全的日期查询
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { Compass, Briefcase, MessageSquare, Sparkles, User, Users, Heart as HeartIcon, Languages, MapPin, Send, Search, BookOpen, Globe } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';
import { useUnreadCount } from '@/lib/UnreadCountContext'; 
import { useSwipeable } from 'react-swipeable';
// [OPTIMIZATION] 引入虚拟列表库
import { Virtuoso } from 'react-virtuoso';

// ===================================================================
// =============  ✅ 优化后的语伴列表相关组件  =============
// ===================================================================

// --- 时间格式化辅助函数 (无变化) ---
const formatLastSeen = (timestamp) => {
    if (!timestamp) return null;
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 2) return "在线"; 
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    
    return null;
};

// --- 单个语伴卡片骨架屏 (无变化) ---
const PartnerCardSkeleton = () => (
    <div className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-2xl overflow-hidden shadow-lg animate-pulse">
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <div className="h-6 bg-gray-400 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-400 rounded w-1/3"></div>
        </div>
    </div>
);

// --- 单个语伴卡片组件 (优化版) ---
// [OPTIMIZATION] 使用 React.memo 避免不必要的重渲染
const LanguagePartnerCard = React.memo(({ partner, onSayHi }) => {
    const router = useRouter();
    // [OPTIMIZATION] 直接从 prop 接收 onlineStatus，不再自己调用 hook
    const onlineStatus = partner.onlineStatus || null;
    const interests = partner.interests || [];

    return (
        // [OPTIMIZATION] 为列表项增加一个外层 div，用于虚拟列表的布局
        <div className="py-3 flex justify-center">
            <div 
                onClick={() => router.push(`/profile/${partner.uid}`)}
                className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg group cursor-pointer"
            >
                {/* [OPTIMIZATION] 添加 loading="lazy" 优化图片加载 */}
                <img 
                    loading="lazy"
                    src={partner.profileBackground || partner.photoURL || '/img/bg_fallback.jpg'} 
                    alt={`${partner.displayName} 的背景`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                 {onlineStatus && (
                    <div className="absolute top-4 left-4 flex items-center bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${onlineStatus === '在线' ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                        {onlineStatus}
                    </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col justify-end p-4 text-white">
                    <div className="absolute top-4 right-4">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onSayHi(partner); }}
                            className="w-12 h-12 rounded-full bg-blue-500/80 backdrop-blur-sm text-white flex items-center justify-center hover:bg-blue-500 shadow-lg transition-all active:scale-90"
                            aria-label="打招呼"
                        >
                            <Send size={20} />
                        </button>
                    </div>
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
        </div>
    );
});
LanguagePartnerCard.displayName = 'LanguagePartnerCard'; // For React DevTools

// --- 语伴列表主组件 (性能优化版) ---
const LanguagePartnerList = () => {
    const [allPartners, setAllPartners] = useState([]);
    const [filteredPartners, setFilteredPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    // [OPTIMIZATION] 使用防抖搜索
    const [rawSearchTerm, setRawSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const { user: currentUser } = useAuth();
    const router = useRouter();

    // [OPTIMIZATION] 以下是为虚拟列表和动态订阅在线状态新增的状态和 Ref
    const [visibleRange, setVisibleRange] = useState({ startIndex: 0, endIndex: 0 });
    const [presenceMap, setPresenceMap] = useState({}); // { userId: '在线' | '5分钟前' | null }
    const presenceUnsubsRef = useRef({}); // 保存当前的 unsubscribe 函数

    // [OPTIMIZATION] 搜索防抖
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(rawSearchTerm);
        }, 300); // 300ms延迟
        return () => clearTimeout(handler);
    }, [rawSearchTerm]);

    // 数据获取和缓存逻辑 (已优化 localStorage 序列化)
    useEffect(() => {
        const fetchAndCachePartners = async () => {
            if (!currentUser) return;
            setLoading(true);

            const cacheKey = `daily_partners_${currentUser.uid}`;
            const today = new Date().toISOString().split('T')[0];
            
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const cachedData = JSON.parse(cachedItem);
                    if (cachedData && cachedData.date === today) {
                        // [OPTIMIZATION] 将毫秒数转回 Date 对象 (如果需要)
                        const partnersFromCache = cachedData.partners.map(p => ({
                            ...p,
                            lastSeen: p.lastSeenMs ? new Date(p.lastSeenMs) : null,
                        }));
                        setAllPartners(partnersFromCache);
                        setLoading(false);
                        return;
                    }
                }
                
                // [OPTIMIZATION] 使用 Timestamp 进行查询
                const oneDayAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
                const q = query(
                    collection(db, 'users'),
                    where('lastSeen', '>=', oneDayAgo),
                    orderBy('lastSeen', 'desc'),
                    limit(50)
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

                // [OPTIMIZATION] 序列化 Timestamp 为毫秒数再存储
                const serializablePartners = fetchedPartners.map(p => {
                    const { lastSeen, ...rest } = p;
                    return {
                        ...rest,
                        lastSeenMs: lastSeen?.toMillis ? lastSeen.toMillis() : null,
                    };
                });
                localStorage.setItem(cacheKey, JSON.stringify({ date: today, partners: serializablePartners }));

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
    
    // 搜索过滤逻辑
    useEffect(() => {
        if (!debouncedSearchTerm) {
            setFilteredPartners(allPartners);
        } else {
            const lowercasedFilter = debouncedSearchTerm.toLowerCase();
            const filtered = allPartners.filter(partner =>
                partner.displayName?.toLowerCase().includes(lowercasedFilter)
            );
            setFilteredPartners(filtered);
        }
    }, [debouncedSearchTerm, allPartners]);

    // [OPTIMIZATION] 清理所有 presence 监听器的辅助函数
    const cleanupPresenceListeners = useCallback(() => {
        Object.values(presenceUnsubsRef.current).forEach((unsub) => {
            if (typeof unsub === 'function') unsub();
        });
        presenceUnsubsRef.current = {};
    }, []);

    // [OPTIMIZATION] 核心优化：只订阅可见范围内用户的在线状态
    useEffect(() => {
        if (!rtDb || filteredPartners.length === 0) return;

        const currentSubs = { ...presenceUnsubsRef.current };
        const newSubs = {};
        const visibleIds = new Set();
        
        const start = visibleRange.startIndex ?? 0;
        const end = Math.min(visibleRange.endIndex ?? start, filteredPartners.length - 1);
        
        for (let i = start; i <= end; i++) {
            const partner = filteredPartners[i];
            if (!partner?.uid) continue;
            visibleIds.add(partner.uid);

            if (currentSubs[partner.uid]) {
                newSubs[partner.uid] = currentSubs[partner.uid];
                delete currentSubs[partner.uid];
            } else {
                const statusRef = ref(rtDb, `/status/${partner.uid}`);
                // 先用 get() 快速获取一次初始状态，避免等待 onValue
                get(statusRef).then(snapshot => {
                    if (!snapshot.exists()) return;
                    const data = snapshot.val();
                    const status = data?.state === 'online' ? '在线' : (data?.last_changed ? formatLastSeen(data.last_changed) : null);
                    setPresenceMap(prev => ({ ...prev, [partner.uid]: status }));
                }).catch(() => {});

                // 然后用 onValue 订阅实时更新
                const unsub = onValue(statusRef, (snapshot) => {
                    if (!snapshot.exists()) {
                         setPresenceMap(prev => ({ ...prev, [partner.uid]: null }));
                         return;
                    }
                    const data = snapshot.val();
                    const status = data?.state === 'online' ? '在线' : (data?.last_changed ? formatLastSeen(data.last_changed) : null);
                    setPresenceMap(prev => ({ ...prev, [partner.uid]: status }));
                });
                newSubs[partner.uid] = unsub;
            }
        }
        
        // 取消订阅已经不可见的用户的状态
        Object.values(currentSubs).forEach(unsub => unsub());
        presenceUnsubsRef.current = newSubs;

        return () => {
            // 组件卸载时，清理所有监听器
            cleanupPresenceListeners();
        };
    }, [visibleRange, filteredPartners, rtDb, cleanupPresenceListeners]);


    const handleSayHi = (targetUser) => {
        if (!currentUser) { alert("请先登录再打招呼"); return; }
        const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    return (
        <div className="bg-gray-100 dark:bg-black min-h-screen">
            <div className="max-w-7xl mx-auto px-4 py-8">
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

                <div className="mb-8 px-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="搜索用户名..."
                            value={rawSearchTerm}
                            onChange={(e) => setRawSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                    </div>
                </div>

                {/* [OPTIMIZATION] 使用 Virtuoso 虚拟列表渲染 */}
                <div className="h-[calc(100vh-300px)]"> {/* 给虚拟列表一个确定的高度 */}
                    {loading ? (
                        <div className="flex flex-col items-center space-y-6">
                            {Array.from({ length: 3 }).map((_, i) => <PartnerCardSkeleton key={i} />)}
                        </div>
                    ) : filteredPartners.length > 0 ? (
                        <Virtuoso
                            data={filteredPartners}
                            rangeChanged={setVisibleRange}
                            itemContent={(index, partner) => (
                                <LanguagePartnerCard
                                    key={partner.uid}
                                    partner={{ ...partner, onlineStatus: presenceMap[partner.uid] }}
                                    onSayHi={handleSayHi}
                                />
                            )}
                        />
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-gray-500 text-lg">
                                {debouncedSearchTerm ? "找不到匹配的用户" : "今天没有新的语伴了，明天再来看看吧！"}
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
// =============  ✅ 现有组件修改 (无大变化) =============
// ===================================================================

const MessageHeader = ({ activeTab, setActiveTab, totalUnreadCount }) => {
  const tabs = [
    { key: 'messages', name: '私信', icon: <MessageSquare className="w-6 h-6" /> },
    { key: 'discover', name: '动态', icon: <Compass className="w-6 h-6" /> }, 
    { key: 'partners', name: '语伴', icon: <Sparkles className="w-6 h-6" /> }, 
    { key: 'jobs', name: '找工作', icon: <Briefcase className="w-6 h-6" /> },
    { key: 'bookshelf', name: '书柜', icon: <BookOpen className="w-6 h-6" /> }
  ];
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


const ConversationList = ({ conversations: initialConversations, loading, user, authLoading }) => {
    const router = useRouter();
    // [OPTIMIZATION] 使用防抖搜索
    const [rawSearchTerm, setRawSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    // [OPTIMIZATION] 搜索防抖
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(rawSearchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [rawSearchTerm]);

    const filteredConversations = useMemo(() => {
        if (!debouncedSearchTerm) {
            return initialConversations;
        }
        return initialConversations.filter(convo => 
            convo.otherUser?.displayName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
    }, [debouncedSearchTerm, initialConversations]);

    const handleConversationClick = (convo) => {
        if (!user?.uid || !convo.otherUser?.id) return;
        router.push(`/messages/${convo.id}`);
    };

    if (authLoading || loading) { return <div className="p-8 text-center text-gray-500">正在加载...</div>; }
    if (!user) { return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>; }

    return (
        <div>
            <div className="p-4 bg-gray-100 dark:bg-black sticky top-0 z-5">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="搜索好友和聊天记录..."
                        value={rawSearchTerm}
                        onChange={(e) => setRawSearchTerm(e.target.value)}
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
                            {/* [OPTIMIZATION] 添加 loading="lazy" 优化图片加载 */}
                            <div className="relative"><img loading="lazy" src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className="w-14 h-14 rounded-full object-cover"/></div>
                            <div className="ml-4 flex-1 overflow-hidden">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold truncate dark:text-gray-200">{convo.otherUser.displayName || '未知用户'}</p>
                                    {convo.lastMessageAt?.toDate && (
                                        <p className="text-xs text-gray-400">{new Date(convo.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    )}
                                </div>
                                <div className="flex justify-between items-start mt-1">
                                    <p className="text-sm text-gray-500 truncate">{convo.lastMessage || '...'}</p>
                                    {convo.unreadCount > 0 && (
                                        <span className="ml-2 flex-shrink-0 text-xs text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center font-semibold">{convo.unreadCount > 99 ? '99+' : convo.unreadCount}</span>
                                    )}
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
// =============  ✅ 页面主组件 (核心数据流优化)  =============
// ===================================================================

const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { user, authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { totalUnreadCount } = useUnreadCount();
  const tabKeys = ['messages', 'discover', 'partners', 'jobs', 'bookshelf'];

  // [OPTIMIZATION] 使用 Ref 缓存用户 Profile，避免重复读取和触发重渲染
  const userProfileCache = useRef(new Map());

  // [OPTIMIZATION] 批量获取用户信息的辅助函数
  const fetchUsersByIds = async (ids = []) => {
    const result = {};
    if (ids.length === 0) return result;
    // Firestore 'in' 查询最多支持10个元素，需要分块
    const chunkSize = 10;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        result[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
    }
    return result;
  };

  // [OPTIMIZATION] 核心优化：重写会话列表的数据获取逻辑
  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      setConversations([]);
      return;
    }

    if (activeTab !== 'messages') {
        return;
    }

    setLoading(true);
    const chatsQuery = query(
        collection(db, 'privateChats'), 
        where('members', 'array-contains', user.uid), 
        orderBy('lastMessageAt', 'desc'), 
        limit(30)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      try {
        const otherIdsToFetch = new Set();
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const otherId = (data.members || []).find(id => id !== user.uid);
          // 如果缓存中没有，才需要去获取
          if (otherId && !userProfileCache.current.has(otherId)) {
            otherIdsToFetch.add(otherId);
          }
        });

        // 批量获取缺失的用户信息并更新缓存
        if (otherIdsToFetch.size > 0) {
          const fetchedProfiles = await fetchUsersByIds(Array.from(otherIdsToFetch));
          Object.entries(fetchedProfiles).forEach(([id, profile]) => {
            userProfileCache.current.set(id, profile);
          });
        }

        // 使用缓存数据构建最终的会话列表
        const resolvedChats = snapshot.docs.map(docSnap => {
          const chatData = docSnap.data();
          const otherUserId = chatData.members.find((id) => id !== user.uid);
          const otherUser = otherUserId 
            ? userProfileCache.current.get(otherUserId) || { id: otherUserId, displayName: '未知用户', photoURL: '/img/avatar.svg' }
            : { id: null, displayName: '加载失败', photoURL: '/img/avatar.svg' };

          return {
            id: docSnap.id,
            ...chatData,
            unreadCount: chatData.unreadCounts?.[user.uid] || 0,
            otherUser,
          };
        });

        setConversations(resolvedChats.filter(Boolean));
      } catch (error) {
        console.error('获取会话并合并用户信息失败:', error);
      } finally {
        setLoading(false);
      }
    }, (error) => { 
        console.error('获取会话列表出错:', error); 
        setLoading(false); 
    });

    return () => unsubscribe();
  }, [user, authLoading, activeTab]);

  // 手势滑动处理 (无变化)
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
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
    delta: 50
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
