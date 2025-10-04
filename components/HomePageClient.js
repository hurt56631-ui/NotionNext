// /components/HomePageClient.js

import React, { useEffect } from 'react';

// 把所有 react-icons 的导入都移动到这个文件里
import { FaTiktok, FaFacebook, FaYoutube, FaSearch } from 'react-icons/fa';
import { CgPinyin } from 'react-icons/cg';
import { MdTranslate, MdOutlineQuiz, MdSpellcheck, MdLibraryBooks } from 'react-icons/md';

// 这个组件包含了所有之前在 home.js 中的实际 JSX 内容
const HomePageClient = () => {

  // 滚动动画的逻辑也属于客户端，所以也移到这里
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1
    });

    const elements = document.querySelectorAll('.fade-in-up');
    elements.forEach(el => observer.observe(el));

    return () => elements.forEach(el => observer.unobserve(el));
  }, []);

  return (
    <div className="modern-homepage">
      {/* --- Section 1: 沉浸式首屏 --- */}
      <header className="hero-section">
        <div className="video-background">
          <video autoPlay loop muted playsInline poster="/path/to/poster-image.jpg">
            <source src="/path/to/your-background-video.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="main-title">我爱中文</h1>
          <p className="subtitle">探索汉字之美，感受华夏之韵</p>
        </div>
      </header>

      <main className="main-content">
        {/* --- Section 2: 直播与核心入口 --- */}
        <section className="section-container">
          <h2 className="section-title fade-in-up">实时互动课堂</h2>
          <p className="section-subtitle fade-in-up">随时随地，加入我们的直播，与老师和同学在线交流</p>
          <div className="live-grid fade-in-up">
            <a href="#" className="live-card large-card">
              <div className="live-card-bg" style={{backgroundImage: 'url(/path/to/youtube-cover.jpg)'}}></div>
              <div className="live-card-content">
                <FaYoutube size={32} />
                <span>YouTube 主频道</span>
                <span className="live-status">直播中</span>
              </div>
            </a>
            <a href="#" className="live-card">
              <div className="live-card-bg" style={{backgroundImage: 'url(/path/to/tiktok-cover.jpg)'}}></div>
              <div className="live-card-content">
                <FaTiktok size={24} />
                <span>TikTok 短视频</span>
              </div>
            </a>
            <a href="#" className="live-card">
              <div className="live-card-bg" style={{backgroundImage: 'url(/path/to/facebook-cover.jpg)'}}></div>
              <div className="live-card-content">
                <FaFacebook size={24} />
                <span>Facebook 交流群</span>
              </div>
            </a>
          </div>
        </section>

        {/* --- Section 3: 汉缅词典 --- */}
        <section className="section-container">
          <div className="dictionary-wrapper fade-in-up">
              <h2 className="section-title">随身汉缅词典</h2>
              <div className="dictionary-input-group">
                  <MdTranslate className="input-icon" />
                  <input type="text" placeholder="输入单词或短句..." />
                  <button className="search-button"><FaSearch /></button>
              </div>
          </div>
        </section>

        {/* --- Section 4: 学习工具 --- */}
        <section className="section-container">
          <h2 className="section-title fade-in-up">全功能学习工具箱</h2>
          <p className="section-subtitle fade-in-up">从拼音到语法，我们为你准备了所有学习工具</p>
          <div className="tools-grid fade-in-up">
            <a href="#" className="tool-card">
              <CgPinyin className="tool-icon" />
              <h3>拼音查询</h3>
              <p>掌握标准发音</p>
            </a>
            <a href="#" className="tool-card">
              <MdSpellcheck className="tool-icon" />
              <h3>生词本</h3>
              <p>记录和复习新词</p>
            </a>
            <a href="#" className="tool-card">
              <MdLibraryBooks className="tool-icon" />
              <h3>情景短句</h3>
              <p>学习地道表达</p>
            </a>
            <a href="#" className="tool-card">
              <MdOutlineQuiz className="tool-icon" />
              <h3>在线练习</h3>
              <p>巩固学习成果</p>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePageClient;
