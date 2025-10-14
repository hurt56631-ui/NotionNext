// components/SpeakingContentBlock.js (最终版 - 调用 ShortSentenceCard)

import { useState } from 'react';
import { ChevronRight, MessageCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

// 动态导入我们全新的全屏卡片组件
const ShortSentenceCard = dynamic(
  () => import('@/components/ShortSentenceCard'),
  { ssr: false } // 这个组件只在客户端渲染
);

const SpeakingContentBlock = ({ speakingCourses, sentenceCards }) => {
  const [activeCourseCards, setActiveCourseCards] = useState(null);

  const handleCourseClick = (course) => {
    if (!Array.isArray(sentenceCards)) {
        console.error('【客户端日志】错误: sentenceCards 不是一个数组，无法筛选。');
        return;
    }

    const cardsForCourse = sentenceCards.filter(card => 
      card.courseIds && card.courseIds.includes(course.id)
    );
    
    if (cardsForCourse.length > 0) {
      setActiveCourseCards(cardsForCourse);
    } else {
      alert(`课程 "${course.title}" 下暂无句子卡片。`);
    }
  };

  // --- 核心渲染逻辑 ---
  // 如果有激活的课程，就渲染全屏卡片组件
  if (activeCourseCards) {
    return (
      <ShortSentenceCard 
        sentences={activeCourseCards.map(card => ({
            id: card.id,
            sentence: card.word,
            translation: card.meaning,
            pinyin: card.pinyin,
        }))}
        onClose={() => setActiveCourseCards(null)} // 传入关闭函数
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
