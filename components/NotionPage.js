// components/NotionPage.js (附带完整诊断日志)

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
 * [带日志] 解析 Notion 页面中的 JSON 代码块
 */
function parseLessonData (blockMap) {
  console.log('[parseLessonData] 函数已调用。');

  if (!blockMap) {
    console.error('[parseLessonData] 致命错误:传入的 blockMap 为空或不存在。函数中止。', blockMap);
    return null;
  }
  console.log('[parseLessonData] 接收到的完整 blockMap:', blockMap);

  try {
    console.log('[parseLessonData] 开始遍历 blockMap 中的所有块...');
    for (const blockId in blockMap) {
      const block = blockMap[blockId]?.value;
      
      // 打印出每一个正在检查的块，方便我们看到所有内容
      console.log(`[parseLessonData] 正在检查 Block ID: ${blockId}`, block);

      if (block && block.type === 'code') {
        console.log(`[parseLessonData] ✅ 成功: 发现一个 'code' 类型的块 (ID: ${blockId}).`);
        
        const language = block.properties?.language?.[0]?.[0]?.toLowerCase();
        console.log(`[parseLessonData] 正在检查该代码块的语言设置... 语言是: '${language}'.`);

        if (language === 'json') {
          console.log('[parseLessonData] ✅ 成功: 语言是 "JSON"。准备解析内容。');
          
          try {
            const jsonString = block.properties.title[0][0];
            console.log('[parseLessonData] 提取出的 JSON 字符串内容:', jsonString);
            
            const parsedData = JSON.parse(jsonString);
            console.log('[parseLessonData] ✅ 成功: JSON.parse() 执行成功。解析出的数据对象:', parsedData);
            
            if (parsedData && parsedData.id && parsedData.title && Array.isArray(parsedData.blocks)) {
              console.log('[parseLessonData] ✅ 成功: 数据结构验证通过。将返回此数据。');
              return parsedData; // 找到并成功解析，直接返回结果
            } else {
              console.warn('[parseLessonData] ⚠️ 警告: 解析出的 JSON 对象不符合预期的课程格式 (缺少 id, title, 或 blocks 数组)。', parsedData);
            }
          } catch (error) {
            console.error(`[parseLessonData] ❌ 致命错误: 在解析来自块 ${blockId} 的 JSON 字符串时失败。`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('[parseLessonData] ❌ 致命错误: 在遍历 block 循环时发生意外错误。', error);
    return null; 
  }
  
  console.warn('[parseLessonData] ⚠️ 最终诊断: 遍历完所有块后，未找到任何有效的课程 JSON 数据。函数返回 null。');
  return null;
}

/**
 * !include 指令处理组件 (无修改)
 */
const CustomCode = (props) => { /* ... 此处代码无修改 ... */ };

/**
 * [带日志] 主页面渲染组件
 */
const NotionPage = (props) => {
  console.log('--- [NotionPage] 组件开始渲染 ---');
  const { post, className } = props;
  
  console.log('[NotionPage] 组件接收到的 `post` 属性对象:', post);

  const blockMap = post?.blockMap;
  console.log('[NotionPage] 从 `post` 中提取的 `blockMap`:', blockMap);

  const isLesson = post?.tags?.includes('Lesson');
  console.log(`[NotionPage] 检查 'Lesson' 标签... 结果: ${isLesson}`);

  if (isLesson) {
    console.log("[NotionPage] 判断为课程页面。准备调用 parseLessonData...");
    const lessonData = parseLessonData(blockMap);
    console.log('[NotionPage] parseLessonData 函数的返回结果是:', lessonData);
    
    if (lessonData) {
      console.log('[NotionPage] ✅ 成功: 获取到课程数据，准备渲染 <LessonPlayer />。');
      return <LessonPlayer lesson={lessonData} />;
    } else {
      console.log('[NotionPage] ❌ 失败: 未获取到课程数据，准备渲染错误提示页面。');
      return (
        <div className="fixed inset-0 bg-gray-100 flex items-center justify-center text-center p-4">
          <div className="p-8 bg-white rounded-lg shadow-xl max-w-lg">
            <h1 className="text-2xl font-bold text-red-600 mb-4">课程加载失败</h1>
            <p className="text-gray-700">此页面被标记为课程 (Lesson)，但未能找到有效的 JSON 数据块。</p>
            <p className="text-gray-500 mt-2 text-sm">请检查 Notion 页面中是否包含一个语言设置为 "JSON" 且格式正确的代码块。</p>
            <p className="text-xs text-gray-400 mt-4">(详细诊断信息请查看浏览器开发者控制台)</p>
          </div>
        </div>
      );
    }
  }

  console.log('[NotionPage] 判断为普通文章页面。准备渲染标准文章内容。');
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

// --- 辅助函数 (无修改) ---
const processDisableDatabaseUrl = () => { if (isBrowser) { const links = document.querySelectorAll('.notion-table a'); for (const e of links) { e.removeAttribute('href') } } }
const processGalleryImg = zoom => { setTimeout(() => { if (isBrowser) { const imgList = document?.querySelectorAll('.notion-collection-card-cover img'); if (imgList && zoom) { for (let i = 0; i < imgList.length; i++) { zoom.attach(imgList[i]) } } const cards = document.getElementsByClassName('notion-collection-card'); for (const e of cards) { e.removeAttribute('href') } } }, 800) }
const autoScrollToHash = () => { setTimeout(() => { const hash = window?.location?.hash; if (hash && hash.length > 0) { const tocNode = document.getElementById(hash.substring(1)); if (tocNode && tocNode?.className?.indexOf('notion') > -1) { tocNode.scrollIntoView({ block: 'start', behavior: 'smooth' }) } } }, 180); }
const mapPageUrl = id => { return '/' + id.replace(/-/g, '') }
function getMediumZoomMargin() { const width = window.innerWidth; if (width < 500) { return 8 } else if (width < 800) { return 20 } else if (width < 1280) { return 30 } else if (width < 1600) { return 40 } else if (width < 1920) { return 48 } else { return 72 } }

export default NotionPage;
