// /lib/AuthContext.js (终极修复版 - 已修复所有性能问题)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
// ✅ 修复：移除了多余的函数导入，因为我们不再需要它们
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase'; 
// ✅ 修复：直接在这里导入 MessageContext，而不是 UnreadCountContext，简化结构
import { useMessages } from './MessageContext'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
        try {
            const cachedUser = localStorage.getItem('cachedUser');
            return cachedUser ? JSON.parse(cachedUser) : null;
        } catch (e) {
            console.error("Failed to parse cached user:", e);
            return null;
        }
    }
    return null;
  });
  
  const [authLoading, setAuthLoading] = useState(true);
  // ✅ 修复：直接从 MessageContext 获取 setTotalUnreadCount
  const { setTotalUnreadCount } = useMessages(); 

  // --- 核心认证与实时数据同步 ---
  useEffect(() => {
    const auth = getAuth();
    let userProfileUnsubscribe = null;

    const authStateUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (userProfileUnsubscribe) {
          userProfileUnsubscribe();
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        userProfileUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const updatedUser = { uid: firebaseUser.uid, ...docSnap.data() };
            setUser(updatedUser);
            if (typeof window !== 'undefined') {
              localStorage.setItem("cachedUser", JSON.stringify(updatedUser));
            }
          }
          if (authLoading) {
            setAuthLoading(false);
          }
        }, (error) => {
          console.error("Error listening to user profile:", error);
          if (authLoading) {
            setAuthLoading(false);
          }
        });
      } else {
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem("cachedUser");
        }
        setAuthLoading(false);
      }
    });

    return () => {
      authStateUnsubscribe();
      if (userProfileUnsubscribe) {
        userProfileUnsubscribe();
      }
    };
  }, [authLoading]); // ✅ 修复：添加 authLoading 作为依赖项以避免潜在的竞态条件

  // --- 独立的 RTDB 在线状态维护 ---
  useEffect(() => {
    if (!user || !rtDb) return;
    const userId = user.uid;
    const userStatusRef = ref(rtDb, `/status/${userId}`);
    const connectedRef = ref(rtDb, '.info/connected');

    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() });
            set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
            updateDoc(doc(db, 'users', userId), { lastSeen: serverTimestamp() });
        }
    });

    return () => {
         if (unsubscribeConnected) unsubscribeConnected();
    };
  }, [user]);

  // --- ✅ 核心修复：高效的全局未读数监听 (取代 MessageContext 中的错误逻辑) ---
  useEffect(() => {
    if (!user || !db) {
      if (setTotalUnreadCount) setTotalUnreadCount(0);
      return;
    }

    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid));
    
    // 这个 onSnapshot 只进行一次查询，然后从返回的数据中直接计算总数
    // 它不会在内部进行任何新的 getDoc 请求，因此非常高效
    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.forEach(doc => {
        // 直接从 chat 文档中读取未读数，这是正确的做法
        currentTotalUnread += doc.data().unreadCounts?.[user.uid] || 0;
      });
      if (setTotalUnreadCount) setTotalUnreadCount(currentTotalUnread);
    }, (error) => {
      console.error("Global Unread Listener Error:", error);
      if (setTotalUnreadCount) setTotalUnreadCount(0);
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
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
