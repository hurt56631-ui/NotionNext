// pages/hsk/hsk1/lesson-5.js (最终修复版 V3 - 确保组件加载安全)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
// ❌ 移除 LianXianTi 的直接导入，改为动态导入
import { pinyin as pinyinConverter } from 'pinyin-pro'; // 仅用于 SSG 时的 Pinyin 格式化
import { FaVolumeUp } from 'react-icons/fa';
import { ChevronLeft, ChevronRight } from 'lucide-react';
// ❌ 移除 Howl 的直接导入

import lessonDataRaw from '@/data/hsk/hsk1/lesson-5.json'; 
import dynamic from 'next/dynamic'; // 确保 dynamic 导入

// 动态导入 LianXianTi (客户端运行)
const LianXianTi = dynamic(
    () => import('@/components/Tixing/LianXianTi'),
    { ssr: false, loading: () => <div className="p-4 text-center">加载连线题...</div> }
);

// 动态导入 Client Section (客户端运行)
const ClientPinyinSection = dynamic(
    () => import('./_LessonSectionClient').then(mod => mod.default),
    { ssr: false, loading: () => <div className="p-4 text-center">加载内容...</div> }
);

// 假设的 TTS 播放函数（仅用于占位）
const playTTS = (text) => {
    if (typeof window !== 'undefined') {
        // 确保只有在客户端才尝试播放
        console.log(`TTS 播放: ${text}`);
    }
};

// Pinyin 格式化函数（仅用于服务器端渲染的静态内容，如日志或 fallback）
const formatPinyin = (pinyin) => {
    if (typeof window === 'undefined') {
        return pinyin; // SSG 阶段，避免 pinyin-pro 报错
    }
    try {
        return pinyinConverter(pinyin, { toneType: 'symbol' });
    } catch (e) {
        return pinyin;
    }
};


// 通用的 Section 渲染组件
const SectionRenderer = ({ section }) => {
    // ✅ 修复：添加安全检查
    if (!section || !section.type) return null; 

    switch (section.type) {
        case 'title_card':
        case 'dialogue':
            // 这两个组件在 ClientPinyinSection 中实现
            return <ClientPinyinSection section={section} />;
            
        case 'lian_xian_ti':
            // LianXianTi 已经是动态导入的，直接返回
            return <LianXianTi data={section.data} mapping={section.mapping} title={section.title} />;

        default:
            return <div className="p-4 bg-red-100 text-red-800 rounded-lg">未知组件类型: {section.type}</div>;
    }
};


const Lesson5Page = () => {
    const router = useRouter();
    const lessonData = lessonDataRaw; 
    const [pageIndex, setPageIndex] = useState(0); 
    
    // ✅ 修复：添加安全检查，避免 lessonData.pages 是 undefined
    if (!lessonData || !lessonData.pages || lessonData.pages.length === 0) {
        return <div className="min-h-screen flex items-center justify-center">课程数据加载失败或为空。请检查 JSON 文件。</div>;
    }

    const currentPage = lessonData.pages[pageIndex];
    const totalPages = lessonData.pages.length;

    // 切换页面逻辑 (不变)
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
            {/* 顶栏 (保持不变) */}
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
                
                {/* 遍历组件时添加安全检查 */}
                {Array.isArray(currentPage.components) && currentPage.components.map((component, index) => (
                    <SectionRenderer key={index} section={component} />
                ))}
            </main>

            {/* 底部导航 (保持不变) */}
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
