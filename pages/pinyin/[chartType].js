// /pages/pinyin/[chartType].js

import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// 动态导入客户端组件
const PinyinChartClient = dynamic(
  () => import('@/components/PinyinChartClient'),
  { 
    ssr: false,
    loading: () => <div className="text-center pt-20 text-white/80">正在加载拼音模块...</div> 
  }
);

// --- 0. 定义 R2 音频基础路径 ---
const BASE_AUDIO_URL = 'https://audio.886.best/chinese-vocab-audio/拼音音频';

// --- 1. 定义谐音映射表 ---
// 注意：要想卡片上显示缅文，这里的 key 必须和数据里的 letter 完全一致。
// 如果你想让带声调的字(如 ā)也显示，需要在这里添加 'ā': '...' 或者修改逻辑去掉声调匹配
const burmeseMap = {
  // 单韵母
  'a': 'အား',
  'o': 'အော(ဝ်)',
  'e': 'အေး', // 补充示例
  'i': 'ယီး',
  'u': 'ဝူး',
  'ü': 'ယွီး',
  
  // 声母 (补充一部分示例，你需要把剩下的填完才能全显示)
  'b': 'ဗ', 'p': 'ဖ', 'm': 'မ', 'f': 'ဖ(ွ)',
  'd': 'ဒ', 't': 'ထ', 'n': 'န', 'l': 'လ',
  'g': 'ဂ', 'k': 'ခ', 'h': 'ဟ',
  'j': 'ကျ', 'q': 'ချ', 'x': 'ရှ',
  'z': 'ဇ', 'c': 'ဆ', 's': 'ဆ(ွ)',
  'r': 'ရ(zh)', 'y': 'ယ', 'w': 'ဝ',
  
  // 可以在这里继续添加韵母和谐音...
  'ai': 'အိုင်', 'ei': 'အေ', 'ao': 'အောက်', 'ou': 'အို'
};

// --- 最终版拼音数据中心 ---
const pinyinData = {
  initials: { 
    title: '声母表', 
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, 
      // 修改为 R2 路径：.../拼音音频/声母/b.mp3
      audio: `${BASE_AUDIO_URL}/声母/${l}.mp3`,
      burmese: burmeseMap[l] || '' 
    })) 
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
        // 修改为 R2 路径：.../拼音音频/韵母/ang.mp3
        audio: `${BASE_AUDIO_URL}/韵母/${letter}.mp3`,
        burmese: burmeseMap[letter] || '' 
      })))
    }))
  },
  tones: { 
    title: '声调表',
    categories: [
      {
        name: '单韵母',
        folder: '单韵母', // 对应 R2 文件夹名：声调表/单韵母
        rows: [
          ['ā','á','ǎ','à'], ['ō','ó','ǒ','ò'], ['ē','é','ě','è'], ['ī','í','ǐ','ì'], ['ū','ú','ǔ','ù'], ['ǖ','ǘ','ǚ','ǜ']
        ]
      },
      {
        name: '复韵母',
        folder: '复韵母', // 对应 R2 文件夹名：声调表/复韵母
        rows: [
          ['āi','ái','ǎi','ài'], ['ēi','éi','ěi','èi'], ['uī','uí','uǐ','uì'], ['āo','áo','ǎo','ào'], ['ōu','óu','ǒu','òu'], ['iū','iú','iǔ','iù'], ['iē','ié','iě','iè'], ['üē','üé','üě','üè'], ['ēr','ér','ěr','èr']
        ]
      },
      {
        name: '前鼻韵母',
        folder: '鼻韵母', // 对应 R2 文件夹名：声调表/鼻韵母 (你给的列表里前后鼻音都在这个文件夹)
        rows: [
          ['ān','án','ǎn','àn'], ['ēn','én','ěn','èn'], ['īn','ín','ǐn','ìn'], ['ūn','ún','ǔn','ùn'], ['ǖn','ǘn','ǚn','ǜn']
        ]
      },
      {
        name: '后鼻韵母',
        folder: '鼻韵母', // 对应 R2 文件夹名：声调表/鼻韵母
        rows: [
          ['āng','áng','ǎng','àng'], ['ēng','éng','ěng','èng'], ['īng','íng','ǐng','ìng'], ['ōng','óng','ǒng','òng']
        ]
      },
      {
        name: '整体认读',
        folder: '整体读音', // 对应 R2 文件夹名：声调表/整体读音
        rows: [
          ['zhī','zhí','zhǐ','zhì'], ['chī','chí','chǐ','chì'], ['shī','shí','shǐ','shì'], ['rī','rí','rǐ','rì'], ['zī','zí','zǐ','zì'], ['cī','cí','cǐ','cì'], ['sī','sí','sǐ','sì'], ['yī','yí','yǐ','yì'], ['wū','wú','wǔ','ù'], ['yū','yú','yǔ','yù'], ['yē','yé','yě','yè'], ['yuē','yué','yuě','yuè'], ['yuān','yuán','yuǎn','yuàn'], ['yīn','yín','yǐ','yìn'], ['yūn','yún','yǔn','yùn'], ['yīng','yíng','ǐng','yìng']
        ]
      }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => {
        // 尝试去除声调来匹配基础谐音 (例如 ā -> a)
        // 这是一个简单的去声调处理，以便在 burmeseMap 中找到对应的 a
        const cleanLetter = letter
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // 去除声调符号
            .replace('g', 'g') // 某些特殊字符处理
            .toLowerCase();

        return {
          letter,
          // 这里的 folder 变量来自上面定义的 categories 数组中的 folder 字段
          // 最终路径：BASE/声调表/单韵母/ā.mp3
          audio: `${BASE_AUDIO_URL}/声调表/${category.folder}/${letter}.mp3`,
          
          // 逻辑修改：优先找带声调的匹配，找不到则找去声调后的匹配
          burmese: burmeseMap[letter] || burmeseMap[cleanLetter] || '' 
        };
      }))
    }))
  }
};

export default function PinyinChartPage() {
  const router = useRouter();
  const { chartType } = router.query;

  if (!router.isReady) {
    return <div className="text-center pt-20 text-white/80">正在加载页面数据...</div>;
  }

  const chartData = pinyinData[chartType] || pinyinData['initials']; 
  
  return (
    <div className="w-full min-h-screen">
      <PinyinChartClient initialData={chartData} key={chartType} />
    </div>
  );
}
