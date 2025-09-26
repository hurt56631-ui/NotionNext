// components/NotionPage.js - 最终集成版

import { siteConfig } from '@/lib/config'
import { compressImage, mapImgUrl } from '@/lib/notion/mapImage'
import { isBrowser, loadExternalResource } from '@/lib/utils'
import mediumZoom from '@fisch0920/medium-zoom'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { NotionRenderer } from 'react-notion-x'

// --- 1. 导入你的所有自定义组件 ---
// <<<< 修改这里：引入新的 HanziModal
const HanziModal = dynamic(() => import('@/components/HanziModal'), { ssr: false }) 
const PaiXuTi = dynamic(() => import('@/components/Tixing/PaiXuTi'), { ssr: false })
const CiDianKa = dynamic(() => import('@/components/Tixing/CiDianKa'), { ssr: false })

// --- 2. 导入 react-notion-x 的原始组件 (保持不变) ---
const DefaultCodeComponent = dynamic(() => import('react-notion-x/build/third-party/code').then(m => m.Code), { ssr: false });
const Collection = dynamic(() => import('react-notion-x/build/third-party/collection').then(m => m.Collection), { ssr: true });
const Equation = dynamic(() => import('@/components/Equation').then(async m => { await import('@/lib/plugins/mhchem'); return m.Equation }), { ssr: false });
const Modal = dynamic(() => import('react-notion-x/build/third-party/modal').then(m => m.Modal), { ssr: false });
const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), { ssr: false });
const TweetEmbed = dynamic(() => import('react-tweet-embed'), { ssr: false });
const AdEmbed = dynamic(() => import('@/components/GoogleAdsense').then(m => m.AdEmbed), { ssr: true });
const PrismMac = dynamic(() => import('@/components/PrismMac'), { ssr: false });
const Tweet = ({ id }) => { return <TweetEmbed tweetId={id} /> }

// --- 3. 增强版的 Code 组件 ---
const CustomCode = (props) => {
  const blockContent = props.block.properties?.title?.[0]?.[0] || '';

  if (blockContent.startsWith('!include')) {
    const includeRegex = /!include\s+(\S+\.js)\s*({.*})?/s;
    const match = blockContent.match(includeRegex);

    if (match) {
      const componentPath = match[1];
      const propsString = match[2] || '{}';
      try {
        const parsedProps = JSON.parse(propsString);
        
        // --- 在这里添加你的组件判断逻辑 ---
        if (componentPath === '/components/Tixing/PaiXuTi.js') {
          return <PaiXuTi {...parsedProps} />;
        }
        // <<<< 修改这里：使用新的 HanziModal
        if (componentPath === '/components/HanziModal.js') {
          return <HanziModal {...parsedProps} />;
        }
        if (componentPath === '/components/Tixing/CiDianKa.js') {
          return <CiDianKa {...parsedProps} />;
        }

        return <div style={{ color: 'orange' }}>未找到组件: {componentPath}</div>;

      } catch (e) {
        console.error('!include JSON 解析失败:', e, `原始JSON字符串: "${propsString}"`);
        return <div style={{ padding: '1rem', border: '2px dashed red', color: 'red' }}>!include 块的 JSON 配置错误，请检查。</div>;
      }
    }
  }

  return <DefaultCodeComponent {...props} />;
};

// --- 主页面组件 (无改动) ---
const NotionPage = ({ post, className }) => {
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK')
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK')
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG')
  const zoom = isBrowser && mediumZoom({ background: 'rgba(0, 0, 0, 0.2)', margin: getMediumZoomMargin() })
  const zoomRef = useRef(zoom ? zoom.clone() : null)
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200)
  useEffect(() => { autoScrollToHash() }, [])
  useEffect(() => { if (POST_DISABLE_GALLERY_CLICK) { processGalleryImg(zoomRef?.current) } if (POST_DISABLE_DATABASE_CLICK) { processDisableDatabaseUrl() } const observer = new MutationObserver((mutationsList) => { mutationsList.forEach(mutation => { if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target.classList.contains('medium-zoom-image--opened')) { setTimeout(() => { const src = mutation?.target?.getAttribute('src'); mutation?.target?.setAttribute('src', compressImage(src, IMAGE_ZOOM_IN_WIDTH)) }, 800) } }) }); observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] }); return () => observer.disconnect() }, [post])
  useEffect(() => { if (SPOILER_TEXT_TAG) { import('lodash/escapeRegExp').then(escapeRegExp => { Promise.all([loadExternalResource('/js/spoilerText.js', 'js'), loadExternalResource('/css/spoiler-text.css', 'css')]).then(() => { window.textToSpoiler && window.textToSpoiler(escapeRegExp.default(SPOILER_TEXT_TAG)) }) }) } const timer = setTimeout(() => { const elements = document.querySelectorAll('.notion-collection-page-properties'); elements?.forEach(element => element?.remove()) }, 1000); return () => clearTimeout(timer) }, [post])
  
  return (
    <div id='notion-article' className={`mx-auto overflow-hidden ${className || ''}`}>
      <NotionRenderer
        recordMap={post?.blockMap}
        mapPageUrl={mapPageUrl}
        mapImageUrl={mapImgUrl}
        components={{
          Code: CustomCode,
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
  )
}

// --- 辅助函数 (无改动) ---
const processDisableDatabaseUrl = () => { if (isBrowser) { const links = document.querySelectorAll('.notion-table a'); for (const e of links) { e.removeAttribute('href') } } }
const processGalleryImg = zoom => { setTimeout(() => { if (isBrowser) { const imgList = document?.querySelectorAll('.notion-collection-card-cover img'); if (imgList && zoom) { for (let i = 0; i < imgList.length; i++) { zoom.attach(imgList[i]) } } const cards = document.getElementsByClassName('notion-collection-card'); for (const e of cards) { e.removeAttribute('href') } } }, 800) }
const autoScrollToHash = () => { setTimeout(() => { const hash = window?.location?.hash; if (hash && hash.length > 0) { const tocNode = document.getElementById(hash.substring(1)); if (tocNode && tocNode?.className?.indexOf('notion') > -1) { tocNode.scrollIntoView({ block: 'start', behavior: 'smooth' }) } }, 180) } }
const mapPageUrl = id => { return '/' + id.replace(/-/g, '') }
function getMediumZoomMargin() { const width = window.innerWidth; if (width < 500) { return 8 } else if (width < 800) { return 20 } else if (width < 1280) { return 30 } else if (width < 1600) { return 40 } else if (width < 1920) { return 48 } else { return 72 } }

export default NotionPage;
