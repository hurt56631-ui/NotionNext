// /components/MessagesPageContent.js (最终完全重构版)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db, rtDb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { Compass, Briefcase, MessageSquare, Sparkles, Languages, Send, Search, BookOpen, MoreVertical, ArrowUp, Trash2, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutBase } from '@/themes/heo';
import { useUnreadCount } from '@/lib/UnreadCountContext';
import { useSwipeable } from 'react-swipeable';

// ✅ 引入我们需要的漂流瓶组件，请确保路径正确
import ThrowBottleModal from './bottle/ThrowBottleModal';
import PickedBottleModal from './bottle/PickedBottleModal';

// ===================================================================
// =============  ✅ 1. 全新：语伴列表 UI (参考图样式)  =============
// ===================================================================

// --- 在线状态 Hook ---
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

// --- 单个语伴列表项 (全新 UI) ---
const PartnerListItem = ({ partner, onSayHi }) => {
    const router = useRouter();
    const { text: statusText, isOnline } = usePartnerStatus(partner.uid);
    const countryCode = partner.countryCode || 'vn'; // 默认越南

    return (
        <div className="w-full max-w-4xl mx-auto flex items-center p-3 space-x-3 border-b border-gray-700">
            <div className="relative flex-shrink-0 cursor-pointer" onClick={() => router.push(`/profile/${partner.uid}`)}>
                <img className="w-14 h-14 rounded-full object-cover" src={partner.photoURL || '/img/avatar.svg'} alt={partner.displayName} />
                <img className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-gray-800 object-cover" src={`https://flagcdn.com/${countryCode.toLowerCase()}.svg`} alt={countryCode} />
            </div>
            <div className="flex-grow overflow-hidden cursor-pointer" onClick={() => router.push(`/profile/${partner.uid}`)}>
                <div className="flex items-center space-x-2">
                    <p className="text-base font-semibold text-white truncate">{partner.displayName || '新用户'}</p>
                </div>
                <div className="flex items-center text-xs text-gray-400 mt-1 space-x-1.5">
                    <div className="flex items-center bg-green-500/20 text-green-300 px-2 py-0.5 rounded">
                        <span>{partner.nativeLanguage || 'VI'}</span>
                    </div>
                    <Languages size={14} className="text-gray-500 flex-shrink-0" />
                    <div className="flex items-center bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                        <span>{partner.learningLanguage || 'CN'}</span>
                    </div>
                </div>
                <p className="text-sm text-gray-400 mt-1.5 truncate">{partner.bio || '很高兴认识你！'}</p>
                 {isOnline && <p className="text-xs text-green-400 mt-1">{statusText}</p>}
            </div>
            <div className="flex-shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onSayHi(partner); }}
                    className="w-12 h-10 rounded-xl bg-green-500/80 text-white flex items-center justify-center hover:bg-green-500 shadow-lg shadow-green-500/20 transition-all active:scale-90"
                    aria-label="打招呼"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

// --- 语伴列表主组件 (全新 UI + 逻辑修正) ---
const LanguagePartnerList = () => {
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
        });
        return () => unsubscribe();
    }, [currentUser]);

    const handleSayHi = (targetUser) => {
        if (!currentUser) return;
        const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen">
            <div className="sticky top-0 bg-gray-900 z-10 p-3 border-b border-gray-700">
                <div className="flex justify-between items-center mb-3">
                    <h1 className="text-xl font-bold">寻找</h1>
                    <Search size={20} className="text-gray-400" />
                </div>
                <div className="flex space-x-2">
                    <button className="px-3 py-1.5 text-sm bg-gray-700 rounded-full flex items-center">语言 <span className="ml-1 bg-green-500 text-white text-xs px-1.5 rounded-full">VI</span></button>
                    <button className="px-3 py-1.5 text-sm bg-gray-700 rounded-full">国家 🌍</button>
                    <button className="px-3 py-1.5 text-sm bg-gray-700 rounded-full">性别 全部</button>
                </div>
            </div>
            <div className="flex flex-col">
                <div className="p-3 border-b border-gray-700 text-center cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => router.push('/bottle')}>
                    <p className="font-semibold">🌊 进入漂流瓶海洋</p>
                    <p className="text-xs text-gray-400">扔一个瓶子，邂逅一段缘分</p>
                </div>
                {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="p-4 border-b border-gray-700 animate-pulse"><div className="h-16 bg-gray-700 rounded"></div></div>)
                : partners.map(partner => <PartnerListItem key={partner.uid} partner={partner} onSayHi={handleSayHi} />)}
            </div>
            <div className="h-24"></div>
        </div>
    );
};

// ===================================================================
// =============  ✅ 2. 新增：健壮的长按菜单功能  =============
// ===================================================================

const useLongPress = (callback = () => {}, ms = 500) => {
    const timerRef = React.useRef();
    const isLongPress = React.useRef(false);
    const isDragging = React.useRef(false);

    const start = useCallback((event) => {
        isDragging.current = false;
        isLongPress.current = false;
        timerRef.current = setTimeout(() => {
            if (!isDragging.current) {
                isLongPress.current = true;
                callback(event);
            }
        }, ms);
    }, [callback, ms]);

    const stop = useCallback(() => {
        clearTimeout(timerRef.current);
    }, []);

    const onTouchMove = () => {
        isDragging.current = true;
        clearTimeout(timerRef.current);
    };

    const onContextMenu = useCallback((e) => {
        e.preventDefault();
        callback(e);
    }, [callback]);

    return {
        onTouchStart: start,
        onTouchEnd: stop,
        onTouchMove: onTouchMove,
        onMouseDown: start,
        onMouseUp: stop,
        onMouseLeave: stop,
        onContextMenu: onContextMenu,
    };
};

const ConversationContextMenu = ({ menu, onClose, onPin, onDelete }) => {
    if (!menu.visible) return null;
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose}></div>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.1 }}
                className="absolute z-50 w-40 bg-white dark:bg-gray-700 rounded-md shadow-lg overflow-hidden"
                style={{ top: menu.y, left: menu.x }}
            >
                <ul>
                    <li onClick={onPin} className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                        <ArrowUp size={16} className="mr-2"/>{menu.item?.isPinned ? '取消置顶' : '置顶该聊天'}
                    </li>
                    <li onClick={onDelete} className="flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer">
                        <Trash2 size={16} className="mr-2"/>删除该聊天
                    </li>
                </ul>
            </motion.div>
        </>
    );
};

// ===================================================================
// =============  ✅ 3. 全新：统一的消息列表  =============
// ===================================================================

const UnifiedConversationList = ({ conversations, loading, user }) => {
    const router = useRouter();
    const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, item: null });
    const [pickedBottle, setPickedBottle] = useState(null);

    const handlePin = async () => {
        if (!menu.item) return;
        const { id, type, isPinned } = menu.item;
        const collectionName = type === 'private' ? 'privateChats' : 'bottles';
        const docRef = doc(db, collectionName, id);
        try {
            await updateDoc(docRef, { isPinned: !isPinned });
        } catch (e) { console.error("置顶失败:", e); }
        setMenu({ ...menu, visible: false });
    };

    const handleDelete = async () => {
        if (!menu.item || !window.confirm("确定要删除这条消息吗？此操作不可恢复。")) return;
        const { id, type } = menu.item;
        const collectionName = type === 'private' ? 'privateChats' : 'bottles';
        const docRef = doc(db, collectionName, id);
        try {
            if (type === 'private') {
                await updateDoc(docRef, { [`deletedBy_${user.uid}`]: true });
            } else {
                await deleteDoc(docRef);
            }
        } catch(e) { console.error("删除失败:", e); }
        setMenu({ ...menu, visible: false });
    };

    const openMenu = (event, item) => {
        const { clientX: x, clientY: y } = event.touches ? event.touches[0] : event;
        const adjustedX = x > window.innerWidth - 160 ? window.innerWidth - 170 : x;
        setMenu({ visible: true, x: adjustedX, y, item });
    };

    const handleItemClick = (convo, isLongPress) => {
        if (isLongPress) return;
        if (convo.type === 'bottle') setPickedBottle(convo.originalData);
        else router.push(`/messages/${convo.id}`);
    };

    const longPressHandlers = (item) => useLongPress((event) => openMenu(event, item));

    if (loading) { return <div className="p-8 text-center text-gray-500">正在加载...</div>; }
    if (conversations.length === 0) { return <div className="p-8 text-center text-gray-500">还没有任何消息哦。</div>; }

    return (
        <div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {conversations.map((convo) => {
                    const itemHandlers = longPressHandlers(convo);
                    const isBottle = convo.type === 'bottle';

                    return (
                        <li key={convo.id}
                            {...itemHandlers}
                            onClick={(e) => {
                                const isLongPress = e.type === 'contextmenu' || itemHandlers.isLongPress;
                                handleItemClick(convo, isLongPress);
                            }}
                            className={`relative flex items-center p-4 cursor-pointer transition-colors ${convo.isPinned ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                             <div className="relative">
                                <img src={convo.avatar} alt={convo.title} className="w-14 h-14 rounded-full object-cover"/>
                                {isBottle && <Package size={16} className="absolute -bottom-1 -right-1 p-0.5 bg-yellow-500 text-white rounded-full border-2 border-white dark:border-gray-800"/>}
                             </div>
                             <div className="ml-4 flex-1 overflow-hidden">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold truncate dark:text-gray-200">{convo.title}</p>
                                    <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{convo.timestamp}</p>
                                </div>
                                <div className="flex justify-between items-start mt-1">
                                    <p className="text-sm text-gray-500 truncate">{convo.lastMessage}</p>
                                    {!isBottle && convo.unreadCount > 0 && (<span className="ml-2 flex-shrink-0 text-xs text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center font-semibold">{convo.unreadCount > 99 ? '99+' : convo.unreadCount}</span>)}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <ConversationContextMenu menu={menu} onClose={() => setMenu({ ...menu, visible: false })} onPin={handlePin} onDelete={handleDelete} />
            {pickedBottle && (<PickedBottleModal bottle={pickedBottle} onClose={() => setPickedBottle(null)} />)}
        </div>
    );
};


// --- 您原有的 MessageHeader 组件 (保持不变) ---
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
// =============  ✅ 4. 页面主组件 (最终集成)  =============
// ===================================================================

const MessagesPageContent = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { user, authLoading } = useAuth();
  const [unifiedConversations, setUnifiedConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // ✅ 核心修改: 合并私信和漂流瓶消息的 useEffect
  useEffect(() => {
      if (!user) {
          setUnifiedConversations([]);
          setLoading(false);
          return;
      }
      setLoading(true);

      const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid), where(`deletedBy_${user.uid}`, '!=', true));
      const bottlesQuery = query(collection(db, 'bottles'), where('pickedBy', '==', user.uid));

      const processUpdates = async () => {
          try {
            const [chatsSnapshot, bottlesSnapshot] = await Promise.all([getDocs(chatsQuery), getDocs(bottlesQuery)]);
            
            const privateChats = await Promise.all(chatsSnapshot.docs.map(async (chatDoc) => {
                const data = chatDoc.data();
                const otherUserId = data.members.find(id => id !== user.uid);
                let otherUser = { displayName: '未知用户', photoURL: '/img/avatar.svg' };
                if (otherUserId) {
                    const userDoc = await getDoc(doc(db, 'users', otherUserId));
                    if (userDoc.exists()) { otherUser = userDoc.data(); }
                }
                return {
                    id: chatDoc.id,
                    type: 'private',
                    title: otherUser.displayName,
                    avatar: otherUser.photoURL || '/img/avatar.svg',
                    lastMessage: data.lastMessage || '',
                    timestampDate: data.lastMessageAt?.toDate() || new Date(0),
                    unreadCount: data.unreadCounts?.[user.uid] || 0,
                    isPinned: data.isPinned || false,
                    originalData: { id: chatDoc.id, ...data }
                };
            }));

            const bottleMessages = bottlesSnapshot.docs.map(bottleDoc => {
                const data = bottleDoc.data();
                return {
                    id: bottleDoc.id,
                    type: 'bottle',
                    title: data.throwerName || '一位旅行者',
                    avatar: data.throwerAvatar || '/img/avatar.svg',
                    lastMessage: data.content,
                    timestampDate: data.pickedAt?.toDate() || new Date(0),
                    isPinned: data.isPinned || false,
                    originalData: { id: bottleDoc.id, ...data }
                };
            });
            
            const all = [...privateChats, ...bottleMessages]
                .sort((a, b) => b.timestampDate - a.timestampDate)
                .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
            
            setUnifiedConversations(all.map(c => ({...c, timestamp: c.timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })));
          } catch (error) {
              console.error("处理消息更新失败:", error);
          } finally {
              setLoading(false);
          }
      };

      const unsubChats = onSnapshot(chatsQuery, processUpdates, (error) => console.error("私信监听失败:", error));
      const unsubBottles = onSnapshot(bottlesQuery, processUpdates, (error) => console.error("瓶子监听失败:", error));
      
      return () => { unsubChats(); unsubBottles(); };
  }, [user]);
  
  const { totalUnreadCount } = useUnreadCount();
  const tabKeys = ['messages', 'discover', 'partners', 'jobs', 'bookshelf'];
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

  const renderContent = () => {
    switch (activeTab) {
      case 'messages': return <UnifiedConversationList conversations={unifiedConversations} loading={loading} user={user} />;
      case 'partners': return <LanguagePartnerList />;
      case 'discover': return (<div className="p-8 text-center text-gray-500">动态功能正在开发中...</div>);
      case 'jobs': return (<div className="p-8 text-center text-gray-500">找工作功能正在开发中...</div>);
      case 'bookshelf': return (<div className="p-8 text-center text-gray-500">书柜功能正在开发中...</div>);
      default: return null;
    }
  };

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-900">
        <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} totalUnreadCount={totalUnreadCount}/>
        <main className="flex-1" {...swipeHandlers}>
          <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                {renderContent()}
              </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </LayoutBase>
  );
};

export default MessagesPageContent;
