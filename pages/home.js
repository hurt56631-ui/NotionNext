// /pages/home.js

import React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// 使用 next/dynamic 动态导入我们刚才创建的客户端组件
// 通过 .then(mod => mod.default) 明确指定使用默认导出的组件
// 这是修复 React Error #130 的关键
const DynamicHomePage = dynamic(() => 
  import('../components/HomePageClient').then(mod => mod.default), 
  {
    ssr: false,
    // 可以在组件加载时显示一个更友好的 loading 状态
    loading: () => (
      <div style={{
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'sans-serif'
      }}>
        <p>正在加载页面...</p>
      </div>
    )
  }
);

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
