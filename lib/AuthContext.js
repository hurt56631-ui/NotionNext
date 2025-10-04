// /lib/AuthContext.js (终极修复版 - 已修复崩溃问题)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
// ✅ 修复：重新导入了 query, collection, where, getDocs 这几个被遗漏的关键函数
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase'; 
import { useUnreadCount } from './UnreadCountContext'; 

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
  const { setTotalUnreadCount } = useUnreadCount(); 

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
        }, (error) => {
          console.error("Error listening to user profile:", error);
        });

      } else {
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem("cachedUser");
        }
      }
      setAuthLoading(false);
    });

    return () => {
      authStateUnsubscribe();
      if (userProfileUnsubscribe) {
        userProfileUnsubscribe();
      }
    };
  }, []);

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
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
