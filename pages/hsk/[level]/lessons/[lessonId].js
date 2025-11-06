// pages/hsk/[level]/lessons/[lessonId].js (全新版本，用于驱动 LessonPlayer)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// 动态导入 LessonPlayer，因为它是一个纯客户端组件
const LessonPlayer = dynamic(
  () => import('@/components/Tixing/LessonPlayer'), // 请务必确认此路径是否正确！
  { ssr: false }
);

const LessonHostPage = () => {
  const router = useRouter();
  const { level, lessonId } = router.query;

  const [lessonData, setLessonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 确保 URL 参数有效
    if (level && lessonId) {
      setIsLoading(true);
      setError(null);

      // 使用动态 import() 来加载对应的课程 JSON 文件
      // 注意：这里我们不再使用脆弱的 '../' 相对路径
      // 而是假设您已经配置了 JSConfig/TSConfig 支持路径别名 '@/' 指向项目根目录
      import(`@/data/hsk/lessons/hsk${level}-lesson${lessonId}.json`)
        .then(data => {
          // 动态导入的 JSON 数据在 .default 属性中
          setLessonData(data.default);
        })
        .catch(err => {
          console.error(`加载课程 hsk${level}-lesson${lessonId}.json 失败:`, err);
          setError(`无法找到课程数据。请检查文件是否存在于 data/hsk/lessons/ 目录中。`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [level, lessonId]); // 当 URL 参数变化时，重新加载数据

  // 1. 显示加载状态
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#1a202c', color: 'white' }}>
        <h1>正在加载课程 HSK {level} - {lessonId}...</h1>
      </div>
    );
  }

  // 2. 显示错误状态
  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#4a0e0e', color: 'white', padding: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>加载失败</h1>
        <p style={{ color: '#fecaca', marginBottom: '2rem' }}>{error}</p>
        <button 
          onClick={() => router.back()}
          style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          返回上一页
        </button>
      </div>
    );
  }

  // 3. 成功加载数据，渲染播放器
  if (lessonData) {
    return <LessonPlayer lesson={lessonData} />;
  }

  // 4. 默认的回退状态（理论上不应该到达这里）
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#1a202c', color: 'white' }}>
      <h1>未知错误，无法显示课程。</h1>
    </div>
  );
};

export default LessonHostPage;
