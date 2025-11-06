import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import WordCard from '../../components/WordCard'; // 路径可能需要根据你的结构调整

// --- 数据中心：一次性导入所有单词数据 ---
// 确保这些 JSON 文件都存在于你的 data/hsk 目录下
import hsk1Words from '../../data/hsk/hsk1.json';
import hsk2Words from '../../data/hsk/hsk2.json';
import hsk3Words from '../../data/hsk/hsk3.json';
import hsk4Words from '../../data/hsk/hsk4.json';
import hsk5Words from '../../data/hsk/hsk5.json';
import hsk6Words from '../../data/hsk/hsk6.json';

// 创建一个映射，方便根据 URL 中的 level 动态查找数据
const hskWordsData = {
  '1': hsk1Words,
  '2': hsk2Words,
  '3': hsk3Words,
  '4': hsk4Words,
  '5': hsk5Words,
  '6': hsk6Words,
};
// -------------------------------------------

const HskLevelPage = () => {
  const router = useRouter();
  const { level } = router.query; // 从 URL 中获取 level 参数，例如 "1", "3"

  const [words, setWords] = useState([]);
  const [isCardOpen, setIsCardOpen] = useState(false);

  // 使用 useEffect 来在 level 参数可用时加载数据
  useEffect(() => {
    // 确保 level 存在，并且是 hskWordsData 中的一个有效键
    if (level && hskWordsData[level]) {
      setWords(hskWordsData[level]);
    } else {
      setWords([]); // 如果 level 无效，则清空单词
    }
  }, [level]); // 这个 effect 会在 level 改变时重新运行

  const handleStart = () => {
    if (words.length > 0) {
      setIsCardOpen(true);
    } else {
      alert("没有加载到任何生词数据！请检查链接是否正确。");
    }
  };

  // 在路由准备好并且数据加载完成之前，可以显示一个加载状态
  if (!level || (router.isReady && words.length === 0)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h1>加载中或未找到 HSK {level} 的单词数据...</h1>
      </div>
    );
  }

  // 如果卡片已经打开，渲染 WordCard 组件
  if (isCardOpen) {
    return (
      <WordCard
        words={words}
        isOpen={isCardOpen}
        onClose={() => setIsCardOpen(false)}
        progressKey={`hsk${level}_study_page`} // 创建一个动态且唯一的进度键
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
      <h1>HSK {level} 学习</h1>
      <p>准备好开始学习 {words.length} 个新单词了吗？</p>
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

export default HskLevelPage;
