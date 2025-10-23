// components/Tixing/LessonPlayer.jsx (最终版 - 集成所有题型组件)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { pinyin } from 'pinyin-pro';

// --- 导入所有需要的题型组件 ---
// 使用 dynamic import 保证这些组件只在被需要时才加载，优化性能
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false });
const PaiXuTi = dynamic(() => import('@/components/Tixing/PaiXuTi'), { ssr: false });
const GaiCuoTi = dynamic(() => import('@/components/Tixing/GaiCuoTi'), { ssr: false });
const FanYiTi = dynamic(() => import('@/components/Tixing/FanYiTi'), { ssr: false });
const TingLiZhuJu = dynamic(() => import('@/components/Tixing/TingLiZhuJu'), { ssr: false });
const CiDianKa = dynamic(() => import('@/components/Tixing/CiDianKa'), { ssr: false });
const GengDuTi = dynamic(() => import('@/components/Tixing/GengDuTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('@/components/Tixing/PanDuanTi'), { ssr: false });
const XuanZeTi = dynamic(() => import('@/components/Tixing/XuanZeTi'), { ssr: false });
// 其他非题型组件如果课程中需要也可以按需引入
// const HanziModal = dynamic(() => import('@/components/HanziModal'), { ssr: false })
// const PhraseCard = dynamic(() => import('@/components/PhraseCard'), { ssr: false })

// --- 拼音生成工具 ---
const generateRubyHTML = (text) => {
  if (!text || typeof text !== 'string') return '';
  let html = '';
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      const pinyinStr = pinyin(char);
      html += `<ruby>${char}<rt>${pinyinStr}</rt></ruby>`;
    } else {
      html += char;
    }
  }
  return html;
};

// --- 子组件：教学页 (保持不变) ---
const TeachingBlock = ({ content }) => {
  const renderDisplayText = (textOrArray) => {
    if (typeof textOrArray === 'string') {
      return <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(textOrArray) }} />;
    }
    if (Array.isArray(textOrArray)) {
      return textOrArray.map((item, index) => {
        const renderedContent = <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(item.content) }} />;
        if (item.type === 'bold') {
          return <strong key={index}>{renderedContent}</strong>;
        }
        return renderedContent;
      });
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 text-slate-800">
      {content.imageUrl && (
        <img src={content.imageUrl} alt="Lesson content" className="max-w-xs md:max-w-md max-h-64 object-contain mb-8 rounded-lg shadow-lg" />
      )}
      <div className="text-5xl md:text-7xl font-bold mb-4">
        {renderDisplayText(content.displayText)}
      </div>
      {content.translation && (
        <p className="text-xl md:text-2xl text-slate-600">{content.translation}</p>
      )}
    </div>
  );
};

// --- 子组件：设置面板 (保持不变) ---
const SettingsPanel = ({ settings, setSettings, onClose }) => {
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white/90 backdrop-blur-md rounded-lg p-6 shadow-2xl text-slate-800 w-96" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="mb-4">
                    <label className="block mb-2 font-semibold">中文发音人</label>
                    <select name="chineseVoice" value={settings.chineseVoice} onChange={handleChange} className="w-full p-2 rounded border"><option value="zh-CN-XiaoxiaoNeural">晓晓 (女)</option><option value="zh-CN-YunyangNeural">云扬 (男)</option></select>
                </div>
                <div className="mb-4">
                    <label className="block mb-2 font-semibold">缅文发音人</label>
                    <select name="myanmarVoice" value={settings.myanmarVoice} onChange={handleChange} className="w-full p-2 rounded border"><option value="my-MM-NilarNeural">Nilar (女)</option><option value="my-MM-ThihaNeural">Thiha (男)</option></select>
                </div>
                <div className="mb-4">
                    <label className="block mb-2 font-semibold">语速: {settings.rate}</label>
                    <input type="range" name="rate" min="0.5" max="2" step="0.1" value={settings.rate} onChange={handleChange} className="w-full" />
                </div>
                <div className="flex items-center justify-between">
                    <span className="font-semibold">显示字幕</span>
                    <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" name="showSubtitles" checked={settings.showSubtitles} onChange={handleChange} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div></label>
                </div>
                <button onClick={onClose} className="mt-6 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors">关闭</button>
            </div>
        </div>
    );
};


// --- 主播放器组件 ---
export default function LessonPlayer({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
      chineseVoice: 'zh-CN-XiaoxiaoNeural',
      myanmarVoice: 'my-MM-NilarNeural',
      rate: 1,
      showSubtitles: true
  });
  
  const audioRef = useRef(null);
  const subtitleTimerRef = useRef(null);
  const totalBlocks = lesson.blocks.length;
  const lessonId = lesson.id;

  // 从 localStorage 加载/保存状态 (保持不变)
  useEffect(() => {
    const savedIndex = localStorage.getItem(`lesson-progress-${lessonId}`);
    if (savedIndex) setCurrentIndex(parseInt(savedIndex, 10));
    const savedSettings = localStorage.getItem('lesson-settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, [lessonId]);
  useEffect(() => { localStorage.setItem(`lesson-progress-${lessonId}`, currentIndex); }, [currentIndex, lessonId]);
  useEffect(() => { localStorage.setItem('lesson-settings', JSON.stringify(settings)); }, [settings]);

  // TTS 播放逻辑 (保持不变)
  const playAudio = useCallback(async () => { /* ... 之前的 TTS 逻辑 ... */ }, [currentIndex, lesson.blocks, settings]);
  const stopAudioAndSubtitles = () => { /* ... 之前的停止逻辑 ... */ };
  const togglePlayPause = () => { /* ... 之前的播放/暂停逻辑 ... */ };
  
  // 导航逻辑
  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, totalBlocks]);

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };
  
  const goToPage = () => {
      const pageNum = prompt(`跳转到页面 (1-${totalBlocks}):`);
      if (pageNum && !isNaN(pageNum)) {
          const targetIndex = parseInt(pageNum, 10) - 1;
          if (targetIndex >= 0 && targetIndex < totalBlocks) {
              setCurrentIndex(targetIndex);
          } else {
              alert('无效的页码');
          }
      }
  }

  // 切换页面时重置状态
  useEffect(() => {
    // stopAudioAndSubtitles(); // 假设之前的停止函数在这里
  }, [currentIndex]);

  const currentBlock = lesson.blocks[currentIndex];

  // --- 核心修改：扩展 renderBlock 函数以支持所有题型 ---
  const renderBlock = () => {
    const props = {
      data: currentBlock.content,
      onComplete: goToNext // 所有题型组件完成时都调用 goToNext
    };
    
    // 如果是单独的 prop，例如 `lesson`
    const specificProps = {
      lesson: currentBlock.content,
      onComplete: goToNext
    }

    switch (currentBlock.type.toLowerCase()) {
      case 'teaching':
        return <TeachingBlock content={currentBlock.content} />;

      // 你的题型组件
      case 'choice': // 沿用之前的示例
      case 'xuanze': // 可以给题型起别名
        return <XuanZeTi {...props} />;
      case 'lianxian':
        return <LianXianTi {...props} />;
      case 'paixu':
        return <PaiXuTi {...props} />;
      case 'gaicuo':
        return <GaiCuoTi {...props} />;
      case 'fanyi':
        return <FanYiTi {...props} />;
      case 'tinglizhuju':
        return <TingLiZhuJu {...props} />;
      case 'cidianka':
        return <CiDianKa {...props} />;
      case 'gengdu':
        return <GengDuTi {...props} />;
      case 'panduan':
        return <PanDuanTi {...props} />;
        
      // 如果有组件的 prop 不是 `data`，可以单独处理
      // case 'interactivehsk':
      //   return <InteractiveHSKLesson {...specificProps} />;
      
      // 未知题型的 fallback
      default:
        return (
          <div className="text-red-500 bg-white/80 p-4 rounded-lg shadow-md">
            错误：不支持的页面类型 "{currentBlock.type}"。
            请检查 Notion 中的 JSON 数据。
          </div>
        );
    }
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center text-slate-800 flex flex-col items-center justify-center"
      style={{ backgroundImage: "url(/background.jpg)" }}
    >
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
      
      <div className="w-full h-full flex items-center justify-center p-4">
        {renderBlock()}
      </div>

      {settings.showSubtitles && subtitles.length > 0 && (
          <div className="absolute bottom-24 md:bottom-28 w-full text-center px-4 pointer-events-none">
              <p className="inline-block text-2xl md:text-3xl font-semibold text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                  {subtitles.join('')}
              </p>
          </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center space-x-2 md:space-x-4">
          <button onClick={goToPrev} disabled={currentIndex === 0} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
          <button onClick={goToPage} className="text-sm font-mono px-2">{currentIndex + 1} / {totalBlocks}</button>
          <button onClick={goToNext} disabled={currentIndex === totalBlocks - 1} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
          <button onClick={togglePlayPause} className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-transform active:scale-95">{isPlaying ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>}</button>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
        </div>
      </div>

      {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
