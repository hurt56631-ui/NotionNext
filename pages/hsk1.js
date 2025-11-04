import React, { useState } from 'react';
import WordCard from '../components/WordCard'; // 确认 WordCard 组件的路径
import hsk1Words from '../data/hsk/hsk1.json'; // ⚠️ 直接导入我们创建的 JSON 文件

const Hsk1Page = () => {
  const [isCardOpen, setIsCardOpen] = useState(false);

  const handleStart = () => {
    if (hsk1Words.length > 0) {
      setIsCardOpen(true);
    } else {
      alert("没有加载到任何生词数据！");
    }
  };

  // 如果卡片已经打开，我们就不显示“开始学习”按钮了
  if (isCardOpen) {
    return (
      <WordCard
        words={hsk1Words}
        isOpen={isCardOpen}
        onClose={() => setIsCardOpen(false)}
        progressKey="hsk1_local" // 为这个学习模式设置一个唯一的进度键
      />
    );
  }

  // 默认显示开始学习的界面
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1>HSK 1 学习</h1>
      <p>准备好开始学习 {hsk1Words.length} 个新单词了吗？</p>
      <button 
        onClick={handleStart} 
        style={{ 
          padding: '12px 25px', 
          fontSize: '1.2rem', 
          cursor: 'pointer',
          borderRadius: '12px',
          border: 'none',
          color: 'white',
          background: 'linear-gradient(135deg, #4299e1, #3182ce)'
        }}
      >
        开始学习
      </button>
    </div>
  );
};

export default Hsk1Page;
