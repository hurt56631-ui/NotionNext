/**
 * 网站字体相关配置
 *
 */
module.exports = {
  // START ************网站字体*****************
  // ['font-serif','font-sans'] 两种可选，分别是衬线和无衬线: 参考 https://www.jianshu.com/p/55e410bd2115
  // 后面空格隔开的font-light的字体粗细，留空是默认粗细；参考 https://www.tailwindcss.cn/docs/font-weight
  FONT_STYLE: process.env.NEXT_PUBLIC_FONT_STYLE || 'font-sans font-normal', // 调整为 'font-normal'，更适合中文阅读和手机显示

  // 字体CSS 例如 https://npm.elemecdn.com/lxgw-wenkai-webfont@1.6.0/style.css
  // 如果需要引入第三方字体，可以在此添加URL
  FONT_URL: [
    // 'https://npm.elemecdn.com/lxgw-wenkai-webfont@1.6.0/style.css',
    'https://fonts.googleapis.com/css?family=Bitter:300,400,700&display=swap',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap', // 确保引入了不同粗细的思源黑体
    'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500;700&display=swap'
  ],

  // 字体优化配置
  FONT_DISPLAY: process.env.NEXT_PUBLIC_FONT_DISPLAY || 'swap',
  FONT_PRELOAD: process.env.NEXT_PUBLIC_FONT_PRELOAD || true,
  FONT_SUBSET: process.env.NEXT_PUBLIC_FONT_SUBSET || 'chinese-simplified',

  // 无衬线字体 例如'"LXGW WenKai"'
  // 优化顺序：将 Noto Sans SC (思源黑体) 放在最前面，因为它通过 FONT_URL 引入，且对 Pinyin 支持较好。
  // 之后是系统字体，如 PingFang SC (macOS) 和 Microsoft YaHei (Windows)。
  FONT_SANS: [
    '"Noto Sans SC"',          // <--- 优先使用思源黑体 (Web Font)，因为它通常对 Pinyin 渲染更稳定。
    '"PingFang SC"',           // macOS 系统字体备选，Pinyin 渲染通常也很好。
    '-apple-system',           // macOS/iOS 系统默认字体
    'BlinkMacSystemFont',      // macOS/iOS 系统默认字体
    '"Microsoft YaHei"',       // Windows 系统字体备选。如果 Noto Sans SC 和 PingFang SC 都没加载/可用，会尝试。
    '"Hiragino Sans GB"',      // macOS 上的另一种中文无衬线字体
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
    '"Segoe UI"',               // Windows 系统默认 UI 字体
    'HarmonyOS_Regular',       // 华为鸿蒙系统字体
    '"Helvetica Neue"',
    'Helvetica',
    '"Source Han Sans SC"',    // 思源黑体 (另一种名称)
    'Arial',
    'sans-serif',              // 最终通用无衬线字体兜底
    '"Apple Color Emoji"'
  ],

  // 衬线字体 例如'"LXGW WenKai"'
  FONT_SERIF: [
    // '"LXGW WenKai"',
    'Bitter',
    '"Noto Serif SC"',         // 思源宋体
    'SimSun',                  // 宋体 (Windows 衬线)
    '"Times New Roman"',
    'Times',
    'serif',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
    '"Apple Color Emoji"'
  ],
  FONT_AWESOME:
    process.env.NEXT_PUBLIC_FONT_AWESOME_PATH ||
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' // font-awesome 字体图标地址; 可选 /css/all.min.css ， https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/font-awesome/6.0.0/css/all.min.css

  // END ************网站字体*****************
}
