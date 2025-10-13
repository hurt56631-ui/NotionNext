// components/BooksContentBlock.js

import { useState, useMemo } from 'react'
import { ChevronRight, BookOpen, Library } from 'lucide-react'

// 【美化核心】: 在这里定义每个分类的附加信息（描述、颜色、图标）
// 您以后在 Notion 中新增了分类，只需在这里添加对应的中文名即可
const categoryMetadata = {
  'HSK系列': {
    description: '系统化学习汉语的标准教材系列',
    color: 'bg-emerald-500',
    icon: <Library size={24} />
  },
  '新实用汉语系列': {
    description: '经典的综合性汉语学习系列教材',
    color: 'bg-sky-500',
    icon: <BookOpen size={24} />
  },
  // 如果您有更多分类，可以在这里继续添加
  // '另一个分类名': {
  //   description: '这是另一个分类的描述',
  //   color: 'bg-violet-500',
  //   icon: <Library size={24} />
  // }
};

// 默认值，防止 Notion 中有新分类但这里没定义时出错
const defaultMetadata = {
  description: '精选汉语学习书籍与资源',
  color: 'bg-gray-500',
  icon: <BookOpen size={24} />
};


// 单个书籍卡片的组件 (保持不变，本身设计已很出色)
const BookItem = ({ item }) => (
    <a
      href={item.readUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
      title={item.title}
    >
      <div className="relative aspect-[3/4] w-full bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <p className="text-white text-center font-semibold">{item.title}</p>
        </div>
      </div>
    </a>
);


// 升级后的主组件
const BooksContentBlock = ({ notionBooks }) => {
  // 使用 useState 来管理每个分类的展开/折叠状态
  const [expandedSections, setExpandedSections] = useState({});

  // 点击按钮时，切换对应分类的展开状态
  const toggleSection = (category) => {
    setExpandedSections(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // 数据分组的逻辑保持不变
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
    return <p className="text-center text-gray-500">暂无书籍数据，请检查Notion数据库配置。</p>
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {groupedBooks.map(section => {
        // 为当前分类获取对应的元数据（颜色、图标等）
        const metadata = categoryMetadata[section.category] || defaultMetadata;
        const isExpanded = expandedSections[section.category];
        
        return (
            <div key={section.category} className="bg-white dark:bg-gray-800/50 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50">
                {/* 1. 精美的分类标题栏 */}
                <div className="flex items-center mb-6">
                    <div className={`w-12 h-12 rounded-lg ${metadata.color} flex items-center justify-center text-white flex-shrink-0 shadow-lg ${metadata.color.replace('bg-', 'shadow-')}/50`}>
                        {metadata.icon}
                    </div>
                    <div className="ml-4">
                        <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">{section.category}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{metadata.description}</p>
                    </div>
                </div>
            
                {/* 2. 响应式的书籍封面网格 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                    {/* 根据展开状态，决定显示3本还是全部 */}
                    {(isExpanded ? section.items : section.items.slice(0, 3)).map(item => (
                        <BookItem key={item.id} item={item} />
                    ))}
                </div>

                {/* 3. 仅当书籍数量超过3本时，才显示“显示更多”按钮 */}
                {section.items.length > 3 && (
                    <div className="mt-6 text-center">
                    <button
                        onClick={() => toggleSection(section.category)}
                        className="group inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                        {isExpanded ? '收起' : '显示更多'}
                        <ChevronRight className={`ml-1 transform transition-transform duration-300 ${isExpanded ? '-rotate-90' : 'rotate-90'}`} size={16} />
                    </button>
                    </div>
                )}
            </div>
        )}
      )}
    </div>
  );
};

export default BooksContentBlock;
