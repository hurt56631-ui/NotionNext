// components/Tixing/GrammarPointPlayer.jsx (支持解释混排的最终版)

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
    // 我们用 {{中文}} 这样的格式来标记中文部分
    const parts = text.split(/(\{\{.*?\}\})/g).filter(Boolean);
    return parts.map((part, index) => {
        const isChinese = part.startsWith('{{') && part.endsWith('}}');
        return {
            id: `${part}-${index}`,
            text: isChinese ? part.slice(2, -2) : part,
            isChinese: isChinese,
        };
    });
};

// --- 主组件 ---
const GrammarPointPlayer = ({ 
    background, 
    grammarPoint, 
    pattern, 
    explanation, 
    examples,
    onComplete = () => {} 
}) => {

    if (!grammarPoint || !examples || !explanation) {
        return (
            <div className="w-full h-full flex items-center justify-center p-4" style={{ background: '#1e3a44' }}>
                <div className="w-11/12 max-w-2xl bg-red-800/80 rounded-2xl p-6 text-white text-center">
                    <h2 className="text-2xl font-bold mb-4">组件数据错误</h2>
                    <p className="text-lg">未能接收到 `grammarPoint`, `explanation` 或 `examples` 属性。</p>
                    <p className="mt-2 text-sm text-red-200">请检查 `!include` JSON 结构。</p>
                </div>
            </div>
        );
    }

    const [settings] = useState({
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
        
        // 朗读时，我们将 {{中文}} 替换成中文发音人指令
        let textToRead = examples[currentExampleIndex].narrationText || examples[currentExampleIndex].sentence;
        if (!textToRead) { setIsLoading(false); return; }
        
        // 注意：现在朗读的默认语言是缅语，中文部分用{{}}包裹
        const ssmlText = textToRead.replace(/\{\{/g, `<voice name="${settings.chineseVoice}">`).replace(/\}\}/g, '</voice>');
        const params = new URLSearchParams({ text: ssmlText, myanmar_voice: settings.myanmarVoice, rate: settings.rate, subtitles: 'true' });
        // 为了让API知道默认语言是缅语，我们可能需要调整API参数，这里假设API可以智能判断或有特定参数
        // 例如： base_lang=my-MM，或者直接把 myanmar_voice 作为主 voice 参数
        // 这里我用 myanmar_voice 参数来示意，你需要根据你的TTS API文档确认
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
                
                {/* ================== 【核心修改】 ================== */}
                <div className="text-base md:text-lg bg-white/5 p-4 rounded-lg mt-4">
                    <p>
                        {parseMixedLanguageText(explanation).map(part => (
                            <span key={part.id} className={part.isChinese ? 'text-white font-semibold' : 'text-slate-300 font-light'}>
                                {part.text}
                            </span>
                        ))}
                    </p>
                </div>
                {/* =================================================== */}

                <hr className="border-white/20 my-5" />
                <div className="min-h-[140px] md:min-h-[160px] flex flex-col items-center justify-center">
                    {/* 我们复用 parseMixedLanguageText 函数来处理例句显示 */}
                    <div className="text-3xl md:text-4xl font-semibold leading-relaxed mb-3">
                         {parseMixedLanguageText(currentExample.sentence).map(part => (
                            <span key={part.id} className={part.isChinese ? 'text-white' : 'text-green-300'}>
                                {part.isChinese 
                                    ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(part.text) }} />
                                    : part.text
                                }
                            </span>
                        ))}
                    </div>
                    <p className="text-xl md:text-2xl text-slate-200">{currentExample.translation}</p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                    <button onClick={handlePrevExample} disabled={currentExampleIndex === 0} className="p-3 bg-white/10 rounded-full hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <button onClick={playAudioForCurrentExample} disabled={isLoading} className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg transform hover:scale-105 active:scale-95 transition-all disabled:bg-gray-500 disabled:scale-100">
                        {/* Icons */}
                    </button>
                    <button onClick={handleNextExample} className="p-3 bg-white/10 rounded-full hover:bg-white/30 transition-all">
                        {/* Icons */}
                    </button>
                </div>
            </div>
            {settings.showSubtitles && subtitles.length > 0 && ( <div className="absolute bottom-10 md:bottom-16 w-full text-center px-4 pointer-events-none">{/* Subtitles */}</div> )}
            <div className="absolute top-5 right-5 bg-black/40 rounded-full px-4 py-2 text-sm font-mono text-white animate-fade-in">{currentExampleIndex + 1} / {totalExamples}</div>
        </div>
    );
};

// --- Prop类型定义 ---
GrammarPointPlayer.propTypes = {
    background: PropTypes.object,
    grammarPoint: PropTypes.string.isRequired,
    pattern: PropTypes.string.isRequired,
    explanation: PropTypes.string.isRequired, // explanation 现在是字符串
    examples: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
