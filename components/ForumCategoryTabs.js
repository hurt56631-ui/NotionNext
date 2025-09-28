// components/ForumCategoryTabs.js

import { useState } from 'react';

const categories = ['推荐', '技术分享', '学习笔记', '资源分享', '日常交流'];
const sortOptions = ['最新', '最热'];

export default function ForumCategoryTabs({ onCategoryChange, onSortChange }) {
  const [activeCategory, setActiveCategory] = useState('推荐');
  const [activeSort, setActiveSort] = useState('最新');

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    onCategoryChange(category);
  };
  
  const handleSortClick = (sort) => {
    setActiveSort(sort);
    onSortChange(sort);
  };

  const activeTabClass = 'bg-blue-600 text-white';
  const inactiveTabClass = 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
      <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
        {/* 分类 */}
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${activeCategory === cat ? activeTabClass : inactiveTabClass}`}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* 排序 */}
        <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-full p-1">
          {sortOptions.map(sort => (
             <button
              key={sort}
              onClick={() => handleSortClick(sort)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${activeSort === sort ? 'bg-white dark:bg-gray-500 shadow' : 'text-gray-600 dark:text-gray-300'}`}
            >
              {sort}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
