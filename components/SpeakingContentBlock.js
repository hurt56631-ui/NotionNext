// components/SpeakingContentBlock.js

import { useState } from 'react';
import { ChevronRight, MessageCircle, X } from 'lucide-react';
import dynamic from 'next/dynamic'; // 保持使用动态导入

// --- 【核心修正】: 导入正确的 ShortSentenceCard 组件，而不是 CiDianKa ---
const ShortSentenceCard = dynamic(
  () => import('@/components/ShortSentenceCard'), // 确保路径正确
  { 
    ssr: false, // 关键：不在服务器上渲染这个组件
    loading: () => <p className="text-center p-8">正在加载学习卡片...</p> 
  }
);

const SpeakingContentBlock = ({ speakingCourses, sentenceCards }) => {
  // --- 日志，用于最终确认数据传递 ---
  console.log('\n================ SpeakingContentBlock 最终确认日志 ================');
  console.log('【客户端日志】收到的 speakingCourses:', speakingCourses);
  console.log('【客户端日志】收到的 sentenceCards:', sentenceCards);
  console.log('====================================================================\n');

  const [activeCourse, setActiveCourse] = useState(null);

  const handleCourseClick = (course) => {
    console.log(`【客户端日志】点击了课程: "${course.title}" (ID: ${course.id})`);

    const cardsForCourse = sentenceCards.filter(card => 
      card.courseIds && card.courseIds.includes(course.id)
    );

    console.log(`【客户端日志】为课程 "${course.title}" 筛选出 ${cardsForCourse.length} 张卡片。`);
    if (cardsForCourse.length === 0) {
        console.warn('【客户端日志】警告：没有找到关联卡片。请检查 Notion "句子卡片库" 的 "所属课程" 关联是否正确。');
    }
    
    setActiveCourse({ ...course, cards: cardsForCourse });
  };

  // 如果 activeCourse 有值，就显示 ShortSentenceCard 组件
  if (activeCourse) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '80vh' }}>
        {/* 【核心修正】: 调用正确的 ShortSentenceCard 组件 */}
        {/* 我们需要将数据格式从 {word, meaning} 映射到 {sentence, translation} */}
        <ShortSentenceCard sentences={activeCourse.cards.map(card => ({
            id: card.id,
            sentence: card.word, // “中文” 对应 sentence
            translation: card.meaning, // “缅语” 对应 translation
            pinyin: card.pinyin,
            // ShortSentenceCard 目前不直接使用 example, burmeseExample, imageUrl，但可以保留
        }))} />
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

  // 默认显示课程列表 (这部分逻辑保持不变)
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
