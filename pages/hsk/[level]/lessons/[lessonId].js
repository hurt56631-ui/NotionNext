// pages/hsk/[level]/lessons/[lessonId].js (已修改为真正的 SSG 模式)

import React from 'react';
import { useRouter } from 'next/router';
import fs from 'fs'; // 导入 Node.js 的文件系统模块
import path from 'path'; // 导入 Node.js 的路径处理模块

// 导入我们的 InteractiveLesson 组件
// 注意：在这里我们不再需要 dynamic import 和 ssr: false
// 因为 getStaticProps 会确保 lessonData 在页面加载前就已经准备好了
import InteractiveLesson from '@/components/Tixing/InteractiveLesson'; // 确保路径正确

export default function LessonPage({ lesson, error }) {
  const router = useRouter();

  // isFallback 状态用于处理 fallback: true 的情况 (我们这里用 fallback: false，所以可以忽略)
  if (router.isFallback) {
    return <div>正在加载...</div>;
  }

  // 如果 getStaticProps 返回了 error，则显示错误信息
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
  return <InteractiveLesson lesson={lesson} />;
}


// 第 1 步: getStaticPaths
// 这个函数会在部署时运行，告诉 Next.js 需要为哪些课程页面生成静态 HTML 文件
export async function getStaticPaths() {
  // 定义您的数据存放目录
  const lessonsDirectory = path.join(process.cwd(), 'data/hsk/lessons');
  
  // 在这里，我们需要扫描您的数据目录来自动发现所有的课程文件
  // 这是一个简化的例子，假设文件命名格式为 hsk[level]-lesson[lessonId].json
  const filenames = fs.readdirSync(lessonsDirectory);
  
  const paths = filenames.map((filename) => {
    // 从文件名中解析出 level 和 lessonId
    const match = filename.match(/hsk(\d+)-lesson(.+?)\.json/);
    if (match) {
      const [, level, lessonId] = match;
      return {
        params: { level, lessonId },
      };
    }
    return null;
  }).filter(Boolean); // 过滤掉无法解析的文件名

  // fallback: false 表示如果用户访问一个不存在的课程 URL，会直接显示 404 页面
  return { paths, fallback: false };
}


// 第 2 步: getStaticProps
// 这个函数也会在部署时运行，为 getStaticPaths 返回的每一个路径获取其对应的数据
export async function getStaticProps(context) {
  const { level, lessonId } = context.params;

  try {
    // 构建文件的完整路径
    const filePath = path.join(process.cwd(), `data/hsk/lessons/hsk${level}-lesson${lessonId}.json`);
    
    // 读取文件内容
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // 将 JSON 字符串解析为对象
    const lessonData = JSON.parse(fileContent);

    // 将获取到的课程数据通过 props 传递给页面组件
    return {
      props: {
        lesson: lessonData,
      },
    };
  } catch (error) {
    console.error(`构建时加载课程 hsk${level}-lesson${lessonId} 失败:`, error);
    // 如果文件不存在或解析失败，返回一个 error prop
    return {
      props: {
        lesson: null,
        error: `无法找到或解析课程 HSK ${level} - Lesson ${lessonId} 的数据文件。`,
      },
    };
  }
}
