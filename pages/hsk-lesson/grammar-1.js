import React from 'react';
import Head from 'next/head';

// 导入你的语法播放器组件
// 确保这个路径是正确的！
import GrammarPointPlayer from '../../components/Tixing/GrammarPointPlayer';

// 导入我们刚刚创建的语法数据
import lessonData from '../../data/grammar-data';
import InteractiveLesson from '../../components/Tixing/InteractiveLesson'; // 刚才优化的组件
import { testLessonData } from '../../data/test-lesson-data'; // 刚才的数据

// 这是我们的课程页面组件
const GrammarLessonPage = () => {

  // 定义课程完成时的回调函数
  const handleLessonComplete = () => {
    console.log("课程学习完成!");
    // 在实际应用中，你可以在这里跳转到下一个课程或者显示一个祝贺信息
    alert("祝贺你！完成了所有语法点的学习！");
    // 例如，跳转回课程列表
    // import Router from 'next/router';
    // Router.push('/lessons');
  };

  return (
    <>
      <Head>
        <title>HSK 语法课 | Lesson 1</title>
        <meta name="description" content="学习HSK基础语法点" />
      </Head>
      <div style={{
        // 确保播放器占满整个屏幕
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        fontFamily: 'sans-serif' // 设置一个基础字体
      }}>
        <GrammarPointPlayer 
          grammarPoints={lessonData}
          onComplete={handleLessonComplete}
        />
      </div>
    </>
  );
};

export default GrammarLessonPage;
