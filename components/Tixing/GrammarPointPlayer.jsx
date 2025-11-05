// components/Tixing/GrammarPointPlayer.jsx (最终真相版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { pinyin } from 'pinyin-pro';

// --- 辅助函数 (保持不变) ---
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

const parseMixedLanguageText = (text) => {
    if (!text) return [];
    const parts = text.split(/(\{\{.*?\}\})/g).filter(Boolean);
    return parts.map((part, index) => {
        const isBurmese = part.startsWith('{{') && part.endsWith('}}');
        return {
            id: `${part}-${index}`,
            text: isBurmese ? part.slice(2, -2) : part,
            isBurmese: isBurmese,
        };
    });
};

// --- 主组件 ---
// 【核心修改】直接从 props 解构出所有需要的属性，不再有 data prop
const GrammarPointPlayer = ({ 
    background, 
    grammarPoint, 
    pattern, 
    explanation, 
    examples,
    onComplete = () => {} 
}) => {

    // --- 防御性检查 ---
    if (!grammarPoint || !examples) {
        return (
            <div className="w-full h-full flex items-center justify-center p-4" style={{ background: '#1e3a44' }}>
                <div className="w-11/12 max-w-2xl bg-red-800/80 rounded-2xl p-6 text-white text-center">
                    <h2 className="text-2xl font-bold mb-4">组件数据错误</h2>
                    <p className="text-lg">未能接收到 `grammarPoint` 或 `examples` 属性。</p>
                    <p className="mt-2 text-sm text-red-200">
                        请检查 `!include` JSON 结构是否包含所有必需的顶级键。
                    </p>
                </div>
            </div>
        );
    }

    // --- 内部状态 ---
    const [settings] = useState({ // 组件现在完全自给自足
      chineseVoice: 'zh-CN-XiaoxiaoNeural',
      myanmarVoice: 'my-MM-NilarNeural',
      rate: 1,
      showSubtitles: true
    });
    
    const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [subtitles, setSubtitles] = useState([]);
    const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(false);

    const audioRef = useRef(null);
    const animationFrameRef = useRef(null);
    
    const totalExamples = examples?.length || 0;

    const stopPlayback = useCallback(() => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setIsPlaying(false);
        setHighlightedWordIndex(-1);
    }, []);

    const playAudioForCurrentExample = useCallback(async () => {
        if (!examples?.[currentExampleIndex]) return;
        stopPlayback();
        setIsLoading(true);

        const textToRead = examples[currentExampleIndex].narrationText || examples[currentExampleIndex].sentence;
        if (!textToRead) { setIsLoading(false); return; }

        const ssmlText = textToRead.replace(/\{\{/g, `<voice name="${settings.myanmarVoice}">`).replace(/\}\}/g, '</voice>');
        const params = new URLSearchParams({ text: ssmlText, chinese_voice: settings.chineseVoice, rate: settings.rate, subtitles: 'true' });
        const ttsUrl = `https://libretts.is-an.org/api/tts?${params.toString()}`;

        try {
            const response = await fetch(ttsUrl);
            if (!response.ok) throw new Error(`API request failed: ${response.status}`);
            const ttsData = await response.json();
            
            if (ttsData.audioUrl && ttsData.subtitles) {
                setSubtitles(ttsData.subtitles);
                if (audioRef.current) {
                    audioRef.current.src = ttsData.audioUrl;
                    await audioRef.current.play();
                    setIsPlaying(true);
                }
            } else { throw new Error('API response missing audioUrl or subtitles.'); }
        } catch (error) {
            console.error("[TTS] Error:", error);
            alert(`语音播放失败: ${error.message}`);
            setSubtitles([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentExampleIndex, examples, settings, stopPlayback]);

    useEffect(() => {
        const updateHighlight = () => {
            if (!isPlaying || !audioRef.current || !subtitles.length) return;
            const currentTime = audioRef.current.currentTime;
            const activeWordIndex = subtitles.findIndex(word => currentTime >= word.start && currentTime < word.end);
            if (activeWordIndex !== -1 && activeWordIndex !== highlightedWordIndex) {
                setHighlightedWordIndex(activeWordIndex);
            }
            animationFrameRef.current = requestAnimationFrame(updateHighlight);
        };
        if (isPlaying) { animationFrameRef.current = requestAnimationFrame(updateHighlight); }
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [isPlaying, subtitles, highlightedWordIndex]);
    
    useEffect(() => stopPlayback, [currentExampleIndex, stopPlayback]);

    const handleNextExample = () => {
        stopPlayback();
        if (currentExampleIndex < totalExamples - 1) {
            setCurrentExampleIndex(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handlePrevExample = () => { stopPlayback(); if (currentExampleIndex > 0) { setCurrentExampleIndex(prev => prev - 1); } };
    
    const currentExample = examples?.[currentExampleIndex];
    const backgroundStyle = {
        backgroundImage: background?.imageUrl ? `url(${background.imageUrl})` : `linear-gradient(135deg, ${background?.gradientStart || '#4A7684'} 0%, ${background?.gradientEnd || '#1e3a44'} 100%)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };

    if (!currentExample) { return <div className="text-white p-4">例句加载失败或课程已完成。</div>; }

    return (
        <div className="w-full h-full flex flex-col items-center justify-center transition-all duration-500" style={backgroundStyle}>
            <audio ref={audioRef} onEnded={() => { setIsPlaying(false); setHighlightedWordIndex(-1); }} />
            <div className="w-11/12 max-w-2xl bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 text-white flex flex-col text-center animate-fade-in-up">
                <h1 className="text-4xl md:text-5xl font-bold tracking-wide" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }} dangerouslySetInnerHTML={{ __html: generateRubyHTML(grammarPoint) }}/>
                <p className="mt-2 text-lg md:text-xl text-cyan-300 font-mono bg-black/20 px-4 py-2 rounded-lg self-center">{pattern}</p>
                <div className="text-base md:text-lg bg-white/5 p-4 rounded-lg mt-4">
                    <p className="mb-2">{explanation.chinese}</p>
                    <p className="text-slate-300 font-light">{explanation.myanmar}</p>
                </div>
                <hr className="border-white/20 my-5" />
                <div className="min-h-[140px] md:min-h-[160px] flex flex-col items-center justify-center">
                    <div className="text-3xl md:text-4xl font-semibold leading-relaxed mb-3">
                         {parseMixedLanguageText(currentExample.sentence).map(part => ( <span key={part.id} className={part.isBurmese ? 'text-green-300' : ''}>{part.text}</span> ))}
                    </div>
                    <p className="text-xl md:text-2xl text-slate-200">{currentExample.translation}</p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                    <button onClick={handlePrevExample} disabled={currentExampleIndex === 0} className="p-3 bg-white/10 rounded-full hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <button onClick={playAudioForCurrentExample} disabled={isLoading} className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg transform hover:scale-105 active:scale-95 transition-all disabled:bg-gray-500 disabled:scale-100">
                        {isLoading ? ( <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ) 
                        : isPlaying ? ( <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z"/></svg> ) 
                        : ( <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg> )}
                    </button>
                    <button onClick={handleNextExample} className="p-3 bg-white/10 rounded-full hover:bg-white/30 transition-all">
                        {currentExampleIndex === totalExamples - 1 ? ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg> ) 
                        : ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg> )}
                    </button>
                </div>
            </div>
            {settings.showSubtitles && subtitles.length > 0 && (
                <div className="absolute bottom-10 md:bottom-16 w-full text-center px-4 pointer-events-none">
                    <div className="inline-block bg-black/60 backdrop-blur-sm p-3 rounded-lg shadow-lg">
                        <p className="text-2xl md:text-3xl font-semibold text-white tracking-wider">
                            {subtitles.map((word, index) => ( <span key={index} className={`transition-colors duration-100 ${highlightedWordIndex === index ? 'text-yellow-300' : 'text-white/80'}`}>{word.text}</span> ))}
                        </p>
                    </div>
                </div>
            )}
            <div className="absolute top-5 right-5 bg-black/40 rounded-full px-4 py-2 text-sm font-mono text-white animate-fade-in">
                {currentExampleIndex + 1} / {totalExamples}
            </div>
        </div>
    );
};

// --- Prop类型定义 ---
GrammarPointPlayer.propTypes = {
    background: PropTypes.object,
    grammarPoint: PropTypes.string.isRequired,
    pattern: PropTypes.string.isRequired,
    explanation: PropTypes.object.isRequired,
    examples: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
