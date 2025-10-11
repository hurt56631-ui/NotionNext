// /app/pinyin/[chartType]/page.js  <-- 新建文件

import PinyinChartClient from '@/components/PinyinChartClient'; // 确保路径正确

// --- 拼音数据中心 (服务器端) ---
// 我们在这里定义所有数据，然后根据URL参数选择性地传递给客户端
const pinyinData = {
  initials: {
    title: '声母表',
    items: ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'].map(l => ({ letter: l, audio: `/audio/initials/${l}.mp3` }))
  },
  finals: {
    title: '韵母表',
    items: ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong'].map(l => ({ letter: l, audio: `/audio/finals/${l}.mp3` }))
  },
  tones: {
    title: '声调表',
    // 注意：声调表目前没有音频，可以后续添加或只做展示
    items: [
      { letter: 'ā', name: '一声', audio: null },
      { letter: 'á', name: '二声', audio: null },
      { letter: 'ǎ', name: '三声', audio: null },
      { letter: 'à', name: '四声', audio: null },
      { letter: 'a', name: '轻声', audio: null },
    ]
  }
};

export default function PinyinChartPage({ params }) {
  const { chartType } = params; // 获取URL中的动态部分, e.g., 'initials'
  const chartData = pinyinData[chartType] || { title: '未找到', items: [] };

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900">
      <PinyinChartClient initialData={chartData} />
    </div>
  );
}
