// /pages/pinyin/[chartType].js <-- 最终版 (已统一鼻韵母音频路径并添加手势切换)

import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useSwipeable } from 'react-swipeable';
import { useEffect } from 'react';

// 动态导入客户端组件，禁用服务端渲染
const PinyinChartClient = dynamic(
  () => import('@/components/PinyinChartClient'),
  { 
    ssr: false,
    loading: () => <div className="text-center pt-20 text-white/80">正在加载拼音模块...</div> 
  }
);

// --- 最终版拼音数据中心 (鼻韵母路径已统一) ---
const pinyinData = {
  initials: { 
    title: '声母表', 
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ letter: l, audio: `/audio/initials/${l}.mp3` })) 
  },
  finals: { 
    title: '韵母表',
    categories: [
      { name: '单韵母', rows: [['a','o','e','i'],['u','ü']] },
      { name: '复韵母', rows: [['ai','ei','ui','ao'],['ou','iu','ie','üe'],['er']] },
      { name: '前鼻韵母', rows: [['an','en','in','un'],['ün']] },
      { name: '后鼻韵母', rows: [['ang','eng','ing','ong']] }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => ({
        letter,
        audio: `/audio/finals/${letter}.mp3`
      })))
    }))
  },
  tones: { 
    title: '声调表',
    categories: [
      {
        name: '单韵母',
        folder: 'simple',
        rows: [
          ['ā','á','ǎ','à'], ['ō','ó','ǒ','ò'], ['ē','é','ě','è'], ['ī','í','ǐ','ì'], ['ū','ú','ǔ','ù'], ['ǖ','ǘ','ǚ','ǜ']
        ]
      },
      {
        name: '复韵母',
        folder: 'compound',
        rows: [
          ['āi','ái','ǎi','ài'], ['ēi','éi','ěi','èi'], ['uī','uí','uǐ','uì'], ['āo','áo','ǎo','ào'], ['ōu','óu','ǒu','òu'], ['iū','iú','iǔ','iù'], ['iē','ié','iě','iè'], ['üē','üé','üě','üè'], ['ēr','ér','ěr','èr']
        ]
      },
      {
        name: '前鼻韵母',
        folder: 'nasal', // <--- 核心修改：指向统一的 'nasal' 文件夹
        rows: [
          ['ān','án','ǎn','àn'], ['ēn','én','ěn','èn'], ['īn','ín','ǐn','ìn'], ['ūn','ún','ǔn','ùn'], ['ǖn','ǘn','ǚn','ǜn']
        ]
      },
      {
        name: '后鼻韵母',
        folder: 'nasal', // <--- 核心修改：同样指向统一的 'nasal' 文件夹
        rows: [
          ['āng','áng','ǎng','àng'], ['ēng','éng','ěng','èng'], ['īng','íng','ǐng','ìng'], ['ōng','óng','ǒng','òng']
        ]
      },
      {
        name: '整体认读',
        folder: 'whole',
        rows: [
          ['zhī','zhí','zhǐ','zhì'], ['chī','chí','chǐ','chì'], ['shī','shí','shǐ','shì'], ['rī','rí','rǐ','rì'], ['zī','zí','zǐ','zì'], ['cī','cí','cǐ','cì'], ['sī','sí','sǐ','sì'], ['yī','yí','yǐ','yì'], ['wū','wú','wǔ','ù'], ['yū','yú','yǔ','yù'], ['yē','yé','yě','yè'], ['yuē','yué','yuě','yuè'], ['yuān','yuán','yuǎn','yuàn'], ['yīn','yín','yǐ','yìn'], ['yūn','yún','yǔn','yùn'], ['yīng','yíng','ǐng','yìng']
        ]
      }
    ].map(category => ({
      ...category,
      // 根据文件夹和字母名生成音频路径
      rows: category.rows.map(row => row.map(letter => {
        return {
          letter,
          audio: `/audio/tones/${category.folder}/${letter}.mp3`
        };
      }))
    }))
  }
};

const chartTypes = Object.keys(pinyinData); // ['initials', 'finals', 'tones']

export default function PinyinChartPage() {
  const router = useRouter();
  const { chartType } = router.query;

  const navigate = (direction) => {
    const currentIndex = chartTypes.indexOf(chartType);
    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % chartTypes.length;
    } else { // 'prev'
      nextIndex = (currentIndex - 1 + chartTypes.length) % chartTypes.length;
    }
    
    const nextChartType = chartTypes[nextIndex];
    router.push(`/pinyin/${nextChartType}`);
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => navigate('next'),
    onSwipedRight: () => navigate('prev'),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });
  
  // 预加载相邻的拼音表数据，提升切换体验
  useEffect(() => {
    if (chartType) {
      const currentIndex = chartTypes.indexOf(chartType);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % chartTypes.length;
        const prevIndex = (currentIndex - 1 + chartTypes.length) % chartTypes.length;
        router.prefetch(`/pinyin/${chartTypes[nextIndex]}`);
        router.prefetch(`/pinyin/${chartTypes[prevIndex]}`);
      }
    }
  }, [chartType, router]);


  if (!router.isReady) {
    return <div className="text-center pt-20 text-white/80">正在加载页面数据...</div>;
  }

  const chartData = pinyinData[chartType] || pinyinData['initials']; 
  
  return (
    // 使用 div 包裹并应用 useSwipeable 返回的 handlers
    <div {...handlers} className="w-full min-h-screen touch-pan-y">
      <PinyinChartClient initialData={chartData} key={chartType} />
    </div>
  );
}
