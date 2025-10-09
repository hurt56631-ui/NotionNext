// pages/hsk.js  <-- 用这段简短的代码覆盖

import dynamic from 'next/dynamic'

// 使用 dynamic import 并禁用服务器端渲染 (ssr: false)
const HskPageClient = dynamic(() => import('@/components/HskPageClient'), {
  ssr: false,
  // 添加一个加载状态，提升用户体验
  loading: () => <div className="w-screen h-screen flex justify-center items-center bg-black text-white">正在加载HSK学习中心...</div>
})

// 页面只导出这个动态加载的组件
const HskPage = () => {
  return <HskPageClient />
}

export default HskPage
