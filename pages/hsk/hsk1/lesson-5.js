// pages/hsk/hsk1/lesson-5.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { getLessonData } from '@/lib/data/localData'; // 假设的本地数据加载函数
import LianXianTi from '@/components/Tixing/LianXianTi';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import { FaVolumeUp } from 'react-icons/fa';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Howl } from 'howler';

// 导入数据文件 (实际项目中需要根据您的路径调整)
import lessonDataRaw from '@/data/hsk/hsk1/lesson-5.json'; 

// 假设的 TTS 播放函数（与 LianXianTi.js 中的保持一致）
const playTTS = (text) => {
    if (!text) return;
    console.log(`TTS 播放: ${text}`);
    // 实际实现
    // const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=0`;
    // new Howl({ src: [ttsUrl], html5: true }).play();
};


// 通用的 Section 渲染组件
const SectionRenderer = ({ section }) => {
    switch (section.type) {
        case 'title_card':
            const { main, pinyin, english } = section.data;
            return (
                <div className="text-center py-8 bg-white rounded-xl shadow-xl mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">{pinyinConverter(main, { toneType: 'symbol' })}</h1>
                    <h2 className="text-5xl font-extrabold text-blue-600 mt-2">{main}</h2>
                    <p className="text-lg text-gray-500 mt-4">{english}</p>
                </div>
            );
        case 'lian_xian_ti':
            return <LianXianTi data={section.data} mapping={section.mapping} title={section.title} />;
        case 'dialogue':
            return (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 my-4">
                    <h3 className="text-xl font-bold mb-4 border-l-4 border-amber-500 pl-3">{section.title}</h3>
                    {section.data.map((item, index) => (
                        <div key={index} className="flex flex-col mb-4 p-3 rounded-lg bg-gray-50 border-l-2 border-gray-300">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <p className="text-sm text-gray-500">{item.speaker}: {pinyinConverter(item.pinyin, { toneType: 'symbol' })}</p>
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
            return <div className="p-4 bg-red-100 text-red-800 rounded-lg">未知组件类型: {section.type}</div>;
    }
};


const Lesson5Page = () => {
    const router = useRouter();
    const lessonData = lessonDataRaw; // 直接加载本地数据
    const [pageIndex, setPageIndex] = useState(0); // 当前是第几页（从 0 开始）
    
    // 假设每页有多个 Section，这里我们用 pageIndex 对应 lessonData.pages 的索引
    const currentPage = lessonData.pages[pageIndex];
    const totalPages = lessonData.pages.length;

    // 切换页面逻辑
    const goToNextPage = useCallback(() => {
        if (pageIndex < totalPages - 1) {
            setPageIndex(pageIndex + 1);
            window.scrollTo(0, 0); // 切换页面后滚动到顶部
        }
    }, [pageIndex, totalPages]);

    const goToPrevPage = useCallback(() => {
        if (pageIndex > 0) {
            setPageIndex(pageIndex - 1);
            window.scrollTo(0, 0);
        }
    }, [pageIndex]);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* 顶栏 */}
            <header className="bg-white shadow-md sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex justify-between items-center p-4">
                    <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">{lessonData.lessonTitle}</h1>
                    <div className="w-6"></div> {/* 占位符 */}
                </div>
                <div className="w-full h-1 bg-blue-200">
                    <div className="h-full bg-blue-500" style={{ width: `${(pageIndex + 1) / totalPages * 100}%` }}></div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">{pageIndex + 1}. {currentPage.title}</h2>
                
                {currentPage.components.map((component, index) => (
                    <SectionRenderer key={index} section={component} />
                ))}
            </main>

            {/* 底部导航 */}
            <footer className="sticky bottom-0 bg-white/90 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-gray-200 z-10">
                <div className="max-w-4xl mx-auto flex justify-between p-4">
                    <button 
                        onClick={goToPrevPage} 
                        disabled={pageIndex === 0}
                        className={`py-2 px-4 rounded-xl font-semibold transition-colors flex items-center gap-2 ${pageIndex === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                    >
                        <ChevronLeft size={20} /> 上一页
                    </button>
                    
                    <span className="text-gray-600 font-medium self-center">{pageIndex + 1} / {totalPages}</span>

                    <button 
                        onClick={goToNextPage} 
                        disabled={pageIndex === totalPages - 1}
                        className={`py-2 px-4 rounded-xl font-semibold transition-colors flex items-center gap-2 ${pageIndex === totalPages - 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                    >
                        {pageIndex === totalPages - 1 ? '完成课程' : '下一页'} <ChevronRight size={20} />
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default Lesson5Page;
