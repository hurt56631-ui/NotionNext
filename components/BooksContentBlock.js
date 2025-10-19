// components/BooksContentBlock.js
import React, { useMemo, useState } from 'react'
import { ChevronRight, ChevronUp } from 'lucide-react'

// --- 📘 单本书封面（优化版） ---
const BookItem = ({ item }) => (
  <a
    href={item.readUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="group block"
    title={item.title}
  >
    <div className="flex flex-col items-center h-full">
      <div className="relative aspect-[3/4] w-full [perspective:800px]">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover rounded-md shadow-md transition-transform duration-300 ease-in-out origin-right group-hover:scale-105 group-hover:-translate-y-1"
          style={{
            transform: 'rotateY(-12deg)',
            borderLeft: '10px solid #fff',
            borderTop: '2px solid #f7f7f7',
            borderBottom: '2px solid #eaeaea'
          }}
        />
      </div>
      {/* 默认隐藏书名，仅悬停显示 */}
      <h3 className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200 text-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 line-clamp-2">
        {item.title}
      </h3>
    </div>
  </a>
);

// --- 📚 分类区域 ---
const BookCategorySection = ({ section }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const defaultShowCount = 4;
  const displayedItems = isExpanded ? section.items : section.items.slice(0, defaultShowCount);
  const canExpand = section.items.length > defaultShowCount;

  return (
    <div className="space-y-4">
      {/* 分类标题 */}
      <div className="flex justify-between items-end px-4">
        <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">
          {section.category}
        </h2>
        {canExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-all"
          >
            {isExpanded ? (
              <>
                <span>收起</span>
                <ChevronUp size={18} className="ml-0.5" />
              </>
            ) : (
              <>
                <span>全部 {section.items.length} 本</span>
                <ChevronRight size={18} className="ml-0.5" />
              </>
            )}
          </button>
        )}
      </div>

      {/* 书籍列表 */}
      <div
        onTouchStart={(e) => e.stopPropagation()}
        className={
          isExpanded
            ? 'grid grid-cols-3 sm:grid-cols-4 gap-x-6 gap-y-10 px-4 transition-all'
            : 'flex gap-x-5 overflow-x-auto pb-4 px-4 no-scrollbar transition-all'
        }
      >
        {displayedItems.map((item) => (
          <div
            key={item.id}
            className={isExpanded ? '' : 'flex-shrink-0 w-[28%] sm:w-[22%]'}
          >
            <BookItem item={item} />
          </div>
        ))}
      </div>

      {/* 🌳 美化后的书架底板 */}
      <div className="h-3 mx-4 rounded-lg bg-gradient-to-t from-gray-300 to-gray-100 dark:from-gray-800 dark:to-gray-700 shadow-inner"></div>
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
      <p className="text-center text-gray-500 py-10">
        暂无书籍数据，请检查 Notion 数据库配置。
      </p>
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
      <div className="space-y-12 max-w-5xl mx-auto">
        <HideScrollbarStyle />
        {groupedBooks.map((section) => (
          <BookCategorySection key={section.category} section={section} />
        ))}
      </div>
    </div>
  );
};

export default BooksContentBlock;
