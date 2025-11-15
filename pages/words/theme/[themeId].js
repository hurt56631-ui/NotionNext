// /pages/words/theme/[themeId].js

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import WordCard from '@/components/WordCard';
import { Layers, BookOpen, ArrowLeft } from 'lucide-react';
import semanticData from '@/data/semantic_words.json'; // 导入我们创建的语义分类数据

// --- 数据中心 ---

// 创建一个快速查找表，方便根据 URL 中的 themeId 快速找到对应的分类信息和单词
const themeLookup = {};
semanticData.forEach(mainCat => {
  mainCat.sub_categories.forEach(subCat => {
    themeLookup[subCat.sub_category_id] = {
      ...subCat, // 包含 id, title, words 数组
      mainCategoryTitle: mainCat.main_category_title
    };
  });
});

// 主题色映射
const mainCategoryColors = {
    1: { text: 'text-indigo-500', gradient: 'from-indigo-500 to-purple-600' },
    2: { text: 'text-sky-500', gradient: 'from-sky-500 to-blue-600' },
    3: { text: 'text-emerald-500', gradient: 'from-emerald-500 to-green-600' },
    4: { text: 'text-amber-500', gradient: 'from-amber-500 to-orange-600' },
    5: { text: 'text-rose-500', gradient: 'from-rose-500 to-red-600' }
};

const findMainCategoryId = (subId) => {
    for (const mainCat of semanticData) {
        if (mainCat.sub_categories.some(sub => sub.sub_category_id == subId)) {
            return mainCat.main_category_id;
        }
    }
    return null;
}


const ThemeStudyPage = () => {
  const router = useRouter();
  const { themeId } = router.query; // 从 URL 中获取 themeId

  const [themeInfo, setThemeInfo] = useState(null);
  const [themeColor, setThemeColor] = useState(mainCategoryColors[1]); // 默认颜色
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (router.isReady) {
      if (themeId && themeLookup[themeId]) {
        const info = themeLookup[themeId];
        setThemeInfo(info);
        const mainCatId = findMainCategoryId(themeId);
        if (mainCatId && mainCategoryColors[mainCatId]) {
            setThemeColor(mainCategoryColors[mainCatId]);
        }
      } else {
        setThemeInfo(null);
      }
      setIsLoading(false);
    }
  }, [themeId, router.isReady]);

  const handleStart = () => {
    if (themeInfo && themeInfo.words && themeInfo.words.length > 0) {
      setIsCardOpen(true);
    } else {
      alert("该分类下暂无词汇，敬请期待！");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <h1 className="text-xl text-gray-500">正在加载主题词汇...</h1>
      </div>
    );
  }

  if (!themeInfo) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <h1 className="text-xl text-red-500">未找到 ID 为 {themeId} 的主题分类。</h1>
      </div>
    );
  }

  if (isCardOpen) {
    return (
      <WordCard
        words={themeInfo.words}
        isOpen={isCardOpen}
        onClose={() => setIsCardOpen(false)}
        progressKey={`theme_${themeId}_study_page`}
      />
    );
  }
  
  const hasWords = themeInfo.words && themeInfo.words.length > 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md">
            <button
                onClick={() => router.push('/?tab=words')}
                className="flex items-center gap-2 mb-4 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
                <ArrowLeft size={16} />
                返回单词分类
            </button>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            
                <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-gradient-to-br ${themeColor.gradient}`}>
                    <Layers size={48} className="text-white" />
                </div>
                
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
                    {themeInfo.sub_category_title}
                </h1>
                <p className={`text-lg font-medium ${themeColor.text} mt-2`}>
                    {themeInfo.mainCategoryTitle}
                </p>

                <div className="flex justify-center my-8 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                    <div className="text-center">
                        <BookOpen className="mx-auto text-gray-500 dark:text-gray-400" />
                        <p className="text-2xl font-semibold text-gray-800 dark:text-white">{hasWords ? themeInfo.words.length : 0}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">词汇数量</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleStart} 
                    disabled={!hasWords}
                    className={`w-full py-4 text-lg font-semibold text-white rounded-xl shadow-lg transform transition-transform duration-200 hover:scale-105 focus:outline-none 
                        ${hasWords 
                        ? `bg-gradient-to-r ${themeColor.gradient} cursor-pointer` 
                        : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                        }`}
                >
                    {hasWords ? '开始学习' : '暂无内容'}
                </button>

            </div>
        </div>
    </div>
  );
};

export default ThemeStudyPage;
