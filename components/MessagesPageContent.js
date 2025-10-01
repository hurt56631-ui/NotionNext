// /components/MessagesPageContent.js (极限调试版)

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

// 这是一个全新的、极简的组件，只用于调试
const MinimalDebugger = () => {
  const { user, authLoading } = useAuth();
  const [debugData, setDebugData] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("正在初始化...");

  useEffect(() => {
    // 1. 检查 useAuth 的状态
    if (authLoading) {
      setStatus("正在等待用户认证...");
      return;
    }
    if (!user) {
      setStatus("用户未登录，无法获取数据。");
      return;
    }

    // 2. 如果认证通过，设置查询
    setStatus(`已作为用户 ${user.uid} 登录，正在查询数据库...`);
    const chatsQuery = query(
      collection(db, 'privateChats'),
      where('members', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    // 3. 启动实时监听
    const unsubscribe = onSnapshot(
      chatsQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setStatus("数据库查询成功，但未找到与此用户相关的聊天记录。");
          setDebugData([]);
          return;
        }

        setStatus(`查询成功，找到 ${snapshot.size} 条聊天记录。正在处理...`);
        
        // 4. 直接处理数据，不进行任何额外的异步调用
        const data = snapshot.docs.map(doc => {
          const chatData = doc.data();
          const unreadCount = chatData.unreadCounts?.[user.uid] || 0;
          return {
            chatId: doc.id,
            lastMessage: chatData.lastMessage,
            unreadCount: unreadCount,
            fullData: chatData // 包含完整数据以便调试
          };
        });
        
        setDebugData(data);
      },
      (err) => {
        // 5. 如果查询出错，显示错误信息
        console.error("Firestore onSnapshot 错误:", err);
        setError(`数据库监听失败: ${err.message}`);
        setStatus("数据库查询时发生错误！");
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  // 6. 将所有状态信息直接渲染到屏幕上
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', color: 'black', background: 'white' }}>
      <h1 style={{ color: 'red', borderBottom: '2px solid red' }}>极限调试模式</h1>
      
      <div style={{ marginTop: '20px' }}>
        <h2 style={{ fontWeight: 'bold' }}>当前状态:</h2>
        <p style={{ color: 'blue', fontWeight: 'bold' }}>{status}</p>
      </div>

      {error && (
        <div style={{ marginTop: '20px', color: 'red' }}>
          <h2 style={{ fontWeight: 'bold' }}>错误信息:</h2>
          <pre>{error}</pre>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <h2 style={{ fontWeight: 'bold' }}>会话未读数:</h2>
        {debugData.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {debugData.map(item => (
              <li key={item.chatId} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0', background: item.unreadCount > 0 ? '#e6ffed' : '#f7f7f7' }}>
                <p><strong>Chat ID:</strong> {item.chatId}</p>
                <p><strong>最后消息:</strong> {item.lastMessage}</p>
                <p style={{ fontWeight: 'bold', fontSize: '1.2em', color: item.unreadCount > 0 ? 'green' : 'black' }}>
                  <strong>计算出的未读数: {item.unreadCount}</strong>
                </p>
                <details>
                    <summary>查看完整数据</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#eee', padding: '5px' }}>
                        {JSON.stringify(item.fullData, null, 2)}
                    </pre>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p>没有找到任何会话数据。</p>
        )}
      </div>
    </div>
  );
};

// 导出这个极简组件
export default MinimalDebugger;
