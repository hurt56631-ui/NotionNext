// pages/hsk/hsk1/lesson-5.js (最终修复版 V7 - 使用 Client Wrapper)

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import lessonDataRaw from '@/data/hsk/hsk1/lesson-5.json'; 
import dynamic from 'next/dynamic'; 

// ====================================================================
// 动态导入客户端组件
// ====================================================================

// 动态导入 LianXianTi (客户端运行)
const LianXianTi = dynamic(
    () => import('@/components/Tixing/LianXianTi'),
    { ssr: false, loading: () => <div className="p-4 text-center">加载连线题...</div> }
);

// ✅ 动态导入客户端渲染器 (LessonSectionClientWrapper)
const ClientSectionWrapper = dynamic(
    () => import('@/components/LessonSectionClientWrapper'),
    { ssr: false, loading: () => <div className="p-4 text-center">加载内容...</div> }
);


// ====================================================================
// 通用的 Section 渲染组件 (服务器端逻辑)
// ====================================================================

const SectionRenderer = ({ section }) => {
    if (!section || !section.type) return null; 

    switch (section.type) {
        case 'title_card':
        case 'dialogue':
            // 路由到客户端组件，并传入 section 数据
            return <ClientSectionWrapper section={section} />;
            
        case 'lian_xian_ti':
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
        // 确保 JSON 文件加载失败时有友好的提示
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
