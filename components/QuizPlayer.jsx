// components/Tixing/QuizPlayer.jsx (新文件或更新)

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// 动态导入所有可能的练习题组件
const XuanZeTi = dynamic(() => import('@/components/Tixing/XuanZeTi'), { ssr: false });
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false });
const PaiXuTi = dynamic(() => import('@/components/Tixing/PaiXuTi'), { ssr: false });
// 您其他的练习题组件...

const componentMap = {
  choice: XuanZeTi,
  lianxian: LianXianTi,
  paixu: PaiXuTi,
};

const QuizPlayer = ({ data, onComplete, settings }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const questions = data.questions || [];
  const totalQuestions = questions.length;

  const handleQuestionComplete = () => {
    // 延迟一小段时间以显示正确/错误的反馈
    setTimeout(() => {
      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // 所有练习题都完成了，通知 LessonPlayer 进入下一站
        onComplete();
      }
    }, 1000); // 延迟1秒
  };
  
  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) return <div>练习加载完毕！</div>;
  
  const QuestionComponent = componentMap[currentQuestion.type];
  if (!QuestionComponent) return <div className="text-white">不支持的练习题类型: {currentQuestion.type}</div>;
  
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 flex flex-col h-full justify-center">
        <div className="mb-4">
            <h2 className="text-2xl font-bold text-white text-center mb-2">{data.title} ({currentQuestionIndex + 1}/{totalQuestions})</h2>
            <div className="w-full bg-gray-600 rounded-full h-2.5">
                <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}></div>
            </div>
        </div>
      <QuestionComponent 
        data={currentQuestion.content} 
        onComplete={handleQuestionComplete} 
        onCorrect={handleQuestionComplete} // 兼容不同组件的完成回调
        settings={settings}
      />
    </div>
  );
};

export default QuizPlayer;
