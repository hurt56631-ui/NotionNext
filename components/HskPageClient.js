// components/HskPageClient.js  <-- 最终修复版：改造为内容块

import { ChevronRight } from 'lucide-react';

// --- 数据中心 (保持不变) ---
const hskData = [
  { level: 1, title: '入门水平', description: '掌握最常用词语和基本语法', color: 'bg-blue-500', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流', color: 'bg-green-500', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 3, title: '进阶水平', description: '完成生活、学习、工作的基本交际', color: 'bg-yellow-500', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 4, title: '中级水平', description: '流畅地与母语者进行交流', color: 'bg-orange-500', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 5, title: '高级水平', description: '阅读报刊杂志，欣赏影视节目', color: 'bg-red-500', lessons: Array.from({ length: 36 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 6, title: '流利水平', description: '轻松理解信息，流利表达观点', color: 'bg-purple-500', lessons: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
];


/**
 * HSK 内容块组件
 * 它不再是一个完整的页面，而是一个可以嵌入任何地方的内容列表。
 * 它的作用就是渲染一个很长的列表来撑开父容器的高度。
 */
const HskContentBlock = () => {
  return (
    <div className="space-y-6">
      {hskData.map(level => (
        <div key={level.level} className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50">
          
          {/* 等级标题 */}
          <div className="flex items-center mb-4">
            <div className={`w-12 h-12 rounded-lg ${level.color} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg ${level.color.replace('bg-', 'shadow-')}/50`}>
              {level.level}
            </div>
            <div className="ml-4">
              <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">HSK {level.level} - {level.title}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{level.description}</p>
            </div>
          </div>

          {/* 课程列表 */}
          <div className="space-y-2">
            {level.lessons.map(lesson => (
              // 这里用 div 代替 a 标签，因为导航逻辑应由父页面处理
              <div key={lesson.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer">
                <span className="font-medium text-gray-700 dark:text-gray-300">{lesson.title}</span>
                <ChevronRight className="text-gray-400" size={20} />
              </div>
            ))}
          </div>

        </div>
      ))}
    </div>
  );
};

export default HskContentBlock;
