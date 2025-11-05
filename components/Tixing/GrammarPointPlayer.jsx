// components/Tixing/GrammarPointPlayer.jsx (TTS移植修复版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { pinyin } from 'pinyin-pro';
import { Howl } from 'howler'; // 【关键修改】引入 Howler.js

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
        const isChinese = part.startsWith('{{') && part.endsWith('}}');
        return { id: `${part}-${index}`, text: isChinese ? part.slice(2, -2) : part, isChinese: isChinese };
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
                </div>
            </div>
        );
    }

    const [settings] = useState({
      chineseVoice: 'zh-CN-XiaoyouNeural', // 与 XuanZeTi 保持一致
      myanmarVoice: 'my-MM-NilarNeural', // 确保这个发音人名称有效
      rate: 1,
      showSubtitles: true
    });
    
    const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const soundRef = useRef(null); // 【关键修改】使用 Ref 存储 Howl 实例
    
    const totalExamples = examples?.length || 0;

    const stopPlayback = useCallback(() => {
        if (soundRef.current) {
            soundRef.current.stop();
        }
        setIsPlaying(false);
    }, []);

    const playAudioForCurrentExample = useCallback(() => {
        if (isPlaying) {
            stopPlayback();
            return;
        }

        if (!examples?.[currentExampleIndex]) return;
        
        setIsLoading(true);
        
        const textToRead = examples[currentExampleIndex].narrationText || examples[currentExampleIndex].sentence;
        if (!textToRead) {
            setIsLoading(false);
            return;
        }
        
        // 【核心修改】构建SSML (语音合成标记语言)
        const ssml = `<speak xmlns="http://www.w3.org/2001/10/synthesis" version="1.0" xml:lang="my-MM"><voice name="${settings.myanmarVoice}">${textToRead.replace(/\{\{/g, `</voice><voice name="${settings.chineseVoice}">`).replace(/\}\}/g, `</voice><voice name="${settings.myanmarVoice}">`)}</voice></speak>`;

        // 【核心修改】使用 t.leftsite.cn API
        const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(ssml)}`;

        if (soundRef.current) {
            soundRef.current.unload();
        }
        
        const sound = new Howl({
            src: [ttsUrl],
            html5: true,
            onplay: () => {
                setIsLoading(false);
                setIsPlaying(true);
            },
            onend: () => {
                setIsPlaying(false);
                soundRef.current = null;
            },
            onloaderror: (id, err) => {
                console.error('TTS 加载错误:', err);
                alert('语音加载失败，请检查网络或API。');
                setIsLoading(false);
            },
            onplayerror: (id, err) => {
                console.error('TTS 播放错误:', err);
                alert('语音播放失败，可能是浏览器限制。请与页面交互后再试。');
                setIsLoading(false);
            }
        });
        
        soundRef.current = sound;
        sound.play();

    }, [currentExampleIndex, examples, settings, isPlaying, stopPlayback]);
    
    useEffect(() => {
        // 组件卸载时，清理音频资源
        return () => {
            if (soundRef.current) {
                soundRef.current.unload();
            }
        };
    }, []);
    
    useEffect(() => {
        // 切换例句时，停止当前播放
        stopPlayback();
    }, [currentExampleIndex, stopPlayback]);

    const handleNextExample = () => {
        if (currentExampleIndex < totalExamples - 1) {
            setCurrentExampleIndex(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handlePrevExample = () => {
        if (currentExampleIndex > 0) {
            setCurrentExampleIndex(prev => prev - 1);
        }
    };
    
    const currentExample = examples?.[currentExampleIndex];
    const backgroundStyle = { backgroundImage: background?.imageUrl ? `url(${background.imageUrl})` : `linear-gradient(135deg, ${background?.gradientStart || '#4A7684'} 0%, ${background?.gradientEnd || '#1e3a44'} 100%)`, backgroundSize: 'cover', backgroundPosition: 'center' };

    if (!currentExample) { return <div className="text-white p-4">例句加载失败或课程已完成。</div>; }

    return (
        <div className="w-full h-full flex flex-col items-center justify-center transition-all duration-500" style={backgroundStyle}>
            <div className="w-11/12 max-w-2xl bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 text-white flex flex-col text-center animate-fade-in-up">
                <h1 className="text-4xl md:text-5xl font-bold tracking-wide" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }} dangerouslySetInnerHTML={{ __html: generateRubyHTML(grammarPoint) }}/>
                <p className="mt-2 text-lg md:text-xl text-cyan-300 font-mono bg-black/20 px-4 py-2 rounded-lg self-center">{pattern}</p>
                <div className="text-base md:text-lg bg-white/5 p-4 rounded-lg mt-4">
                    <p>{parseMixedLanguageText(explanation).map(part => ( <span key={part.id} className={part.isChinese ? 'text-white font-semibold' : 'text-slate-300 font-light'}>{part.text}</span> ))}</p>
                </div>
                <hr className="border-white/20 my-5" />
                <div className="min-h-[140px] md:min-h-[160px] flex flex-col items-center justify-center">
                    <div className="text-3xl md:text-4xl font-semibold leading-relaxed mb-3">
                         {parseMixedLanguageText(currentExample.sentence).map(part => ( <span key={part.id} className={part.isChinese ? 'text-white' : 'text-green-300'}>{part.isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(part.text) }} /> : part.text}</span> ))}
                    </div>
                    <p className="text-xl md:text-2xl text-slate-200">{currentExample.translation}</p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                    <button onClick={handlePrevExample} disabled={currentExampleIndex === 0} className="p-3 bg-white/10 rounded-full hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <button onClick={playAudioForCurrentExample} disabled={isLoading} className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg transform hover:scale-105 active:scale-95 transition-all disabled:bg-gray-500 disabled:scale-100">
                        {isLoading ? ( <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> ) 
                        : isPlaying ? ( <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z"/></svg> ) 
                        : ( <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg> )}
                    </button>
                    <button onClick={handleNextExample} className="p-3 bg-white/10 rounded-full hover:bg-white/30 transition-all">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                </div>
            </div>
            <div className="absolute top-5 right-5 bg-black/40 rounded-full px-4 py-2 text-sm font-mono text-white animate-fade-in">{currentExampleIndex + 1} / {totalExamples}</div>
        </div>
    );
};

GrammarPointPlayer.propTypes = {
    background: PropTypes.object,
    grammarPoint: PropTypes.string.isRequired,
    pattern: PropTypes.string.isRequired,
    explanation: PropTypes.string.isRequired,
    examples: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
