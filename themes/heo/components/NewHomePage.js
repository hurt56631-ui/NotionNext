import React, { useEffect } from 'react'

// --- 图标组件：不再从外部库导入，直接定义为SVG ---

const IconYoutube = (props) => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 576 512" {...props}>
    <path d="M549.655 124.083c-6.281-23.65-24.787-42.1-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.497-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 42.1 48.284 48.597C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.497 42.003-24.947 48.284-48.597 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zM232.083 349.083V163.917l142.739 92.583-142.739 92.583z"></path>
  </svg>
)

const IconTiktok = (props) => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" {...props}>
        <path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"></path>
    </svg>
)

const IconFacebook = (props) => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" {...props}>
        <path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z"></path>
    </svg>
)

const IconSearch = (props) => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" {...props}>
    <path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.3-128-128s57.3-128 128-128 128 57.3 128 128-57.3 128-128 128z"></path>
  </svg>
)

const IconTranslate = (props) => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" {...props}>
    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"></redacted>
  </svg>
)

const IconPinyin = (props) => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 1024 1024" {...props} >
        <path d="M248 200h-40c-4.4 0-8 3.6-8 8v608c0 4.4 3.6 8 8 8h40c4.4 0 8-3.6 8-8V208c0-4.4-3.6-8-8-8zm136 544H248c-4.4 0-8 3.6-8 8v40c0 4.4 3.6 8 8 8h136c4.4 0 8-3.6 8-8v-40c0-4.4-3.6-8-8-8zm0-584H248c-4.4 0-8 3.6-8 8v40c0 4.4 3.6 8 8 8h136c4.4 0 8-3.6 8-8v-40c0-4.4-3.6-8-8-8zM520 200h-40c-4.4 0-8 3.6-8 8v608c0 4.4 3.6 8 8 8h40c4.4 0 8-3.6 8-8V208c0-4.4-3.6-8-8-8zm136 544H520c-4.4 0-8 3.6-8 8v40c0 4.4 3.6 8 8 8h136c4.4 0 8-3.6 8-8v-40c0-4.4-3.6-8-8-8zm0-584H520c-4.4 0-8 3.6-8 8v40c0 4.4 3.6 8 8 8h136c4.4 0 8-3.6 8-8v-40c0-4.4-3.6-8-8-8zM808 200h-40c-4.4 0-8 3.6-8 8v608c0 4.4 3.6 8 8 8h40c4.4 0 8-3.6 8-8V208c0-4.4-3.6-8-8-8zm136 544H808c-4.4 0-8 3.6-8 8v40c0 4.4 3.6 8 8 8h136c4.4 0 8-3.6 8-8v-40c0-4.4-3.6-8-8-8zm0-584H808c-4.4 0-8 3.6-8 8v40c0 4.4 3.6 8 8 8h136c4.4 0 8-3.6 8-8v-40c0-4.4-3.6-8-8-8z"></path>
    </svg>
)

const IconSpellcheck = (props) => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" {...props}>
    <path d="M21.59 11.59l-1.42-1.42L16 14.17l-1.41-1.41-1.42 1.42L14.59 17l-4.24 4.24-1.41-1.41-1.42 1.42L11.76 25l6.36-6.36L21.59 15l-1.41-1.41L16 17.17zM1.39 4.22l2.12 2.12c-1.03.9-1.92 2.02-2.63 3.27.39.73.83 1.42 1.32 2.06l1.58-1.58c-.2-.29-.38-.6-.54-.91-.19-.35-.36-.71-.5-1.08.33-.63.72-1.23 1.18-1.78l1.42 1.42c-.52.61-.98 1.28-1.35 2-.1.19-.18.39-.26.59l2.01 2.01c.42-.04.83-.11 1.24-.21.94-.23 1.83-.56 2.67-.99l1.41 1.41c-1.11.66-2.3 1.2-3.58 1.58-.52.16-1.05.29-1.59.39l.99.99 1.42-1.42.01.01.28-.28.1-.1 1.42 1.42 1.41-1.42-.99-.99c.35-.35.67-.72.97-1.11l1.42 1.42c-.47.63-.99 1.22-1.57 1.75l1.41 1.41 4.95-4.95L21.48 3.4l-1.41-1.41L1.39 4.22z"></path>
  </svg>
)

const IconLibraryBooks = (props) => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" {...props}>
    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"></path>
  </svg>
)

const IconQuiz = (props) => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" {...props}>
    <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"></path>
  </svg>
)


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
      <style jsx global>{`
          :root { --primary-color: #0052D4; --text-color-dark: #222; --text-color-light: #666; --bg-color-light: #ffffff; --bg-color-grey: #f7f8fa; --border-color: #e5e7eb; }
          .fade-in-up { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease-out, transform 0.6s ease-out; }
          .fade-in-up.visible { opacity: 1; transform: translateY(0); }
          .hero-section-new { position: relative; height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; color: white; overflow: hidden; }
          .video-background { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
          .video-background video { width: 100%; height: 100%; object-fit: cover; }
          .hero-overlay-new { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.4); z-index: 2; }
          .hero-content-new { position: relative; z-index: 3; animation: fadeIn 1.5s ease-in-out; }
          .main-title-new { font-size: clamp(2.5rem, 8vw, 4.5rem); font-weight: 700; letter-spacing: 2px; text-shadow: 0 4px 15px rgba(0,0,0,0.4); }
          .subtitle-new { font-size: clamp(1rem, 4vw, 1.5rem); font-weight: 300; margin-top: 1rem; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .main-content-new { background-color: var(--bg-color-light); position: relative; z-index: 5; }
          .section-container-new { max-width: 1200px; margin: 0 auto; padding: 80px 20px; }
          .section-title-new { text-align: center; font-size: 2.5rem; font-weight: 700; color: var(--text-color-dark); margin-bottom: 0.5rem; }
          .section-subtitle-new { text-align: center; font-size: 1.1rem; color: var(--text-color-light); margin-bottom: 3rem; max-width: 600px; margin-left: auto; margin-right: auto; }
          .live-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
          .live-card { position: relative; border-radius: 16px; overflow: hidden; height: 250px; color: white; text-decoration: none; transition: transform 0.3s ease, box-shadow 0.3s ease; display: flex; flex-direction: column; justify-content: flex-end; padding: 20px; }
          .live-card.large-card { grid-column: span 1; }
          @media (min-width: 768px) { .live-card.large-card { grid-column: span 2; } }
          .live-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
          .live-card-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; transition: transform 0.4s ease; }
          .live-card:hover .live-card-bg { transform: scale(1.05); }
          .live-card-content { position: relative; z-index: 2; background: rgba(0,0,0,0.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); }
          .live-card-content span { display: block; font-weight: 500; margin-top: 8px; }
          .live-status { position: absolute; top: 16px; right: 16px; background-color: #E53935; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; }
          .dictionary-wrapper { background-color: var(--bg-color-grey); border-radius: 20px; padding: 40px; text-align: center; border: 1px solid var(--border-color); }
          .dictionary-wrapper .section-title-new { margin-bottom: 2rem; }
          .dictionary-input-group { display: flex; align-items: center; max-width: 600px; margin: 0 auto; background: var(--bg-color-light); border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 15px rgba(0,0,0,0.05); padding: 8px; }
          .dictionary-input-group .input-icon { font-size: 1.5rem; color: var(--text-color-light); margin: 0 12px; }
          .dictionary-input-group input { flex-grow: 1; border: none; outline: none; background: transparent; font-size: 1.1rem; padding: 12px 0; }
          .dictionary-input-group .search-button { background: var(--primary-color); color: white; border: none; border-radius: 8px; padding: 12px 20px; cursor: pointer; font-size: 1.2rem; transition: background-color 0.2s ease; }
          .dictionary-input-group .search-button:hover { background: #0041a8; }
          .tools-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; }
          .tool-card { background: var(--bg-color-grey); border: 1px solid var(--border-color); border-radius: 16px; padding: 32px; text-align: center; text-decoration: none; color: var(--text-color-dark); transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
          .tool-card:hover { transform: translateY(-8px); box-shadow: 0 15px 30px rgba(0, 82, 212, 0.08); border-color: var(--primary-color); }
          .tool-icon { font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem; }
          .tool-card h3 { font-size: 1.4rem; font-weight: 500; margin-bottom: 0.5rem; }
          .tool-card p { color: var(--text-color-light); margin: 0; }
      `}
      </style>

      <div className="modern-homepage">
        <header className="hero-section-new">
            <div className="video-background">
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
                        <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/youtube-cover.jpg)' }}></div>
                        <div className="live-card-content">
                            <IconYoutube size={32} />
                            <span>YouTube 主频道</span>
                            <span className="live-status">直播中</span>
                        </div>
                    </a>
                    <a href="#" className="live-card">
                        <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/tiktok-cover.jpg)' }}></div>
                        <div className="live-card-content">
                            <IconTiktok size={24} />
                            <span>TikTok 短视频</span>
                        </div>
                    </a>
                    <a href="#" className="live-card">
                        <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/facebook-cover.jpg)' }}></div>
                        <div className="live-card-content">
                            <IconFacebook size={24} />
                            <span>Facebook 交流群</span>
                        </div>
                    </a>
                </div>
            </section>
            <section className="section-container-new">
                <div className="dictionary-wrapper fade-in-up">
                    <h2 className="section-title-new">随身汉缅词典</h2>
                    <div className="dictionary-input-group">
                        <IconTranslate className="input-icon" />
                        <input type="text" placeholder="输入单词或短句..." />
                        <button className="search-button"><IconSearch /></button>
                    </div>
                </div>
            </section>
            <section className="section-container-new">
                <h2 className="section-title-new fade-in-up">全功能学习工具箱</h2>
                <p className="section-subtitle-new fade-in-up">从拼音到语法，我们为你准备了所有学习工具</p>
                <div className="tools-grid fade-in-up">
                    <a href="/pinyin" className="tool-card"> <IconPinyin className="tool-icon" /> <h3>拼音查询</h3> <p>掌握标准发音</p> </a>
                    <a href="/vocabulary" className="tool-card"> <IconSpellcheck className="tool-icon" /> <h3>生词本</h3> <p>记录和复习新词</p> </a>
                    <a href="/sentences" className="tool-card"> <IconLibraryBooks className="tool-icon" /> <h3>情景短句</h3> <p>学习地道表达</p> </a>
                    <a href="/exercises" className="tool-card"> <IconQuiz className="tool-icon" /> <h3>在线练习</h3> <p>巩固学习成果</p> </a>
                </div>
            </section>
        </main>
      </div>
    </>
  )
}

export default NewHomePage
