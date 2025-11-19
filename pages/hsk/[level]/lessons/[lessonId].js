import React from 'react';
import { useRouter } from 'next/router';
import fs from 'fs'; 
import path from 'path'; 
import dynamic from 'next/dynamic';

// 动态导入组件，关闭 SSR 以适应 PWA 和 浏览器 API
const InteractiveLesson = dynamic(
  () => import('@/components/Tixing/InteractiveLesson'), 
  { ssr: false }
);

const WORDS_PER_LESSON = 45; // 🔥 这里控制每节课的单词数量，建议 20-50 之间

export default function LessonPage({ lessonData, nextLessonId, level, error }) {
  const router = useRouter();

  if (router.isFallback) return <div>加载中...</div>;

  if (error) {
    return <div style={{padding: 20, textAlign: 'center'}}>{error}</div>;
  }

  // 这是一个回调函数，当用户学完当前 30 个词后，WordCard 调用它
  const handleFinish = () => {
      if (nextLessonId) {
          // 跳转到下一课
          router.push(`/hsk/${level}/lessons/${nextLessonId}`);
      } else {
          alert("恭喜！你已经学完了该等级的所有单词！");
          router.push('/'); // 回首页
      }
  };

  return (
    <InteractiveLesson 
        lesson={lessonData} 
        onFinishLesson={handleFinish} // 传递完成回调
        hasMore={!!nextLessonId}      // 告诉组件后面还有没有课
    />
  );
}

// --- 1. 自动计算需要生成多少个页面 ---
export async function getStaticPaths() {
  const hskDir = path.join(process.cwd(), 'data/hsk');
  
  // 1. 扫描目录下所有的 hskX.json 文件
  // 假设你的文件命名是 hsk1.json, hsk4.json 等
  const files = fs.readdirSync(hskDir).filter(file => file.match(/^hsk(\d+)\.json$/));
  
  const paths = [];

  files.forEach(file => {
    const match = file.match(/^hsk(\d+)\.json$/);
    const level = match[1]; // 获取等级，例如 "4"

    // 读取文件内容，计算有多少个词
    const filePath = path.join(hskDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const allWords = JSON.parse(fileContent);
    
    // 计算需要多少节课
    // 例如 600 个词 / 30 = 20 节课
    const totalLessons = Math.ceil(allWords.length / WORDS_PER_LESSON);

    // 生成 1 到 20 的路径
    for (let i = 1; i <= totalLessons; i++) {
      paths.push({
        params: { 
            level: level, 
            lessonId: i.toString() 
        },
      });
    }
  });

  return { paths, fallback: false };
}

// --- 2. 根据 lessonId 切割数据 ---
export async function getStaticProps(context) {
  const { level, lessonId } = context.params;
  const pageNum = parseInt(lessonId, 10);

  try {
    // 读取完整的大文件
    const filePath = path.join(process.cwd(), `data/hsk/hsk${level}.json`);
    
    if (!fs.existsSync(filePath)) {
        throw new Error("文件不存在");
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const allWords = JSON.parse(fileContent);

    // 🔥 核心切片逻辑 🔥
    const startIndex = (pageNum - 1) * WORDS_PER_LESSON;
    const endIndex = startIndex + WORDS_PER_LESSON;
    
    // 只取出当前页面需要的 30 个词
    const slicedWords = allWords.slice(startIndex, endIndex);

    // 计算是否有下一课
    const totalLessons = Math.ceil(allWords.length / WORDS_PER_LESSON);
    const nextLessonId = pageNum < totalLessons ? (pageNum + 1).toString() : null;

    return {
      props: {
        lessonData: slicedWords, // 前端只收到 30 个词，速度飞快
        nextLessonId,            // 用于前端跳转
        level,
      },
    };
  } catch (error) {
    console.error(`生成 HSK${level} 第 ${lessonId} 课失败:`, error);
    return {
      props: {
        error: `无法加载数据: ${error.message}`,
      },
    };
  }
}
