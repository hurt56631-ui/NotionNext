// components/BooksContentBlock.js

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'

// --- 书籍封面组件 (保持3D立体效果) ---
const BookItem3D = ({ item }) => (
    <a
      href={item.readUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block [perspective:1000px]"
      title={item.title}
    >
      <div 
        className="relative aspect-[3/4] w-full rounded-md shadow-lg transition-transform duration-500 ease-in-out [transform-style:preserve-3d] group-hover:-translate-y-2"
        style={{ transform: 'rotateX(5deg) rotateY(-10deg)' }} // 增加X轴旋转，更有俯视感
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
      </div>
    </a>
);

// --- 单个落地书架组件 ---
const FloorShelf = ({ section, isExpanded, onToggle }) => {
    return (
        <div className="space-y-4">
            {/* 1. 可点击的分类标题区域 */}
            <button 
              onClick={onToggle}
              className="w-full flex justify-between items-center px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
                <h2 className="font-bold text-2xl text-gray-100">{section.category}</h2>
                <div className="flex items-center text-sm font-medium text-gray-400">
                    <span>{isExpanded ? '收起' : '展开'}</span>
                    <ChevronDown size={20} className={`ml-1 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
        
            {/* 2. 可展开的书籍列表，现在是网格布局 */}
            <div 
              // 【核心】手势冲突解决方案：包裹一个div并阻止触摸事件冒泡
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <div 
                className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-8 px-4 transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
              >
                  {section.items.map((item) => (
                      <div key={item.id}>
                          <BookItem3D item={item} />
                      </div>
                  ))}
              </div>
            </div>

             {/* 3. “地板”图片 */}
            <div className="px-4">
                <div 
                  className="h-8 w-full bg-cover bg-center rounded-b-lg"
                  style={{ backgroundImage: "url('/images/muban.jpg')" }}
                ></div>
            </div>
        </div>
    )
}

// --- 主组件 ---
const BooksContentBlock = ({ notionBooks }) => {
  // 使用 useState 来管理每个分类的展开/折叠状态
  const [expandedSections, setExpandedSections] = useState({});

  // 点击标题时，切换对应分类的展开状态
  const toggleSection = (category) => {
    setExpandedSections(prev => ({
      // 可以支持同时展开多个
      ...prev,
      [category]: !prev[category]
      // 如果希望每次只展开一个，使用下面这行
      // { [category]: !prev[category] }
    }));
  };

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

  return (
    // 整体背景色和垂直间距
    <div className="bg-[#18171d] dark:bg-[#18171d] py-8">
        <div className="space-y-8 max-w-5xl mx-auto">
            {groupedBooks.map(section => (
                <FloorShelf 
                  key={section.category}
                  section={section}
                  isExpanded={!!expandedSections[section.category]}
                  onToggle={() => toggleSection(section.category)}
                />
            ))}
        </div>
    </div>
  );
};

export default BooksContentBlock;
