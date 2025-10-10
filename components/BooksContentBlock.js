// components/BooksContentBlock.js (结合版)

import { ChevronRight } from 'lucide-react';
import Image from 'next/image';

// --- 模拟数据 (保持不变，使用带封面的数据) ---
const booksData = [
  {
    category: 'HSK 标准教程',
    items: [
      { id: 'hsk-1', title: 'HSK 1', author: '姜丽萍 主编', imageUrl: 'https://m.media-amazon.com/images/I/71X8k3s0c+L._AC_UF1000,1000_QL80_.jpg' },
      { id: 'hsk-2', title: 'HSK 2', author: '姜丽萍 主编', imageUrl: 'https://m.media-amazon.com/images/I/51552z0a1TL._AC_UF1000,1000_QL80_.jpg' },
      { id: 'hsk-3', title: 'HSK 3', author: '姜丽萍 主编', imageUrl: 'https://m.media-amazon.com/images/I/81Lflq8-yNL._AC_UF1000,1000_QL80_.jpg' },
      { id: 'hsk-4a', title: 'HSK 4上', author: '姜丽萍 主编', imageUrl: 'https://m.media-amazon.com/images/I/516a73K-3pL.jpg' },
      { id: 'hsk-4b', title: 'HSK 4下', author: '姜丽萍 主编', imageUrl: 'https://m.media-amazon.com/images/I/51-PMLo7wKL.jpg' },
      { id: 'hsk-5a', title: 'HSK 5上', author: '姜丽萍 主编', imageUrl: 'https://m.media-amazon.com/images/I/51y2eY-JdKL.jpg' },
    ]
  },
  {
    category: '推荐中文读物',
    items: [
      { id: 'reader-1', title: '活着', author: '余华', imageUrl: 'https://img1.doubanio.com/view/subject/s/public/s34044208.jpg' },
      { id: 'reader-2', title: '三体', author: '刘慈欣', imageUrl: 'https://img9.doubanio.com/view/subject/s/public/s25633164.jpg' },
      { id: 'reader-3', title: '围城', author: '钱钟书', imageUrl: 'https://img2.doubanio.com/view/subject/s/public/s29433392.jpg' },
      { id: 'reader-4', title: '平凡的世界', author: '路遥', imageUrl: 'https://img9.doubanio.com/view/subject/s/public/s33629095.jpg' },
      { id: 'reader-5', title: '白鹿原', author: '陈忠实', imageUrl: 'https://img9.doubanio.com/view/subject/s/public/s29467645.jpg' },
    ]
  },
  {
    category: '儿童启蒙读物',
    items: [
        { id: 'child-1', title: '窗边的小豆豆', author: '黑柳彻子', imageUrl: 'https://img9.doubanio.com/view/subject/s/public/s33923565.jpg' },
        { id: 'child-2', title: '猜猜我有多爱你', author: '山姆·麦克布雷尼', imageUrl: 'https://img1.doubanio.com/view/subject/s/public/s1598207.jpg' },
        { id: 'child-3', title: '小王子', author: '安托万·德·圣-埃克苏佩里', imageUrl: 'https://img3.doubanio.com/view/subject/s/public/s1020482.jpg' },
        { id: 'child-4', title: '活了100万次的猫', author: '佐野洋子', imageUrl: 'https://img9.doubanio.com/view/subject/s/public/s1333304.jpg' }
    ]
  }
];

const BooksContentBlock = () => {
  return (
    // {/ V 整体容器，使用了图一的背景图片来营造氛围 /}
    <div
      className="p-4 rounded-lg bg-cover bg-center"
      style={{ backgroundImage: "url('/images/shujiabeijing.png')" }}
    >
      <div className="space-y-6">
        {booksData.map(section => (
          // {/ V 每个分类都是一个独立的“书架层” /}
          <div key={section.category} className="relative pt-8">
            {/* --- 分类头部 --- */}
            <div className="flex justify-between items-center mb-4 px-2 text-white">
              <h2 className="font-bold text-2xl" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}>{section.category}</h2>
              <a href="#" className="flex items-center text-sm bg-black/20 px-2 py-1 rounded-full hover:bg-black/40 transition-colors">
                <span>全部</span>
                <ChevronRight size={16} className="ml-1" />
              </a>
            </div>

            {/* --- 书籍封面横向滚动列表 --- */}
            <div className="flex gap-x-5 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
              {section.items.map(item => (
                <a href="#" key={item.id} className="block flex-shrink-0 w-36 group">
                  <div className="w-full relative">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      width={150}
                      height={225}
                      // {/ V 书籍封面：增加了更强的阴影和变换效果，模拟立在书架上的感觉 /}
                      className="w-full h-auto object-cover rounded-md shadow-2xl aspect-[2/3] bg-gray-200 dark:bg-gray-700 
                                 group-hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-300"
                    />
                  </div>
                  <h3 className="text-sm font-semibold mt-3 text-white truncate" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{item.title}</h3>
                  <p className="text-xs text-gray-300 truncate" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{item.author}</p>
                </a>
              ))}
            </div>
            
            {/* --- 关键元素：用图一的木板作为分类的“底座”和分隔符 --- */}
            <div
              className="absolute bottom-[-1.5rem] left-0 w-full h-6 bg-cover bg-center rounded-sm shadow-lg"
              style={{ backgroundImage: "url('/images/muban.jpg')" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// 小提示: 为了实现干净的横向滚动效果，您可能需要在全局 CSS 文件中添加这个类
// .scrollbar-hide::-webkit-scrollbar { display: none; }
// .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

export default BooksContentBlock;
