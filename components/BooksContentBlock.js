// components/BooksContentBlock.js

import React, { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'

// --- [最终版] 书籍封面组件 (融合了立体效果并支持透明封面) ---
const BookItem = ({ item }) => (
    <a
      href={item.readUrl}
      target="_blank"
      rel="noopener noreferrer"
      // `group` 启用父级交互, `[perspective:800px]` 创建3D舞台
      className="block group [perspective:800px]"
      title={item.title}
    >
      {/* 3D变换的核心容器 */}
      <div 
        className="relative aspect-[3/4] w-full transition-transform duration-500 ease-in-out [transform-style:preserve-3d] group-hover:rotate-y-0 group-hover:scale-105"
        // 默认给一个Y轴旋转，制造立体透视感，让侧面可见
        style={{ transform: 'rotateY(-15deg)' }}
      >
        {/* 
          1. 书籍封面 (前景)
          - 关键修改：移除了父级的背景色，现在可以完美支持透明背景的 PNG 封面。
          - `rounded-lg` 保持圆角。
        */}
        <img
          src={item.imageUrl}
          alt={item.title}
          className="relative w-full h-full object-cover rounded-lg z-10"
        />

        {/* 
          2. 模拟书本的厚度 (背景)
          - 这是一个在Z轴上向后平移的元素，形成了书的侧面。
          - `bg-white dark:bg-gray-900` 模拟书页的颜色。
          - `shadow-inner` 增加一点内阴影，让侧面更有层次感。
        */}
        <div 
            className="absolute inset-0 rounded-lg bg-white dark:bg-gray-900 shadow-inner"
            // 向Z轴负方向移动8px，形成厚度
            style={{ transform: 'translateZ(-8px)' }} 
        />
      </div>

      {/* 书籍标题：保持在3D容器外部，确保清晰易读 */}
      <h3 className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
        {item.title}
      </h3>
    </a>
);


// --- [重构] 单个书籍分类区域 (采用现代卡片式设计) ---
// 这个组件保持不变，因为它已经是最优的 “底板” 布局
const BookCategorySection = ({ section }) => {
    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-lg overflow-hidden">
            <div className="flex justify-between items-center px-4 pt-4 pb-3">
                <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">{section.category}</h2>
                <a 
                  href={`/category/${encodeURIComponent(section.category)}`} 
                  className="flex items-center text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                    全部 {section.items.length} 本 <ChevronRight size={18} className="ml-0.5" />
                </a>
            </div>
        
            <div
                onTouchStart={(e) => e.stopPropagation()}
                className="flex gap-x-4 overflow-x-auto pb-5 px-4 no-scrollbar"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {section.items.map((item) => (
                    <div 
                        key={item.id}
                        className="flex-shrink-0 w-[28%] sm:w-[22%]"
                        style={{ scrollSnapAlign: 'start' }}
                    >
                        {/* 调用我们全新的立体书本组件 */}
                        <BookItem item={item} />
                    </div>
                ))}
            </div>
        </div>
    )
}


// --- “书籍”主组件 (整体结构和逻辑保持不变) ---
const BooksContentBlock = ({ notionBooks }) => {

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

  if (!groupedBooks || groupedBooks.length === 0) {
    return <p className="text-center text-gray-500 py-10">暂无书籍数据，请检查Notion数据库配置。</p>
  }

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
