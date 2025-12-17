import React from 'react';
import Head from 'next/head';
// 1. 引入你的主互动组件
import InteractiveLesson from '../components/Tixing/InteractiveLesson'; 
// 2. 引入刚才创建的数据
import { hskLessonData } from '../data/hsk1-lesson1'; 

export default function TestLessonPage() {
  return (
    <>
      <Head>
        <title>HSK 1 - Lesson 1 Test</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      
      {/* 渲染互动课程 */}
      <InteractiveLesson lesson={hskLessonData} />
    </>
  );
}
