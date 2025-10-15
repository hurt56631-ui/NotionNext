// components/BooksContentBlock.js

import React, { useMemo, useState } from 'react'
import { ChevronRight, ChevronUp } from 'lucide-react'

// --- [最终版] 书籍封面组件 (巧妙实现立体效果，完美支持透明封面) ---
const BookItem = ({ item }) => (
    <a
      href={item.readUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
      title={item.title}
    >
      <div className="flex flex-col h-full">
        {/* 
          核心修改：3D效果现在直接作用于图片本身 
          [perspective:800px] 为父容器创建3D舞台
        */}
        <div className="relative aspect-[3/4] w-full [perspective:800px]">
          {/*
            立体效果实现：
            1. transform: rotateY(-12deg) - 将图片Y轴旋转，产生透视。
            2. border-l-[10px] ... - 添加一个厚的左边框和薄的上下边框，模拟书页的厚度。
            3. border-color - 边框颜色模拟纸张。
            这个方法让透明背景的PNG也能拥有立体侧面。
          */}
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover rounded-md shadow-lg transition-transform duration-300 ease-in-out origin-right group-hover:scale-105"
            style={{
              transform: 'rotateY(-12deg)',
              borderLeft: '10px solid #FFFFFF',
              borderTop: '2px solid #F7F7F7',
              borderBottom: '2px solid #EAEAEA'
            }}
          />
        </div>
        
        {/* 书籍标题 */}
        <h3 className="mt-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
          {item.title}
        </h3>
      </div>
    </a>
);


// --- [全新] 单个书籍分类区域 (支持展开/收起，并带有独立底板) ---
const BookCategorySection = ({ section }) => {
    // 1. 【核心功能】为每个分类添加独立的“展开”状态
    const [isExpanded, setIsExpanded] = useState(false);

    // 默认显示的书籍数量
    const defaultShowCount = 4;
    // 根据是否展开，决定显示哪些书籍
    const displayedItems = isExpanded ? section.items : section.items.slice(0, defaultShowCount);
    // 判断是否需要显示“展开”按钮
    const canExpand = section.items.length > defaultShowCount;

    return (
        // 每个分类的根容器
        <div className="space-y-3">
            {/* 2. 分类标题区域 */}
            <div className="flex justify-between items-end px-4">
                <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">{section.category}</h2>
                {/* 
                  3. 【核心功能】交互按钮
                  - 只有当书籍总数超过默认显示数量时才显示。
                  - onClick事件切换 isExpanded 状态。
                  - 根据 isExpanded 状态显示不同文本和图标。
                */}
                {canExpand && (
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="flex items-center text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-200"
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
        
            {/* 4. 书籍列表容器 */}
            <div
                onTouchStart={(e) => e.stopPropagation()}
                // 根据是否展开，切换布局模式
                className={
                    isExpanded
                    ? 'grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-8 px-4 transition-all' // 展开时使用Grid网格布局
                    : 'flex gap-x-4 overflow-x-auto pb-2 px-4 no-scrollbar transition-all' // 未展开时使用Flex横向滚动
                }
            >
                {displayedItems.map((item) => (
                    <div 
                        key={item.id}
                        // 在Flex布局下，此宽度确保默认显示约3本多一点
                        className={isExpanded ? '' : 'flex-shrink-0 w-[28%] sm:w-[22%]'}
                    >
                        <BookItem item={item} />
                    </div>
                ))}
            </div>

            {/* 5. 【核心外观】独立的“底板”/书架 */}
            <div className="h-2 bg-gray-200 dark:bg-gray-800/60 rounded-lg shadow-inner mx-4"></div>
        </div>
    )
}


// --- “书籍”主组件 ---
const BooksContentBlock = ({ notionBooks }) => {

  const groupedBooks = useMemo(() => {
    if (!notionBooks || !Array.isArray(notionBooks)) return []
    const categories = {}
    notionBooks.forEach(book => {
      const category = book.category || '未分类'
      if (!categories[category]) {
        categories[category] = { category: category, items: [] }
      }
      categories[category].items.push(book)
    })
    return Object.values(categories)
  }, [notionBooks]);

  if (!groupedBooks || groupedBooks.length === 0) {
    return <p className="text-center text-gray-500 py-10">暂无书籍数据，请检查Notion数据库配置。</p>
  }

  const HideScrollbarStyle = () => (
    <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );

  return (
    <div className="bg-transparent dark:bg-transparent py-6">
        <div className="space-y-12 max-w-5xl mx-auto">
            <HideScrollbarStyle />
            {groupedBooks.map(section => (
                <BookCategorySection key={section.category} section={section} />
            ))}
        </div>
    </div>
  );
};

export default BooksContentBlock;
