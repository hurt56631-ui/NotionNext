// components/ForumCategoryTabs.js (使用 @use-gesture/react)
import { useState, useRef } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

// 你的分类和排序选项
const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
const sortOptions = ['默认', '最新', '最热'];

// 假设每个分类下面都有一个帖子列表组件
const CategoryContent = ({ category }) => (
  <div className="p-4">
    <h3 className="text-xl font-bold">{category} 内容区</h3>
    <p>这里将显示 {category} 分类下的帖子列表...</p>
    {/* 在这里放置你从 Firebase 获取并渲染的 PostItem 列表 */}
  </div>
);

const ForumCategoryTabs = ({ onCategoryChange, onSortChange }) => {
  const [activeSort, setActiveSort] = useState('默认');
  const index = useRef(0); // 当前显示的页面索引

  // 使用 react-spring 创建动画效果
  const [props, api] = useSprings(categories.length, i => ({
    x: i * window.innerWidth, // 每个页面都排在屏幕外面
    display: 'block'
  }));

  // 使用 @use-gesture/react 来绑定拖拽手势
  const bind = useDrag(({ active, movement: [mx], direction: [xDir], cancel }) => {
    // 当拖拽超过一定阈值时，切换页面
    if (active && Math.abs(mx) > window.innerWidth / 4) {
      const newIndex = index.current + (xDir > 0 ? -1 : 1);
      index.current = Math.max(0, Math.min(newIndex, categories.length - 1)); // 保证索引不越界
      cancel(); // 取消当前的拖拽
    }
    // 更新所有页面的位置
    api.start(i => {
      if (i < index.current - 1 || i > index.current + 1) return { display: 'none' }; // 只渲染相邻的页面
      const x = (i - index.current) * window.innerWidth + (active ? mx : 0);
      return { x, display: 'block' };
    });
  });
  
  // 点击 Tab 切换
  const handleTabChange = (i) => {
    index.current = i;
    api.start(j => {
      if (j < index.current - 1 || j > index.current + 1) return { display: 'none' };
      const x = (j - index.current) * window.innerWidth;
      return { x, display: 'block' };
    });
    onCategoryChange(categories[i]);
  };

  const handleSortClick = (sort) => {
    setActiveSort(sort);
    onSortChange(sort);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow sticky top-0 z-30 overflow-hidden">
      {/* 顶部的 Tabs 和排序 */}
      <div className="p-4">
        <div className="flex border-b dark:border-gray-700">
          {categories.map((cat, i) => (
            <button
              key={cat}
              onClick={() => handleTabChange(i)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${index.current === i ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500 hover:text-blue-500'}`}
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

      {/* 手势滑动区域 */}
      <div className="relative w-full h-full" {...bind()}>
        {props.map(({ x, display }, i) => (
          <animated.div
            key={i}
            className="absolute w-full h-full"
            style={{ display, x }}
          >
            {/* 这里渲染每个分类对应的内容 */}
            <CategoryContent category={categories[i]} />
          </animated.div>
        ))}
      </div>
    </div>
  );
};

export default ForumCategoryTabs;
