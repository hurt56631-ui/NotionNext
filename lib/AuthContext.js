// /lib/AuthContext.js (终极架构版 - 缓存优先，后台实时同步)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
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
                    // 如果文档不存在（例如，新用户但数据库写入失败），可以保留旧的缓存或置空
                    // 这里我们选择不处理，等待标准的注册流程写入数据
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

        // 清理函数
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
            // 注意：这里不再主动设置为离线，因为 onDisconnect 会处理
        };
    }, [user]);

    // --- 独立的全局未读数监听 (未改动) ---
    useEffect(() => {
        if (!user || !db) {
            setTotalUnreadCount(0);
            return;
        }
        const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid));
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
