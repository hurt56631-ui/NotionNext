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
// 这里涵盖了声母(bo, po, mo...)、韵母(a, o, e...)以及整体认读音节
const burmeseMap = {
  // === 声母 (Initials) - 对应：玻坡摸佛... ===
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

  // === 单韵母 (Simple Finals) ===
  'a': 'အာ',    // a
  'o': 'အော',   // o
  'e': 'အ',     // e (鹅)
  'i': 'အီ',    // i
  'u': 'အူ',    // u
  'ü': 'ယူ',    // ü

  // === 复韵母 (Compound Finals) ===
  'ai': 'အိုင်',
  'ei': 'အေ',
  'ui': 'ဝေ',
  'ao': 'အောက်',
  'ou': 'အို',
  'iu': 'ယူ',
  'ie': 'ယဲ',
  'üe': 'ရွဲ့',
  'er': 'အာရ်',

  // === 前鼻韵母 (Nasal Finals - Front) ===
  'an': 'အန်',
  'en': 'အန်(en)',
  'in': 'အင်',
  'un': 'ဝန်း',
  'ün': 'ရွန်း',

  // === 后鼻韵母 (Nasal Finals - Back) ===
  'ang': 'အောင်',
  'eng': 'အိုင်(eng)',
  'ing': 'အိုင်',
  'ong': 'အုန်',

  // === 整体认读音节 (Whole Syllables) ===
  // 这些音节虽然有声母韵母组成，但作为整体发音，需要单独映射
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
  initials: { 
    title: '声母表', 
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, 
      audio: `${BASE_AUDIO_URL}/声母/${l}.mp3`,
      // 直接匹配声母映射
      burmese: burmeseMap[l] || '' 
    })) 
  },
  finals: { 
    title: '韵母表',
    // 这里将所有韵母分类放在同一页展示
    categories: [
      { name: '单韵母', rows: [['a','o','e','i'],['u','ü']] },
      { name: '复韵母', rows: [['ai','ei','ui','ao'],['ou','iu','ie','üe'],['er']] },
      { name: '前鼻韵母', rows: [['an','en','in','un'],['ün']] },
      { name: '后鼻韵母', rows: [['ang','eng','ing','ong']] }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => ({
        letter,
        audio: `${BASE_AUDIO_URL}/韵母/${letter}.mp3`,
        // 直接匹配韵母映射
        burmese: burmeseMap[letter] || '' 
      })))
    }))
  },
  tones: { 
    title: '声调表',
    categories: [
      {
        name: '单韵母',
        folder: '单韵母', // R2: 声调表/单韵母
        rows: [
          ['ā','á','ǎ','à'], ['ō','ó','ǒ','ò'], ['ē','é','ě','è'], ['ī','í','ǐ','ì'], ['ū','ú','ǔ','ù'], ['ǖ','ǘ','ǚ','ǜ']
        ]
      },
      {
        name: '复韵母',
        folder: '复韵母', // R2: 声调表/复韵母
        rows: [
          ['āi','ái','ǎi','ài'], ['ēi','éi','ěi','èi'], ['uī','uí','uǐ','uì'], ['āo','áo','ǎo','ào'], ['ōu','óu','ǒu','òu'], ['iū','iú','iǔ','iù'], ['iē','ié','iě','iè'], ['üē','üé','üě','üè'], ['ēr','ér','ěr','èr']
        ]
      },
      {
        name: '前鼻韵母',
        folder: '鼻韵母', // R2: 声调表/鼻韵母
        rows: [
          ['ān','án','ǎn','àn'], ['ēn','én','ěn','èn'], ['īn','ín','ǐn','ìn'], ['ūn','ún','ǔn','ùn'], ['ǖn','ǘn','ǚn','ǜn']
        ]
      },
      {
        name: '后鼻韵母',
        folder: '鼻韵母', // R2: 声调表/鼻韵母
        rows: [
          ['āng','áng','ǎng','àng'], ['ēng','éng','ěng','èng'], ['īng','íng','ǐng','ìng'], ['ōng','óng','ǒng','òng']
        ]
      },
      {
        name: '整体认读',
        folder: '整体读音', // R2: 声调表/整体读音
        rows: [
          ['zhī','zhí','zhǐ','zhì'], ['chī','chí','chǐ','chì'], ['shī','shí','shǐ','shì'], ['rī','rí','rǐ','rì'], ['zī','zí','zǐ','zì'], ['cī','cí','cǐ','cì'], ['sī','sí','sǐ','sì'], ['yī','yí','yǐ','yì'], ['wū','wú','wǔ','ù'], ['yū','yú','yǔ','yù'], ['yē','yé','yě','yè'], ['yuē','yué','yuě','yuè'], ['yuān','yuán','yuǎn','yuàn'], ['yīn','yín','yǐ','yìn'], ['yūn','yún','yǔn','yùn'], ['yīng','yíng','ǐng','yìng']
        ]
      }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => {
        // 关键逻辑：去除声调，还原成基础字母 (例如 ā -> a, zhī -> zhi)
        const cleanLetter = letter
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // 去声调
            .replace('g', 'g') // 兼容性处理
            .toLowerCase(); // 转小写

        return {
          letter,
          audio: `${BASE_AUDIO_URL}/声调表/${category.folder}/${letter}.mp3`,
          // 逻辑：优先找 letter 本身（万一你有 ā 的映射），找不到就找 cleanLetter（基础谐音）
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

  // 默认为 initials，防止 chartType 为空报错
  const chartData = pinyinData[chartType] || pinyinData['initials']; 
  
  return (
    <div className="w-full min-h-screen">
      <PinyinChartClient initialData={chartData} key={chartType} />
    </div>
  );
}
