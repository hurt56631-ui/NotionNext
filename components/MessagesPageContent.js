// /components/MessagesPageContent.js (修改版 - 已应用所有新需求)

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db, rtDb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, updateDoc } from 'firebase/firestore';
import { Compass, Briefcase, MessageSquare, Sparkles, User, Users, Heart as HeartIcon, Languages, MapPin, Send, Search, BookOpen, Globe, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';
import { useUnreadCount } from '@/lib/UnreadCountContext';
import { useSwipeable } from 'react-swipeable';
import VerticalShortVideoPlayer from '@/themes/heo/components/VerticalShortVideoPlayer';

// ===================================================================
// =============  ✅ 0. 可复用组件和工具函数  =============
// ===================================================================

/**
 * ✅ 带国旗的头像组件 (已使用背景图技术彻底修复变形问题)
 * @param {object} user - 包含 photoURL 和 countryCode 的用户对象
 * @param {string} sizeClass - Tailwind CSS 尺寸类名 (例如 'w-14 h-14')
 * @param {string} flagSizeClass - Tailwind CSS 旗帜尺寸类名 (例如 'w-5 h-5')
 */
const AvatarWithFlag = ({ user, sizeClass = 'w-14 h-14', flagSizeClass = 'w-5 h-5' }) => {
    if (!user) return null;

    const countryCode = user.countryCode || 'vn'; // 默认越南国旗

    return (
        <div className={`relative flex-shrink-0 ${sizeClass}`}>
            {/* 使用 div 和 background-image 来完美处理任何形状的图片，杜绝变形 */}
            <div
                className="w-full h-full rounded-full bg-cover bg-center bg-gray-200"
                style={{ backgroundImage: `url(${user.photoURL || '/img/avatar.svg'})` }}
            />
            <img 
                className={`absolute -bottom-1 -right-1 ${flagSizeClass} rounded-full border-2 border-white object-cover`} 
                src={`https://flagcdn.com/${countryCode.toLowerCase()}.svg`} 
                alt={`${countryCode} flag`}
                // 如果国旗图片加载失败，隐藏它
                onError={(e) => { e.target.style.display = 'none'; }}
            />
        </div>
    );
};


/**
 * 将 Firestore Timestamp 或 Date 对象格式化为相对时间字符串
 */
const formatRelativeTime = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days === 1) return '昨天';
    if (days > 1 && days < 7) return `${days}天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};


// ===================================================================
// =============  ✅ 1. 语伴列表及相关组件  =============
// ===================================================================

const usePartnerStatus = (partnerId) => {
    const [status, setStatus] = useState({ text: null, isOnline: false });
    useEffect(() => {
        if (!partnerId || !rtDb) return;
        const statusRef = ref(rtDb, `/status/${partnerId}`);
        const unsubscribe = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.state === 'online') {
                setStatus({ text: '当前活跃', isOnline: true });
            } else {
                setStatus({ text: null, isOnline: false });
            }
        });
        return () => unsubscribe();
    }, [partnerId]);
    return status;
};

const PartnerListItem = ({ partner, onSayHi }) => {
    const router = useRouter();
    const { text: statusText, isOnline } = usePartnerStatus(partner.uid);
    
    const genderSymbol = partner.gender === 'male' ? '♂' : partner.gender === 'female' ? '♀' : '';
    const genderColor = partner.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600';

    return (
        <div className="relative w-full max-w-4xl mx-auto flex items-center p-3 space-x-3">
            <div className="cursor-pointer" onClick={() => router.push(`/profile/${partner.uid}`)}>
                <AvatarWithFlag user={partner} sizeClass="w-14 h-14" flagSizeClass="w-5 h-5"/>
            </div>
            
            <div className="flex-grow flex items-center min-w-0">
                <div className="flex-grow overflow-hidden cursor-pointer min-w-0" onClick={() => router.push(`/profile/${partner.uid}`)}>
                    <div className="flex items-center space-x-2">
                        <p className="text-base font-semibold text-gray-800 truncate">{partner.displayName || '新用户'}</p>
                        {partner.age && ( <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md text-gray-600 bg-gray-100"> {partner.age} </span> )}
                        {genderSymbol && ( <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${genderColor}`}> {genderSymbol} </span> )}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mt-1 space-x-1.5">
                        <div className="flex items-center bg-green-100 text-green-800 px-2 py-0.5 rounded"> <span>{partner.nativeLanguage || 'VI'}</span> </div>
                        <Languages size={14} className="text-gray-400 flex-shrink-0" />
                        <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-0.5 rounded"> <span>{partner.learningLanguage || 'CN'}</span> </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1.5 truncate">{partner.bio || '很高兴认识你！'}</p>
                    {isOnline && <p className="text-xs text-green-500 mt-1">{statusText}</p>}
                    
                    {partner.interests && partner.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {partner.interests.slice(0, 3).map(interest => (
                                <span key={interest} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{interest}</span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-shrink-0 ml-2">
                    {/* ✅ 修复：确认打招呼按钮样式为白色背景 */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onSayHi(partner); }}
                        className="w-10 h-10 rounded-full bg-white text-green-500 border border-gray-200 flex items-center justify-center hover:bg-gray-100 shadow-sm transition-all active:scale-90"
                        aria-label="打招呼"
                    >
                        <MessageCircle size={20} />
                    </button>
                </div>
            </div>
            <div className="absolute bottom-0 left-[76px] right-0 h-px bg-gray-200" />
        </div>
    );
};

const LanguagePartnerList = () => { /* ... 此组件代码未变动，保持原样 ... */
    const router = useRouter();
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user: currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser) { setLoading(false); return; }
        const q = query(collection(db, 'users'), where('uid', '!=', currentUser.uid), limit(20));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPartners = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setPartners(fetchedPartners);
            setLoading(false);
        }, (error) => { console.error("获取语伴列表失败:", error); setLoading(false); });
        return () => unsubscribe();
    }, [currentUser]);

    const handleSayHi = (targetUser) => {
        if (!currentUser) return;
        const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    return (
        <div className="bg-white min-h-screen">
            <div className="sticky top-0 bg-white z-10 p-3 border-b border-gray-200">
                <div className="flex justify-between items-center mb-3">
                    <h1 className="text-xl font-bold text-gray-900">寻找语伴</h1>
                    <Search size={20} className="text-gray-500" />
                </div>
                <div className="flex space-x-2">
                    <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-800 rounded-full flex items-center">语言 <span className="ml-1 bg-green-500 text-white text-xs px-1.5 rounded-full">VI</span></button>
                    <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-800 rounded-full">国家 🌍</button>
                    <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-800 rounded-full">性别 全部</button>
                </div>
            </div>
            <div className="flex flex-col">
                <div className="p-3 border-b border-gray-200 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => router.push('/bottle')}>
                    <p className="font-semibold text-gray-800">🌊 进入漂流瓶海洋</p>
                    <p className="text-xs text-gray-500">扔一个瓶子，邂逅一段缘分</p>
                </div>
                {loading 
                    ? Array.from({ length: 5 }).map((_, i) => <PartnerListItemSkeleton key={i} />)
                    // @ts-ignore
                    : partners.map((partner) => <PartnerListItem key={partner.uid} partner={partner} onSayHi={handleSayHi} />)
                }
            </div>
            <div className="h-24"></div>
        </div>
    );
};


// ===================================================================
// =============  ✅ 2. 消息列表及其他页面组件  =============
// ===================================================================

const MessageHeader = ({ activeTab, setActiveTab, totalUnreadCount }) => {
  const tabs = [ { key: 'messages', name: '私信', icon: <MessageSquare className="w-6 h-6" /> }, { key: 'discover', name: '动态', icon: <Compass className="w-6 h-6" /> }, { key: 'partners', name: '语伴', icon: <Sparkles className="w-6 h-6" /> }, { key: 'jobs', name: '找工作', icon: <Briefcase className="w-6 h-6" /> }, { key: 'bookshelf', name: '书柜', icon: <BookOpen className="w-6 h-6" /> } ];
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

const ConversationListItem = ({ convo, onClick, onPin, onDelete, currentUser }) => { /* ... 此组件代码未变动，保持原样 ... */
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const timerRef = useRef(null);
    const touchStartPos = useRef({ x: 0, y: 0 });

    const isPinned = convo[`isPinned_${currentUser?.uid}`] || false;

    const handleTouchStart = (e) => {
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        timerRef.current = setTimeout(() => { setIsMenuOpen(true); }, 500);
    };

    const handleTouchMove = (e) => {
        const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
        const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
        if (deltaX > 10 || deltaY > 10) { clearTimeout(timerRef.current); }
    };

    const handleTouchEnd = () => { clearTimeout(timerRef.current); };
    const handleContextMenu = (e) => { e.preventDefault(); setIsMenuOpen(true); };
    const handleCloseMenu = () => setIsMenuOpen(false);

    const handlePinClick = (e) => {
        e.stopPropagation();
        onPin(convo);
        handleCloseMenu();
    };

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        onDelete(convo.id);
        handleCloseMenu();
    };

    if (!convo || !convo.otherUser) { return null; }

    return (
        <li
            onClick={() => { if (!isMenuOpen) onClick(convo); }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={handleContextMenu}
            className={`relative flex items-center p-4 transition-colors ${isPinned ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
        >
            <AvatarWithFlag user={convo.otherUser} sizeClass="w-14 h-14" flagSizeClass="w-5 h-5"/>
            
            <div className="ml-4 flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                    <p className="font-semibold truncate text-gray-800">{convo.otherUser.displayName || '未知用户'}</p>
                    {convo.lastMessageAt && (<p className="text-xs text-gray-500">{formatRelativeTime(convo.lastMessageAt)}</p>)}
                </div>
                <div className="flex justify-between items-start mt-1">
                    <p className="text-base text-gray-600 truncate">{convo.lastMessage || '...'}</p>
                    {convo.unreadCount > 0 && (<span className="ml-2 flex-shrink-0 text-xs text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center font-semibold">{convo.unreadCount > 99 ? '99+' : convo.unreadCount}</span>)}
                </div>
            </div>

            <AnimatePresence>
            {isMenuOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); handleCloseMenu(); }} />
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-1/2 right-6 -translate-y-1/2 z-30 bg-white shadow-xl rounded-lg flex text-sm overflow-hidden border border-gray-200"
                    >
                        <button onClick={handlePinClick} className="px-4 py-2.5 hover:bg-gray-100 transition-colors">{isPinned ? '取消置顶' : '置顶'}</button>
                        <div className="w-px bg-gray-200"></div>
                        <button onClick={handleDeleteClick} className="px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors">删除</button>
                    </motion.div>
                </>
            )}
            </AnimatePresence>
            <div className="absolute bottom-0 left-[80px] right-0 h-px bg-gray-200" />
        </li>
    );
};

const ConversationList = ({ conversations: initialConversations, loading, user, authLoading }) => { /* ... 此组件代码未变动，保持原样 ... */
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const handlePinConversation = async (convo) => {
        if (!user) return;
        const chatRef = doc(db, 'privateChats', convo.id);
        const pinField = `isPinned_${user.uid}`;
        const currentPinStatus = convo[pinField] || false;
        try {
            await updateDoc(chatRef, { [pinField]: !currentPinStatus });
        } catch (error) {
            console.error("置顶操作失败:", error);
        }
    };

    const handleDeleteConversation = async (chatId) => {
        if (!user) return;
        const chatRef = doc(db, 'privateChats', chatId);
        const deleteField = `isHiddenFor_${user.uid}`;
        try {
            await updateDoc(chatRef, { [deleteField]: true });
        } catch (error) {
            console.error("删除操作失败:", error);
        }
    };

    const sortedAndFilteredConversations = useMemo(() => {
        const sorted = [...initialConversations].sort((a, b) => {
            const aIsPinned = a[`isPinned_${user?.uid}`] || false;
            const bIsPinned = b[`isPinned_${user?.uid}`] || false;
            if (aIsPinned !== bIsPinned) {
                return aIsPinned ? -1 : 1;
            }
            return (b.lastMessageAt?.toMillis() || 0) - (a.lastMessageAt?.toMillis() || 0);
        });

        if (!searchTerm) { return sorted; }
        return sorted.filter(convo => convo.otherUser?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, initialConversations, user]);

    const handleConversationClick = (convo) => {
        if (!user?.uid || !convo.otherUser?.id) return;
        router.push(`/messages/${convo.id}`);
    };

    if (authLoading || loading) { return <div className="p-8 text-center text-gray-500">正在加载...</div>; }
    if (!user) { return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>; }

    return (
        <div className="bg-white">
            <div className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input type="text" placeholder="搜索好友和聊天记录..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                </div>
            </div>
            {initialConversations.length === 0 && !loading && (<div className="p-8 text-center text-gray-500">还没有任何私信哦。</div>)}
            {sortedAndFilteredConversations.length === 0 && initialConversations.length > 0 && (<div className="p-8 text-center text-gray-500">找不到匹配的聊天记录。</div>)}
            
            <ul>
                {sortedAndFilteredConversations.map((convo) => (
                    <ConversationListItem
                        key={convo.id}
                        convo={convo}
                        onClick={handleConversationClick}
                        onPin={handlePinConversation}
                        onDelete={handleDeleteConversation}
                        currentUser={user}
                    />
                ))}
            </ul>
        </div>
    );
};

// ✅ 新增：书柜页面组件，用于内嵌网页
const BookshelfPage = () => {
    return (
        <div className="w-full h-full">
            <iframe
                src="https://books.843075.xyz"
                title="书柜"
                className="w-full h-full border-0"
            />
        </div>
    );
};

// ===================================================================
// =============  ✅ 3. 页面主组件 (集成所有修改)  =============
// ===================================================================
const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { user, authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { totalUnreadCount } = useUnreadCount();
  
  // ✅ 修复：将 'bookshelf' 重新加入 tabKeys 数组，以支持手势切换
  const tabKeys = ['messages', 'discover', 'partners', 'jobs', 'bookshelf'];
  
  const pageContainerRef = useRef(null);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      setConversations([]);
      return;
    }
    if (activeTab !== 'messages') { return; }
    
    setLoading(true);

    const chatsQuery = query(
        collection(db, 'privateChats'), 
        where('members', 'array-contains', user.uid),
        orderBy('lastMessageAt', 'desc'), 
        limit(50)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const chatsWithPlaceholders = snapshot.docs.map(doc => {
          const chatData = doc.data();
          const unreadCount = chatData.unreadCounts?.[user.uid] || 0;
          const otherUserId = chatData.members.find((id) => id !== user.uid);
          return { id: doc.id, ...chatData, unreadCount: unreadCount, otherUser: { id: otherUserId || null, displayName: '加载中...', photoURL: '/img/avatar.svg' } };
        });
        
        const resolvedChats = await Promise.all(chatsWithPlaceholders.map(async (chat) => {
            if (!chat.otherUser.id) return null;
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

        const visibleChats = resolvedChats.filter(chat => {
            return chat && !chat[`isHiddenFor_${user.uid}`];
        });

        setConversations(visibleChats);
        setLoading(false);
      }, (error) => { console.error('获取会话列表出错:', error); setLoading(false); }
    );
    return () => unsubscribe();
  }, [user, authLoading, activeTab]);
  
  // 处理全屏模式的 Effect
  useEffect(() => {
    const element = pageContainerRef.current;
    if (!element) return;

    const isFullScreen = () => document.fullscreenElement || document.webkitFullscreenElement;
    const requestFullScreen = () => {
        const requestMethod = element.requestFullscreen || element.webkitRequestFullscreen;
        if (requestMethod) { requestMethod.call(element).catch(err => {}); }
    };
    const exitFullScreen = () => {
        const exitMethod = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitMethod) { exitMethod.call(document).catch(err => {}); }
    };

    if (activeTab === 'discover') {
        if (!isFullScreen()) { requestFullScreen(); }
    } else {
        if (isFullScreen()) { exitFullScreen(); }
    }

    return () => { if (isFullScreen()) { exitFullScreen(); } };
  }, [activeTab]);


  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
        const currentIndex = tabKeys.indexOf(activeTab);
        if (currentIndex < tabKeys.length - 1) { setActiveTab(tabKeys[currentIndex + 1]); }
    },
    onSwipedRight: () => {
        const currentIndex = tabKeys.indexOf(activeTab);
        if (currentIndex > 0) { setActiveTab(tabKeys[currentIndex - 1]); }
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
    delta: 50
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'messages': return <ConversationList conversations={conversations} loading={loading} user={user} authLoading={authLoading} />;
      case 'discover': return <VerticalShortVideoPlayer useProxy={false} />;
      case 'partners': return <LanguagePartnerList />;
      case 'jobs': return (<div className="p-8 text-center text-gray-500">找工作功能正在开发中...</div>);
      // ✅ 修复：添加 'bookshelf' case，渲染内嵌网页组件
      case 'bookshelf': return <BookshelfPage />;
      default: return null;
    }
  };

  return (
    <LayoutBase>
      <div ref={pageContainerRef} className={`flex flex-col min-h-screen bg-white ${activeTab === 'discover' ? 'h-screen' : ''}`}>
        {activeTab !== 'discover' && (
          <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} totalUnreadCount={totalUnreadCount}/>
        )}
        <main className={`flex-1 ${activeTab === 'bookshelf' ? 'h-full' : ''}`} {...swipeHandlers}>
          <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab} 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }} 
                transition={{ duration: 0.2 }}
                // ✅ 修复：确保书柜页面填满可用空间
                className={activeTab === 'bookshelf' ? 'w-full h-full' : ''}
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
