// /components/NotionPage.js (最终修正版 - 只注册存在的组件)

import { siteConfig } from '@/lib/config'
import { compressImage, mapImgUrl } from '@/lib/notion/mapImage'
import { isBrowser, loadExternalResource } from '@/lib/utils'
import mediumZoom from '@fisch0920/medium-zoom'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { NotionRenderer } from 'react-notion-x'

// =============================================================================
// START: 自定义组件注册与渲染逻辑
// =============================================================================

// 1. 定义一个映射表，用于注册所有可以通过 !include 使用的组件
const CUSTOM_COMPONENTS_MAP = {
  // 【重要】只在这里注册您项目中真实存在的组件文件！
  // 确保 '/components/XuanZeTi.js' 这个文件存在于您的项目中。
  '/components/XuanZeTi.js': dynamic(() => import('@/components/XuanZeTi'), { ssr: false }),
  '/components/TingYinShiCi.js': dynamic(() => import('@/components/TingYinShiCi'), { ssr: false }),

  // 【未来扩展】当您创建了新的组件（如 TingYinShiCi.js）后，再来这里取消注释或添加新的一行。
  // '/components/TingYinShiCi.js': dynamic(() => import('@/components/TingYinShiCi'), { ssr: false }),
  // '/components/LianXianTi.js': dynamic(() => import('@/components/LianXianTi'), { ssr: false }),
  // '/components/BeiDanCi.js': dynamic(() => import('@/components/BeiDanCi'), { ssr: false }),
};

// 2. 辅助函数：从 Notion 的富文本数组中提取纯文本
const getTextContent = (richTextArray) => {
  return richTextArray?.map(segment => segment[0])?.join('') || '';
};

// 3. 默认的 Notion 代码块渲染器
const DefaultNotionCodeRenderer = dynamic(
  () => import('react-notion-x/build/third-party/code').then(m => m.Code),
  { ssr: false }
);

// 4. 创建一个自定义的 Code 块渲染器，用于拦截和处理 !include 命令
const CustomCodeRenderer = (props) => {
  const { block } = props;
  const codeContent = getTextContent(block.properties?.title);
  
  if (codeContent && codeContent.trim().startsWith('!include')) {
    try {
      const includeRegex = /^!include\s+(\S+)\s*(\{.*\})?$/s;
      const match = codeContent.trim().match(includeRegex);

      if (match) {
        const componentPath = match[1];
        const propsJsonString = match[2];
        const props = propsJsonString ? JSON.parse(propsJsonString) : {};

        const DynamicComponent = CUSTOM_COMPONENTS_MAP[componentPath];

        if (DynamicComponent) {
          return <DynamicComponent {...props} />;
        } else {
          return (
            <div className="p-3 my-2 text-red-700 bg-red-100 rounded-md">
              错误：自定义组件 "{componentPath}" 未在 NotionPage.js 中注册。
            </div>
          );
        }
      }
    } catch (e) {
      return (
        <div className="p-3 my-2 text-red-700 bg-red-100 rounded-md">
          错误：解析 !include 块失败。请检查 JSON 语法。
          <pre className="mt-2 text-sm whitespace-pre-wrap">{e.message}</pre>
        </div>
      );
    }
  }

  return <DefaultNotionCodeRenderer {...props} />;
};

// =============================================================================
// END: 自定义组件注册与渲染逻辑
// =============================================================================


/**
 * 整个站点的核心组件
 * 将Notion数据渲染成网页
 */
const NotionPage = ({ post, className }) => {
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK')
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK')
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG')

  const zoom = isBrowser && mediumZoom({ background: 'rgba(0, 0, 0, 0.2)', margin: getMediumZoomMargin() });
  const zoomRef = useRef(zoom ? zoom.clone() : null);
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200);

  useEffect(() => {
    autoScrollToHash();
  }, []);

  useEffect(() => {
    if (POST_DISABLE_GALLERY_CLICK) {
      processGalleryImg(zoomRef?.current);
    }
    if (POST_DISABLE_DATABASE_CLICK) {
      processDisableDatabaseUrl();
    }

    const observer = new MutationObserver((mutationsList) => {
      mutationsList.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target.classList.contains('medium-zoom-image--opened')) {
          setTimeout(() => {
            const src = mutation?.target?.getAttribute('src');
            mutation?.target?.setAttribute('src', compressImage(src, IMAGE_ZOOM_IN_WIDTH));
          }, 800);
        }
      });
    });

    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [post]);

  useEffect(() => {
    if (SPOILER_TEXT_TAG) {
      import('lodash/escapeRegExp').then(escapeRegExp => {
        Promise.all([
          loadExternalResource('/js/spoilerText.js', 'js'),
          loadExternalResource('/css/spoiler-text.css', 'css')
        ]).then(() => {
          window.textToSpoiler && window.textToSpoiler(escapeRegExp.default(SPOILER_TEXT_TAG));
        });
      });
    }

    const timer = setTimeout(() => {
      document.querySelectorAll('.notion-collection-page-properties')?.forEach(e => e.remove());
    }, 1000);

    return () => clearTimeout(timer);
  }, [post]);

  return (
    <div id='notion-article' className={`mx-auto overflow-hidden ${className || ''}`}>
      <NotionRenderer
        recordMap={post?.blockMap}
        mapPageUrl={mapPageUrl}
        mapImageUrl={mapImgUrl}
        components={{
          Code: CustomCodeRenderer,
          Collection,
          Equation,
          Modal,
          Pdf,
          Tweet
        }}
      />
      <AdEmbed />
      <PrismMac />
    </div>
  );
};


// 下面的所有代码都保持原样，无需修改
const processDisableDatabaseUrl = () => { if (isBrowser) { document.querySelectorAll('.notion-table a').forEach(e => e.removeAttribute('href')) } }
const processGalleryImg = zoom => { setTimeout(() => { if (isBrowser) { const imgs = document.querySelectorAll('.notion-collection-card-cover img'); if (imgs && zoom) { imgs.forEach(i => zoom.attach(i)) } document.querySelectorAll('.notion-collection-card').forEach(e => e.removeAttribute('href')) } }, 800) }
const autoScrollToHash = () => { setTimeout(() => { const hash = window?.location?.hash; if (hash) { const node = document.getElementById(hash.substring(1)); if (node) { node.scrollIntoView({ block: 'start', behavior: 'smooth' }) } } }, 180) }
const mapPageUrl = id => '/' + id.replace(/-/g, '')
function getMediumZoomMargin() { const w = window.innerWidth; if (w < 500) return 8; if (w < 800) return 20; if (w < 1280) return 30; if (w < 1600) return 40; if (w < 1920) return 48; return 72; }
const Equation = dynamic(() => import('@/components/Equation').then(async m => { await import('@/lib/plugins/mhchem'); return m.Equation }), { ssr: false });
const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), { ssr: false });
const PrismMac = dynamic(() => import('@/components/PrismMac'), { ssr: false });
const TweetEmbed = dynamic(() => import('react-tweet-embed'), { ssr: false });
const AdEmbed = dynamic(() => import('@/components/GoogleAdsense').then(m => m.AdEmbed), { ssr: true });
const Collection = dynamic(() => import('react-notion-x/build/third-party/collection').then(m => m.Collection), { ssr: true });
const Modal = dynamic(() => import('react-notion-x/build/third-party/modal').then(m => m.Modal), { ssr: false });
const Tweet = ({ id }) => <TweetEmbed tweetId={id} />;
export default NotionPage;
