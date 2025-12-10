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

// --- 1. 定义谐音映射表 (完整版) ---
// 只要这里有定义，卡片上就会显示缅文
const burmeseMap = {
  // === 声母 (Initials) ===
  'b': 'ဗ (ဘ)', // bo
  'p': 'ပ (ဖ)', // po
  'm': 'မ',      // mo (摸)
  'f': 'ဖ(ွ)',   // fo (佛)
  'd': 'ဒ',      // de
  't': 'ထ',      // te
  'n': 'န',      // ne
  'l': 'လ',      // le
  'g': 'ဂ',      // ge
  'k': 'ခ',      // ke
  'h': 'ဟ',      // he
  'j': 'ကျ',     // ji
  'q': 'ချ',     // qi
  'x': 'ရှ',      // xi
  'zh': 'ကျ(zh)', // zhi
  'ch': 'ချ(ch)', // chi
  'sh': 'ရှ(sh)', // shi
  'r': 'ရ(r)',    // ri
  'z': 'ဇ',      // zi
  'c': 'ဆ',      // ci
  's': 'ဆ(ွ)',   // si
  'y': 'ယ',      // yi
  'w': 'ဝ',      // wu

  // === 单韵母 ===
  'a': 'အာ',
  'o': 'အော',
  'e': 'အ',      // (鹅)
  'i': 'အီ',
  'u': 'အူ',
  'ü': 'ယူ',

  // === 复韵母 ===
  'ai': 'အိုင်',
  'ei': 'အေ',
  'ui': 'ဝေ',
  'ao': 'အောက်',
  'ou': 'အို',
  'iu': 'ယူ',
  'ie': 'ယဲ',
  'üe': 'ရွဲ့',
  'er': 'အာရ်',

  // === 前鼻韵母 ===
  'an': 'အန်',
  'en': 'အန်(en)',
  'in': 'အင်',
  'un': 'ဝန်း',
  'ün': 'ရွန်း',

  // === 后鼻韵母 ===
  'ang': 'အောင်',
  'eng': 'အိုင်(eng)',
  'ing': 'အိုင်',
  'ong': 'အုန်',

  // === 整体认读音节 (必须单独定义) ===
  'zhi': 'ကျ(zh)',
  'chi': 'ချ(ch)',
  'shi': 'ရှ(sh)',
  'ri': 'ရ(r)',
  'zi': 'ဇ',
  'ci': 'ဆ',
  'si': 'ဆ(ွ)',
  'yi': 'ယီး',
  'wu': 'ဝူး',
  'yu': 'ယွီး',
  'ye': 'ယဲ',
  'yue': 'ရွဲ့',
  'yuan': 'ယွမ်',
  'yin': 'ယင်း',
  'yun': 'ယွန်း',
  'ying': 'ယင်း(g)'
};

// --- 最终版拼音数据中心 ---
const pinyinData = {
  // 1. 声母页
  initials: { 
    title: '声母表 (Initials)', 
    // 声母是一个简单的列表，没有分类
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, 
      audio: `${BASE_AUDIO_URL}/声母/${l}.mp3`,
      burmese: burmeseMap[l] || '' 
    })) 
  },

  // 2. 韵母页 (结构修改为 Categories，确保竖向展示)
  finals: { 
    title: '韵母表 (Finals)',
    categories: [
      { name: '单韵母', rows: [['a','o','e','i','u','ü']] },
      { name: '复韵母', rows: [['ai','ei','ui','ao','ou','iu','ie','üe','er']] },
      { name: '前鼻韵母', rows: [['an','en','in','un','ün']] },
      { name: '后鼻韵母', rows: [['ang','eng','ing','ong']] }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => ({
        letter,
        // R2 路径：拼音音频/韵母/ang.mp3
        audio: `${BASE_AUDIO_URL}/韵母/${letter}.mp3`,
        burmese: burmeseMap[letter] || '' 
      })))
    }))
  },

  // 3. 整体认读页 (新增！对应 /pinyin/whole)
  whole: {
    title: '整体认读 (Whole Syllables)',
    // 整体认读也用 Categories 结构，这样样式会和韵母表一致，竖着排列
    categories: [
      {
        name: '翘舌音与平舌音',
        rows: [['zhi','chi','shi','ri'], ['zi','ci','si']]
      },
      {
        name: 'i u ü 开头',
        rows: [['yi','wu','yu'], ['ye','yue','yuan'], ['yin','yun','ying']]
      }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => ({
        letter,
        // R2 路径：拼音音频/整体读音/zhi.mp3
        audio: `${BASE_AUDIO_URL}/整体读音/${letter}.mp3`,
        burmese: burmeseMap[letter] || ''
      })))
    }))
  },

  // 4. 声调表页
  tones: { 
    title: '声调表 (Tones)',
    categories: [
      {
        name: '单韵母',
        folder: '单韵母',
        rows: [
          ['ā','á','ǎ','à'], ['ō','ó','ǒ','ò'], ['ē','é','ě','è'], ['ī','í','ǐ','ì'], ['ū','ú','ǔ','ù'], ['ǖ','ǘ','ǚ','ǜ']
        ]
      },
      {
        name: '复韵母',
        folder: '复韵母',
        rows: [
          ['āi','ái','ǎi','ài'], ['ēi','éi','ěi','èi'], ['uī','uí','uǐ','uì'], ['āo','áo','ǎo','ào'], ['ōu','óu','ǒu','òu'], ['iū','iú','iǔ','iù'], ['iē','ié','iě','iè'], ['üē','üé','üě','üè'], ['ēr','ér','ěr','èr']
        ]
      },
      {
        name: '前鼻韵母',
        folder: '鼻韵母',
        rows: [
          ['ān','án','ǎn','àn'], ['ēn','én','ěn','èn'], ['īn','ín','ǐn','ìn'], ['ūn','ún','ǔn','ùn'], ['ǖn','ǘn','ǚn','ǜn']
        ]
      },
      {
        name: '后鼻韵母',
        folder: '鼻韵母',
        rows: [
          ['āng','áng','ǎng','àng'], ['ēng','éng','ěng','èng'], ['īng','íng','ǐng','ìng'], ['ōng','óng','ǒng','òng']
        ]
      },
      {
        name: '整体认读 (带声调)',
        folder: '整体读音',
        rows: [
          ['zhī','zhí','zhǐ','zhì'], ['chī','chí','chǐ','chì'], ['shī','shí','shǐ','shì'], ['rī','rí','rǐ','rì'], 
          ['zī','zí','zǐ','zì'], ['cī','cí','cǐ','cì'], ['sī','sí','sǐ','sì'], 
          ['yī','yí','yǐ','yì'], ['wū','wú','wǔ','ù'], ['yū','yú','yǔ','yù'], 
          ['yē','yé','yě','yè'], ['yuē','yué','yuě','yuè'], ['yuān','yuán','yuǎn','yuàn'], 
          ['yīn','yín','yǐ','yìn'], ['yūn','yún','yǔn','yùn'], ['yīng','yíng','ǐng','yìng']
        ]
      }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => {
        // 去声调逻辑，确保带声调的字母也能匹配到上面的 burmeseMap
        const cleanLetter = letter
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
            .replace('g', 'g') 
            .toLowerCase();

        return {
          letter,
          // R2 路径：拼音音频/声调表/单韵母/ā.mp3
          audio: `${BASE_AUDIO_URL}/声调表/${category.folder}/${letter}.mp3`,
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

  // 这里的 chartType 会对应上面 pinyinData 的 keys (initials, finals, tones, whole)
  const chartData = pinyinData[chartType] || pinyinData['initials']; 
  
  return (
    <div className="w-full min-h-screen">
      <PinyinChartClient initialData={chartData} key={chartType} />
    </div>
  );
}
