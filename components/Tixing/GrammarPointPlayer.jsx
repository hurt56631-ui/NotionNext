// components/Tixing/GrammarPointPlayer.jsx (极简可靠版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { pinyin } from 'pinyin-pro';
import { Howl } from 'howler';

// --- 硬编码的数据 ---
// 为了 100% 确保渲染成功，我们暂时将数据直接写在代码里
const grammarData = {
  "background": { "gradientStart": "#4A7684", "gradientEnd": "#1e3a44" },
  "grammarPoint": "动词 ‘在’",
  "pattern": "Subject + 在 + Place",
  "explanation": "မင်္ဂလာပါ ကျောင်းသားတို့။ ဒီနေ့ ကျွန်တော်တို့ အရမ်းအသုံးဝင်တဲ့ စကားလုံးတစ်လုံးဖြစ်တဲ့ {{在}} ကို လေ့လာကြမယ်။",
  "examples": [
    { "id": "ex1", "sentence": "{{我朋友}} {{在}} {{学校}}။", "translation": "ကျွန်တော့်သူငယ်ချင်းက ကျောင်းမှာရှိတယ်။" }
  ]
};

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
const GrammarPointPlayer = () => {
    // --- 直接使用硬编码的数据 ---
    const { background, grammarPoint, pattern, explanation, examples } = grammarData;

    const [settings] = useState({
      chineseVoice: 'zh-CN-XiaoyouNeural',
      myanmarVoice: 'my-MM-NilarNeural',
    });
    
    const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const soundRef = useRef(null);

    const playAudio = useCallback(() => {
        if (isPlaying) {
            if (soundRef.current) soundRef.current.stop();
            setIsPlaying(false);
            return;
        }

        const currentExample = examples[currentExampleIndex];
        const textToRead = currentExample.narrationText || currentExample.sentence;
        if (!textToRead) return;

        const ssml = `<speak xmlns="http://www.w3.org/2001/10/synthesis" version="1.0" xml:lang="my-MM"><voice name="${settings.myanmarVoice}">${textToRead.replace(/\{\{/g, `</voice><voice name="${settings.chineseVoice}">`).replace(/\}\}/g, `</voice><voice name="${settings.myanmarVoice}">`)}</voice></speak>`;
        const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(ssml)}`;

        if (soundRef.current) soundRef.current.unload();

        const sound = new Howl({
            src: [ttsUrl],
            html5: true,
            onplay: () => setIsPlaying(true),
            onend: () => setIsPlaying(false),
            onloaderror: () => alert('语音加载失败'),
            onplayerror: () => alert('语音播放失败'),
        });
        
        soundRef.current = sound;
        sound.play();

    }, [currentExampleIndex, examples, settings, isPlaying]);

    useEffect(() => {
        return () => {
            if (soundRef.current) soundRef.current.unload();
        };
    }, []);

    const currentExample = examples[currentExampleIndex];
    const backgroundStyle = { backgroundImage: `linear-gradient(135deg, ${background.gradientStart} 0%, ${background.gradientEnd} 100%)`, backgroundSize: 'cover' };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center" style={backgroundStyle}>
            <div className="w-11/12 max-w-2xl bg-black/30 backdrop-blur-xl rounded-2xl p-8 text-white text-center">
                <h1 className="text-5xl font-bold" dangerouslySetInnerHTML={{ __html: generateRubyHTML(grammarPoint) }} />
                <p className="mt-2 text-xl text-cyan-300 font-mono">{pattern}</p>
                <div className="text-lg bg-white/5 p-4 rounded-lg mt-4">
                    <p>{parseMixedLanguageText(explanation).map(part => (<span key={part.id} className={part.isChinese ? 'font-semibold' : 'text-slate-300'}>{part.text}</span>))}</p>
                </div>
                <hr className="border-white/20 my-5" />
                <div className="min-h-[140px] flex flex-col items-center justify-center">
                    <div className="text-4xl font-semibold mb-3">
                         {parseMixedLanguageText(currentExample.sentence).map(part => ( <span key={part.id} className={part.isChinese ? 'text-white' : 'text-green-300'}>{part.isChinese ? <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(part.text) }} /> : part.text}</span> ))}
                    </div>
                    <p className="text-2xl text-slate-200">{currentExample.translation}</p>
                </div>
                <div className="mt-6">
                    <button onClick={playAudio} className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                        {isPlaying ? 
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 19h3V5H8v14zm5-14v14h3V5h-3z"/></svg> :
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

// GrammarPointPlayer.propTypes = {}; // 暂时禁用所有 prop 检查

export default GrammarPointPlayer;
