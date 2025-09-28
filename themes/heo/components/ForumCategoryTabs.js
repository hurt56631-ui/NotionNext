// components/ForumCategoryTabs.js (最终正确UI版)

import { useState } from 'react';

const ForumCategoryTabs = ({ onCategoryChange, onSortChange }) => {
  // 状态管理：分别跟踪当前选中的分类和排序
  const [activeCategory, setActiveCategory] = useState('推荐');
  const [activeSort, setActiveSort] = useState('默认');
  
  // 数据定义：分类和排序的选项列表
  const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
  const sorts = ['默认', '最新', '最热'];

  // 事件处理：当点击分类时，更新状态并通知父组件
  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    onCategoryChange(category);
  };
  
  // 事件处理：当点击排序时，更新状态并通知父组件
  const handleSortClick = (sort) => {
    setActiveSort(sort);
    onSortChange(sort);
  };

  // 渲染UI：严格按照您截图的两行式布局
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
