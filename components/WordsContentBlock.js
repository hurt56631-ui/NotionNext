// /components/WordsContentBlock.js

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

import { 
    ArrowLeft, BookOpen, ChevronRight, LayoutGrid, 
    Atom, Layers, Home, BrainCircuit, Globe,
    Quote, Sigma, Clock, Map, HeartPulse, Waves, Smile, 
    UtensilsCrossed, Bus, Briefcase, Banknote, Sun, Palette, Film,
    GraduationCap, Star, Heart
} from 'lucide-react';

// --- 动态导入 WordCard 组件 ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });

// =================================================================================
// 数据库逻辑 (保持不变)
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 2;
const STORE_FAVORITES = 'favoriteWords';

const getFavoritesFromDB = async () => {
    if (typeof window === 'undefined') return [];
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => resolve([]);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
                db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_FAVORITES)) { resolve([]); return; }
            const transaction = db.transaction([STORE_FAVORITES], 'readonly');
            const store = transaction.objectStore(STORE_FAVORITES);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        };
    });
};

// =================================================================================
// 数据加载
// =================================================================================

// 1. HSK 单词数据
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) {}
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) {}
try { hskWordsData[3] = require('@/data/hsk/hsk3.json'); } catch (e) {}
try { hskWordsData[4] = require('@/data/hsk/hsk4.json'); } catch (e) {}
try { hskWordsData[5] = require('@/data/hsk/hsk5.json'); } catch (e) {}
try { hskWordsData[6] = require('@/data/hsk/hsk6.json'); } catch (e) {}

// 2. 语义分类单词数据
import semanticData from '@/data/semantic_words.json';

// --- UI 数据配置 ---
const hskLevels = [
  { level: 1, title: '入门级 (Introductory)', wordCount: 150 },
  { level: 2, title: '初级 (Basic)', wordCount: 300 },
  { level: 3, title: '进阶级 (Intermediate)', wordCount: 600 },
  { level: 4, title: '中级 (Upper Intermediate)', wordCount: 1200 },
  { level: 5, title: '高级 (Advanced)', wordCount: 2500 },
  { level: 6, title: '精通级 (Proficiency)', wordCount: 5000 }
];

const mainCategoryIcons = { 1: Atom, 2: Layers, 3: Home, 4: BrainCircuit, 5: Globe };
const mainCategoryColors = { 1: 'text-indigo-500', 2: 'text-sky-500', 3: 'text-emerald-500', 4: 'text-amber-500', 5: 'text-rose-500' };

const subCategoryIcons = { 
    101: Quote, 102: Sigma, 103: Clock, 104: Map, 
    201: HeartPulse, 202: Waves, 203: Smile, 204: BrainCircuit, 
    301: Home, 302: Layers, 303: UtensilsCrossed, 304: Home, 305: Bus, 
    401: BrainCircuit, 402: Quote, 403: GraduationCap, 404: Briefcase, 405: Banknote, 
    501: Sun, 502: Palette, 503: Film 
};

// =================================================================================
// 子组件
// =================================================================================

const FavoritesCard = ({ onClick, isLoading }) => (
  <motion.div 
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-8"
  >
    <button
      onClick={onClick}
      disabled={isLoading}
      className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-pink-400 to-rose-500 p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300 text-left disabled:opacity-70"
    >
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
            <Heart size={24} className="text-white fill-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">
                {isLoading ? '正在读取...' : '我的生词本 (My Favorites)'}
            </h3>
            <p className="text-pink-100 text-sm mt-1">复习您收藏的重点词汇（本地存储）</p>
          </div>
        </div>
        <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
            <ChevronRight size={24} className="text-white" />
        </div>
      </div>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
    </button>
  </motion.div>
);

const HskLevelList = ({ onVocabularyClick }) => (
  <div className="flex flex-col gap-3">
    {hskLevels.map((level, index) => (
      <motion.div
        key={level.level}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        <button
          onClick={() => onVocabularyClick('hsk', level)}
          className="group w-full flex items-center justify-between p-4 rounded-xl 
                     bg-pink-50 border border-pink-100 hover:bg-pink-100 
                     transition-all duration-200 cursor-pointer text-left shadow-sm hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white text-pink-500 border border-pink-100 shadow-sm font-serif font-bold text-lg group-hover:scale-110 transition-transform">
              {level.level}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800">HSK {level.level}</h3>
              <p className="text-xs text-gray-500">{level.title}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white/60 text-xs text-gray-600">
                <BookOpen size={12} className="text-pink-400" />
                <span>{level.wordCount}</span>
             </div>
             <ChevronRight size={20} className="text-gray-300 group-hover:text-pink-500 transition-colors" />
          </div>
        </button>
      </motion.div>
    ))}
  </div>
);

const ThemeView = ({ onVocabularyClick }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  if (selectedCategory) {
    const MainIcon = mainCategoryIcons[selectedCategory.main_category_id] || Layers;
    const themeColorClass = mainCategoryColors[selectedCategory.main_category_id] || 'text-gray-500';

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-1 mb-4 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          返回全部分类
        </button>
        
        <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <MainIcon size={28} className={themeColorClass} />
            <div>
                <h3 className="text-lg font-bold text-gray-800">{selectedCategory.main_category_title}</h3>
                <p className="text-xs text-gray-500">{selectedCategory.main_category_description}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectedCategory.sub_categories.map((sub, idx) => {
            const SubIcon = subCategoryIcons[sub.sub_category_id] || BookOpen;
            return (
              <motion.button 
                key={sub.sub_category_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="group p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-100 hover:shadow-md transition-all flex items-center justify-between text-left"
                onClick={() => onVocabularyClick('theme', sub)}
              >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                        <SubIcon size={18} className="text-gray-600 group-hover:text-indigo-500" />
                    </div>
                    <span className="font-medium text-gray-700 group-hover:text-gray-900">{sub.sub_category_title}</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400" />
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {semanticData.map((cat, index) => {
        const MainIcon = mainCategoryIcons[cat.main_category_id] || Layers;
        const colorClass = mainCategoryColors[cat.main_category_id] || 'text-gray-500';
        
        return(
          <motion.button
            key={cat.main_category_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedCategory(cat)}
            className="group flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all text-left"
          >
            <div className={`p-3 rounded-full bg-gray-50 group-hover:bg-white border border-transparent group-hover:border-gray-100 transition-colors`}>
                <MainIcon size={24} className={colorClass} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{cat.main_category_title}</h3>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cat.main_category_description}</p>
            </div>
          </motion.button>
        )
      })}
    </div>
  );
};

// =================================================================================
// 主组件 WordsContentBlock
// =================================================================================

const WordsContentBlock = () => {
  const router = useRouter();
  const [activeWords, setActiveWords] = useState(null);
  const [progressKey, setProgressKey] = useState(null);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  // 判断当前 URL hash 是否为 vocabulary
  const isCardViewOpen = router.asPath.includes('#vocabulary');

  // ---------------------------------------------------------------------------------
  // ✅ 核心修复：监听 URL 参数，自动恢复数据（解决刷新/分享后空白问题）
  // ---------------------------------------------------------------------------------
  useEffect(() => {
    // 1. 等待路由就绪，且当前必须在 vocabulary 视图下
    if (!router.isReady || !router.asPath.includes('#vocabulary')) return;

    // 2. 如果 state 里已经有数据，避免重复加载
    if (activeWords && activeWords.length > 0) return;

    const { mode, itemId } = router.query;
    
    // 如果没有参数，说明可能是“收藏夹”或者无效链接
    if (!mode || !itemId) return;

    let words = [];
    let key = '';

    // 3. 恢复 HSK 数据
    if (mode === 'hsk') {
        const level = parseInt(itemId, 10);
        words = hskWordsData[level] || [];
        key = `hsk_level_${level}_progress`;
    } 
    // 4. 恢复 Theme 数据
    else if (mode === 'theme') {
        const subId = parseInt(itemId, 10);
        // 遍历 semanticData 查找对应子分类
        for (const mainCat of semanticData) {
            const sub = mainCat.sub_categories.find(s => s.sub_category_id === subId);
            if (sub) {
                words = sub.words;
                key = `theme_cat_${subId}_progress`;
                break;
            }
        }
    }

    // 5. 设置数据到 State
    if (words.length > 0) {
        setActiveWords(words);
        setProgressKey(key);
    }

  }, [router.isReady, router.asPath, router.query, activeWords]);


  // ---------------------------------------------------------------------------------
  // ✅ 点击处理：更新 URL 参数，支持分享
  // ---------------------------------------------------------------------------------
  const handleVocabularyClick = useCallback(async (type, data) => {
    let words = [];
    let key = '';
    
    // 收藏夹逻辑 (特殊处理：不写参数到 URL，因为本地数据不能分享)
    if (type === 'favorites') {
        setIsLoadingFavorites(true);
        try {
            const favs = await getFavoritesFromDB();
            if (!favs || favs.length === 0) {
                alert("您还没有收藏任何单词。\n\n学习时点击卡片上的爱心即可收藏！");
                setIsLoadingFavorites(false);
                return;
            }
            setActiveWords(favs);
            setProgressKey('my_favorites_collection');
            // 只打开弹窗，不带参数
            router.push('/?tab=words#vocabulary', undefined, { shallow: true });
        } catch (e) {
            console.error(e);
            alert("读取收藏失败");
        } finally {
            setIsLoadingFavorites(false);
        }
        return;
    }

    // 常规逻辑 (HSK / Theme)
    let urlParams = {};

    if (type === 'hsk') {
      words = hskWordsData[data.level];
      key = `hsk_level_${data.level}_progress`;
      urlParams = { mode: 'hsk', itemId: data.level }; // 准备写入 URL
    
    } else if (type === 'theme') {
      words = data.words;
      key = `theme_cat_${data.sub_category_id}_progress`;
      urlParams = { mode: 'theme', itemId: data.sub_category_id }; // 准备写入 URL
    }

    if (words && words.length > 0) {
      setActiveWords(words);
      setProgressKey(key);
      
      // ✅ 重点：把 mode 和 itemId 写入 URL
      router.push({
        pathname: router.pathname,
        query: { ...router.query, tab: 'words', ...urlParams },
        hash: 'vocabulary'
      }, undefined, { shallow: true });

    } else {
      alert(`数据加载中...`);
    }
  }, [router]);

  // ---------------------------------------------------------------------------------
  // ✅ 关闭处理：清除 URL 参数
  // ---------------------------------------------------------------------------------
  const handleCloseCard = useCallback(() => {
    setActiveWords(null);
    setProgressKey(null);

    // 关闭时，移除 mode 和 itemId 参数，同时去掉 hash
    const { mode, itemId, ...restQuery } = router.query;
    
    router.push({
        pathname: router.pathname,
        query: restQuery, // 保留 tab=words，去掉 mode/itemId
        hash: ''
    }, undefined, { shallow: true });

  }, [router]);
  
  return (
    <>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 min-h-[60vh]">
        
        {/* 收藏入口 */}
        <FavoritesCard 
            onClick={() => handleVocabularyClick('favorites')}
            isLoading={isLoadingFavorites} 
        />

        {/* HSK Section */}
        <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 px-1">
                <div className="w-1 h-5 bg-pink-400 rounded-full"></div>
                HSK 核心词汇
            </h2>
            <HskLevelList onVocabularyClick={handleVocabularyClick} /> 
        </div>

        {/* Theme Section */}
        <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 px-1">
                <div className="w-1 h-5 bg-indigo-400 rounded-full"></div>
                主题场景分类
            </h2>
            <ThemeView onVocabularyClick={handleVocabularyClick} />
        </div>
      </div>

      {/* 单词卡片 */}
      <WordCard 
        isOpen={isCardViewOpen}
        words={activeWords || []} // 如果没数据，给空数组，防止报错
        onClose={handleCloseCard}
        progressKey={progressKey || 'default-key'}
      />
    </>
  );
};

export default WordsContentBlock;
