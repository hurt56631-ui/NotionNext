// pages/discover.js (这是新的入口文件)

import dynamic from 'next/dynamic';
import React from 'react';

// 使用 next/dynamic 动态导入我们的页面内容组件
// 关键在于 ssr: false，它告诉 Next.js “不要在服务器上渲染这个组件”
const DiscoverPageContent = dynamic(
  () => import('@/components/DiscoverPageContent'), // 确保路径正确
  { ssr: false }
);

const DiscoverPage = () => {
  return <DiscoverPageContent />;
};

export default DiscoverPage;
