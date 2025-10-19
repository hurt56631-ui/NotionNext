// components/BooksContentBlock.js
import React, { useMemo, useState } from 'react'
import { ChevronRight, ChevronUp } from 'lucide-react'

// --- 📘 单本书封面（保持不变） ---
const BookItem = ({ item }) => (
  <a
    href={item.readUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="group block"
    title={item.title}
  >
    <div className="flex flex-col items-center h-full">
      {/* 书脊效果 */}
      <div className="w-1 h-12 bg-gradient-to-b from-gray-600 to-gray-800 rounded-t-sm mx-auto mb-1 opacity-60"></div>
      
      {/* 书本容器 */}
      <div className="relative w-full">
        {/* 书本阴影 */}
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg shadow-lg transform translate-y-1 -z-10"></div>
        
        {/* 书本主体 */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 p-1.5 transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1">
          {/* 书封面 */}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover rounded transition-transform duration-500 group-hover:scale-105"
            />
            {/* 光泽效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        </div>
      </div>
      
      {/* 书名 */}
      <h3 className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200 text-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 line-clamp-2 px-1">
        {item.title}
      </h3>
    </div>
  </a>
);

// --- 📚 分类区域 (已修改书架部分) ---
const BookCategorySection = ({ section }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const defaultShowCount = 4;
  const displayedItems = isExpanded ? section.items : section.items.slice(0, defaultShowCount);
  const canExpand = section.items.length > defaultShowCount;

  return (
    <div className="space-y-6">
      {/* 分类标题 */}
      <div className="flex justify-between items-end px-4">
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

      {/* 书架区域 */}
      <div className="relative">
        {/* 书籍列表 */}
        <div className="relative z-10 pb-6 px-6">
          <div
            onTouchStart={(e) => e.stopPropagation()}
            className={
              isExpanded
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 transition-all'
                : 'flex gap-6 overflow-x-auto pb-6 no-scrollbar transition-all'
            }
          >
            {displayedItems.map((item) => (
              <div
                key={item.id}
                className={isExpanded ? '' : 'flex-shrink-0 w-32 sm:w-36 md:w-40'}
              >
                <BookItem item={item} />
              </div>
            ))}
          </div>
        </div>

        {/* ✅ 核心修改：使用真实的图片作为书架，并移除所有装饰性 div */}
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none">
          <img
            // 我为您找到了一张高质量的真实书架图片，您可以直接使用
            // 如果您想更换，只需替换下面的 src 链接即可
            src="https://images.unsplash.com/photo-1542826438-c2d279252285?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Wooden Bookshelf"
            className="w-full h-full object-cover rounded-t-xl"
          />
           {/* 书架顶部添加一点阴影，让书本更有立体感 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent rounded-t-xl"></div>
        </div>
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

  // ✅ 清理：移除了不再使用的 bg-wood-pattern 样式
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
