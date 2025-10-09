// components/BooksContentBlock.js

import { ChevronRight, BookOpen, Library } from 'lucide-react';

// --- 模拟数据 ---
const booksData = [
  {
    category: '推荐教材',
    description: '系统化学习汉语的标准教材系列',
    color: 'bg-emerald-500',
    icon: <Library />,
    items: [
      { id: 1, title: '《HSK 标准教程》系列', author: '姜丽萍 主编' },
      { id: 2, title: '《博雅汉语》系列', author: '李晓琪 主编' },
      { id: 3, title: '《新实用汉语课本》系列', author: '刘珣 主编' },
    ]
  },
  {
    category: '分级读物',
    description: '通过阅读有趣的故事来巩固和扩展词汇',
    color: 'bg-violet-500',
    icon: <BookOpen />,
    items: [
      { id: 1, title: '汉语风 - 中文分级读物系列', author: '刘月华 等' },
      { id: 2, title: '中文天天读系列', author: '刘月华 等' },
      { id: 3, title: '汉语阶梯阅读', author: '各类作者' },
    ]
  },
];

const BooksContentBlock = () => {
  return (
    <div className="space-y-6">
      {booksData.map(section => (
        <div key={section.category} className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center mb-4">
            <div className={`w-12 h-12 rounded-lg ${section.color} flex items-center justify-center text-white flex-shrink-0 shadow-lg ${section.color.replace('bg-', 'shadow-')}/50`}>
              {section.icon}
            </div>
            <div className="ml-4">
              <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">{section.category}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
            {section.items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-3 px-1 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-lg transition-colors cursor-pointer group">
                <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.author}</p>
                </div>
                <ChevronRight className="text-gray-400" size={20} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BooksContentBlock;
