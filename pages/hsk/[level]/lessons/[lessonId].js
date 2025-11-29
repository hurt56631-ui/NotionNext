// pages/hsk/[level]/lessons/[lessonId].js

import React from 'react';
import { useRouter } from 'next/router';
import fs from 'fs'; 
import path from 'path'; 
import dynamic from 'next/dynamic';

// 【修改】: 改为动态导入 GrammarPointPlayer
const GrammarPointPlayer = dynamic(
  () => import('@/components/Tixing/GrammarPointPlayer'),
  { ssr: false }
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

  // 【核心修改】: 从 lesson 数据中提取语法点并传递给 GrammarPointPlayer
  if (lesson) {
    // 从 lesson 数据中提取语法点
    const grammarStudyBlock = lesson.blocks.find(block => block.type === 'grammar_study');
    
    if (grammarStudyBlock && grammarStudyBlock.content.grammarPoints) {
      return (
        <GrammarPointPlayer 
          grammarPoints={grammarStudyBlock.content.grammarPoints}
          onComplete={() => {
            // 学习完成后的回调，可以返回课程列表或做其他操作
            router.push(`/hsk/${router.query.level}`);
          }}
        />
      );
    } else {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#dc2626' }}>课程数据格式错误</h1>
          <p style={{ color: '#6b7280', marginBottom: '2rem', textAlign: 'center' }}>
            未找到语法点数据。<br/>
            请检查课程数据文件格式。
          </p>
          <button 
            onClick={() => router.back()} 
            style={{ 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '8px', 
              backgroundColor: '#3b82f6',
              color: 'white',
              cursor: 'pointer' 
            }}
          >
            返回上一页
          </button>
        </div>
      );
    }
  }
  
  return null;
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
