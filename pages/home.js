// /pages/home.js

import React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// 使用 next/dynamic 动态导入我们刚才创建的客户端组件
// 关键在于 { ssr: false }，它告诉 Next.js 不要在服务器上渲染这个组件
const DynamicHomePage = dynamic(() => import('../components/HomePageClient'), {
  ssr: false,
  // 可以在组件加载时显示一个 loading 状态
  loading: () => <p>Loading...</p> 
});

const Home = () => {
  return (
    <>
      <Head>
        <title>我爱中文 - 开启你的中文学习之旅</title>
        {/* 字体链接等可以保留在主页面中 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </Head>
      
      {/* 直接渲染这个动态导入的组件 */}
      <DynamicHomePage />
    </>
  );
};

export default Home;
