// themes/heo/components/ForumCategoryTabs.js (CSS 升级版)

import { useState } from 'react';
import { useRouter } from 'next/router';

const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
const sortOptions = ['默认', '最新', '最热'];

const ForumCategoryTabs = ({ onCategoryChange, onSortChange }) => {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(router?.query?.category || '推荐');
  const [activeSort, setActiveSort] = useState('默认');

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    onCategoryChange(category);
  };

  const handleSortClick = (sort) => {
    setActiveSort(sort);
    onSortChange(sort);
  };

  return (
    // 【关键改动】添加了磨砂玻璃效果
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow-md p-4 sticky top-2 z-30">
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto scroll-hidden">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            // 【关键改动】点击时增加下沉动画
            className={`flex-shrink-0 px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 ${activeCategory === cat ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600 dark:text-gray-300 hover:text-blue-500'}`}
          >
            {cat}
          </button>
        ))}
      </div>
      
      <div className="flex justify-end items-center mt-2 text-sm">
        {sortOptions.map(sort => (
          <button
            key={sort}
            onClick={() => handleSortClick(sort)}
            // 【关键改动】调整颜色和字体粗细
            className={`ml-3 px-3 py-1 rounded-md font-medium transition-colors ${activeSort === sort ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {sort}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ForumCategoryTabs;
