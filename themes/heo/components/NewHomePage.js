import React, { useEffect } from 'react'
// 所有客户端依赖的库都在这个文件里导入
import { FaTiktok, FaFacebook, FaYoutube, FaSearch } from 'react-icons/fa'
import { CgPinyin } from 'react-icons/cg'
import { MdTranslate, MdOutlineQuiz, MdSpellcheck, MdLibraryBooks } from 'react-icons/md'

const NewHomePage = (props) => {
  // 滚动动画逻辑
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    }, {
      threshold: 0.1
    })

    const elements = document.querySelectorAll('.fade-in-up')
    elements.forEach(el => observer.observe(el))

    return () => elements.forEach(el => observer.unobserve(el))
  }, [])

  return (
    <>
      {/* 新首页的专属样式 */}
      <style jsx global>{`
          /* --- 全局与字体定义 --- */
          :root {
            --primary-color: #0052D4; /* 主题色 - 一种现代蓝 */
            --text-color-dark: #222;
            --text-color-light: #666;
            --bg-color-light: #ffffff;
            --bg-color-grey: #f7f8fa;
            --border-color: #e5e7eb;
          }

          /* --- 动画效果 --- */
          .fade-in-up {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s ease-out, transform 0.6s ease-out;
          }

          .fade-in-up.visible {
            opacity: 1;
            transform: translateY(0);
          }

          /* --- 1. 沉浸式首屏 --- */
          .hero-section-new {
            position: relative;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: white;
            overflow: hidden;
          }

          .video-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
          }

          .video-background video {
            width: 100%;
            height: 100%;
            object-fit: cover; /* 保证视频填满容器 */
          }

          .hero-overlay-new {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4); /* 黑色蒙版，突出文字 */
            z-index: 2;
          }

          .hero-content-new {
            position: relative;
            z-index: 3;
            animation: fadeIn 1.5s ease-in-out;
          }

          .main-title-new {
            font-size: clamp(2.5rem, 8vw, 4.5rem); /* 响应式字体 */
            font-weight: 700;
            letter-spacing: 2px;
            text-shadow: 0 4px 15px rgba(0,0,0,0.4);
          }

          .subtitle-new {
            font-size: clamp(1rem, 4vw, 1.5rem);
            font-weight: 300;
            margin-top: 1rem;
            text-shadow: 0 2px 10px rgba(0,0,0,0.3);
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* --- 主内容区通用样式 --- */
          .main-content-new {
            background-color: var(--bg-color-light);
            position: relative;
            z-index: 5; /* 确保在首屏视频之上 */
          }

          .section-container-new {
            max-width: 1200px;
            margin: 0 auto;
            padding: 80px 20px;
          }

          .section-title-new {
            text-align: center;
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--text-color-dark);
            margin-bottom: 0.5rem;
          }

          .section-subtitle-new {
            text-align: center;
            font-size: 1.1rem;
            color: var(--text-color-light);
            margin-bottom: 3rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
          }

          /* --- 2. 直播网格 --- */
          .live-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
          }

          .live-card {
            position: relative;
            border-radius: 16px;
            overflow: hidden;
            height: 250px;
            color: white;
            text-decoration: none;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: 20px;
          }

          .live-card.large-card {
            grid-column: span 1;
          }

          @media (min-width: 768px) {
              .live-card.large-card {
                  grid-column: span 2;
              }
          }


          .live-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
          }

          .live-card-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            transition: transform 0.4s ease;
          }

          .live-card:hover .live-card-bg {
            transform: scale(1.05); /* 悬浮时背景图放大 */
          }

          .live-card-content {
            position: relative;
            z-index: 2;
            background: rgba(0,0,0,0.2);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px); /* Safari support */
            padding: 16px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.2);
          }

          .live-card-content span {
            display: block;
            font-weight: 500;
            margin-top: 8px;
          }

          .live-status {
              position: absolute;
              top: 16px;
              right: 16px;
              background-color: #E53935;
              color: white;
              padding: 4px 10px;
              border-radius: 20px;
              font-size: 0.8rem;
              font-weight: 500;
          }


          /* --- 3. 汉缅词典 --- */
          .dictionary-wrapper {
            background-color: var(--bg-color-grey);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            border: 1px solid var(--border-color);
          }
          .dictionary-wrapper .section-title-new {
            margin-bottom: 2rem;
          }

          .dictionary-input-group {
            display: flex;
            align-items: center;
            max-width: 600px;
            margin: 0 auto;
            background: var(--bg-color-light);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
            padding: 8px;
          }

          .dictionary-input-group .input-icon {
            font-size: 1.5rem;
            color: var(--text-color-light);
            margin: 0 12px;
          }

          .dictionary-input-group input {
            flex-grow: 1;
            border: none;
            outline: none;
            background: transparent;
            font-size: 1.1rem;
            padding: 12px 0;
          }

          .dictionary-input-group .search-button {
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 20px;
            cursor: pointer;
            font-size: 1.2rem;
            transition: background-color 0.2s ease;
          }
          .dictionary-input-group .search-button:hover {
            background: #0041a8;
          }

          /* --- 4. 学习工具 --- */
          .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 24px;
          }

          .tool-card {
            background: var(--bg-color-grey);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 32px;
            text-align: center;
            text-decoration: none;
            color: var(--text-color-dark);
            transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
          }

          .tool-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 15px 30px rgba(0, 82, 212, 0.08);
            border-color: var(--primary-color);
          }

          .tool-icon {
            font-size: 3rem;
            color: var(--primary-color);
            margin-bottom: 1rem;
          }

          .tool-card h3 {
            font-size: 1.4rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
          }

          .tool-card p {
            color: var(--text-color-light);
            margin: 0;
          }
      `}
      </style>

      {/* 新首页的JSX结构 */}
      <div className="modern-homepage">
        <header className="hero-section-new">
            <div className="video-background">
                {/* 
                  重要提示：请将下面的视频和图片路径替换为您自己的文件路径 
                  视频和图片文件需要放在项目根目录的 /public 文件夹下
                  例如: /my-video.mp4, /my-poster.jpg
                */}
                <video autoPlay loop muted playsInline poster="/path/to/poster-image.jpg">
                    <source src="/path/to/your-background-video.mp4" type="video/mp4" />
                </video>
            </div>
            <div className="hero-overlay-new"></div>
            <div className="hero-content-new">
                <h1 className="main-title-new">我爱中文</h1>
                <p className="subtitle-new">探索汉字之美，感受华夏之韵</p>
            </div>
        </header>
        <main className="main-content-new">
            <section className="section-container-new">
                <h2 className="section-title-new fade-in-up">实时互动课堂</h2>
                <p className="section-subtitle-new fade-in-up">随时随地，加入我们的直播，与老师和同学在线交流</p>
                <div className="live-grid fade-in-up">
                    <a href="#" className="live-card large-card">
                        {/* 请替换为您自己的图片, 放在/public文件夹下 */}
                        <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/youtube-cover.jpg)' }}></div>
                        <div className="live-card-content">
                            <FaYoutube size={32} />
                            <span>YouTube 主频道</span>
                            <span className="live-status">直播中</span>
                        </div>
                    </a>
                    <a href="#" className="live-card">
                        <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/tiktok-cover.jpg)' }}></div>
                        <div className="live-card-content">
                            <FaTiktok size={24} />
                            <span>TikTok 短视频</span>
                        </div>
                    </a>
                    <a href="#" className="live-card">
                        <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/facebook-cover.jpg)' }}></div>
                        <div className="live-card-content">
                            <FaFacebook size={24} />
                            <span>Facebook 交流群</span>
                        </div>
                    </a>
                </div>
            </section>
            <section className="section-container-new">
                <div className="dictionary-wrapper fade-in-up">
                    <h2 className="section-title-new">随身汉缅词典</h2>
                    <div className="dictionary-input-group">
                        <MdTranslate className="input-icon" />
                        <input type="text" placeholder="输入单词或短句..." />
                        <button className="search-button"><FaSearch /></button>
                    </div>
                </div>
            </section>
            <section className="section-container-new">
                <h2 className="section-title-new fade-in-up">全功能学习工具箱</h2>
                <p className="section-subtitle-new fade-in-up">从拼音到语法，我们为你准备了所有学习工具</p>
                <div className="tools-grid fade-in-up">
                    <a href="/pinyin" className="tool-card"> <CgPinyin className="tool-icon" /> <h3>拼音查询</h3> <p>掌握标准发音</p> </a>
                    <a href="/vocabulary" className="tool-card"> <MdSpellcheck className="tool-icon" /> <h3>生词本</h3> <p>记录和复习新词</p> </a>
                    <a href="/sentences" className="tool-card"> <MdLibraryBooks className="tool-icon" /> <h3>情景短句</h3> <p>学习地道表达</p> </a>
                    <a href="/exercises" className="tool-card"> <MdOutlineQuiz className="tool-icon" /> <h3>在线练习</h3> <p>巩固学习成果</p> </a>
                </div>
            </section>
        </main>
      </div>
    </>
  )
}

// 确保使用 export default
export default NewHomePage
