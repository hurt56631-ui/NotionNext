// components/Tixing/LessonPlayer.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PinyinHelper } from '@/lib/pinyin'; // 假设你有一个拼音转换工具

// --- 子组件：教学页 ---
const TeachingBlock = ({ content }) => {
  // 富文本渲染函数
  const renderDisplayText = (text) => {
    if (typeof text === 'string') {
      return <ruby dangerouslySetInnerHTML={{ __html: PinyinHelper.toRuby(text) }} />;
    }
    // 扩展以支持更多富文本类型
    if (Array.isArray(text)) {
      return text.map((item, index) => {
        if (item.type === 'bold') {
          return <strong key={index}><ruby dangerouslySetInnerHTML={{ __html: PinyinHelper.toRuby(item.content) }} /></strong>;
        }
        return <ruby key={index} dangerouslySetInnerHTML={{ __html: PinyinHelper.toRuby(item.content) }} />;
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

// --- 子组件：题型页 (示例 - 选择题) ---
// 注意：你需要根据你的实际题型组件进行替换和调整
const ChoiceQuestionBlock = ({ data, onComplete }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);

  const handleSelect = (id) => {
    if (isCorrect !== null) return; // 已经回答正确，不再响应
    setSelectedId(id);
    const correct = id === data.correctId;
    setIsCorrect(correct);
    if (correct) {
      setTimeout(() => onComplete(), 1000); // 答对后1秒自动进入下一页
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 text-slate-800">
      <h2 className="text-3xl font-bold text-center mb-8">{data.prompt}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.choices.map(choice => {
          const isSelected = selectedId === choice.id;
          let buttonClass = 'p-4 text-lg rounded-lg transition-all duration-300 shadow-md ';
          if (isSelected) {
            buttonClass += isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
          } else {
            buttonClass += 'bg-white/80 backdrop-blur-sm hover:bg-white';
          }
          return (
            <button key={choice.id} onClick={() => handleSelect(choice.id)} className={buttonClass}>
              {choice.text}
            </button>
          );
        })}
      </div>
    </div>
  );
};


// --- 子组件：设置面板 ---
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
                    <select name="chineseVoice" value={settings.chineseVoice} onChange={handleChange} className="w-full p-2 rounded border">
                        <option value="zh-CN-XiaoxiaoNeural">晓晓 (女)</option>
                        <option value="zh-CN-YunyangNeural">云扬 (男)</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block mb-2 font-semibold">缅文发音人</label>
                    <select name="myanmarVoice" value={settings.myanmarVoice} onChange={handleChange} className="w-full p-2 rounded border">
                        <option value="my-MM-NilarNeural">Nilar (女)</option>
                        <option value="my-MM-ThihaNeural">Thiha (男)</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block mb-2 font-semibold">语速: {settings.rate}</label>
                    <input type="range" name="rate" min="0.5" max="2" step="0.1" value={settings.rate} onChange={handleChange} className="w-full" />
                </div>
                
                <div className="flex items-center justify-between">
                    <span className="font-semibold">显示字幕</span>
                    <label className="switch">
                        <input type="checkbox" name="showSubtitles" checked={settings.showSubtitles} onChange={handleChange} />
                        <span className="slider round"></span>
                    </label>
                </div>

                <button onClick={onClose} className="mt-6 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors">
                    关闭
                </button>
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
  const totalBlocks = lesson.blocks.length;
  const lessonId = lesson.id;

  // 从 localStorage 加载进度和设置
  useEffect(() => {
    const savedIndex = localStorage.getItem(`lesson-progress-${lessonId}`);
    if (savedIndex) {
      setCurrentIndex(parseInt(savedIndex, 10));
    }
    const savedSettings = localStorage.getItem('lesson-settings');
    if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
    }
  }, [lessonId]);

  // 保存进度和设置到 localStorage
  useEffect(() => {
    localStorage.setItem(`lesson-progress-${lessonId}`, currentIndex);
  }, [currentIndex, lessonId]);

  useEffect(() => {
    localStorage.setItem('lesson-settings', JSON.stringify(settings));
  }, [settings]);

  // TTS 播放逻辑
  const playAudio = useCallback(async () => {
    const currentBlock = lesson.blocks[currentIndex];
    const narrationText = currentBlock.content?.narrationText;
    if (!narrationText) {
        setIsPlaying(false);
        return;
    }

    // 构建 TTS API URL
    // API URL: https://libretts.is-an.org/api/tts?text=...&chinese_voice=...&myanmar_voice=...&rate=...&subtitles=true
    const params = new URLSearchParams({
        text: narrationText.replace(/\{\{/g, '<voice name="' + settings.myanmarVoice + '">').replace(/\}\}/g, '</voice>'),
        chinese_voice: settings.chineseVoice,
        myanmar_voice: settings.myanmarVoice,
        rate: settings.rate,
        subtitles: 'true'
    });
    const ttsUrl = `https://libretts.is-an.org/api/tts?${params.toString()}`;

    try {
        const response = await fetch(ttsUrl);
        const data = await response.json();

        if (audioRef.current) {
            audioRef.current.src = data.audioUrl;
            audioRef.current.play();
            setIsPlaying(true);
            
            // 卡拉OK字幕效果
            if (settings.showSubtitles && data.subtitles) {
                let subtitleIndex = 0;
                const updateSubtitle = () => {
                    if (subtitleIndex < data.subtitles.length) {
                        const currentTime = audioRef.current.currentTime * 1000; // ms
                        const currentSubtitle = data.subtitles[subtitleIndex];
                        if (currentTime >= currentSubtitle.start) {
                            setSubtitles(prev => [...prev, currentSubtitle.text]);
                            subtitleIndex++;
                        }
                        if(isPlaying) requestAnimationFrame(updateSubtitle);
                    }
                };
                setSubtitles([]);
                requestAnimationFrame(updateSubtitle);
            }
        }
    } catch (error) {
        console.error("TTS API Error:", error);
        setIsPlaying(false);
    }
  }, [currentIndex, lesson.blocks, settings]);

  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current && audioRef.current.src && !audioRef.current.ended) {
          audioRef.current.play();
          setIsPlaying(true);
      } else {
          playAudio();
      }
    }
  };

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

  // 切换页面时重置状态并自动播放
  useEffect(() => {
    setIsPlaying(false);
    setSubtitles([]);
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
    }
    // 可选：进入新页面后自动播放
    // playAudio(); 
  }, [currentIndex, playAudio]);

  const currentBlock = lesson.blocks[currentIndex];

  const renderBlock = () => {
    switch (currentBlock.type) {
      case 'teaching':
        return <TeachingBlock content={currentBlock.content} />;
      case 'choice':
        return <ChoiceQuestionBlock data={currentBlock.content} onComplete={goToNext} />;
      // case 'matching':
      //   return <MatchingQuestionBlock data={currentBlock.content} onComplete={goToNext} />;
      default:
        return <div className="text-red-500">不支持的页面类型: {currentBlock.type}</div>;
    }
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center text-slate-800 flex flex-col items-center justify-center"
      style={{ backgroundImage: "url(/background.jpg)" }}
    >
      {/* 隐藏的 Audio 元素 */}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
      
      {/* 主要内容区域 */}
      <div className="w-full h-full flex items-center justify-center">
        {renderBlock()}
      </div>

      {/* 字幕 */}
      {settings.showSubtitles && subtitles.length > 0 && (
          <div className="absolute bottom-24 md:bottom-28 w-full text-center px-4">
              <p className="inline-block text-2xl md:text-3xl font-semibold text-white" style={{ textShadow: '2px 2px 4px #000000' }}>
                  {subtitles.join(' ')}
              </p>
          </div>
      )}

      {/* 底部控制栏 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center space-x-4">
          <button onClick={goToPrev} disabled={currentIndex === 0} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <button onClick={goToPage} className="text-sm font-mono">{currentIndex + 1} / {totalBlocks}</button>
          
          <button onClick={goToNext} disabled={currentIndex === totalBlocks - 1} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>

          <button onClick={togglePlayPause} className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600">
            {isPlaying 
              ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
            }
          </button>

          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      {/* 设置面板浮层 */}
      {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}

    </div>
  );
}
