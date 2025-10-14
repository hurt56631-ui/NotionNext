// components/SpeakingContentBlock.js (最终版 - 调用 CombinedPhraseCard)

import { useState } from 'react';
import { ChevronRight, MessageCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

// 【核心】: 动态导入你指定的 CombinedPhraseCard 组件
const CombinedPhraseCard = dynamic(
  () => import('@/components/Tixing/CombinedPhraseCard'),
  { 
    ssr: false, // 这是一个高度交互的组件，只在客户端渲染
    loading: () => <p className="text-center p-8">正在加载学习模块...</p>
  }
);

const SpeakingContentBlock = ({ speakingCourses, sentenceCards }) => {
  // 这个状态用于控制是否显示卡片播放器
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  // 这个状态用于存储要传递给播放器的卡片数据
  const [activeCourseCards, setActiveCourseCards] = useState([]);

  const handleCourseClick = (course) => {
    if (!Array.isArray(sentenceCards)) {
        console.error('【客户端日志】错误: sentenceCards 不是一个数组，无法筛选。');
        return;
    }

    const cardsForCourse = sentenceCards.filter(card => 
      card.courseIds && card.courseIds.includes(course.id)
    );
    
    if (cardsForCourse.length > 0) {
      // 找到了卡片，更新状态并激活播放器
      setActiveCourseCards(cardsForCourse);
      setIsPlayerActive(true);
    } else {
      alert(`课程 "${course.title}" 下暂无句子卡片。`);
    }
  };

  // --- 核心渲染逻辑 ---
  // 如果播放器被激活，就渲染 CombinedPhraseCard
  if (isPlayerActive) {
    return (
      <CombinedPhraseCard 
        // 【核心】: 将数据从我们的格式转换为 CombinedPhraseCard 需要的格式
        flashcards={activeCourseCards.map(card => ({
            id: card.id,
            chinese: card.word,
            burmese: card.meaning,
            pinyin: card.pinyin,
            burmesePhonetic: null, // 如果你的Notion有缅语发音列，可以在这里添加
            imageUrl: card.imageUrl || null,
        }))}
        // CombinedPhraseCard 似乎没有 onClose 属性，它内部管理自己的显示/隐藏
        // 如果需要一个外部关闭按钮，需要修改 CombinedPhraseCard 来接收 onClose prop
      />
    );
  }

  // 默认情况：显示课程列表
  if (!Array.isArray(speakingCourses) || speakingCourses.length === 0) {
      return <p className="text-center text-gray-500">暂无口语课程，请检查Notion数据库配置。</p>;
  }

  return (
    <div className="space-y-4">
      {speakingCourses.map(course => (
        <div 
            key={course.id} 
            onClick={() => handleCourseClick(course)}
            className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-lg hover:border-teal-500 dark:hover:border-teal-500 transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg bg-teal-500 flex items-center justify-center text-white flex-shrink-0">
                <MessageCircle />
              </div>
              <div className="ml-4">
                <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">{course.title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{course.description}</p>
              </div>
            </div>
            <ChevronRight className="text-gray-400" size={20} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SpeakingContentBlock;
