// components/NotionPage.js (真正完整且已修正的最终版)

import { siteConfig } from '@/lib/config'
import { compressImage, mapImgUrl } from '@/lib/notion/mapImage'
import { isBrowser, loadExternalResource } from '@/lib/utils'
import mediumZoom from '@fisch0920/medium-zoom'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { NotionRenderer } from 'react-notion-x'

// --- 动态导入所有组件 ---
const LessonPlayer = dynamic(() => import('@/components/Tixing/LessonPlayer'), { ssr: false })
const HanziModal = dynamic(() => import('@/components/HanziModal'), { ssr: false })
const PhraseCard = dynamic(() => import('@/components/PhraseCard'), { ssr: false })
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false })
const PaiXuTi = dynamic(() => import('@/components/Tixing/PaiXuTi'), { ssr: false })
const TianKongTi = dynamic(() => import('@/components/Tixing/TianKongTi'), { ssr: false })
const GaiCuoTi = dynamic(() => import('@/components/Tixing/GaiCuoTi'), { ssr: false })
const FanYiTi = dynamic(() => import('@/components/Tixing/FanYiTi'), { ssr: false })
const TingLiZhuJu = dynamic(() => import('@/components/Tixing/TingLiZhuJu'), { ssr: false })
const CiDianKa = dynamic(() => import('@/components/Tixing/CiDianKa'), { ssr: false })
const GengDuTi = dynamic(() => import('@/components/Tixing/GengDuTi'), { ssr: false })
const PanDuanTi = dynamic(() => import('@/components/Tixing/PanDuanTi'), { ssr: false })
const XuanZeTi = dynamic(() => import('@/components/Tixing/XuanZeTi'), { ssr: false })
const AiTtsButton = dynamic(() => import('@/components/AiTtsButton'), { ssr: false })
const InteractiveHSKLesson = dynamic(() => import('@/components/Tixing/InteractiveHSKLesson'), { ssr: false })
const DefaultCodeComponent = dynamic(() => import('react-notion-x/build/third-party/code').then(m => m.Code), { ssr: false });
const Collection = dynamic(() => import('react-notion-x/build/third-party/collection').then(m => m.Collection), { ssr: true });
const Equation = dynamic(() => import('@/components/Equation').then(async m => { await import('@/lib/plugins/mhchem'); return m.Equation }), { ssr: false });
const Modal = dynamic(() => import('react-notion-x/build/third-party/modal').then(m => m.Modal), { ssr: false });
const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), { ssr: false });
const TweetEmbed = dynamic(() => import('react-tweet-embed'), { ssr: false });
const AdEmbed = dynamic(() => import('@/components/GoogleAdsense').then(m => m.AdEmbed), { ssr: true });
const PrismMac = dynamic(() => import('@/components/PrismMac'), { ssr: false });
const Tweet = ({ id }) => { return <TweetEmbed tweetId={id} /> }

/**
 * [已修正] 解析 Notion 页面中的 JSON 代码块
 */
function parseLessonData (blockMap) {
  if (!blockMap || !blockMap.block) {
    console.error('[parseLessonData] 错误: blockMap 或 blockMap.block 不存在。', blockMap);
    return null;
  }

  // 核心修正：我们必须遍历 blockMap.block 对象
  for (const blockId in blockMap.block) {
    const block = blockMap.block[blockId]?.value;
    
    if (block && block.type === 'code') {
      const language = block.properties?.language?.[0]?.[0]?.toLowerCase();
      if (language === 'json') {
        try {
          const jsonString = block.properties.title[0][0];
          const parsedData = JSON.parse(jsonString);
          if (parsedData && parsedData.id && parsedData.title && Array.isArray(parsedData.blocks)) {
            console.log('[parseLessonData] ✅ 成功找到并解析了课程JSON！');
            return parsedData;
          }
        } catch (error) {
          console.error(`[parseLessonData] ❌ 解析JSON时出错，块ID: ${blockId}`, error);
        }
      }
    }
  }

  console.warn('[parseLessonData] ⚠️ 遍历完成，未找到有效的课程JSON。');
  return null;
}

/**
 * [完整版] 增强版的 Code 组件，用于处理 !include 指令
 */
const CustomCode = (props) => {
  const blockContent = props.block.properties?.title?.[0]?.[0] || '';
  if (blockContent.startsWith('!include')) {
    const includeRegex = /!include\s+(\S+\.jsx?)\s*({.*})?/s;
    const match = blockContent.match(includeRegex);
    if (match) {
      const componentPath = match[1];
      const propsString = match[2] || '{}';
      try {
        const parsedProps = JSON.parse(propsString);
        if (componentPath === '/components/Tixing/PaiXuTi.js') return <PaiXuTi {...parsedProps} />;
        if (componentPath === '/components/HanziModal.js') return <HanziModal {...parsedProps} />;
        if (componentPath === '/components/AiTtsButton.js') return <AiTtsButton {...parsedProps} />;
        if (componentPath === '/components/PhraseCard.js') return <PhraseCard {...parsedProps} />;
        if (componentPath === '/components/Tixing/LianXianTi.js') return <LianXianTi {...parsedProps} />;
        if (componentPath === '/components/Tixing/FanYiTi.js') return <FanYiTi {...parsedProps} />;
        if (componentPath === '/components/Tixing/TianKongTi.js') return <TianKongTi {...parsedProps} />;
        if (componentPath === '/components/Tixing/GengDuTi.js') return <GengDuTi {...parsedProps} />;
        if (componentPath === '/components/Tixing/GaiCuoTi.js') return <GaiCuoTi {...parsedProps} />;
        if (componentPath.includes('InteractiveHSKLesson.jsx')) return <InteractiveHSKLesson lesson={parsedProps.lesson} />;
        if (componentPath === '/components/Tixing/TingLiZhuJu.js') return <TingLiZhuJu {...parsedProps} />;
        if (componentPath === '/components/Tixing/PanDuanTi.js') return <PanDuanTi {...parsedProps} />;
        if (componentPath === '/components/Tixing/XuanZeTi.js') return <XuanZeTi {...parsedProps} />;
        if (componentPath === '/components/Tixing/CiDianKa.js') return <CiDianKa {...parsedProps} />;
        return <div style={{ color: 'orange' }}>未找到组件: {componentPath}</div>;
      } catch (e) {
        console.error('!include JSON 解析失败:', e);
        return <div style={{ padding: '1rem', border: '2px dashed red', color: 'red' }}>!include 块的 JSON 配置错误。</div>;
      }
    }
  }
  return <DefaultCodeComponent {...props} />;
};

/**
 * 主页面渲染组件
 */
const NotionPage = (props) => {
  const { post, className } = props;
  const blockMap = post?.blockMap;

  const isLesson = post?.tags?.includes('Lesson');

  if (isLesson) {
    const lessonData = parseLessonData(blockMap);
    
    if (lessonData) {
      return <LessonPlayer lesson={lessonData} />;
    } else {
      return (
        <div className="fixed inset-0 bg-gray-100 flex items-center justify-center text-center p-4">
          <div className="p-8 bg-white rounded-lg shadow-xl max-w-lg">
            <h1 className="text-2xl font-bold text-red-600 mb-4">课程加载失败</h1>
            <p className="text-gray-700">此页面被标记为课程 (Lesson)，但未能找到有效的 JSON 数据块。</p>
            <p className="text-gray-500 mt-2 text-sm">请检查 Notion 页面中是否包含一个语言设置为 "JSON" 且格式正确的代码块。</p>
          </div>
        </div>
      );
    }
  }

  // --- 如果不是课程页面，则执行原来的普通文章渲染逻辑 ---
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK');
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK');
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG');
  const zoom = isBrowser && mediumZoom({ background: 'rgba(0, 0, 0, 0.2)', margin: getMediumZoomMargin() });
  const zoomRef = useRef(zoom ? zoom.clone() : null);
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200);
  
  useEffect(() => { autoScrollToHash() }, []);
  useEffect(() => { 
    if (POST_DISABLE_GALLERY_CLICK) { processGalleryImg(zoomRef?.current) } 
    if (POST_DISABLE_DATABASE_CLICK) { processDisableDatabaseUrl() } 
    const observer = new MutationObserver((mutationsList) => { 
        mutationsList.forEach(mutation => { 
            if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target.classList.contains('medium-zoom-image--opened')) { 
                setTimeout(() => { 
                    const src = mutation?.target?.getAttribute('src'); 
                    mutation?.target?.setAttribute('src', compressImage(src, IMAGE_ZOOM_IN_WIDTH)) 
                }, 800) 
            } 
        }) 
    }); 
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] }); 
    return () => observer.disconnect() 
  }, [post]);
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
        const elements = document.querySelectorAll('.notion-collection-page-properties'); 
        elements?.forEach(element => element?.remove()) 
    }, 1000); 
    return () => clearTimeout(timer) 
  }, [post]);
  
  return (
    <div id='notion-article' className={`mx-auto overflow-hidden ${className || ''}`}>
      <NotionRenderer
        recordMap={blockMap}
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

// --- 辅助函数 ---
const processDisableDatabaseUrl = () => { if (isBrowser) { const links = document.querySelectorAll('.notion-table a'); for (const e of links) { e.removeAttribute('href') } } }
const processGalleryImg = zoom => { setTimeout(() => { if (isBrowser) { const imgList = document?.querySelectorAll('.notion-collection-card-cover img'); if (imgList && zoom) { for (let i = 0; i < imgList.length; i++) { zoom.attach(imgList[i]) } } const cards = document.getElementsByClassName('notion-collection-card'); for (const e of cards) { e.removeAttribute('href') } } }, 800) }
const autoScrollToHash = () => { setTimeout(() => { const hash = window?.location?.hash; if (hash && hash.length > 0) { const tocNode = document.getElementById(hash.substring(1)); if (tocNode && tocNode?.className?.indexOf('notion') > -1) { tocNode.scrollIntoView({ block: 'start', behavior: 'smooth' }) } } }, 180); }
const mapPageUrl = id => { return '/' + id.replace(/-/g, '') }
function getMediumZoomMargin() { const width = window.innerWidth; if (width < 500) { return 8 } else if (width < 800) { return 20 } else if (width < 1280) { return 30 } else if (width < 1600) { return 40 } else if (width < 1920) { return 48 } else { return 72 } }

export default NotionPage;
