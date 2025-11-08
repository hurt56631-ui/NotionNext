import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// 动态导入所有可能的练习题组件
const XuanZeTi = dynamic(() => import('@/components/Tixing/XuanZeTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('@/components/Tixing/PanDuanTi'), { ssr: false });
const PaiXuTi = dynamic(() => import('@/components/Tixing/PaiXuTi'), { ssr: false });
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false });
const GaiCuoTi = dynamic(() => import('@/components/Tixing/GaiCuoTi'), { ssr: false });

const componentMap = {
  choice: XuanZeTi,
  panduan: PanDuanTi,
  paixu: PaiXuTi,
  lianxian: LianXianTi,
  gaicuo: GaiCuoTi,
};

const QuizPlayer = ({ data, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const questions = data.questions || [];
  const totalQuestions = questions.length;

  const handleQuestionComplete = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // 所有练习题都完成了，通知 InteractiveLesson 进入下一站
      onComplete();
    }
  };
  
  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) return <div>练习加载完毕！</div>;
  
  const QuestionComponent = componentMap[currentQuestion.type];
  if (!QuestionComponent) return <div>不支持的练习题类型: {currentQuestion.type}</div>;
  
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // [核心修复] 新增一个函数，用来准备传递给具体题型组件的 props
  const getQuestionProps = () => {
    const content = currentQuestion.content;
    const type = currentQuestion.type.toLowerCase();

    // 默认 props，适用于大多数简单组件 (如 lianxian, paixu 等)
    const baseProps = {
      data: content,
      onComplete: handleQuestionComplete,
      onCorrect: handleQuestionComplete,
    };

    // 针对需要特殊 props 结构的组件进行适配
    switch (type) {
      case 'choice':
        const xuanZeTiProps = {
          question: { text: content.prompt, ...content },
          options: content.choices || [],
          correctAnswer: content.correctId ? [content.correctId] : [],
          explanation: content.explanation,
          onCorrect: handleQuestionComplete,
          onNext: handleQuestionComplete, // 兼容 onNext
          isListeningMode: !!content.narrationText,
        };
        // 处理听力模式的文本替换
        if (xuanZeTiProps.isListeningMode) {
           xuanZeTiProps.question.text = content.narrationText;
        }
        return xuanZeTiProps;

      // 如果其他组件 (如 panduan) 也需要特殊 props，可以在这里添加 case
      // case 'panduan':
      //   return { ... };

      default:
        // 对于不需要转换的组件，直接返回基础 props
        return baseProps;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
        <div className="mb-4">
            <h2 className="text-2xl font-bold text-white text-center mb-2">{data.title} ({currentQuestionIndex + 1}/{totalQuestions})</h2>
            <div className="w-full bg-gray-600 rounded-full h-2.5">
                <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}></div>
            </div>
        </div>
      {/* [核心修复] 使用 getQuestionProps() 来传递正确的 props */}
      <QuestionComponent {...getQuestionProps()} />
    </div>
  );
};

export default QuizPlayer;
