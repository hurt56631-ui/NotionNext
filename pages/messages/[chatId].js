// /pages/messages/[chatId].js (V14 - 智能容器版 - 已添加“标记已读”功能)

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
// ✅ ---【核心修改】--- ✅
// 导入 updateDoc 函数，用于更新数据库文档
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// 动态导入UI组件
const ChatInterface = dynamic(
  () => import('@/components/ChatInterface'),
  { 
    ssr: false,
    // 整个加载过程由页面本身控制，所以组件自身的loading可以简化
    loading: () => null 
  }
);

const ChatPage = () => {
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const { chatId } = router.query;

    const [peerUser, setPeerUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 这个 useEffect 负责获取对方用户信息 (逻辑保持不变)
    useEffect(() => {
        // 当 currentUser 或 chatId 变化时，重置状态并开始获取数据
        setIsLoading(true);
        setPeerUser(null);
        setError(null);

        // 确保关键信息存在
        if (!chatId || !currentUser) {
            if (!currentUser) return; 
            setError("无效的聊天ID。");
            setIsLoading(false);
            return;
        }

        const members = typeof chatId === 'string' ? chatId.split('_') : [];
        if (members.length !== 2 || members.some(uid => !uid || uid.trim() === '')) {
            setError("聊天ID格式不正确。");
            setIsLoading(false);
            return;
        }

        const peerUid = members.find(uid => uid !== currentUser.uid);
        if (!peerUid) {
            setError("无法从聊天ID中识别对方用户。");
            setIsLoading(false);
            return;
        }

        const fetchPeerUser = async () => {
            try {
                const userDocRef = doc(db, 'users', peerUid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setPeerUser({ id: userDoc.id, ...userDoc.data() });
                } else {
                    setError("对方用户不存在。");
                }
            } catch (err) {
                console.error("获取对方用户信息失败:", err);
                setError("加载用户信息时发生网络错误。");
            } finally {
                setIsLoading(false);
            }
        };

        fetchPeerUser();

    }, [chatId, currentUser]);

    // ✅ ---【核心修改】--- ✅
    // 新增一个独立的 useEffect，专门负责在进入页面时将当前用户的未读数清零。
    // 我们把它和获取用户信息的逻辑分开，让职责更清晰。
    useEffect(() => {
      // 确保 chatId 和 currentUser.uid 都已加载
      if (chatId && currentUser?.uid) {
        // 定义一个异步函数来执行数据库更新操作
        const markAsRead = async () => {
          // 创建指向当前聊天文档的引用
          const chatDocRef = doc(db, 'privateChats', chatId);
          try {
            // 使用 updateDoc 和点表示法，将 unreadCounts Map 中
            // 属于当前用户的计数值更新为 0。
            // 如果 unreadCounts 字段或用户ID不存在，Firestore会自动创建它们。
            await updateDoc(chatDocRef, {
              [`unreadCounts.${currentUser.uid}`]: 0
            });
            console.log(`Chat ${chatId} marked as read for user ${currentUser.uid}`);
          } catch (error) {
            // 这个操作如果失败，不应该阻塞UI，所以我们只在控制台打印错误。
            // 例如，如果这是一个全新的聊天，文档可能还未创建，update会失败，但这没关系。
            console.error("Error marking chat as read (it might be a new chat):", error);
          }
        };

        // 调用这个函数
        markAsRead();
      }
      // 这个 effect 的依赖项是 chatId 和 currentUser.uid
      // 当它们任何一个发生变化时（例如从一个聊天切换到另一个），此逻辑会重新运行
    }, [chatId, currentUser?.uid]);


    // 渲染加载状态 (逻辑保持不变)
    if (isLoading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white text-gray-500">
                正在进入聊天室...
            </div>
        );
    }

    // 渲染错误状态 (逻辑保持不变)
    if (error) {
        return (
            <div className="flex flex-col h-screen w-full bg-white text-black items-center justify-center p-4">
                <h2 className="text-xl font-bold text-red-500">错误</h2>
                <p className="text-gray-600 mt-2 text-center">{error}</p>
            </div>
        );
    }

    // 当所有数据准备好后，渲染聊天界面 (逻辑保持不变)
    return <ChatInterface chatId={chatId} currentUser={currentUser} peerUser={peerUser} />;
};

export default ChatPage;
