// /pages/messages/[chatId].js (V14 - 智能容器版)

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

    useEffect(() => {
        // 当 currentUser 或 chatId 变化时，重置状态并开始获取数据
        setIsLoading(true);
        setPeerUser(null);
        setError(null);

        // 确保关键信息存在
        if (!chatId || !currentUser) {
            // 如果是在初始加载，等待 currentUser 可用
            if (!currentUser) return; 
            // 如果 chatId 无效
            setError("无效的聊天ID。");
            setIsLoading(false);
            return;
        }

        const members = chatId.split('_');
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

        // 异步获取对方用户信息
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

    }, [chatId, currentUser]); // 依赖 currentUser 和 chatId

    // 渲染加载状态
    if (isLoading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white text-gray-500">
                正在进入聊天室...
            </div>
        );
    }

    // 渲染错误状态
    if (error) {
        return (
            <div className="flex flex-col h-screen w-full bg-white text-black items-center justify-center p-4">
                <h2 className="text-xl font-bold text-red-500">错误</h2>
                <p className="text-gray-600 mt-2 text-center">{error}</p>
            </div>
        );
    }

    // 当所有数据准备好后，渲染聊天界面
    return <ChatInterface chatId={chatId} currentUser={currentUser} peerUser={peerUser} />;
};

export default ChatPage;
