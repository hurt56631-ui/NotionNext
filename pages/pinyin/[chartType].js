// /pages/pinyin/[chartType].js <-- 最终修复版 (使用动态导入)

import { useRouter } from 'next/router';
import dynamic from 'next/dynamic'; // 1. 导入 next/dynamic

// 2. 使用 dynamic 创建一个只在客户端加载的组件
//    ssr: false 是这里的关键，它禁用了服务端渲染
const PinyinChartClient = dynamic(
  () => import('@/components/PinyinChartClient'),
  { 
    ssr: false,
    // 添加一个加载时的占位符，提升用户体验
    loading: () => <div className="text-center pt-20 dark:text-white">正在加载播放器...</div> 
  }
);

// --- 拼音数据中心 (保持不变) ---
const pinyinData = {
  initials: { title: '声母表', items: ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'].map(l => ({ letter: l, audio: `/audio/initials/${l}.mp3` })) },
  finals: { title: '韵母表', items: ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong'].map(l => ({ letter: l, audio: `/audio/finals/${l}.mp3` })) },
  tones: { title: '声调表', items: [ { letter: 'ā', name: '一声', audio: null }, { letter: 'á', name: '二声', audio: null }, { letter: 'ǎ', name: '三声', audio: null }, { letter: 'à', name: '四声', audio: null }, { letter: 'a', name: '轻声', audio: null }, ] }
};

export default function PinyinChartPage() {
  const router = useRouter();
  const { chartType } = router.query;

  // 确保路由参数准备好后再进行数据查找
  if (!router.isReady) {
    return <div className="text-center pt-20 dark:text-white">正在加载页面...</div>;
  }

  // 根据 URL 参数查找对应的数据
  const chartData = pinyinData[chartType] || pinyinData['initials']; 
  
  return (
    <div className="w-full min-h-screen">
      {/* 3. 像普通组件一样使用这个动态加载的组件 */}
      <PinyinChartClient initialData={chartData} />
    </div>
  );
}
