// pages/short-videos/index.js

import VerticalShortVideoPlayer from '@/themes/heo/components/VerticalShortVideoPlayer'
// import { LayoutBase } from '@/themes/heo'; // 如果要全屏，不需要 LayoutBase

export default function ShortVideosPage() {
  return (
    // 直接渲染播放器，让它完全占满屏幕，通常短视频页面不需要额外的布局
    <VerticalShortVideoPlayer useProxy={false} />
  )
}
