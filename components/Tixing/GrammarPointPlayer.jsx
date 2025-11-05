// components/Tixing/GrammarPointPlayer.jsx (TTS修复最终完整版)

import React, antd from 'react';
import PropTypes from 'prop-types';
import { pinyin } from 'pinyin-pro';
import { useSwipeable } from 'react-swipeable';
import { Howl } from 'howler'; // 【关键修改】引入 Howler.js

// --- 辅助函数 (保持不变) ---
const generateRubyHTML = (text) => {
  if (!text || typeof text !== 'string') return '';
  let html = '';
  for (const char of text) {
    if (/[\u4e-00-\u9fa5]/.test(char)) {
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
        return {
            id: `${part}-${index}`,
            text: isChinese ? part.slice(2, -2) : part,
            isChinese: isChinese,
        };
    });
};

// --- 主组件 ---
const GrammarPointPlayer = ({ 
    grammarPoints,
    onComplete = () => {} 
}) => {

    const [grammarIndex, setGrammarIndex] = antd.useState(0);
    const [exampleIndex, setExampleIndex] = antd.useState(0);

    if (!grammarPoints || !Array.isArray(grammarPoints) || grammarPoints.length === 0) {
        return <div className="p-4 text-white bg-red-900">错误：未能接收到有效的 `grammarPoints` 数组。</div>;
    }

    const totalGrammarPoints = grammarPoints.length;
    const currentGrammarPoint = grammarPoints[grammarIndex];
    const { background, grammarPoint, pattern, explanation, examples } = currentGrammarPoint;
    const totalExamples = examples?.length || 0;
    
    const [settings] = antd.useState({
      chineseVoice: 'zh-CN-XiaoyouNeural', // 与 XuanZeTi 保持一致
      myanmarVoice: 'my-MM-NilarNeural', // 假设的缅文发音人
      rate: 1,
      showSubtitles: true // 虽然 t.leftsite.cn 不返回字幕，但我们保留这个开关
    });
    
    const [isPlaying, setIsPlaying] = antd.useState(false);
    const [isLoading, setIsLoading] = antd.useState(false);
    
    // 使用 useRef 来存储 Howler 实例，以便可以控制它
    const soundRef = antd.useRef(null);

    const stopPlayback = antd.useCallback(() => {
        if (soundRef.current) {
            soundRef.current.stop();
        }
        setIsPlaying(false);
    }, []);

    const playAudioForCurrentExample = antd.useCallback(async () => {
        if (isPlaying) {
            stopPlayback();
            return;
        }
        
        if (!examples?.[exampleIndex]) return;
        
        setIsLoading(true);
        
        const textToRead = examples[exampleIndex].narrationText || examples[exampleIndex].sentence;
        if (!textToRead) { setIsLoading(false); return; }
        
        // 【核心修改】构建SSML (语音合成标记语言)
        // 默认语言是缅语，中文部分用 <voice> 标签指定中文发音人
        const ssml = `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="my-MM">
            <voice name="${settings.myanmarVoice}">
                ${textToRead.replace(/\{\{/g, `</voice><voice name="${settings.chineseVoice}">`).replace(/\}\}/g, '</voice><voice name="' + settings.myanmarVoice + '">')}
            </voice>
        </speak>`;

        // 【核心修改】使用 t.leftsite.cn API
        // 注意：这个API可能需要特定的参数来处理SSML，这里假设't'参数可以接受SSML
        const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(ssml)}`;

        // 停止任何当前正在播放的音频
        if (soundRef.current) {
            soundRef.current.unload();
        }
        
        const sound = new Howl({
            src: [ttsUrl],
            html5: true, // 关键！对于长音频或流式音频，这通常是必须的
            onplay: () => {
                setIsLoading(false);
                setIsPlaying(true);
            },
            onend: () => {
                setIsPlaying(false);
                soundRef.current = null;
            },
            onloaderror: (id, err) => {
                console.error('TTS Load Error:', err);
                alert('语音加载失败，请检查网络或联系管理员。');
                setIsLoading(false);
                setIsPlaying(false);
            },
            onplayerror: (id, err) => {
                console.error('TTS Play Error:', err);
                alert('语音播放失败，可能是浏览器限制。');
                setIsLoading(false);
                setIsPlaying(false);
            }
        });
        
        soundRef.current = sound;
        sound.play();

    }, [exampleIndex, examples, settings, isPlaying, stopPlayback]);
    
    const goToNextExample = () => { stopPlayback(); if (exampleIndex < totalExamples - 1) { setExampleIndex(p => p + 1); } else { goToNextGrammar(); } };
    const goToPrevExample = () => { stopPlayback(); if (exampleIndex > 0) { setExampleIndex(p => p - 1); } };
    const goToNextGrammar = () => { stopPlayback(); if (grammarIndex < totalGrammarPoints - 1) { setGrammarIndex(p => p + 1); setExampleIndex(0); } else { onComplete(); } };
    const goToPrevGrammar = () => { stopPlayback(); if (grammarIndex > 0) { setGrammarIndex(p => p - 1); setExampleIndex(0); } };

    const swipeHandlers = useSwipeable({
        onSwipedUp: goToNextGrammar,
        onSwipedDown: goToPrevGrammar,
        preventDefaultTouchmoveEvent: true,
        trackMouse: true
    });
    
    antd.useEffect(() => {
        return () => {
            // 组件卸载时，确保停止并卸载音频
            if (soundRef.current) {
                soundRef.current.unload();
            }
        };
    }, []);
    
    const currentExample = examples?.[exampleIndex];
    const backgroundStyle = { backgroundImage: background?.imageUrl ? `url(${background.imageUrl})` : `linear-gradient(135deg, ${background?.gradientStart || '#4A7684'} 0%, ${background?.gradientEnd || '#1e3a44'} 100%)`, backgroundSize: 'cover', backgroundPosition: 'center', transition: 'background-image 0.5s ease-in-out' };

    if (!currentExample) { return <div className="text-white p-4">例句加载失败或课程已完成。</div>; }

    return (
        <div {...swipeHandlers} className="w-full h-full flex flex-col items-center justify-center" style={backgroundStyle}>
            <div className="w-11/12 max-w-2xl bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 text-white flex flex-col text-center animate-fade-in-up">
                <h1 className="text-4xl md:text-5xl font-bold tracking-wide" dangerouslySetInnerHTML={{ __html: generateRubyHTML(grammarPoint) }}/>
                <p className="mt-2 text-lg md:text-xl text-cyan-300 font-mono">{pattern}</p>
                <div className="text-base md:text-lg bg-white/5 p-4 rounded-lg mt-4">
                    <p>
                        {parseMixedLanguageText(explanation).map(part => ( <span key={part.id} className={part.isChinese ? 'text-white font-semibold' : 'text-slate-300 font-light'}>{part.text}</span> ))}
                    </p>
                </div>
                <hr className="border-white/20 my-5" />
                <div className="min-h-[140px] flex flex-col items-center justify-center">
                    <div className="text-3xl md:text-4xl font-semibold leading-relaxed mb-3">
                         {parseMixedLanguageText(currentExample.sentence).map(part => ( <span key={part.id} className={part.isChinese ? 'text-white' : 'text-green-300'}>{part.isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(part.text) }} /> : part.text}</span> ))}
                    </div>
                    <p className="text-xl md:text-2xl text-slate-200">{currentExample.translation}</p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                    <button onClick={goToPrevExample} disabled={exampleIndex === 0} className="p-3 bg-white/10 rounded-full hover:bg-white/30 disabled:opacity-40 transition-all">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <button onClick={playAudioForCurrentExample} disabled={isLoading} className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg transform hover:scale-105 active:scale-95 transition-all">
                        {isLoading ? ( <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> ) 
                        : isPlaying ? ( <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z"/></svg> ) 
                        : ( <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg> )}
                    </button>
                    <button onClick={goToNextExample} className="p-3 bg-white/10 rounded-full hover:bg-white/30 transition-all">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                </div>
            </div>
            <div className="absolute top-5 right-5 bg-black/40 rounded-full px-4 py-2 text-sm font-mono text-white">语法: {grammarIndex + 1} / {totalGrammarPoints}</div>
            <div className="absolute top-5 left-5 bg-black/40 rounded-full px-4 py-2 text-sm font-mono text-white">例句: {exampleIndex + 1} / {totalExamples}</div>
            <button onClick={goToNextGrammar} className="absolute bottom-10 right-5 p-3 bg-white/20 backdrop-blur-sm rounded-full text-white animate-bounce">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
            </button>
        </div>
    );
};

GrammarPointPlayer.propTypes = {
    grammarPoints: PropTypes.array.isRequired,
    onComplete: PropTypes.func,
};

export default GrammarPointPlayer;
