
// components/BooksContentBlock.js

import { useState } from 'react';
import { ChevronRight, BookOpen, Library } from 'lucide-react';

// --- 模拟数据 ---
const booksData = [
  {
    category: '推荐综合教材',
    description: '系统化学习汉语的标准教材系列',
    color: 'bg-emerald-500',
    icon: <Library />,
    items: [
      { 
        id: 1, 
        title: '《HSK 标准教程》系列', 
        author: '姜丽萍 主编',
        imageUrl: '/images/hsk.png',
        readUrl: 'https://www.amazon.cn/dp/B00KL2M3F0'
      },
      { 
        id: 2, 
        title: '《博雅汉语》系列', 
        author: '李晓琪 主编',
        imageUrl: 'https://img1.doubanio.com/view/subject/l/public/s33983228.jpg',
        readUrl: 'https://book.douban.com/subject/35226757/'
      },
      { 
        id: 3, 
        title: '《新实用汉语课本》系列', 
        author: '刘珣 主编',
        imageUrl: 'https://m.media-amazon.com/images/I/5135Y6F6BFL.jpg',
        readUrl: 'https://www.blcup.com/PInfo/index/12554' 
      },
      {
        id: 4,
        title: '《发展汉语》系列',
        author: '国家汉办 规划',
        imageUrl: 'https://img1.doubanio.com/view/subject/l/public/s29509658.jpg',
        readUrl: 'https://book.douban.com/subject/26897232/',
      },
      {
        id: 5,
        title: '《成功之路》系列',
        author: '张莉 主编',
        imageUrl: 'https://img9.doubanio.com/view/subject/l/public/s3491416.jpg',
        readUrl: 'https://book.douban.com/subject/3482705/',
      }
    ]
  },
  {
    category: '分级读物',
    description: '通过阅读有趣的故事来巩固和扩展词汇',
    color: 'bg-violet-500',
    icon: <BookOpen />,
    items: [
      { 
        id: 1, 
        title: '汉语风 - 中文分级读物系列', 
        author: '刘月华 等',
        imageUrl: 'https://img2.doubanio.com/view/subject/l/public/s27221293.jpg',
        readUrl: 'https://book.douban.com/subject/26372076/'
      },
      { 
        id: 2, 
        title: '中文天天读系列', 
        author: '刘月华 等',
        imageUrl: 'https://m.media-amazon.com/images/I/51-j82rVq2L.jpg',
        readUrl: 'https://www.blcup.com/PInfo/index/8405'
      },
      { 
        id: 3, 
        title: '汉语阶梯阅读', 
        author: '各类作者',
        imageUrl: 'https://img9.doubanio.com/view/subject/l/public/s4657984.jpg',
        readUrl: 'https://book.douban.com/subject/5392812/'
      },
      {
        id: 4,
        title: '国际中文学习词汇速记速练',
        author: '吴晓露 等',
        imageUrl: 'https://img9.doubanio.com/view/subject/l/public/s34503716.jpg',
        readUrl: 'https://book.douban.com/subject/36183313/',
      }
    ]
  },
  {
    category: '专项技能与教师用书',
    description: '针对听说读写及教学法的专业书籍',
    color: 'bg-sky-500',
    icon: <Library />,
    items: [
        {
            id: 1,
            title: '《国际汉语教师证书》面试指南',
            author: '刘珣 主编',
            imageUrl: 'https://img1.doubanio.com/view/subject/l/public/s29671657.jpg',
            readUrl: 'https://book.douban.com/subject/27618919/',
        },
        {
            id: 2,
            title: '外国人学汉字',
            author: '陈作宏',
            imageUrl: 'https://img9.doubanio.com/view/subject/l/public/s2792874.jpg',
            readUrl: 'https://book.douban.com/subject/2381206/',
        },
        {
            id: 3,
            title: '国际汉语教学案例与分析',
            author: '朱勇',
            imageUrl: 'https://img2.doubanio.com/view/subject/l/public/s4408013.jpg',
            readUrl: 'https://book.douban.com/subject/4845421/',
        }
    ],
  }
];

const BookItem = ({ item }) => (
    <a 
      href={item.readUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="group block"
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


const BooksContentBlock = () => {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (category) => {
    setExpandedSections(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return (
    <div className="space-y-8">
      {booksData.map(section => (
        <div key={section.category} className="bg-white dark:bg-gray-800/50 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center mb-6">
            <div className={`w-12 h-12 rounded-lg ${section.color} flex items-center justify-center text-white flex-shrink-0 shadow-lg ${section.color.replace('bg-', 'shadow-')}/50`}>
              {section.icon}
            </div>
            <div className="ml-4">
              <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">{section.category}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
            {(expandedSections[section.category] ? section.items : section.items.slice(0, 3)).map(item => (
                <BookItem key={item.id} item={item} />
            ))}
          </div>

          {section.items.length > 3 && (
            <div className="mt-6 text-center">
              <button
                onClick={() => toggleSection(section.category)}
                className="group inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                {expandedSections[section.category] ? '收起' : '显示更多'}
                <ChevronRight className={`ml-1 transform transition-transform duration-300 ${expandedSections[section.category] ? 'rotate-90' : ''}`} size={16} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default BooksContentBlock;
