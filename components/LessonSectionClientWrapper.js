// components/LessonSectionClientWrapper.js

import React from 'react';
// ✅ 在这个文件中，我们可以安全地导入所有客户端依赖
import { pinyin as pinyinConverter } from 'pinyin-pro'; 
import { Howl } from 'howler';
import { FaVolumeUp } from 'react-icons/fa';

// TTS 播放函数（依赖于 Howl）
const playTTS = (text) => {
    if (!text) return;
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=0`;
    new Howl({ src: [ttsUrl], html5: true, volume: 0.8 }).play(); 
};

// Pinyin 格式化函数（依赖于 pinyin-pro）
const formatPinyin = (pinyin) => {
    try {
        return pinyinConverter(pinyin, { toneType: 'symbol' });
    } catch (e) {
        return pinyin;
    }
};

// 实际的客户端渲染逻辑
const LessonSectionClientWrapper = ({ section }) => {
    switch (section.type) {
        case 'title_card':
            const { main, pinyin, english } = section.data;
            return (
                <div className="text-center py-8 bg-white rounded-xl shadow-xl mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">{formatPinyin(pinyin)}</h1>
                    <h2 className="text-5xl font-extrabold text-blue-600 mt-2">{main}</h2>
                    <p className="text-lg text-gray-500 mt-4">{english}</p>
                </div>
            );
        case 'dialogue':
            return (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 my-4">
                    <h3 className="text-xl font-bold mb-4 border-l-4 border-amber-500 pl-3">{section.title}</h3>
                    {section.data.map((item, index) => (
                        <div key={index} className="flex flex-col mb-4 p-3 rounded-lg bg-gray-50 border-l-2 border-gray-300">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <p className="text-sm text-gray-500">{item.speaker}: {formatPinyin(item.pinyin)}</p>
                                    <p className="text-xl font-bold text-gray-800">{item.chinese}</p>
                                </div>
                                <button onClick={() => playTTS(item.chinese)} className="text-gray-500 hover:text-blue-600 transition-colors">
                                    <FaVolumeUp size={20} />
                                </button>
                            </div>
                            <p className="text-sm text-green-600 mt-1">{item.english}</p>
                        </div>
                    ))}
                </div>
            );
        default:
            return null;
    }
};

export default LessonSectionClientWrapper;
