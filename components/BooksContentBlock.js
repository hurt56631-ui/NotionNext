// components/BooksContentBlock.js

import { useMemo } from 'react'
import { ArrowRight, BookOpen, Library } from 'lucide-react'

// --- 分类元数据 (保持不变，用于装饰) ---
const categoryMetadata = {
  'HSK系列': {
    description: '系统化学习汉语的标准教材系列',
    color: 'bg-emerald-500',
    icon: <Library size={20} />
  },
  '新实用汉语系列': {
    description: '经典的综合性汉语学习系列教材',
    color: 'bg-sky-500',
    icon: <BookOpen size={20} />
  }
};

const defaultMetadata = {
  description: '精选汉语学习书籍与资源',
  color: 'bg-gray-500',
  icon: <BookOpen size={20} />
};

// --- 书籍封面组件 (保持不变) ---
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

// --- 升级后的“书架”主组件 ---
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

  // 自定义滚动条样式 (注入到页面)
  const CustomScrollbarStyle = () => (
    <style jsx global>{`
        .horizontal-scrollbar::-webkit-scrollbar {
            height: 4px;
        }
        .horizontal-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
            margin: 0.5rem;
        }
        .horizontal-scrollbar::-webkit-scrollbar-thumb {
            background: #cccccc;
            border-radius: 10px;
        }
        .dark .horizontal-scrollbar::-webkit-scrollbar-track {
            background: #2d3748;
        }
        .dark .horizontal-scrollbar::-webkit-scrollbar-thumb {
            background: #4a5568;
        }
    `}</style>
  );

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
        <CustomScrollbarStyle />
        {groupedBooks.map(section => {
            const metadata = categoryMetadata[section.category] || defaultMetadata;
            
            return (
                <div key={section.category} className="space-y-4">
                    {/* 1. 分类标题区域 */}
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${metadata.color} flex items-center justify-center text-white flex-shrink-0`}>
                                {metadata.icon}
                            </div>
                            <div>
                                <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">{section.category}</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{metadata.description}</p>
                            </div>
                        </div>
                        {/* 2. 右上角的“更多”按钮 */}
                        <a href="#" className="flex items-center text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-500 transition-colors">
                            更多 <ArrowRight size={16} className="ml-1" />
                        </a>
                    </div>
                
                    {/* 3. 横向滚动的“书架” */}
                    <div className="flex space-x-4 overflow-x-auto pb-4 horizontal-scrollbar">
                        {section.items.map((item, index) => (
                            <div 
                                key={item.id}
                                // 【核心】手机上每行3本，通过控制宽度实现
                                // w-[calc((100%-2rem)/3)] 表示 (容器宽度 - 间距) / 3
                                // flex-shrink-0 确保项目不会被压缩
                                className="w-[calc((100%-2rem)/3)] sm:w-40 flex-shrink-0"
                                // 第一个和最后一个元素添加边距，让滚动看起来更舒适
                                style={{
                                    marginLeft: index === 0 ? '0.5rem' : undefined,
                                    marginRight: index === section.items.length - 1 ? '0.5rem' : undefined
                                }}
                            >
                                <BookItem item={item} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        )}
    </div>
  );
};

export default BooksContentBlock;
