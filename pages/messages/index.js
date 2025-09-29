// /pages/messages/index.js (终极修复版：使用客户端渲染外壳)

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// ------------------------------------------------------------------
// 【核心修复】我们创建一个非常干净的“外壳”页面
// 这个页面在服务器端渲染时，几乎不加载任何复杂的组件
// ------------------------------------------------------------------

// 动态导入我们真正的页面内容，并禁用SSR
const MessagesPageContentWithNoSSR = dynamic(
  () => import('@/components/MessagesPageContent'), // 我们将把所有页面逻辑移到这个新组件中
  { 
    ssr: false,
    // 在组件加载期间，显示一个简单的占位符
    loading: () => <div className="fixed inset-0 flex items-center justify-center bg-gray-100 dark:bg-black text-gray-500">正在加载消息中心...</div>
  }
);

// 这个 MessagesPage 组件是最终导出的页面
// 它在服务器端只会渲染一个空的 div 或者 loading 状态
const MessagesPage = () => {
    const [isClient, setIsClient] = useState(false);

    // 使用 useEffect 确保只在客户端渲染我们的动态组件
    useEffect(() => {
        setIsClient(true);
    }, []);

    // 在服务器端或客户端初次渲染时，什么都不渲染或渲染一个占位符
    // 以确保不会触发任何依赖浏览器API的代码
    if (!isClient) {
        return <div className="fixed inset-0 bg-gray-100 dark:bg-black"></div>;
    }

    // 只有在客户端，我们才渲染真正的页面内容
    return <MessagesPageContentWithNoSSR />;
};

export default MessagesPage;
