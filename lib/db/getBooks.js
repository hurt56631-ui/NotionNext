// components/BooksContentBlock.js

import { useState, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'

// 单个书籍卡片的组件 - 彻底重写以实现立体效果
const BookItem = ({ item }) => (
    <a
      href={item.readUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block relative w-full pt-[141%] transition-transform duration-300 transform-gpu hover:-translate-y-2" // pt-[141%] 模拟书籍高宽比
      title={item.title}
    >
        {/* 使用一个伪元素来创建书的厚度和阴影，增加立体感 */}
        <div 
            className="absolute inset-0 bg-gray-300 dark:bg-gray-600 rounded-md transform-gpu 
                       origin-bottom -rotate-1 group-hover:rotate-0 transition-transform duration-300"
            style={{
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)' // 确保阴影不超出
            }}
        />
        {/* 封面图片本身 */}
        <img
            src={item.imageUrl}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-contain rounded-md z-10" // object-contain 确保透明图片比例正确
        />
    </a>
);

// 升级后的主组件 - 书架风格
const BooksContentBlock = ({ notionBooks }) => {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (category) => {
    setExpandedSections(prev => ({
      ...prev,
      [category]: !prev[category]
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
  }, [notionBooks])

  if (!groupedBooks || groupedBooks.length === 0) {
    return <p className="text-center text-gray-500 py-10">暂无书籍数据，请检查Notion数据库配置。</p>
  }

  return (
    <div className="space-y-12 px-4 py-8">
      {groupedBooks.map(section => {
        const isExpanded = expandedSections[section.category];
        const booksToShow = isExpanded ? section.items : section.items.slice(0, 3);
        
        return (
            <div key={section.category}>
                {/* 1. 分类标题栏 - 仿照参考图设计 */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{section.category}</h2>
                    {/* 点击“全部”来展开/收起 */}
                    {section.items.length > 3 && (
                        <button
                            onClick={() => toggleSection(section.category)}
                            className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        >
                            {isExpanded ? '收起' : `全部 ${section.items.length} 本`}
                            <ChevronRight className={`ml-1 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} size={16} />
                        </button>
                    )}
                </div>
            
                {/* 2. 书籍网格 - 关键的“书架”部分 */}
                <div className="relative pt-4 pb-8">
                    {/* 书籍封面 */}
                    <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                        {booksToShow.map(item => (
                            <BookItem key={item.id} item={item} />
                        ))}
                    </div>
                    {/* 书架的横板 */}
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gray-200/80 dark:bg-gray-800/80 rounded-lg" 
                         style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)' }}
                    />
                </div>
            </div>
        )}
      )}
    </div>
  );
};

export default BooksContentBlock;
