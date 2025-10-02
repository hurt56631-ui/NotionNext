// /lib/AuthContext.js (终极架构版 - 缓存优先，后台同步)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase'; 
import { useUnreadCount } from './UnreadCountContext'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // ✅ 1. 缓存优先：从 localStorage 初始化 user，UI 秒开
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
        try {
            const cachedUser = localStorage.getItem('cachedUser');
            return cachedUser ? JSON.parse(cachedUser) : null;
        } catch (e) {
            return null;
        }
    }
    return null;
  });
  // authLoading 现在只用于初始加载，后续由缓存接管
  const [authLoading, setAuthLoading] = useState(true);
  
  const { setTotalUnreadCount } = useUnreadCount(); 

  // --- 核心认证逻辑 (后台同步) ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let finalUser;
        if (userSnap.exists()) {
          finalUser = { uid: firebaseUser.uid, ...userSnap.data() };
        } else {
          // ... (创建新用户逻辑不变)
        }

        // ✅ 无感更新：用后台最新数据更新 UI 和缓存
        setUser(finalUser);
        localStorage.setItem("cachedUser", JSON.stringify(finalUser)); 

      } else {
        setUser(null);
        localStorage.removeItem("cachedUser");
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. 独立的 RTDB 在线状态维护 ---
  useEffect(() => {
    if (!user || !rtDb) return; // 如果没有用户或 RTDB 没加载，则不执行

    const userId = user.uid;
    const userStatusRef = ref(rtDb, `/status/${userId}`);
    const connectedRef = ref(rtDb, '.info/connected');
    
    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() });
            set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
            // 辅助更新 Firestore lastSeen
            updateDoc(doc(db, 'users', userId), { lastSeen: serverTimestamp() });
        }
    });

    return () => {
         if (unsubscribeConnected) unsubscribeConnected();
         // 当 effect 清理时，主动设置为离线
         set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    };
  }, [user]); // 只依赖 user

  // --- 3. 独立的全局未read数监听 ---
  useEffect(() => {
    if (!user || !db) { // 增加对 db 的检查
      setTotalUnreadCount(0);
      return;
    }

    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid));
    
    // 初始同步
    getDocs(chatsQuery).then(snapshot => {
        let initialUnread = 0;
        snapshot.forEach(doc => { initialUnread += doc.data().unreadCounts?.[user.uid] || 0; });
        setTotalUnreadCount(initialUnread);
    });

    // 实时监听
    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.docs.forEach(doc => {
        currentTotalUnread += doc.data().unreadCounts?.[user.uid] || 0;
      });
      setTotalUnreadCount(currentTotalUnread);
    }, (error) => {
      console.error("Global Unread Listener Error:", error);
      setTotalUnreadCount(0);
    });

    return () => unsubscribeUnread();
  }, [user, setTotalUnreadCount]); 

  const signOut = async () => {
    const auth = getAuth();
    if (user && rtDb) {
        const userStatusRef = ref(rtDb, '/status/' + user.uid);
        await set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    }
    await firebaseSignOut(auth);
    // onAuthStateChanged 会处理 setUser(null) 和清除缓存
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
