// components/SpeakingContentBlock.js

import { useState } from 'react';
import { ChevronRight, MessageCircle, X } from 'lucide-react';
import dynamic from 'next/dynamic'; // 使用动态导入，防止服务端渲染问题

// --- 使用动态导入 CiDianKa，并禁用 SSR ---
const CiDianKa = dynamic(
  () => import('@/components/Tixing/CiDianKa'),
  { 
    ssr: false, // 关键：不在服务器上渲染这个组件
    loading: () => <p className="text-center p-8">正在加载学习卡片...</p> 
  }
);

const SpeakingContentBlock = ({ speakingCourses, sentenceCards }) => {
  // --- 【日志-客户端】: 检查组件接收到的原始数据 ---
  console.log('\n================ SpeakingContentBlock 客户端日志 ================');
  console.log('【日志】组件收到的 speakingCourses:', speakingCourses);
  console.log('【日志】组件收到的 sentenceCards:', sentenceCards);
  console.log('====================================================================\n');

  const [activeCourse, setActiveCourse] = useState(null);

  const handleCourseClick = (course) => {
    console.log(`【日志】点击了课程: "${course.title}" (ID: ${course.id})`);

    // 筛选出属于这个课程的所有卡片
    const cardsForCourse = sentenceCards.filter(card => {
      const isIncluded = card.courseIds && card.courseIds.includes(course.id);
      // 打印每一张卡片的筛选过程
      // console.log(`  - 检查卡片 "${card.word}": 关联的课程ID [${card.courseIds}], 是否包含 ${course.id}? -> ${isIncluded}`);
      return isIncluded;
    });

    console.log(`【日志】为课程 "${course.title}" 筛选出 ${cardsForCourse.length} 张卡片。`);
    if (cardsForCourse.length === 0) {
        console.warn('【日志】警告：没有为这个课程找到任何关联的卡片。请检查 Notion "句子卡片库" 中的 "所属课程" 关联是否正确设置。');
    }
    
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
      return <p className="text-center text-gray-500">暂无口语课程，请检查Notion“口语课程库”配置。</p>;
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
