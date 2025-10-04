// /lib/AuthContext.js (终极修复版 - 已修复所有溃问题)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
// ✅ 修复：重新导入了 query, collection, where, getDocs 这几个被遗漏的关键函数
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase'; 
import { useUnreadCount } from './UnreadCountContext'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // ✅ 缓存优先：从 localStorage 初始化 user，UI 秒开
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
  const { setTotalUnreadCount } = useUnreadCount(); 

  // --- 核心认证与实时数据同步 ---
  useEffect(() => {
    const auth = getAuth();
    let userProfileUnsubscribe = null; // 用于取消用户资料的监听

    const authStateUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // 当认证状态改变时，先取消上一个用户的资料监听
      if (userProfileUnsubscribe) {
          userProfileUnsubscribe();
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);

        // ✅ 实时监听用户文档
        userProfileUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const updatedUser = { uid: firebaseUser.uid, ...docSnap.data() };
            
            // ✅ 无感更新：用后台最新数据更新 UI 和缓存
            setUser(updatedUser);
            if (typeof window !== 'undefined') {
              localStorage.setItem("cachedUser", JSON.stringify(updatedUser));
            }
          }
          // 当 setAuthLoading(false) 移到此处时，确保即使新用户文档还未创建，应用也能继续加载
          if (authLoading) {
            setAuthLoading(false);
          }
        }, (error) => {
          console.error("Error listening to user profile:", error);
          if (authLoading) {
            setAuthLoading(false); // 即使监听失败，也要结束加载状态
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

    // 清理函数
    return () => {
      authStateUnsubscribe();
      if (userProfileUnsubscribe) {
        userProfileUnsubscribe();
      }
    };
  }, []); // 依赖项为空，确保只运行一次

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

  // --- 独立的全局未读数监听 ---
  useEffect(() => {
    if (!user || !db) {
      setTotalUnreadCount(0);
      return;
    }

    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid));
    
    // 初始同步
    getDocs(chatsQuery).then(snapshot => {
        let initialUnread = 0;
        snapshot.forEach(doc => { initialUnread += doc.data().unreadCounts?.[user.uid] || 0; });
        setTotalUnreadCount(initialUnread);
    }).catch(error => {
        console.error("Error getting initial unread count:", error);
    });

    // 实时监听
    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.forEach(doc => {
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
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
