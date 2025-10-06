// /lib/AuthContext.js (最终优化版 - 秒开、离线、实时同步)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
// [OPTIMIZATION] 引入 getDocFromCache 以支持离线数据优先加载
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, onSnapshot, getDocs, getDocFromCache } from 'firebase/firestore';
// [OPTIMIZATION] 明确区分 Firestore 和 RTDB 的 serverTimestamp，避免混淆
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase'; 
import { useUnreadCount } from './UnreadCountContext'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
        try {
            const cachedUser = localStorage.getItem('cachedUser');
            if (!cachedUser) return null;
            
            const parsedUser = JSON.parse(cachedUser);
            // [OPTIMIZATION] 增加简单的版本或字段检查，防止旧缓存结构导致应用崩溃
            return parsedUser && parsedUser.uid ? parsedUser : null;
        } catch (e) {
            console.warn("Failed to parse cached user:", e);
            return null;
        }
    }
    return null;
  });
  
  const [authLoading, setAuthLoading] = useState(true);
  const { setTotalUnreadCount } = useUnreadCount(); 

  // --- 核心认证与用户数据同步逻辑 (缓存优先，后台同步，实时更新) ---
  useEffect(() => {
    const auth = getAuth();
    // [OPTIMIZATION] onAuthStateChanged 只负责认证状态，用户数据的获取和监听分离
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem("cachedUser");
        setAuthLoading(false);
      }
      // 用户数据的获取交由下面的 useEffect 处理
    });

    return () => unsubscribeAuth();
  }, []);

  // [OPTIMIZATION] 独立的 Firestore 用户数据监听器 (实时同步用户资料)
  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        // 如果 auth.currentUser 还没有准备好，依赖 onAuthStateChanged
        setAuthLoading(true);
        return;
    }

    const userRef = doc(db, 'users', currentUser.uid);
    let userSnapshotUnsubscribe = null;

    const syncUser = async () => {
        try {
            // [OPTIMIZATION] 1. 尝试从缓存加载，实现秒开和离线支持
            const cachedSnap = await getDocFromCache(userRef).catch(() => null);
            if (cachedSnap && cachedSnap.exists()) {
                const cachedData = { uid: currentUser.uid, ...cachedSnap.data() };
                setUser(cachedData);
                // 此时UI已更新，可以结束loading
                setAuthLoading(false); 
            }

            // [OPTIMIZATION] 2. 实时监听来自服务器的更新
            userSnapshotUnsubscribe = onSnapshot(userRef, 
                (docSnap) => {
                    if (docSnap.exists()) {
                        const freshData = { uid: currentUser.uid, ...docSnap.data() };
                        setUser(freshData);
                        localStorage.setItem("cachedUser", JSON.stringify(freshData));
                    } else {
                        // 处理用户在数据库中被删除的情况
                        signOut(); 
                    }
                    // 确保任何一次有效快照后都结束loading
                    if (authLoading) setAuthLoading(false);
                },
                (error) => {
                    console.error("User data onSnapshot listener error:", error);
                    // 如果监听失败，也应该结束 loading
                    setAuthLoading(false);
                }
            );

        } catch (error) {
            console.error("Failed to sync user data:", error);
            setAuthLoading(false);
        }
    };
    
    syncUser();

    return () => {
        if (userSnapshotUnsubscribe) {
            userSnapshotUnsubscribe();
        }
    };
  }, [user?.uid]); // 依赖 user.uid, onAuthStateChanged 会触发这个 effect


  // --- RTDB 在线状态维护 (逻辑已很完善，无需大改) ---
  useEffect(() => {
    if (!user || !rtDb) return;

    const userId = user.uid;
    const userStatusRef = ref(rtDb, `/status/${userId}`);
    const connectedRef = ref(rtDb, '.info/connected');
    
    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() });
            set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
            // 使用 Firestore 的 serverTimestamp
            updateDoc(doc(db, 'users', userId), { lastSeen: serverTimestamp() });
        }
    });

    return () => {
         if (unsubscribeConnected) unsubscribeConnected();
         // 主动设置离线状态，确保在组件卸载或用户切换时状态正确
         set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    };
  }, [user]);

  // --- 全局未读数监听 (增加健壮性) ---
  useEffect(() => {
    if (!user || !db) {
      setTotalUnreadCount(0);
      return;
    }

    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid));
    
    // [OPTIMIZATION] 将实时监听逻辑包裹在 try-catch 中，防止权限等问题导致应用崩溃
    let unsubscribeUnread = () => {};
    try {
        unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
          let currentTotalUnread = 0;
          snapshot.forEach(doc => {
            currentTotalUnread += doc.data().unreadCounts?.[user.uid] || 0;
          });
          setTotalUnreadCount(currentTotalUnread);
        }, (error) => {
          console.error("Global Unread Listener Error:", error);
          setTotalUnreadCount(0);
        });
    } catch(error) {
        console.error("Failed to initialize global unread listener:", error);
        setTotalUnreadCount(0);
    }

    return () => unsubscribeUnread();
  }, [user, setTotalUnreadCount]); 

  const signOut = async () => {
    const auth = getAuth();
    if (user && rtDb) {
        const userStatusRef = ref(rtDb, '/status/' + user.uid);
        // [OPTIMIZATION] 增加 await 确保离线状态设置完成后再执行后续操作
        await set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    }
    
    await firebaseSignOut(auth);
    // [OPTIMIZATION] 主动清理，提供更快的 UI 响应，而不是等待 onAuthStateChanged
    setUser(null);
    localStorage.removeItem("cachedUser");
    setTotalUnreadCount(0);
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
