/**
 * 网站字体相关配置
 *
 */
module.exports = {
  // START ************网站字体*****************
  // ['font-serif','font-sans'] 两种可选，分别是衬线和无衬线
  FONT_STYLE: process.env.NEXT_PUBLIC_FONT_STYLE || 'font-sans font-normal',

  // 字体CSS，从网络加载字体资源
  FONT_URL: [
    'https://fonts.googleapis.com/css?family=Bitter:300,400,700&display=swap',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap', // 引入思源黑体 (无衬线)
    'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500;700&display=swap' // 引入思源宋体 (衬线)
  ],

  // 字体优化配置
  FONT_DISPLAY: process.env.NEXT_PUBLIC_FONT_DISPLAY || 'swap',
  FONT_PRELOAD: process.env.NEXT_PUBLIC_FONT_PRELOAD || true,
  FONT_SUBSET: process.env.NEXT_PUBLIC_FONT_SUBSET || 'chinese-simplified',

  // ✨ [已修改] 无衬线字体 (Sans-serif) 列表
  // 优化了字体栈顺序，确保优先使用对汉语拼音支持最好的字体。
  FONT_SANS: [
    '"Noto Sans SC"',         // 1. 优先使用通过 FONT_URL 引入的思源黑体，它能完美显示所有拼音。
    '"PingFang SC"',          // 2. 苹果设备上的最佳备选系统字体。
    '"Microsoft YaHei"',      // 3. Windows 设备上的最佳备选系统字体。
    '"Helvetica Neue"',       // 4. 高质量的西文备选字体。
    'Helvetica',              // 西文备选字体。
    '"Source Han Sans SC"',   // 思源黑体的别名，以防万一。
    'Arial',                  // 通用西文备选字体。
    'sans-serif',             // 5. 浏览器最终的通用无衬线字体兜底。
    // Emoji 字体应该放在最后，以确保它们只在需要渲染表情符号时才被调用。
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"'
  ],

  // 衬线字体 (Serif) 列表
  FONT_SERIF: [
    'Bitter',
    '"Noto Serif SC"',        // 优先使用思源宋体
    'SimSun',                 // Windows 上的宋体
    '"Times New Roman"',
    'Times',
    'serif',                  // 浏览器通用衬线字体兜底
    // Emoji 字体
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"'
  ],
  
  // Font Awesome 图标字体
  FONT_AWESOME:
    process.env.NEXT_PUBLIC_FONT_AWESOME_PATH ||
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'

  // END ************网站字体*****************
}
