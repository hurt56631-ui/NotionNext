// components/PracticeContentBlock.js

import { ChevronRight, Target, ListChecks, Ear, FileText } from 'lucide-react';

// --- 模拟数据 ---
const practiceData = [
  {
    category: '专项练习',
    description: '针对听说读写各项技能进行强化训练',
    color: 'bg-sky-500',
    icon: <Target />,
    items: [
      { id: 1, title: '听力理解训练', subIcon: <Ear size={16} className="mr-2 text-sky-600 dark:text-sky-400"/> },
      { id: 2, title: '阅读速度与技巧', subIcon: <FileText size={16} className="mr-2 text-sky-600 dark:text-sky-400"/> },
      { id: 3, title: '写作练习与范文', subIcon: <ListChecks size={16} className="mr-2 text-sky-600 dark:text-sky-400"/> },
    ]
  },
  {
    category: '模拟测试',
    description: '全真模拟考试环境，检验学习成果',
    color: 'bg-rose-500',
    icon: <ListChecks />,
    items: [
      { id: 1, title: 'HSK 四级全真模拟（一）' },
      { id: 2, title: 'HSK 五级全真模拟（一）' },
      { id: 3, title: 'HSK 六级全真模拟（一）' },
      { id: 4, title: 'BCT 商务汉语考试模拟' },
    ]
  },
];

const PracticeContentBlock = () => {
  return (
    <div className="space-y-6">
      {practiceData.map(section => (
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
          <div className="space-y-2">
            {section.items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer">
                <div className="flex items-center">
                  {item.subIcon}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{item.title}</span>
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

export default PracticeContentBlock;
