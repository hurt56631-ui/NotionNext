import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronUp } from 'lucide-react';

// --- 📘 全新设计：带倒影效果的单本书封面 ---
const BookItem = ({ item }) => (
  <a
    href={item.readUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="group block w-full focus:outline-none"
    title={item.title}
  >
    <div className="flex flex-col items-center">
      {/* 封面容器 */}
      <div className="relative w-full aspect-[3/4] transition-transform duration-300 ease-in-out group-hover:-translate-y-2">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover rounded-md shadow-lg"
        />
      </div>
      
      {/* 倒影效果 */}
      <div className="relative w-full h-1/2 mt-1 overflow-hidden">
        <div 
          className="w-full h-full bg-cover bg-center blur-sm scale-y-[-1] opacity-20 group-hover:opacity-30 transition-opacity duration-300"
          style={{ backgroundImage: `url(${item.imageUrl})` }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/80 to-white dark:from-gray-900/0 dark:via-gray-900/80 dark:to-gray-900"></div>
      </div>
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
    <div className="space-y-6">
      {/* 分类标题 */}
      <div className="flex justify-between items-center px-4 sm:px-6">
        <h2 className="font-bold text-xl text-gray-800 dark:text-gray-100">
          {section.category}
        </h2>
        {canExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            {isExpanded ? (
              <>
                <span>收起</span>
                <ChevronUp size={16} className="ml-1" />
              </>
            ) : (
              <>
                <span>查看全部 ({section.items.length})</span>
                <ChevronRight size={16} className="ml-1" />
              </>
            )}
          </button>
        )}
      </div>

      {/* 书籍列表 (移除了底板) */}
      <div
        onTouchStart={(e) => e.stopPropagation()}
        className={
          isExpanded
            ? 'px-4 sm:px-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-6 gap-y-8'
            : 'pl-4 sm:pl-6 flex gap-x-6 overflow-x-auto pb-4 no-scrollbar'
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
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );

  return (
    <div className="bg-white dark:bg-gray-900 py-8">
      <div className="space-y-12 max-w-7xl mx-auto">
        <HideScrollbarStyle />
        {groupedBooks.map((section) => (
          <BookCategorySection key={section.category} section={section} />
        ))}
      </div>
    </div>
  );
};

export default BooksContentBlock;
