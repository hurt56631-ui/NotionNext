// components/ForumCategoryTabs.js (独立的、UI正确的分类/排序组件)

import { useState } from 'react';

const ForumCategoryTabs = ({ onCategoryChange, onSortChange }) => {
  const [activeCategory, setActiveCategory] = useState('推荐');
  const [activeSort, setActiveSort] = useState('默认');
  
  const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
  const sorts = ['默认', '最新', '最热'];

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    onCategoryChange(category);
  };
  
  const handleSortClick = (sort) => {
    setActiveSort(sort);
    onSortChange(sort);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-t-lg shadow-md px-4 pt-2">
      {/* 第一行：主分类 */}
      <div className="flex items-center space-x-6 border-b border-gray-200 dark:border-gray-700">
        {categories.map(category => (
          <div
            key={category}
            onClick={() => handleCategoryClick(category)}
            className={`cursor-pointer text-base py-3 transition-colors duration-200 ${
              activeCategory === category 
              ? 'text-blue-500 font-semibold border-b-2 border-blue-500' 
              : 'text-gray-600 dark:text-gray-300 hover:text-blue-500'
            }`}
          >
            {category}
          </div>
        ))}
      </div>
      {/* 第二行：排序方式 (药丸/胶囊样式) */}
      <div className="flex items-center space-x-3 py-3">
        {sorts.map(sort => (
          <button
            key={sort}
            onClick={() => handleSortClick(sort)}
            className={`px-4 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
              activeSort === sort
              ? 'bg-blue-500 text-white shadow'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {sort}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ForumCategoryTabs;
