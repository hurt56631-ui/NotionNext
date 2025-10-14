// components/SpeakingContentBlock.js

import { useState } from 'react';
import { ChevronRight, MessageCircle, X } from 'lucide-react';
import dynamic from 'next/dynamic';

// --- 【核心修正】: 导入正确的 ShortSentenceCard 组件 ---
const ShortSentenceCard = dynamic(
  () => import('@/components/ShortSentenceCard'), // 请确保这个路径是正确的
  { 
    ssr: false, // 建议在客户端渲染交互式卡片组件
    loading: () => <p className="text-center p-8">正在加载学习卡片...</p> 
  }
);

const SpeakingContentBlock = ({ speakingCourses, sentenceCards }) => {
  // --- 【核心修正】: 添加更详细的客户端日志来确认数据传递 ---
  console.log('\n================ SpeakingContentBlock 客户端日志 ================');
  console.log('【客户端日志】组件收到的 speakingCourses:', speakingCourses);
  console.log('【客户端日志】组件收到的 sentenceCards:', sentenceCards);
  console.log('====================================================================\n');

  const [activeCourse, setActiveCourse] = useState(null);

  const handleCourseClick = (course) => {
    // 确认 sentenceCards 是否存在且为数组
    if (!Array.isArray(sentenceCards)) {
        console.error('【客户端日志】错误: sentenceCards 不是一个数组，无法进行筛选。');
        setActiveCourse({ ...course, cards: [] });
        return;
    }

    const cardsForCourse = sentenceCards.filter(card => 
      card.courseIds && card.courseIds.includes(course.id)
    );

    console.log(`【客户端日志】为课程 "${course.title}" 筛选出 ${cardsForCourse.length} 张卡片。`);
    if (cardsForCourse.length === 0) {
        console.warn('【客户端日志】警告：没有找到关联卡片。请检查 Notion "句子卡片库" 的 "所属课程" 关联是否正确，并确认服务端日志中 "关联课程ID" 是否有值。');
    }
    
    setActiveCourse({ ...course, cards: cardsForCourse });
  };
  
  // 如果 activeCourse 有值，就显示 ShortSentenceCard 组件
  if (activeCourse) {
    return (
      <div style={{ position: 'relative', width: '100%', minHeight: '60vh' }}>
        {/* 【核心修正】: 调用正确的 ShortSentenceCard 组件 */}
        {/* 假设 ShortSentenceCard 接收一个名为 'sentences' 的 prop，其格式为 {id, sentence, translation, ...} */}
        {activeCourse.cards.length > 0 ? (
            <ShortSentenceCard sentences={activeCourse.cards.map(card => ({
                id: card.id,
                sentence: card.word,       // “中文” 对应 sentence
                translation: card.meaning,  // “缅语” 对应 translation
                pinyin: card.pinyin,
                example: card.example,
                burmeseExample: card.burmeseExample
            }))} />
        ) : (
            <div className="text-center p-8 text-gray-500">
                <p>该课程下暂无句子卡片。</p>
                <p className="text-sm mt-2">请检查 Notion 数据库中的关联是否正确设置。</p>
            </div>
        )}
        <button
          onClick={() => setActiveCourse(null)}
          className="absolute top-4 right-4 z-50 p-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full hover:bg-white/80 dark:hover:bg-gray-700 transition-colors"
          aria-label="返回课程列表"
        >
          <X size={24} />
        </button>
      </div>
    );
  }

  // 默认显示课程列表
  // 添加一个健壮性检查，确保 speakingCourses 是一个数组
  if (!Array.isArray(speakingCourses) || speakingCourses.length === 0) {
      return <p className="text-center text-gray-500">暂无口语课程，请检查 Notion 数据库配置或服务端日志。</p>;
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
