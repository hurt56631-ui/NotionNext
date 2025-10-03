// pages/video.js
import VerticalShortVideoPlayer from '@/themes/heo/components/VerticalShortVideoPlayer';
import { useGlobal } from '@/lib/global';

/**
 * 全屏短视频页面
 * 这个页面将只渲染视频播放器组件，以实现沉浸式体验
 */
const ShortVideoPage = () => {
  const { locale } = useGlobal(); // 如果您的组件需要多语言支持，可以保留

  return <VerticalShortVideoPlayer useProxy={true} />;
};

/**
 * 这是实现全屏的关键：
 * 我们通过定义一个 getLayout 函数并直接返回 page，
 * 来告诉 NotionNext/Next.js：“这个页面不需要使用网站的默认布局（例如页眉、页脚等）”。
 */
ShortVideoPage.getLayout = function getLayout(page) {
  return page;
};

export default ShortVideoPage;
