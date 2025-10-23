// components/Tixing/LessonPlayer.jsx (最终优化版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { pinyin } from 'pinyin-pro';
import { useSwipeable } from 'react-swipeable'; // [新增] 导入划屏库

// --- [修改] 导入您项目中所有真实的题型组件 ---
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('@/components/Tixing/PanDuanTi'), { ssr: false });
const XuanZeTi = dynamic(() => import('@/components/Tixing/XuanZeTi'), { ssr: false });
// 如果有其他题型，也在这里导入...

// --- 拼音生成工具 (保持不变) ---
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

// --- 子组件：教学页 ---
const TeachingBlock = ({ content }) => {
  const renderDisplayText = (textOrArray) => { /* ... 此函数无变化 ... */ };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      {/* [修改] 调整displayText和imageUrl的顺序，将图片放到底部 */}
      <div className="text-5xl md:text-7xl font-bold mb-4 text-white" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.7)' }}>
        <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content.displayText) }} />
      </div>
      
      {content.translation && (
        <p className="text-xl md:text-2xl text-slate-200 mb-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>
          {content.translation}
        </p>
      )}

      {content.imageUrl && (
        <img src={content.imageUrl} alt="Lesson content" className="max-w-xs md:max-w-md max-h-64 object-contain rounded-lg shadow-lg mt-4" />
      )}
    </div>
  );
};

// --- 子组件：设置面板 (保持不变) ---
const SettingsPanel = ({ settings, setSettings, onClose }) => { /* ... 此组件无变化 ... */ };

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

  // ... localStorage 相关 useEffect 保持不变 ...

  // [修改] TTS 播放逻辑，加入详细日志
  const playAudio = useCallback(async () => {
    console.log('[TTS] playAudio called.');
    const currentBlock = lesson.blocks[currentIndex];
    const narrationText = currentBlock.content?.narrationText;
    if (!narrationText) {
        console.warn('[TTS] No narrationText found for this block.');
        setIsPlaying(false);
        return;
    }

    const params = new URLSearchParams({
        text: narrationText.replace(/\{\{/g, `<voice name="${settings.myanmarVoice}">`).replace(/\}\}/g, '</voice>'),
        chinese_voice: settings.chineseVoice,
        rate: settings.rate,
        subtitles: 'true'
    });
    const ttsUrl = `https://libretts.is-an.org/api/tts?${params.toString()}`;
    console.log('[TTS] Requesting URL:', ttsUrl);

    try {
        const response = await fetch(ttsUrl);
        console.log('[TTS] API Response Status:', response.status);
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        
        const data = await response.json();
        console.log('[TTS] API Response Data:', data);

        if (audioRef.current && data.audioUrl) {
            audioRef.current.src = data.audioUrl;
            await audioRef.current.play();
            setIsPlaying(true);
            console.log('[TTS] Audio playback started.');
            // ... 字幕逻辑保持不变 ...
        } else {
            console.error('[TTS] Audio element not found or no audioUrl in response.');
        }
    } catch (error) {
        console.error("[TTS] API Error:", error);
        alert(`语音播放失败: ${error.message}。请检查浏览器控制台获取详细信息。`);
        setIsPlaying(false);
    }
  }, [currentIndex, lesson.blocks, settings]);
  
  const togglePlayPause = () => { /* ... 此函数无变化 ... */ };

  // 导航逻辑
  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, totalBlocks]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);
  
  const goToPage = () => { /* ... 此函数无变化 ... */ };
  
  // [新增] 上下划屏切换
  const swipeHandlers = useSwipeable({
    onSwipedUp: () => goToNext(),
    onSwipedDown: () => goToPrev(),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  useEffect(() => { /* ... 切换页面时重置状态的逻辑无变化 ... */ }, [currentIndex]);

  const currentBlock = lesson.blocks[currentIndex];

  // [修改] 扩展 renderBlock 函数以使用您的真实题型组件
  const renderBlock = () => {
    const props = {
      data: currentBlock.content,
      onComplete: goToNext
    };

    switch (currentBlock.type.toLowerCase()) {
      case 'teaching':
        return <TeachingBlock content={currentBlock.content} />;
      case 'choice':
        return <XuanZeTi {...props} />; // <-- 使用您的真实组件
      case 'panduan':
        return <PanDuanTi {...props} />; // <-- 使用您的真实组件
      case 'lianxian':
        return <LianXianTi {...props} />; // <-- 使用您的真实组件
      default:
        return (
          <div className="text-red-500 bg-white/80 p-4 rounded-lg shadow-md">
            错误：不支持的页面类型 "{currentBlock.type}"。
          </div>
        );
    }
  };

  return (
    // [修改] 将 swipeHandlers 应用到主 div 上
    <div 
      {...swipeHandlers}
      className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center text-slate-800 flex flex-col items-center justify-center"
      style={{ backgroundImage: "url(/background.jpg)" }} // 您可以将这里的背景图换成截图中的绿色背景图
    >
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
      
      <div className="w-full h-full flex items-center justify-center p-4">
        {renderBlock()}
      </div>

      {/* [修改] 字幕样式调整 */}
      {settings.showSubtitles && subtitles.length > 0 && (
          <div className="absolute bottom-24 md:bottom-28 w-full text-center px-4 pointer-events-none">
              <p className="inline-block text-2xl md:text-3xl font-semibold text-white" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.8)' }}>
                  {subtitles.join('')}
              </p>
          </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
        {/* ... 控制栏 UI 保持不变 ... */}
      </div>

      {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
