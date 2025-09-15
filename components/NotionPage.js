// components/NotionPage.js

import { siteConfig } from '@/lib/config'
import { compressImage, mapImgUrl } from '@/lib/notion/mapImage'
import { isBrowser, loadExternalResource } from '@/lib/utils'
import mediumZoom from '@fisch0920/medium-zoom'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { NotionRenderer } from 'react-notion-x'

// --- 导入您的所有自定义组件 ---
const PronunciationPractice = dynamic(() => import('@/components/PronunciationPractice'), { ssr: false });
const MotionTest = dynamic(() => import('@/components/MotionTest'), { ssr: false });
const HanziWriterPractice = dynamic(() => import('@/components/HanziWriterPractice'), { ssr: false });
const SentenceScramble = dynamic(() => import('@/components/SentenceScramble'), { ssr: false });
const SwipeableFlashcard = dynamic(() => import('@/components/SwipeableFlashcard'), { ssr: false }); // <-- 新增：导入 SwipeableFlashcard 组件
const MediaPlayer = dynamic(() => import('@/components/MediaPlayer'), { ssr: false }); // <-- 补上：导入 MediaPlayer 组件

// 动态导入 react-notion-x 提供的原始 Code 组件
const Code = dynamic(
  () => import('react-notion-x/build/third-party/code').then(m => m.Code),
  { ssr: false }
);

// ... 其他组件导入 (保持不变) ...
const Collection = dynamic(() => import('react-notion-x/build/third-party/collection').then(m => m.Collection),{ ssr: true });
const Equation = dynamic(() => import('@/components/Equation').then(async m => { await import('@/lib/plugins/mhchem'); return m.Equation }), { ssr: false });
const Modal = dynamic(() => import('react-notion-x/build/third-party/modal').then(m => m.Modal), { ssr: false });
const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), { ssr: false });
const TweetEmbed = dynamic(() => import('react-tweet-embed'), { ssr: false });
const AdEmbed = dynamic(() => import('@/components/GoogleAdsense').then(m => m.AdEmbed), { ssr: true });
const PrismMac = dynamic(() => import('@/components/PrismMac'), { ssr: false });
const Tweet = ({ id }) => { return <TweetEmbed tweetId={id} /> }


/**
 * 整个站点的核心组件
 * 将Notion数据渲染成网页
 * @param {*} param0
 * @returns
 */
const NotionPage = ({ post, className }) => {
  // ... useEffect 和其他 Hooks (保持不变) ...
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK')
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK')
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG')
  const zoom = isBrowser && mediumZoom({ background: 'rgba(0, 0, 0, 0.2)', margin: getMediumZoomMargin() })
  const zoomRef = useRef(zoom ? zoom.clone() : null)
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200)
  useEffect(() => { autoScrollToHash() }, [])
  useEffect(() => {
    if (POST_DISABLE_GALLERY_CLICK) { processGalleryImg(zoomRef?.current) }
    if (POST_DISABLE_DATABASE_CLICK) { processDisableDatabaseUrl() }
    const observer = new MutationObserver((mutationsList, observer) => {
      mutationsList.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (mutation.target.classList.contains('medium-zoom-image--opened')) {
            setTimeout(() => {
              const src = mutation?.target?.getAttribute('src')
              mutation?.target?.setAttribute('src', compressImage(src, IMAGE_ZOOM_IN_WIDTH))
            }, 800)
          }
        }
      })
    })
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] })
    return () => { observer.disconnect() }
  }, [post])
  useEffect(() => {
    if (SPOILER_TEXT_TAG) {
      import('lodash/escapeRegExp').then(escapeRegExp => {
        Promise.all([
          loadExternalResource('/js/spoilerText.js', 'js'),
          loadExternalResource('/css/spoiler-text.css', 'css')
        ]).then(() => {
          window.textToSpoiler && window.textToSpoiler(escapeRegExp.default(SPOILER_TEXT_TAG))
        })
      })
    }
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll('.notion-collection-page-properties')
      elements?.forEach(element => { element?.remove() })
    }, 1000)
    return () => clearTimeout(timer)
  }, [post])

  // --- 关键修复：更新 parseInclude 函数 ---
  const parseInclude = (textContent) => {
    // 移除所有换行符和多余的空格，让正则表达式更容易匹配
    const cleanedText = textContent.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, " ");
    
    // 使用更健壮的正则表达式，匹配到第一个 '{' 和最后一个 '}'
    const includeRegex = /!include\s+(\S+?\.js)\s*({.*})?/;
    const match = cleanedText.match(includeRegex);

    if (match) {
      const componentPath = match[1];
      const propsString = match[2] || '{}';
      try {
        const parsedProps = JSON.parse(propsString);
        return { componentPath, parsedProps };
      } catch (e) {
        console.error('Failed to parse JSON props for !include block:', e, `Original text: "${textContent}"`, `Cleaned text: "${cleanedText}"`);
        // 返回一个明确的错误信号，而不是 null
        return { error: 'JSON_PARSE_ERROR' }; 
      }
    }
    return null;
  };


  return (
    <div
      id='notion-article'
      className={`mx-auto overflow-hidden ${className || ''}`}>
      <NotionRenderer
        recordMap={post?.blockMap}
        mapPageUrl={mapPageUrl}
        mapImageUrl={mapImgUrl}
        components={{
          Code: (props) => {
            const blockContent = props.block.properties?.title?.[0]?.[0];
            if (blockContent) {
              const includeData = parseInclude(blockContent);
              
              // 检查是否有解析错误
              if (includeData && !includeData.error) {
                 const { componentPath, parsedProps } = includeData;
                 // --- 根据 componentPath 渲染不同的自定义组件 ---
                 if (componentPath === '/components/PronunciationPractice.js') {
                   return <PronunciationPractice key={props.block.id} {...parsedProps} />;
                 }
                 if (componentPath === '/components/MotionTest.js') {
                   return <MotionTest key={props.block.id} {...parsedProps} />;
                 }
                 if (componentPath === '/components/HanziWriterPractice.js') {
                    return <HanziWriterPractice key={props.block.id} {...parsedProps} />;
                 }
                 if (componentPath === '/components/SentenceScramble.js') {
                    return <SentenceScramble key={props.block.id} {...parsedProps} />;
                 }
                 if (componentPath === '/components/MediaPlayer.js') { // <-- 补上：添加 MediaPlayer 渲染规则
                    return <MediaPlayer key={props.block.id} {...parsedProps} />;
                 }
                 if (componentPath === '/components/SwipeableFlashcard.js') { // <-- 新增：添加 SwipeableFlashcard 渲染规则
                    return <SwipeableFlashcard key={props.block.id} {...parsedProps} />;
                 }
              } else if (includeData && includeData.error) {
                  // 如果解析 JSON 失败，显示一个错误组件
                  return <div style={{padding: '1rem', border: '2px dashed red', color: 'red'}}>!include 块的 JSON 配置错误，请检查 Notion 页面。</div>
              }
            }
            // 如果不是 !include 块，或解析失败，则回退到原始 Code 组件
            return <Code {...props} />;
          },
          // ... 其他组件 (保持不变) ...
          Collection,
          Equation,
          Modal,
          Pdf,
          Tweet,
        }}
      />

      <AdEmbed />
      <PrismMac />
    </div>
  )
}

// ==================== 以下是辅助函数，无需修改 ====================
// ... (所有辅助函数保持不变) ...
const processDisableDatabaseUrl = () => { if (isBrowser) { const links = document.querySelectorAll('.notion-table a'); for (const e of links) { e.removeAttribute('href') } } }
const processGalleryImg = zoom => { setTimeout(() => { if (isBrowser) { const imgList = document?.querySelectorAll('.notion-collection-card-cover img'); if (imgList && zoom) { for (let i = 0; i < imgList.length; i++) { zoom.attach(imgList[i]) } } const cards = document.getElementsByClassName('notion-collection-card'); for (const e of cards) { e.removeAttribute('href') } } }, 800) }
const autoScrollToHash = () => { setTimeout(() => { const hash = window?.location?.hash; const needToJumpToTitle = hash && hash.length > 0; if (needToJumpToTitle) { console.log('jump to hash', hash); const tocNode = document.getElementById(hash.substring(1)); if (tocNode && tocNode?.className?.indexOf('notion') > -1) { tocNode.scrollIntoView({ block: 'start', behavior: 'smooth' }) } } }, 180) }
const mapPageUrl = id => { return '/' + id.replace(/-/g, '') }
function getMediumZoomMargin() { const width = window.innerWidth; if (width < 500) { return 8 } else if (width < 800) { return 20 } else if (width < 1280) { return 30 } else if (width < 1600) { return 40 } else if (width < 1920) { return 48 } else { return 72 } }

export default NotionPage;
