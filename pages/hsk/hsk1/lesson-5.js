// pages/hsk/hsk1/lesson-5.js (修复 Module Not Found & 整合客户端逻辑)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
// 移除所有客户端依赖的顶部导入 (pinyin-pro, Howl, FaVolumeUp)
import { ChevronLeft, ChevronRight } from 'lucide-react';
import lessonDataRaw from '@/data/hsk/hsk1/lesson-5.json'; 
import dynamic from 'next/dynamic'; 

// ====================================================================
// 动态导入组件 - 它们都依赖浏览器 API
// ====================================================================

// 动态导入 LianXianTi (客户端运行)
const LianXianTi = dynamic(
    () => import('@/components/Tixing/LianXianTi'),
    { ssr: false, loading: () => <div className="p-4 text-center">加载连线题...</div> }
);

// 动态导入客户端 Section 渲染器
const ClientSectionRenderer = dynamic(
    () => import('./_ClientPinyinSectionRenderer'), // 假设我们将客户端逻辑放入此文件
    { ssr: false, loading: () => <div className="p-4 text-center">加载内容...</div> }
);

// **然而，我们避免新建文件。下面是整合的 Dynamic Component**
const DynamicPinyinSection = dynamic(
    () => import('react-icons/fa').then(mod => { // 使用一个已知的客户端依赖作为触发器
        // 在客户端环境下安全导入 pinyin-pro 和 howl
        const { pinyin: pinyinConverter } = require('pinyin-pro');
        const { Howl } = require('howler');
        const { FaVolumeUp } = mod;

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
        
        // 返回实际的客户端组件
        return ({ section }) => {
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
    }),
    { ssr: false, loading: () => <div className="p-4 text-center">加载内容...</div> }
);


// ====================================================================
// 通用的 Section 渲染组件 (使用 DynamicPinyinSection 替代 ClientPinyinSection)
// ====================================================================

const SectionRenderer = ({ section }) => {
    if (!section || !section.type) return null; 

    switch (section.type) {
        case 'title_card':
        case 'dialogue':
            // 依赖 pinyin-pro 的组件，使用动态导入的组件
            return <DynamicPinyinSection section={section} />;
            
        case 'lian_xian_ti':
            // LianXianTi 已经是动态导入的
            return <LianXianTi data={section.data} mapping={section.mapping} title={section.title} />;

        default:
            return <div className="p-4 bg-red-100 text-red-800 rounded-lg">未知组件类型: {section.type}</div>;
    }
};


// ====================================================================
// Lesson Page 主组件 (保持不变)
// ====================================================================

const Lesson5Page = () => {
    const router = useRouter();
    const lessonData = lessonDataRaw; 
    const [pageIndex, setPageIndex] = useState(0); 
    
    if (!lessonData || !lessonData.pages || lessonData.pages.length === 0) {
        return <div className="min-h-screen flex items-center justify-center">课程数据加载失败或为空。请检查 JSON 文件。</div>;
    }

    const currentPage = lessonData.pages[pageIndex];
    const totalPages = lessonData.pages.length;

    const goToNextPage = useCallback(() => {
        if (pageIndex < totalPages - 1) {
            setPageIndex(pageIndex + 1);
            window.scrollTo(0, 0); 
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
                    <div className="w-6"></div> 
                </div>
                <div className="w-full h-1 bg-blue-200">
                    <div className="h-full bg-blue-500" style={{ width: `${(pageIndex + 1) / totalPages * 100}%` }}></div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">{pageIndex + 1}. {currentPage.title}</h2>
                
                {Array.isArray(currentPage.components) && currentPage.components.map((component, index) => (
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
