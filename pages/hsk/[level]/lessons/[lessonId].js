import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const LessonPage = () => {
  const router = useRouter();
  const { level, lessonId } = router.query; // 现在可以同时获取 level 和 lessonId

  const [lessonData, setLessonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 确保 level 和 lessonId 都已经从 URL 中获取到了
    if (level && lessonId) {
      setIsLoading(true);
      // 动态导入对应的课程 JSON 文件
      import(`../../../../data/hsk/lessons/hsk${level}-lesson${lessonId}.json`)
        .then(data => {
          setLessonData(data.default); // 动态导入的 JSON 数据在 .default 属性中
        })
        .catch(error => {
          console.error("加载课程数据失败:", error);
          setLessonData(null); // 加载失败
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [level, lessonId]); // 当 level 或 lessonId 变化时，重新加载数据

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><h1>正在加载 HSK {level} 第 {lessonId} 课...</h1></div>;
  }

  if (!lessonData) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><h1>无法加载课程数据。请确认该课程是否存在。</h1></div>;
  }

  // 数据加载成功后，渲染课程内容
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        HSK {lessonData.level} - 第 {lessonData.lesson} 课: {lessonData.title}
      </h1>

      {/* 词汇部分 */}
      <section>
        <h2>生词 (Vocabulary)</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {lessonData.vocabulary.map(word => (
            <li key={word.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
              <span><strong>{word.hanzi}</strong></span>
              <span>{word.pinyin}</span>
              <span>{word.translation}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 对话部分 */}
      <section>
        <h2>对话 (Dialogues)</h2>
        {lessonData.dialogues.map((dialogue, index) => (
          <div key={index} style={{ marginBottom: '20px' }}>
            <h3>{dialogue.title}</h3>
            {dialogue.lines.map((line, lineIndex) => (
              <p key={lineIndex}>
                <strong>{line.speaker}: </strong>{line.hanzi}<br />
                <em style={{ color: '#555' }}>{line.pinyin}</em><br />
                <span style={{ color: '#777' }}>{line.translation}</span>
              </p>
            ))}
          </div>
        ))}
      </section>

      {/* 语法部分 */}
      <section>
        <h2>语法 (Grammar)</h2>
        {lessonData.grammar.map((grammarPoint, index) => (
          <div key={index} style={{ marginBottom: '20px' }}>
            <h3>{grammarPoint.point}</h3>
            <p>{grammarPoint.explanation}</p>
            {grammarPoint.examples.map((example, exIndex) => (
              <p key={exIndex} style={{ marginLeft: '20px', fontStyle: 'italic' }}>- {example}</p>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
};

export default LessonPage;
