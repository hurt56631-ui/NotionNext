// components/SpeakingContentBlock.js (最终修复版 - 使用路由哈希控制卡片)

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ChevronRight, MessageCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const ShortSentenceCard = dynamic(
  () => import('@/components/ShortSentenceCard'),
  { ssr: false }
);

const SpeakingContentBlock = ({ speakingCourses, sentenceCards }) => {
  const router = useRouter();
  const [activeCourseCards, setActiveCourseCards] = useState(null);

  // 判断卡片是否应该打开，现在基于 URL 哈希
  const isCardViewOpen = router.asPath.includes('#cards');

  const handleCourseClick = (course) => {
    if (!Array.isArray(sentenceCards)) {
        console.error('【客户端日志】错误: sentenceCards 不是一个数组，无法筛选。');
        return;
    }

    const cardsForCourse = sentenceCards.filter(card => 
      card.courseIds && card.courseIds.includes(course.id)
    );
    
    if (cardsForCourse.length > 0) {
      // 设置数据，并通过路由哈希打开卡片
      setActiveCourseCards(cardsForCourse);
      router.push(router.asPath + '#cards', undefined, { shallow: true });
    } else {
      alert(`课程 "${course.title}" 下暂无句子卡片。`);
    }
  };

  // 监听路由变化，当用户点击后退导致哈希消失时，清除卡片数据
  useEffect(() => {
    const handleHashChange = () => {
      if (!window.location.hash.includes('cards')) {
        setActiveCourseCards(null);
      }
    };
    // popstate 事件能监听到浏览器的前进/后退操作
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  if (!Array.isArray(speakingCourses) || speakingCourses.length === 0) {
      return <p className="text-center text-gray-500">暂无口语课程，请检查Notion数据库配置。</p>;
  }

  return (
    <>
      <div className="space-y-4">
        {speakingCourses.map(course => (
          <div 
              key={course.id} 
              onClick={() => handleCourseClick(course)}
              className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-lg hover:border-teal-500 dark:hover-border-teal-500 transition-all duration-300"
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

      <ShortSentenceCard 
        isOpen={isCardViewOpen}
        sentences={(activeCourseCards || []).map(card => ({
            id: card.id,
            sentence: card.word,
            translation: card.meaning,
            pinyin: card.pinyin,
        }))}
        // 关闭操作现在是简单的“后退一步”
        onClose={() => router.back()}
      />
    </>
  );
};

export default SpeakingContentBlock;
