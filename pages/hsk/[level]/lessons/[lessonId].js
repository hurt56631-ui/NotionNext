// pages/hsk/[level]/lessons/[lessonId].js (极简版)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// 动态导入我们全新的互动课程组件
const InteractiveLesson = dynamic(
  () => import('../../../../components/Tixing/InteractiveLesson'),
  { loading: () => <p className="text-white">正在加载课程播放器...</p>, ssr: false }
);

const LessonHostPage = () => {
  const router = useRouter();
  const { level, lessonId } = router.query;

  const [lessonData, setLessonData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (level && lessonId) {
      import(`@/data/hsk/lessons/hsk${level}-lesson${lessonId}.json`)
        .then(data => setLessonData(data.default))
        .catch(err => {
          console.error(`加载课程失败:`, err);
          setError(`无法找到课程数据。`);
        });
    }
  }, [level, lessonId]);

  if (error) {
    return <div className="text-red-500 text-center p-8">{error}</div>;
  }

  if (!lessonData) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#1a202c', color: 'white' }}>
            <h1>正在加载课程 HSK {level} - {lessonId}...</h1>
        </div>
    );
  }

  // 只需渲染这一个组件，并把课程数据传给它
  return <InteractiveLesson lesson={lessonData} />;
};

export default LessonHostPage;
