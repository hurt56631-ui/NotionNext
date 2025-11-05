// components/Tixing/GrammarPointPlayer.jsx (最终修复完整版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { pinyin } from 'pinyin-pro';
import { useSwipeable } from 'react-swipeable';
import { Howl } from 'howler';

// --- 辅助函数 ---
const generateRubyHTML = (text) => {
  if (!text) return '';
  let html = '';
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      html += `<ruby>${char}<rt>${pinyin(char)}</rt></ruby>`;
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
        const isChinese = part.startsWith('{{') && part.endsWith('}}');
        return { id: index, text: isChinese ? part.slice(2, -2) : part, isChinese };
    });
};

// --- 主组件 ---
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {

    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) {
        return <div className="p-4 text-white bg-red-900">错误：未能接收到有效的 `grammarPoints` 数组。</div>;
    }

    const [grammarIndex, setGrammarIndex] = useState(0);
    const [exampleIndex, setExampleIndex] = useState(0);
    
    const [settings] = useState({
      chineseVoice: 'zh-CN-XiaoyouNeural',
      myanmarVoice: 'my-MM-NilarNeural',
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const soundQueue = useRef([]);
    const isPlayingRef = useRef(false);

    const totalGrammarPoints = grammarPoints.length;
    const currentGrammarPoint = grammarPoints[grammarIndex];
    const { background, grammarPoint, pattern, visibleExplanation, narrationScript, examples } = currentGrammarPoint;
    const totalExamples = examples.length;

    const stopPlayback = useCallback(() => {
        Howler.stop();
        soundQueue.current = [];
        isPlayingRef.current = false;
        setIsLoading(false);
    }, []);
    
    // 【核心TTS修复】客户端混音播放函数
    const playMixedAudio = useCallback((text) => {
        stopPlayback();
        if (!text) return;

        const parts = parseMixedLanguageText(text);
        let currentPart = 0;

        const playNextPart = () => {
            if (currentPart >= parts.length) {
                isPlayingRef.current = false;
                setIsLoading(false);
                return;
            }

            const part = parts[currentPart];
            const voice = part.isChinese ? settings.chineseVoice : settings.myanmarVoice;
            const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(part.text)}&v=${voice}`;
            
            const sound = new Howl({
                src: [ttsUrl],
                html5: true,
                onend: () => {
                    currentPart++;
                    playNextPart();
                },
                onloaderror: () => {
                    console.error(`语音片段加载失败: ${part.text}`);
                    stopPlayback();
                },
                onplayerror: () => {
                    console.error(`语音片段播放失败: ${part.text}`);
                    stopPlayback();
                }
            });
            sound.play();
        };

        isPlayingRef.current = true;
        setIsLoading(true);
        playNextPart();
    }, [settings, stopPlayback]);

    const handlePlayButtonClick = () => {
        if (isPlayingRef.current) {
            stopPlayback();
        } else {
            const currentExample = examples[exampleIndex];
            playMixedAudio(currentExample.narrationText || currentExample.sentence);
        }
    };

    // 自动播放旁白
    useEffect(() => {
        // 延迟播放，给用户反应时间
        const timer = setTimeout(() => {
            if (narrationScript) {
                playMixedAudio(narrationScript);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [grammarIndex, narrationScript, playMixedAudio]);
    
    // 组件卸载时清理
    useEffect(() => stopPlayback, [stopPlayback]);

    const goToNextExample = () => { if (exampleIndex < totalExamples - 1) setExampleIndex(p => p + 1); };
    const goToPrevExample = () => { if (exampleIndex > 0) setExampleIndex(p => p - 1); };
    const goToNextGrammar = () => { if (grammarIndex < totalGrammarPoints - 1) { setGrammarIndex(p => p + 1); setExampleIndex(0); } else { onComplete(); } };
    const goToPrevGrammar = () => { if (grammarIndex > 0) { setGrammarIndex(p => p - 1); setExampleIndex(0); } };

    const swipeHandlers = useSwipeable({ onSwipedUp: goToNextGrammar, onSwipedDown: goToPrevGrammar, preventDefaultTouchmoveEvent: true, trackMouse: true });
    
    const currentExample = examples?.[exampleIndex];
    const backgroundStyle = { backgroundImage: background?.imageUrl ? `url(${background.imageUrl})` : `linear-gradient(135deg, ${background?.gradientStart || '#4A7684'} 0%, ${background?.gradientEnd || '#1e3a44'} 100%)`, backgroundSize: 'cover', backgroundPosition: 'center', transition: 'all 0.5s ease-in-out' };

    if (!currentExample) { return <div className="text-white p-4">例句加载失败或课程已完成。</div>; }

    return (
        <div {...swipeHandlers} className="w-full h-full flex flex-col items-center justify-center p-4" style={backgroundStyle}>
            <div className="w-full max-w-md bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl p-6 text-white text-center flex flex-col animate-fade-in-up">
                
                {/* 标题和模式 */}
                <h1 className="text-3xl font-bold" dangerouslySetInnerHTML={{ __html: generateRubyHTML(grammarPoint) }}/>
                <p className="mt-1 text-lg text-cyan-300 font-mono">{pattern}</p>
                
                {/* 【UI修改】只显示简短的可视化解释 */}
                <p className="mt-4 text-base text-slate-200">{visibleExplanation}</p>
                
                <hr className="border-white/20 my-4" />

                {/* 例句区域 */}
                <div className="min-h-[120px] flex flex-col items-center justify-center">
                    <div className="text-3xl font-semibold mb-2 leading-relaxed">
                         {parseMixedLanguageText(currentExample.sentence).map(part => (
                            <span key={part.id} className={part.isChinese ? 'text-white' : 'text-green-300'}>
                                {part.isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(part.text) }} /> : part.text}
                            </span>
                         ))}
                    </div>
                    <p className="text-lg text-slate-300">{currentExample.translation}</p>
                </div>
                
                {/* 播放按钮 */}
                <div className="my-4 flex justify-center">
                    <button onClick={handlePlayButtonClick} disabled={isLoading} className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                        {isLoading ? <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"></path></svg>
                        : isPlayingRef.current ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        }
                    </button>
                </div>

                {/* 例句切换 */}
                <div className="flex items-center justify-between text-sm text-slate-300">
                    <button onClick={goToPrevExample} disabled={exampleIndex === 0} className="p-2 disabled:opacity-30">上一个例句</button>
                    <span>{exampleIndex + 1} / {totalExamples}</span>
                    <button onClick={goToNextExample} disabled={exampleIndex === totalExamples - 1} className="p-2 disabled:opacity-30">下一个例句</button>
                </div>
            </div>

            {/* 语法点切换指示 */}
            <div className="absolute top-4 text-white text-sm">
                语法 {grammarIndex + 1} / {totalGrammarPoints}
            </div>
            <button onClick={goToNextGrammar} className="absolute bottom-6 text-white animate-bounce p-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
        </div>
    );
};

GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
