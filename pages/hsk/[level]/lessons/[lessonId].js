// pages/hsk/[level]/lessons/[lessonId].js (使用超级组件的版本)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// 动态导入我们新的超级组件
const HSK_Mega_Component = dynamic(
  () => import('@/components/HSK_Mega_Component'), // 确保路径正确
  { ssr: false }
);

const LessonPage = () => {
  const router = useRouter();
  const { level, lessonId } = router.query;

  const [lessonData, setLessonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (level && lessonId) {
      // 动态导入对应的课程JSON文件
      import(`@/data/hsk/lessons/hsk${level}-lesson${lessonId}.json`)
        .then(data => {
          setLessonData(data.default);
          setIsLoading(false);
        })
        .catch(err => {
          console.error(`加载课程JSON失败:`, err);
          setIsLoading(false);
        });
    }
  }, [level, lessonId]);

  if (isLoading) {
    return <div>正在加载课程...</div>;
  }
  
  if (!lessonData) {
    return <div>无法找到课程数据。</div>
  }

  // 只需要渲染这一个组件，并把整个课程数据传给它！
  return <HSK_Mega_Component lesson={lessonData} />;
};

export default LessonPage;
