// /app/pinyin/[chartType]/page.js  <-- 无需改动

import PinyinChartClient from '@/components/PinyinChartClient'; // 确保路径正确

const pinyinData = {
  initials: { title: '声母表', items: ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'].map(l => ({ letter: l, audio: `/audio/initials/${l}.mp3` })) },
  finals: { title: '韵母表', items: ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong'].map(l => ({ letter: l, audio: `/audio/finals/${l}.mp3` })) },
  tones: { title: '声调表', items: [ { letter: 'ā', name: '一声', audio: null }, { letter: 'á', name: '二声', audio: null }, { letter: 'ǎ', name: '三声', audio: null }, { letter: 'à', name: '四声', audio: null }, { letter: 'a', name: '轻声', audio: null }, ] }
};

export default function PinyinChartPage({ params }) {
  const { chartType } = params;
  const chartData = pinyinData[chartType] || { title: '未找到', items: [] };

  // 使用一个根布局来应用背景效果
  return (
    <div className="w-full min-h-screen pt-10">
      <PinyinChartClient initialData={chartData} />
    </div>
  );
}
