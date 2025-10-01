// /lib/MessageContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const { user } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    // 查询该用户参与的所有会话
    const chatsQuery = query(
      collection(db, 'privateChats'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      let totalCount = 0;
      // 遍历所有会话，获取当前用户在每个会话子集合中的未读数
      for (const chatDoc of snapshot.docs) {
        try {
          const memberSnap = await getDoc(doc(db, `privateChats/${chatDoc.id}/members`, user.uid));
          if (memberSnap.exists() && memberSnap.data().unreadCount > 0) {
            totalCount += memberSnap.data().unreadCount;
          }
        } catch (error) {
          // 忽略单个文档读取失败的情况
        }
      }
      setTotalUnreadCount(totalCount);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <MessageContext.Provider value={{ totalUnreadCount }}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => useContext(MessageContext);
