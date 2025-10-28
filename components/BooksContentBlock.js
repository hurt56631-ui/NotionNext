// components/BooksContentBlock.js
import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronUp } from 'lucide-react';

// --- 📘 全新的、更适合移动端的单本书卡片 ---
const BookItem = ({ item }) => (
  <a
    href={item.readUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="group block space-y-3"
    title={item.title}
  >
    {/* 书本封面卡片 */}
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1">
      <img
        src={item.imageUrl}
        alt={item.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      {/* 光泽效果 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 opacity-60 group-hover:opacity-30 transition-opacity duration-300"></div>
    </div>
    
    {/* 书名和作者信息 */}
    <div>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2">
        {item.title}
      </h3>
      {item.author && (
         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.author}</p>
      )}
    </div>
  </a>
);

// --- 📚 重构后的分类区域 ---
const BookCategorySection = ({ section }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const defaultShowCount = 4;
  const displayedItems = isExpanded ? section.items : section.items.slice(0, defaultShowCount);
  const canExpand = section.items.length > defaultShowCount;

  return (
    // ✅ 新增：为每个分类区域添加优雅的渐变背景和圆角
    <div className="space-y-6 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(199,210,254,0.3),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(55,48,163,0.3),rgba(0,0,0,0))] rounded-2xl py-6">
      {/* 分类标题 */}
      <div className="flex justify-between items-end px-4 sm:px-6">
        <div className="flex items-center space-x-3">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">
            {section.category}
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
            {section.items.length}本
          </span>
        </div>
        {canExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-all bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            {isExpanded ? (
              <>
                <span>收起</span>
                <ChevronUp size={18} className="ml-1" />
              </>
            ) : (
              <>
                <span>查看全部</span>
                <ChevronRight size={18} className="ml-1" />
              </>
            )}
          </button>
        )}
      </div>

      {/* 书籍列表区域 (已移除实体书架) */}
      <div
        onTouchStart={(e) => e.stopPropagation()}
        className={
          isExpanded
            ? 'px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 transition-all'
            : 'pl-4 sm:pl-6 flex gap-4 overflow-x-auto pb-4 no-scrollbar transition-all'
        }
      >
        {displayedItems.map((item) => (
          <div
            key={item.id}
            className={isExpanded ? '' : 'flex-shrink-0 w-32 sm:w-36'}
          >
            <BookItem item={item} />
          </div>
        ))}
        {/* 在横向滚动时，在末尾添加一个透明元素以保证右边距 */}
        {!isExpanded && <div className="flex-shrink-0 w-2 sm:w-4"></div>}
      </div>
    </div>
  );
};

// --- 主组件 ---
const BooksContentBlock = ({ notionBooks }) => {
  const groupedBooks = useMemo(() => {
    if (!notionBooks || !Array.isArray(notionBooks)) return [];
    const categories = {};
    notionBooks.forEach((book) => {
      const category = book.category || '未分类';
      if (!categories[category]) {
        categories[category] = { category, items: [] };
      }
      categories[category].items.push(book);
    });
    return Object.values(categories);
  }, [notionBooks]);

  if (groupedBooks.length === 0)
    return (
      <div className="text-center text-gray-500 py-16 bg-gray-50 dark:bg-gray-900 rounded-2xl m-4">
        <div className="text-4xl mb-4">📚</div>
        <p className="text-lg">暂无书籍数据</p>
        <p className="text-sm text-gray-400 mt-2">请检查 Notion 数据库配置</p>
      </div>
    );

  const HideScrollbarStyle = () => (
    <style jsx global>{`
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `}</style>
  );

  return (
    <div className="bg-transparent py-8">
      <div className="space-y-8 max-w-7xl mx-auto">
        <HideScrollbarStyle />
        {groupedBooks.map((section) => (
          <BookCategorySection key={section.category} section={section} />
        ))}
      </div>
    </div>
  );
};

export default BooksContentBlock;
