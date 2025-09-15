// components/NotionPage.js

import { siteConfig } from '@/lib/config'
import { compressImage, mapImgUrl } from '@/lib/notion/mapImage'
import { isBrowser, loadExternalResource } from '@/lib/utils'
import mediumZoom from '@fisch0920/medium-zoom'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { NotionRenderer } from 'react-notion-x'

// 导入您的自定义组件
const PronunciationPractice = dynamic(() => import('@/components/PronunciationPractice'), { ssr: false });
// 如果您有 TingYinShiCi 组件，也在这里导入
// const TingYinShiCi = dynamic(() => import('@/components/TingYinShiCi'), { ssr: false });

// 动态导入 react-notion-x 提供的原始 Code 组件，确保它在服务器端和客户端都可用
const Code = dynamic(
  () => import('react-notion-x/build/third-party/code').then(m => m.Code),
  { ssr: false } // 如果 NotionNext 的 SSR 不依赖它，可以设为 false
);

// 动态导入 react-notion-x 提供的其他组件
const Collection = dynamic(
  () =>
    import('react-notion-x/build/third-party/collection').then(
      m => m.Collection
    ),
  {
    ssr: true // Collection通常需要SSR
  }
)

const Equation = dynamic(
  () =>
    import('@/components/Equation').then(async m => {
      await import('@/lib/plugins/mhchem')
      return m.Equation
    }),
  { ssr: false }
)

const Modal = dynamic(
  () => import('react-notion-x/build/third-party/modal').then(m => m.Modal),
  { ssr: false }
)

const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), {
  ssr: false
})

const TweetEmbed = dynamic(() => import('react-tweet-embed'), {
  ssr: false
})

const AdEmbed = dynamic(
  () => import('@/components/GoogleAdsense').then(m => m.AdEmbed),
  { ssr: true }
)

const PrismMac = dynamic(() => import('@/components/PrismMac'), {
  ssr: false
})

const Tweet = ({ id }) => {
  return <TweetEmbed tweetId={id} />
}


/**
 * 整个站点的核心组件
 * 将Notion数据渲染成网页
 * @param {*} param0
 * @returns
 */
const NotionPage = ({ post, className }) => {
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK')
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK')
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG')

  const zoom =
    isBrowser &&
    mediumZoom({
      background: 'rgba(0, 0, 0, 0.2)',
      margin: getMediumZoomMargin()
    })

  const zoomRef = useRef(zoom ? zoom.clone() : null)
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200)

  useEffect(() => {
    autoScrollToHash()
  }, [])

  useEffect(() => {
    if (POST_DISABLE_GALLERY_CLICK) {
      processGalleryImg(zoomRef?.current)
    }

    if (POST_DISABLE_DATABASE_CLICK) {
      processDisableDatabaseUrl()
    }

    const observer = new MutationObserver((mutationsList, observer) => {
      mutationsList.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          if (mutation.target.classList.contains('medium-zoom-image--opened')) {
            setTimeout(() => {
              const src = mutation?.target?.getAttribute('src')
              mutation?.target?.setAttribute(
                'src',
                compressImage(src, IMAGE_ZOOM_IN_WIDTH)
              )
            }, 800)
          }
        }
      })
    })

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    })

    return () => {
      observer.disconnect()
    }
  }, [post])

  useEffect(() => {
    if (SPOILER_TEXT_TAG) {
      import('lodash/escapeRegExp').then(escapeRegExp => {
        Promise.all([
          loadExternalResource('/js/spoilerText.js', 'js'),
          loadExternalResource('/css/spoiler-text.css', 'css')
        ]).then(() => {
          window.textToSpoiler &&
            window.textToSpoiler(escapeRegExp.default(SPOILER_TEXT_TAG))
        })
      })
    }

    const timer = setTimeout(() => {
      const elements = document.querySelectorAll(
        '.notion-collection-page-properties'
      )
      elements?.forEach(element => {
        element?.remove()
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [post])

  // 辅助函数：解析 !include 语法
  const parseInclude = (textContent) => {
    const includeRegex = /^!include\s+(\S+?\.js)\s*({.*})?$/;
    const match = textContent.match(includeRegex);
    if (match) {
      const componentPath = match[1];
      const propsString = match[2] || '{}';
      try {
        const parsedProps = JSON.parse(propsString);
        return { componentPath, parsedProps };
      } catch (e) {
        console.error('Failed to parse props for !include block:', e, textContent);
        return null;
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
          // 在这里用自定义渲染器覆盖 NotinRenderer 的 Code 组件
          Code: (props) => {
            const blockContent = props.block.properties?.title?.[0]?.[0];
            if (blockContent) {
              const includeData = parseInclude(blockContent);
              if (includeData) {
                 const { componentPath, parsedProps } = includeData;
                 // 根据 componentPath 渲染不同的自定义组件
                 if (componentPath === '/components/PronunciationPractice.js') {
                   return <PronunciationPractice key={props.block.id} {...parsedProps} />;
                 }
                 // 如果有 TingYinShiCi，也在这里添加映射
                 // if (componentPath === '/components/TingYinShiCi.js') {
                 //   return <TingYinShiCi key={props.block.id} {...parsedProps} />;
                 // }
              }
            }
            // 如果不是 !include 块，则回退到 react-notion-x 提供的原始 Code 组件
            return <Code {...props} />;
          },
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

/**
 * 页面的数据库链接禁止跳转，只能查看
 */
const processDisableDatabaseUrl = () => {
  if (isBrowser) {
    const links = document.querySelectorAll('.notion-table a')
    for (const e of links) {
      e.removeAttribute('href')
    }
  }
}

/**
 * gallery视图，点击后是放大图片还是跳转到gallery的内部页面
 */
const processGalleryImg = zoom => {
  setTimeout(() => {
    if (isBrowser) {
      const imgList = document?.querySelectorAll(
        '.notion-collection-card-cover img'
      )
      if (imgList && zoom) {
        for (let i = 0; i < imgList.length; i++) {
          zoom.attach(imgList[i])
        }
      }

      const cards = document.getElementsByClassName('notion-collection-card')
      for (const e of cards) {
        e.removeAttribute('href')
      }
    }
  }, 800)
}

/**
 * 根据url参数自动滚动到锚位置
 */
const autoScrollToHash = () => {
  setTimeout(() => {
    const hash = window?.location?.hash
    const needToJumpToTitle = hash && hash.length > 0
    if (needToJumpToTitle) {
      console.log('jump to hash', hash)
      const tocNode = document.getElementById(hash.substring(1))
      if (tocNode && tocNode?.className?.indexOf('notion') > -1) {
        tocNode.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    }
  }, 180)
}

/**
 * 将id映射成博文内部链接。
 * @param {*} id
 * @returns
 */
const mapPageUrl = id => {
  return '/' + id.replace(/-/g, '')
}

/**
 * 缩放
 * @returns
 */
function getMediumZoomMargin() {
  const width = window.innerWidth

  if (width < 500) {
    return 8
  } else if (width < 800) {
    return 20
  } else if (width < 1280) {
    return 30
  } else if (width < 1600) {
    return 40
  } else if (width < 1920) {
    return 48
  } else {
    return 72
  }
}

export default NotionPage;
