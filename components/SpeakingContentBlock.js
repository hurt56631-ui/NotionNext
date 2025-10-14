// components/SpeakingContentBlock.js

import { useState } from 'react';
import { ChevronRight, MessageCircle, X } from 'lucide-react';
import CiDianKa from '@/components/Tixing/CiDianKa';

const SpeakingContentBlock = ({ speakingCourses, sentenceCards }) => {
  const [activeCourse, setActiveCourse] = useState(null);

  const handleCourseClick = (course) => {
    const cardsForCourse = sentenceCards.filter(card => 
      card.courseIds && card.courseIds.includes(course.id)
    );
    setActiveCourse({ ...course, cards: cardsForCourse });
  };

  if (activeCourse) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '80vh' }}>
        <CiDianKa flashcards={activeCourse.cards} />
        <button
          onClick={() => setActiveCourse(null)}
          className="absolute top-4 right-4 z-[10000] p-2 bg-white/50 rounded-full hover:bg-white/80 transition-colors"
          aria-label="返回课程列表"
        >
          <X size={24} />
        </button>
      </div>
    );
  }

  if (!speakingCourses || speakingCourses.length === 0) {
      return <p className="text-center text-gray-500">暂无口语课程，请检查Notion数据库配置。</p>;
  }

  return (
    <div className="space-y-6">
      {speakingCourses.map(course => (
        <div 
            key={course.id} 
            onClick={() => handleCourseClick(course)}
            className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-md transition-shadow"
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
