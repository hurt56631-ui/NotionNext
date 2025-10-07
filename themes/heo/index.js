/**
 * 首页 - 全新门户设计 V2.1
 * - 代码与上一版完全相同，仅为确保操作准确性，请重新覆盖。
 */

import { siteConfig } from '@/lib/config'
import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import { FaTiktok, FaFacebook, FaYoutube } from 'react-icons/fa'

const LayoutIndex = props => {
  const tabs = ['文章', 'HSK', '口语', '练习'];
  const [activeTab, setActiveTab] = useState(tabs[0]);

  // 优化的手势切换逻辑
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabs.indexOf(activeTab);
      setActiveTab(tabs[(currentIndex + 1) % tabs.length]);
    },
    onSwipedRight: () => {
      const currentIndex = tabs.indexOf(activeTab);
      setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
    },
    trackMouse: true
  });

  const renderContent = () => {
    const iframeKey = activeTab + Date.now();
    switch (activeTab) {
      case '文章':
        return (
          <div className='mt-1'>
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
    <div className='w-full'>
      {/* 1. 全新的直播卡片网格区 */}
      <section className='p-4'>
        <div className='grid grid-cols-3 grid-rows-2 gap-4 h-[320px] md:h-[400px]'>
          <a href="#" target="_blank" rel="noopener noreferrer" className='col-span-1 row-span-1 card-style group'>
            <div className='card-background' style={{ backgroundImage: "url('https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80')" }}></div>
            <div className='card-overlay'></div>
            <div className='card-content'>
              <FaTiktok size={30} />
              <h3 className='text-xl font-bold mt-2'>TikTok</h3>
            </div>
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer" className='col-span-1 row-span-1 card-style group'>
            <div className='card-background' style={{ backgroundImage: "url('https://images.unsplash.com/photo-1633675254053-f72b6383b160?w=800&q=80')" }}></div>
            <div className='card-overlay'></div>
            <div className='card-content'>
              <FaFacebook size={30} />
              <h3 className='text-xl font-bold mt-2'>Facebook</h3>
            </div>
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer" className='col-span-2 row-span-2 card-style group'>
            <div className='card-background' style={{ backgroundImage: "url('https://images.unsplash.com/photo-1611162616805-65313b947c62?w=800&q=80')" }}></div>
            <div className='card-overlay'></div>
            <div className='card-content'>
              <FaYoutube size={40} />
              <h3 className='text-2xl font-bold mt-2'>YouTube 直播</h3>
            </div>
          </a>
        </div>
      </section>

      {/* 2. 粘性分类导航 */}
      <div className='sticky top-0 z-10 bg-white dark:bg-[#18171d] py-1 shadow-sm'>
          <div className='flex justify-center border-b border-gray-200 dark:border-gray-700'>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm md:text-base font-semibold transition-colors duration-300 focus:outline-none whitespace-nowrap
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
      
      {/* 3. 手势切换内容区 (全宽) */}
      <div {...handlers} className="w-full min-h-[50vh] bg-white dark:bg-[#1e1e1e]">
        {renderContent()}
      </div>
    </div>
  );
};

export default LayoutIndex;
