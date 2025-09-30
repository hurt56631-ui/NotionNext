// /pages/messages/[chatId].js

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// 动态导入我们真正的聊天界面组件，并禁用SSR
const ChatInterfaceWithNoSSR = dynamic(
  () => import('@/components/ChatInterface'), // 我们将把 PrivateChat.js 的逻辑移到这里
  { 
    ssr: false,
    loading: () => <div className="fixed inset-0 flex items-center justify-center bg-gray-100 dark:bg-black text-gray-500">正在进入聊天室...</div>
  }
);

const ChatPage = () => {
    const [isClient, setIsClient] = useState(false);
    const router = useRouter();
    const { chatId } = router.query; // 从URL中获取chatId

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient || !chatId) {
        return <div className="fixed inset-0 bg-gray-100 dark:bg-black"></div>;
    }

    // 只有在客户端，并且获取到chatId后，才渲染聊天界面
    // 将 chatId 作为 prop 传递给真正的聊天组件
    return <ChatInterfaceWithNoSSR chatId={chatId} />;
};

export default ChatPage;
