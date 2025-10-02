// /lib/AuthContext.js (终极修复版 - 解决小绿点延迟和假登录问题)
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
// 增加 getDocs 和 query，用于初始同步未读数
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ref, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase'; 
import { useUnreadCount } from './UnreadCountContext'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // ✅ 核心修复：先从 localStorage 尝试恢复用户，实现秒级加载
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
        const cachedUser = localStorage.getItem('cachedUser');
        return cachedUser ? JSON.parse(cachedUser) : null;
    }
    return null;
  });
  const [authLoading, setAuthLoading] = useState(true);
  
  const { setTotalUnreadCount } = useUnreadCount(); 

  // --- RTDB 在线状态维护逻辑 (保持不变) ---
  useEffect(() => {
    if (user && typeof window !== 'undefined' && rtDb) {
        // ... (RTDB 在线状态维护逻辑) ...
        const userId = user.uid;
        const userStatusRef = ref(rtDb, '/status/' + userId);

        const connectedRef = ref(rtDb, '.info/connected');
        const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === true) {
                onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() }).then(() => {
                    set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
                    const userRef = doc(db, 'users', userId);
                    updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(e => console.error("Update lastSeen error:", e));
                    const intervalId = setInterval(() => {
                         updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(e => console.error("Update lastSeen error:", e));
                    }, 60000);
                    return () => clearInterval(intervalId);
                });
            }
        });
        return () => unsubscribeConnected();
    }
  }, [user]);


  // ✅ ---【核心修复：全局未读数初始同步 + 实时监听】--- ✅
  useEffect(() => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    const chatsQuery = query(
        collection(db, 'privateChats'),
        where('members', 'array-contains', user.uid),
    );

    // 1. 立即执行一次 getDocs，拉取初始未读数 (解决小绿点延迟)
    getDocs(chatsQuery).then(snapshot => {
        let initialUnread = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            initialUnread += data.unreadCounts?.[user.uid] || 0;
        });
        setTotalUnreadCount(initialUnread);
    }).catch(e => console.error("Initial unread sync failed:", e));


    // 2. 开启 onSnapshot 实时监听
    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.docs.forEach(doc => {
        const chatData = doc.data();
        currentTotalUnread += chatData.unreadCounts?.[user.uid] || 0;
      });
      setTotalUnreadCount(currentTotalUnread);
    }, (error) => {
      console.error("Global Unread Listener Error:", error);
      setTotalUnreadCount(0);
    });

    return () => unsubscribeUnread();
  }, [user, setTotalUnreadCount]); 

  
  // ✅ ---【核心修复：认证核心逻辑，加入缓存】--- ✅
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        // ... (用户数据处理逻辑保持不变) ...
        let finalUser = null;
        if (userSnap.exists()) {
          finalUser = { uid: firebaseUser.uid, ...userSnap.data() };
        } else {
          const newUserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || '新用户',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || '/img/avatar.svg',
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, newUserProfile);
          finalUser = newUserProfile;
        }

        setUser(finalUser);
        // 关键：将最终的用户信息存入 localStorage
        localStorage.setItem("cachedUser", JSON.stringify(finalUser)); 

      } else {
        setUser(null);
        // 关键：登出时清除缓存
        localStorage.removeItem("cachedUser");
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    const auth = getAuth();
    if (user && rtDb) {
        const userStatusRef = ref(rtDb, '/status/' + user.uid);
        set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    }
    await firebaseSignOut(auth);
    setUser(null);
    localStorage.removeItem("cachedUser"); // 再次确保清除缓存
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
