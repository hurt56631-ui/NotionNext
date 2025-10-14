// components/BooksContentBlock.js

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'

// --- 书籍封面组件 (全新3D立体效果) ---
const BookItem3D = ({ item }) => (
    <a
      href={item.readUrl}
      target="_blank"
      rel="noopener noreferrer"
      // group: 启用父级悬停效果, perspective: 创建3D舞台
      className="group block [perspective:1000px]"
      title={item.title}
    >
      {/* 3D变换的核心容器 */}
      <div 
        className="relative aspect-[3/4] w-full rounded-md shadow-lg transition-transform duration-500 ease-in-out [transform-style:preserve-3d] group-hover:rotate-y-0 group-hover:scale-105"
        // 默认给一个轻微的Y轴旋转，制造透视感
        style={{ transform: 'rotateY(-10deg)' }}
      >
        {/* 书籍封面 */}
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover rounded-md"
        />
        {/* 悬停时的遮罩层和标题 */}
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md">
          <p className="text-white text-center text-sm font-semibold">{item.title}</p>
        </div>
        {/* 模拟书本的厚度 */}
        <div 
            className="absolute top-0 left-0 w-full h-full rounded-md bg-gray-200 dark:bg-gray-800 [transform:translateZ(-5px)]"
            style={{ backfaceVisibility: 'hidden' }}
        />
      </div>
    </a>
);

// --- 单个书架组件 ---
const BookShelf = ({ section }) => {
    return (
        <div className="space-y-3">
            {/* 1. 分类标题区域 */}
            <div className="flex justify-between items-end px-4">
                <h2 className="font-bold text-2xl text-gray-900 dark:text-gray-100">{section.category}</h2>
                {/* 2. 右上角的“全部 XX 本”按钮 */}
                <a href={`/category/${encodeURIComponent(section.category)}`} className="flex items-center text-sm font-medium text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors">
                    全部 {section.items.length} 本 <ChevronRight size={16} className="ml-0.5" />
                </a>
            </div>
        
            {/* 3. 横向滚动的容器 */}
            <div
                // 【核心】阻止滑动事件冒泡到父级，解决手势冲突
                onTouchStart={(e) => e.stopPropagation()}
                className="flex gap-x-5 overflow-x-auto pb-4 horizontal-scrollbar"
            >
                {section.items.map((item, index) => (
                    <div 
                        key={item.id}
                        // 手机上默认显示约3本，通过控制宽度实现
                        // flex-shrink-0 确保项目不会被压缩
                        className="w-[30vw] sm:w-36 md:w-40 flex-shrink-0"
                        // 第一个和最后一个元素添加边距，让滚动看起来更舒适
                        style={{
                            scrollSnapAlign: 'start',
                            marginLeft: index === 0 ? '1rem' : undefined,
                            marginRight: index === section.items.length - 1 ? '1rem' : undefined
                        }}
                    >
                        <BookItem3D item={item} />
                    </div>
                ))}
            </div>

             {/* 4. 模拟实体书架的木板 */}
            <div className="h-2 bg-gray-300 dark:bg-gray-700/50 rounded-md shadow-inner mx-4"></div>
        </div>
    )
}


// --- “书架”主组件 ---
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
    return <p className="text-center text-gray-500">暂无书籍数据，请检查Notion数据库配置。</p>
  }

  // 自定义极细滚动条样式
  const CustomScrollbarStyle = () => (
    <style jsx global>{`
        .horizontal-scrollbar::-webkit-scrollbar {
            height: 3px;
        }
        .horizontal-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .horizontal-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(150, 150, 150, 0.2);
            border-radius: 10px;
        }
        .dark .horizontal-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(100, 100, 100, 0.3);
        }
    `}</style>
  );

  return (
    // 整体背景色和垂直间距
    <div className="bg-gray-100 dark:bg-[#1E1E1E] py-8">
        <div className="space-y-12 max-w-5xl mx-auto">
            <CustomScrollbarStyle />
            {groupedBooks.map(section => (
                <BookShelf key={section.category} section={section} />
            ))}
        </div>
    </div>
  );
};

export default BooksContentBlock;
