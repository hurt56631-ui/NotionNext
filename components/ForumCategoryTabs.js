// themes/heo/components/ForumCategoryTabs.js (使用内置 Font Awesome)

import { useState } from 'react';
import { useRouter } from 'next/router';

const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
const sortOptions = ['默认', '最新', '最热'];

/**
 * 论坛的分类和排序Tabs
 */
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-0 z-30">
      <div className="flex border-b dark:border-gray-700 overflow-x-auto scroll-hidden">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`flex-shrink-0 px-4 py-2 text-sm font-semibold transition-colors ${activeCategory === cat ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500 hover:text-blue-500'}`}
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
            className={`ml-3 px-2 py-1 rounded ${activeSort === sort ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {sort}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ForumCategoryTabs;
