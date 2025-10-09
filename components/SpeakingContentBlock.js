// components/SpeakingContentBlock.js

import { ChevronRight, MessageCircle, MicVocal, Users } from 'lucide-react';

// --- 模拟数据 ---
const speakingData = [
  {
    category: '日常会话',
    description: '涵盖生活中的常见交流场景',
    color: 'bg-teal-500',
    icon: <MessageCircle />,
    items: [
      { id: 1, title: '打招呼与介绍' },
      { id: 2, title: '购物与问路' },
      { id: 3, title: '餐厅点餐' },
      { id: 4, title: '谈论天气' },
    ]
  },
  {
    category: '职场口语',
    description: '提升您在工作环境中的沟通能力',
    color: 'bg-indigo-500',
    icon: <Users />,
    items: [
      { id: 1, title: '会议与讨论' },
      { id: 2, title: '商务谈判' },
      { id: 3, title: '电话沟通' },
      { id: 4, title: '求职面试' },
    ]
  },
  {
    category: '话题讨论',
    description: '就特定话题进行深入探讨和辩论',
    color: 'bg-amber-500',
    icon: <MicVocal />,
    items: [
      { id: 1, title: '科技与未来' },
      { id: 2, title: '环境保护' },
      { id: 3, title: '文化差异' },
    ]
  },
];

const SpeakingContentBlock = () => {
  return (
    <div className="space-y-6">
      {speakingData.map(section => (
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
                <span className="font-medium text-gray-700 dark:text-gray-300">{item.title}</span>
                <ChevronRight className="text-gray-400" size={20} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SpeakingContentBlock;
