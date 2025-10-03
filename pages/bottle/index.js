// /pages/bottle/index.js (最终修复版 - 解决 'self is not defined' 错误)

import React from 'react';
import dynamic from 'next/dynamic';

// ✅ 核心修复 1: 使用 dynamic import 动态导入我们的主组件
// 我们将漂流瓶页面的所有逻辑都放到一个新的 'BottlePageContent' 组件中
// { ssr: false } 是关键，它告诉 Next.js: "不要在服务器上尝试渲染这个组件"
const BottlePageContent = dynamic(
  () => import('../../components/bottle/BottlePageContent'), // 我们将创建一个新文件
  { 
    ssr: false,
    // 在组件加载时，显示一个简单的加载提示
    loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>正在加载海洋...</div> 
  }
);

// 这个页面文件本身变得非常简单
// 它的唯一作用就是加载并渲染我们的客户端组件
export default function BottlePage() {
  return <BottlePageContent />;
    }
