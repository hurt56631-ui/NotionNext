// pages/hsk/[level]/lessons/[lessonId].js (最终推荐版)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// [修改] 导入我们最终的 InteractiveLesson 组件
const InteractiveLesson = dynamic(
  () => import('@/components/Tixing/InteractiveLesson'), // 确保路径正确
  { ssr: false }
);

const LessonHostPage = () => {
  const router = useRouter();
  const { level, lessonId } = router.query;

  const [lessonData, setLessonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (level && lessonId) {
      setIsLoading(true);
      setError(null);
      import(`@/data/hsk/lessons/hsk${level}-lesson${lessonId}.json`)
        .then(data => {
          setLessonData(data.default);
        })
        .catch(err => {
          console.error(`加载课程失败:`, err);
          setError(`无法找到课程数据。请检查文件是否存在。`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [level, lessonId]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#1a202c', color: 'white' }}>
        <h1>正在加载课程 HSK {level} - {lessonId}...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#4a0e0e', color: 'white', padding: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>加载失败</h1>
        <p style={{ color: '#fecaca', marginBottom: '2rem' }}>{error}</p>
        <button onClick={() => router.back()} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          返回上一页
        </button>
      </div>
    );
  }

  if (lessonData) {
    // [修改] 渲染我们最终的 InteractiveLesson 组件
    return <InteractiveLesson lesson={lessonData} />;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#1a202c', color: 'white' }}>
      <h1>未知错误，无法显示课程。</h1>
    </div>
  );
};

export default LessonHostPage;
