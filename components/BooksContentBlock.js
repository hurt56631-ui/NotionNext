// components/BooksContentBlock.js

import React, { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'

// --- [重构] 书籍封面组件 (为移动端优化的简洁设计) ---
// 移除了不适用于手机的 3D 和鼠标悬停效果，专注于清晰的展示
const BookItem = ({ item }) => (
    <a
      href={item.readUrl}
      target="_blank" // 如果是外部链接，保留。如果是内部链接，可以移除
      rel="noopener noreferrer"
      className="block group" // 保留 group 以备将来可能的扩展
      title={item.title}
    >
      <div className="flex flex-col h-full">
        {/* 书籍封面：采用 aspect-ratio 确保比例一致，并添加了更柔和的阴影 */}
        <div className="aspect-[3/4] w-full rounded-lg overflow-hidden shadow-md bg-gray-200 dark:bg-gray-700">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" // 保留一个轻微的缩放效果，对桌面端依然友好
          />
        </div>
        {/* 书籍标题：置于封面下方，清晰易读 */}
        <h3 className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
          {item.title}
        </h3>
      </div>
    </a>
);


// --- [重构] 单个书籍分类区域 (采用现代卡片式设计) ---
// 将 "书架木板" 的概念升级为完整的背景卡片，即您提到的 "底板"
const BookCategorySection = ({ section }) => {
    return (
        // 这是 “底板”：一个带有内边距、圆角和阴影的卡片，包裹整个分类
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-lg overflow-hidden">
            {/* 1. 分类标题区域 (放置在卡片内部) */}
            <div className="flex justify-between items-center px-4 pt-4 pb-3">
                <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">{section.category}</h2>
                <a 
                  href={`/category/${encodeURIComponent(section.category)}`} 
                  className="flex items-center text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                    全部 {section.items.length} 本 <ChevronRight size={18} className="ml-0.5" />
                </a>
            </div>
        
            {/* 2. 横向滚动的容器 */}
            <div
                // 【核心功能】阻止触摸滑动事件冒泡到父级，完美解决手势冲突问题
                onTouchStart={(e) => e.stopPropagation()}
                // `overflow-x-auto` 开启横向滚动
                // `no-scrollbar` class 应用我们定义的隐藏滚动条样式
                // `px-4` 提供左右内边距，`gap-x-4` 定义书籍间的距离
                className="flex gap-x-4 overflow-x-auto pb-5 px-4 no-scrollbar"
                style={{ scrollSnapType: 'x mandatory' }} // 增加滚动吸附效果，体验更佳
            >
                {section.items.map((item) => (
                    <div 
                        key={item.id}
                        // 【核心布局】
                        // `flex-shrink-0` 确保项目不会被压缩变形
                        // `w-[28%]` 是实现“默认显示3本”的关键。28% * 3 = 84%，加上间距，正好在一屏内展示三本多一点点，暗示用户可以滚动
                        // `sm:w-[22%]` 在稍大屏幕上显示4本
                        className="flex-shrink-0 w-[28%] sm:w-[22%]"
                        style={{ scrollSnapAlign: 'start' }} // 配合父级的滚动吸附
                    >
                        <BookItem item={item} />
                    </div>
                ))}
            </div>
        </div>
    )
}


// --- “书籍”主组件 (整体结构和逻辑保持不变) ---
const BooksContentBlock = ({ notionBooks }) => {

  // 您的数据处理逻辑非常棒，这里保持原样
  const groupedBooks = useMemo(() => {
    if (!notionBooks || !Array.isArray(notionBooks)) return []
    const categories = {}
    notionBooks.forEach(book => {
      const category = book.category || '未分类'
      if (!categories[category]) {
        categories[category] = {
          category: category,
          items: []
        }
      }
      categories[category].items.push(book)
    })
    return Object.values(categories)
  }, [notionBooks]);

  // 加载状态或无数据时的提示
  if (!groupedBooks || groupedBooks.length === 0) {
    return <p className="text-center text-gray-500 py-10">暂无书籍数据，请检查Notion数据库配置。</p>
  }

  // 【核心功能】隐藏滚动条的全局样式
  const HideScrollbarStyle = () => (
    <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
            display: none; /* Chrome, Safari and Opera */
        }
        .no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
    `}</style>
  );

  return (
    // 调整了整体背景色和垂直间距，使其更好地融入页面
    <div className="bg-transparent dark:bg-transparent py-6">
        <div className="space-y-8 max-w-5xl mx-auto">
            <HideScrollbarStyle />
            {groupedBooks.map(section => (
                <BookCategorySection key={section.category} section={section} />
            ))}
        </div>
    </div>
  );
};

export default BooksContentBlock;
