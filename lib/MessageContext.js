// /lib/MessageContext.js (✅ 最终修复版 - 已彻底解决 N+1 查询问题)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const { user } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    // 如果用户未登录，则重置未读数并停止执行
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    // 创建一个查询，只监听那些当前用户是成员的聊天室
    const chatsQuery = query(
      collection(db, 'privateChats'),
      where('members', 'array-contains', user.uid)
    );

    // ✅ 核心修复：使用一个高效的 onSnapshot 侦听器
    // 这个侦听器只执行一次查询来获取所有相关的聊天文档列表。
    // 它不会在内部进行任何新的、重复的 getDoc 请求。
    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      let totalCount = 0;
      
      // 直接遍历返回的文档快照，从每个文档中累加未读数
      snapshot.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        // 直接从聊天文档的 `unreadCounts` 字段中读取当前用户的未读数
        // 这是正确且高效的“数据非规范化”实践
        totalCount += chatData.unreadCounts?.[user.uid] || 0;
      });
      
      // 一次性更新总未读数状态
      setTotalUnreadCount(totalCount);
    }, (error) => {
      // 增加错误处理，以防查询失败
      console.error("监听未读总数失败:", error);
      setTotalUnreadCount(0);
    });

    // 返回清理函数，在组件卸载或用户切换时，自动取消侦听，防止内存泄漏
    return () => unsubscribe();
  }, [user]); // 依赖数组中只有 user，确保只在用户登录或登出时重新设置侦听器

  return (
    <MessageContext.Provider value={{ totalUnreadCount, setTotalUnreadCount }}>
      {children}
    </MessageContext.Provider>
  );
};

// 导出 useMessages hook 以便其他组件可以方便地访问总未读数
export const useMessages = () => useContext(MessageContext);
