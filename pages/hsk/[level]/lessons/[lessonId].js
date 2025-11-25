// pages/hsk/[level]/lessons/[lessonId].js (已修正 "document is not defined" 错误的最终版本)

import React from 'react';
import { useRouter } from 'next/router';
import fs from 'fs'; 
import path from 'path'; 
import dynamic from 'next/dynamic'; // 导入 dynamic

// 【核心修复】: 使用 dynamic 导入 InteractiveLesson 并禁用 SSR
const InteractiveLesson = dynamic(
  () => import('@/components/Tixing/InteractiveLesson'), // 确保路径正确
  { ssr: false } // <--- 关键！告诉 Next.js 不要预渲染它
);

export default function LessonPage({ lesson, error }) {
  const router = useRouter();

  if (router.isFallback) {
    return <div>正在加载...</div>;
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

  // 正常渲染课程
  // 注意：在 ssr: false 模式下，组件在首次渲染时不会立即出现，
  // 所以我们可以提供一个 fallback 占位符，但在这里我们依赖 InteractiveLesson 内部的加载逻辑
  if (lesson) {
    return <InteractiveLesson lesson={lesson} />;
  }
  
  return null; // 如果没有 lesson 且没有 error，什么都不渲染
}


// 第 1 步: getStaticPaths
export async function getStaticPaths() {
  const lessonsDirectory = path.join(process.cwd(), 'data/hsk/lessons');
  
  const filenames = fs.readdirSync(lessonsDirectory);
  
  const paths = filenames.map((filename) => {
    const match = filename.match(/hsk(\d+)-lesson(.+?)\.json/);
    if (match) {
      const [, level, lessonId] = match;
      return {
        params: { level, lessonId },
      };
    }
    return null;
  }).filter(Boolean);

  return { paths, fallback: false };
}


// 第 2 步: getStaticProps
export async function getStaticProps(context) {
  const { level, lessonId } = context.params;

  try {
    const filePath = path.join(process.cwd(), `data/hsk/lessons/hsk${level}-lesson${lessonId}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lessonData = JSON.parse(fileContent);

    return {
      props: {
        lesson: lessonData,
      },
      revalidate: 3600, // 1 hour in seconds
    };
  } catch (error) {
    console.error(`构建时加载课程 hsk${level}-lesson${lessonId} 失败:`, error);
    return {
      props: {
        lesson: null,
        error: `无法找到或解析课程 HSK ${level} - Lesson ${lessonId} 的数据文件。`,
      },
    };
  }
}
