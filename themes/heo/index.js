/**
 * 首页 - 全新门户设计
 * 根据您的要求，此页面已重构为一个包含品牌信息、直播卡片和粘性内容标签的门户页面。
 * - 设计师：Gemini (根据您的构想)
 */

import { siteConfig } from '@/lib/config'
import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import CategoryBar from './components/CategoryBar'
// 引入一些图标，您可以根据需要替换
import { FaTiktok, FaFacebook, FaYoutube } from 'react-icons/fa'

const LayoutIndex = props => {
  const tabs = ['文章', 'HSK', '口语', '练习'];
  const [activeTab, setActiveTab] = useState(tabs[0]);

  // 手势切换逻辑 (已优化)
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabs.indexOf(activeTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
    },
    onSwipedRight: () => {
      const currentIndex = tabs.indexOf(activeTab);
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex]);
    },
    trackMouse: true
  });

  // 根据激活的标签渲染对应内容
  const renderContent = () => {
    // 为 iframe 添加一个 key，确保在切换时能重新加载
    const iframeKey = activeTab + Date.now();
    switch (activeTab) {
      case '文章':
        return (
          <div className='mt-6'>
            <CategoryBar {...props} />
            {siteConfig('POST_LIST_STYLE') === 'page' ? (
              <BlogPostListPage {...props} />
            ) : (
              <BlogPostListScroll {...props} />
            )}
          </div>
        );
      case 'HSK':
        return <iframe key={iframeKey} src="about:blank" title="HSK" style={{ width: '100%', height: '80vh', border: 'none' }} />;
      case '口语':
        return <iframe key={iframeKey} src="about:blank" title="口语" style={{ width: '100%', height: '80vh', border: 'none' }} />;
      case '练习':
        return <iframe key={iframeKey} src="about:blank" title="练习" style={{ width: '100%', height: '80vh', border: 'none' }} />;
      default:
        return null;
    }
  };

  return (
    // 主容器
    <div className='w-full px-4 md:px-0'>

      {/* 1. 顶部英雄/品牌区 */}
      <section className='text-center py-12 md:py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-8'>
        <h1 className='text-4xl md:text-6xl font-extrabold text-blue-600 dark:text-blue-400'>
          中缅文培训中心
        </h1>
        <p className='mt-4 text-lg md:text-xl text-gray-500 dark:text-gray-300'>
          {/* 您可以在这里填写价格信息或一句Slogan */}
          开启您的中文学习之旅
        </p>
      </section>

      {/* 2. 直播卡片网格区 */}
      <section className='mb-8'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {/* 卡片1: TikTok */}
          <a href="#" target="_blank" rel="noopener noreferrer" className='card-style group'>
            <div className='card-background' style={{ backgroundImage: "url('https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80')" }}></div>
            <div className='card-overlay'></div>
            <div className='card-content'>
              <FaTiktok size={40} />
              <h3 className='text-2xl font-bold mt-2'>TikTok 直播</h3>
            </div>
          </a>
          {/* 卡片2: Facebook */}
          <a href="#" target="_blank" rel="noopener noreferrer" className='card-style group'>
            <div className='card-background' style={{ backgroundImage: "url('https://images.unsplash.com/photo-1633675254053-f72b6383b160?w=800&q=80')" }}></div>
            <div className='card-overlay'></div>
            <div className='card-content'>
              <FaFacebook size={40} />
              <h3 className='text-2xl font-bold mt-2'>Facebook 直播</h3>
            </div>
          </a>
          {/* 卡片3: YouTube */}
          <a href="#" target="_blank" rel="noopener noreferrer" className='card-style group'>
            <div className='card-background' style={{ backgroundImage: "url('https://images.unsplash.com/photo-1611162616805-65313b947c62?w=800&q=80')" }}></div>
            <div className='card-overlay'></div>
            <div className='card-content'>
              <FaYoutube size={40} />
              <h3 className='text-2xl font-bold mt-2'>YouTube 直播</h3>
            </div>
          </a>
        </div>
      </section>
      
      {/* CSS for Card Styles - 添加到您的全局CSS文件或Style-JSX中 */}
      <style jsx>{`
        .card-style {
          position: relative;
          display: block;
          height: 200px;
          border-radius: 12px;
          overflow: hidden;
          color: white;
          text-decoration: none;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card-style:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .card-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
          transition: transform 0.4s ease;
        }
        .group:hover .card-background {
          transform: scale(1.05);
        }
        .card-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 100%);
        }
        .card-content {
          position: relative;
          z-index: 2;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          padding: 20px;
          text-align: center;
        }
      `}</style>

      {/* 3. 粘性分类导航 + 内容区 */}
      <div className='sticky top-0 z-10 bg-white dark:bg-[#18171d] py-2 shadow-sm'>
        <div className='max-w-7xl mx-auto px-4'>
          <div className='flex justify-center border-b border-gray-200 dark:border-gray-700'>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-base font-semibold transition-colors duration-300 focus:outline-none
                  ${activeTab === tab 
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* 4. 手势切换内容区 */}
      <div {...handlers} className="w-full min-h-[50vh] bg-white dark:bg-[#1e1e1e] rounded-b-lg">
        {renderContent()}
      </div>

    </div>
  );
};

export default LayoutIndex; // 如果您是按组件导出，请确保导出
