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
// 确保这个路径是正确的，并且文件名为 PronunciationPractice.js
const PronunciationPractice = dynamic(() => import('@/components/PronunciationPractice'), { ssr: false });
// 如果您有 TingYinShiCi 组件，也在这里导入
// const TingYinShiCi = dynamic(() => import('@/components/TingYinShiCi'), { ssr: false });


// 1. 定义一个映射表，用于注册所有可以通过 !include 使用的组件
// 注意：这里我们不再直接使用 CUSTOM_COMPONENTS_MAP 来映射，
// 而是通过一个解析函数来处理 `!include` 语句，
// 因为 NotionRenderer 的 components prop 主要用于覆盖原有的 Notion 块类型。
// 对于 `!include` 这种自定义语法，通常需要拦截 Notion 块的文本内容进行处理。

/**
 * 整个站点的核心组件
 * 将Notion数据渲染成网页
 * @param {*} param0
 * @returns
 */
const NotionPage = ({ post, className }) => {
  // 是否关闭数据库和画册的点击跳转
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK')
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK')
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG')

  const zoom =
    isBrowser &&
    mediumZoom({
      //   container: '.notion-viewport',
      background: 'rgba(0, 0, 0, 0.2)',
      margin: getMediumZoomMargin()
    })

  const zoomRef = useRef(zoom ? zoom.clone() : null)
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200)

  // 页面首次打开时执行的勾子
  useEffect(() => {
    // 检测当前的url并自动滚动到对应目标
    autoScrollToHash()
  }, [])

  // 页面文章发生变化时会执行的勾子
  useEffect(() => {
    // 相册视图点击禁止跳转，只能放大查看图片
    if (POST_DISABLE_GALLERY_CLICK) {
      // 针对页面中的gallery视图，点击后是放大图片还是跳转到gallery的内部页面
      processGalleryImg(zoomRef?.current)
    }

    // 页内数据库点击禁止跳转，只能查看
    if (POST_DISABLE_DATABASE_CLICK) {
      processDisableDatabaseUrl()
    }

    /**
     * 放大查看图片时替换成高清图像
     */
    const observer = new MutationObserver((mutationsList, observer) => {
      mutationsList.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          if (mutation.target.classList.contains('medium-zoom-image--opened')) {
            // 等待动画完成后替换为更高清的图像
            setTimeout(() => {
              // 获取该元素的 src 属性
              const src = mutation?.target?.getAttribute('src')
              //   替换为更高清的图像
              mutation?.target?.setAttribute(
                'src',
                compressImage(src, IMAGE_ZOOM_IN_WIDTH)
              )
            }, 800)
          }
        }
      })
    })

    // 监视页面元素和属性变化
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
    // Spoiler文本功能
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

    // 查找所有具有 'notion-collection-page-properties' 类的元素,删除notion自带的页面properties
    const timer = setTimeout(() => {
      // 查找所有具有 'notion-collection-page-properties' 类的元素
      const elements = document.querySelectorAll(
        '.notion-collection-page-properties'
      )

      // 遍历这些元素并将其从 DOM 中移除
      elements?.forEach(element => {
        element?.remove()
      })
    }, 1000) // 1000 毫秒 = 1 秒

    // 清理定时器，防止组件卸载时执行
    return () => clearTimeout(timer)
  }, [post])

  // ==================== Custom block rendering logic ====================
  // 这是一个自定义渲染器，用于处理 NotonRenderer 无法直接渲染的块，
  // 例如您通过 `!include` 语法嵌入的组件。
  const customRenderer = (block) => {
    // 检查是否是文本块或代码块，并尝试解析 !include 语句
    if (block.type === 'code' || block.type === 'text' || block.type === 'paragraph') {
      // 假设 !include 语句通常会出现在 code 块或单独的文本块中
      const blockContent = block.properties?.title?.[0]?.[0]; // 尝试获取块的文本内容
      if (blockContent) {
        const includeRegex = /^!include\s+(\S+?\.js)\s*({.*})?$/;
        const match = blockContent.match(includeRegex);

        if (match) {
          const componentPath = match[1]; // 例如 /components/PronunciationPractice.js
          const propsString = match[2] || '{}';
          try {
            const props = JSON.parse(propsString);

            // 根据 componentPath 映射到实际的 React 组件
            if (componentPath === '/components/PronunciationPractice.js') {
              return <PronunciationPractice key={block.id} {...props} />;
            }
            // 如果有 TingYinShiCi，也在这里添加映射
            // if (componentPath === '/components/TingYinShiCi.js') {
            //   return <TingYinShiCi key={block.id} {...props} />;
            // }

            // 如果匹配到 !include 但没有找到对应的组件，可以渲染一个错误提示
            return (
              <div key={block.id} style={{ color: 'red', border: '1px solid red', padding: '10px', margin: '10px 0' }}>
                Error: Custom component not found for path: {componentPath}
              </div>
            );

          } catch (e) {
            console.error('Failed to parse props for !include block:', e, blockContent);
            return (
              <div key={block.id} style={{ color: 'red', border: '1px solid red', padding: '10px', margin: '10px 0' }}>
                Error: Invalid JSON props for !include block: {blockContent}
              </div>
            );
          }
        }
      }
    }
    // 如果不是 !include 块，则返回 null，让 NotionRenderer 继续处理
    return null;
  };
  // ======================================================================

  return (
    <div
      id='notion-article'
      className={`mx-auto overflow-hidden ${className || ''}`}>
      <NotionRenderer
        recordMap={post?.blockMap}
        mapPageUrl={mapPageUrl}
        mapImageUrl={mapImgUrl}
        components={{
          Code,
          Collection,
          Equation,
          Modal,
          Pdf,
          Tweet,
          // 将 customRenderer 传入 NotionRenderer 的 overrideFn (或其他类似的自定义渲染钩子)
          // 注意：react-notion-x 并没有直接的 `overrideFn` prop。
          // 您可能需要修改 NotionNext 封装 `react-notion-x` 的地方来拦截块的渲染。
          // 另一个常见的方法是在 `components` prop 中针对 'code' 或 'text' 块类型进行自定义处理。
          // 这里的实现假设您需要拦截原始的 block 渲染流程。
          // 考虑到 NotionNext 框架通常会封装 NotionRenderer，
          // 最稳妥的方式是在您的 NotionNext 渲染器中，
          // 遍历 `post?.blockMap?.block` 时，对每个 block 调用 customRenderer。

          // 重新思考：更常见和直接的方式是修改 NotionNext 自己的渲染循环。
          // 例如，如果您的 NotionNext 是这样渲染块的：
          // post?.blockMap?.block && Object.values(post.blockMap.block).map(block => <RenderBlock key={block.id} block={block} />)
          // 那么您应该修改 RenderBlock 或其父级。

          // 暂时将这个逻辑放置在 NotionRenderer 的 components.Code 中，
          // 因为 NotionNext 的 !include 语法通常是通过 code 块实现的。
          // 如果您的 !include 不仅仅是 code 块，则需要更全面的拦截。
          Code: (props) => {
            const blockContent = props.block.properties?.title?.[0]?.[0];
            if (blockContent) {
              const includeData = parseInclude(blockContent); // 使用一个辅助函数
              if (includeData) {
                 const { componentPath, parsedProps } = includeData; // 辅助函数需要返回组件路径和解析后的 props
                 if (componentPath === '/components/PronunciationPractice.js') {
                   return <PronunciationPractice key={props.block.id} {...parsedProps} />;
                 }
                 // 其他自定义组件
              }
            }
            // 如果不是自定义组件，则回退到默认的 Code 渲染
            return <Code {...props} />;
          },
          // 确保其他组件也在这里
          // Code, // 这里需要注意，不能直接覆盖 Code，因为它也是个动态导入的组件
          // 您需要确保这个自定义的 Code 渲染器仍然能处理非 !include 的 Code 块。
          // 所以上面已经把原始的 Code 引入，并在条件不满足时返回它。
        }}
        // 由于直接修改 NotionRenderer 的 components.Code 可能会影响所有代码块，
        // 建议 NotionNext 框架会提供一个更高级的自定义块渲染机制。
        // 如果没有，或者您想快速测试，上面的 components.Code 方法可以作为一种尝试。
        // 更推荐的做法是修改 NotionNext 内部处理 block.type = 'code' 的地方。
      />

      <AdEmbed />
      <PrismMac />
    </div>
  )
}

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
    // 跳转到指定标题
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
  // return 'https://www.notion.so/' + id.replace(/-/g, '')
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

// 代码
// 注意：这里需要确保原始的 Code 组件依然可用，以便在自定义逻辑不匹配时回退
const OriginalCode = dynamic(
  () =>
    import('react-notion-x/build/third-party/code').then(m => {
      return m.Code
    }),
  { ssr: false }
)

// 公式
const Equation = dynamic(
  () =>
    import('@/components/Equation').then(async m => {
      // 化学方程式
      await import('@/lib/plugins/mhchem')
      return m.Equation
    }),
  { ssr: false }
)

// 原版文档
// const Pdf = dynamic(
//   () => import('react-notion-x/build/third-party/pdf').then(m => m.Pdf),
//   {
//     ssr: false
//   }
// )
const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), {
  ssr: false
})

// 美化代码 from: https://github.com/txs
const PrismMac = dynamic(() => import('@/components/PrismMac'), {
  ssr: false
})

/**
 * tweet嵌入
 */
const TweetEmbed = dynamic(() => import('react-tweet-embed'), {
  ssr: false
})

/**
 * 文内google广告
 */
const AdEmbed = dynamic(
  () => import('@/components/GoogleAdsense').then(m => m.AdEmbed),
  { ssr: true }
)

const Collection = dynamic(
  () =>
    import('react-notion-x/build/third-party/collection').then(
      m => m.Collection
    ),
  {
    ssr: true
  }
)

const Modal = dynamic(
  () => import('react-notion-x/build/third-party/modal').then(m => m.Modal),
  { ssr: false }
)

const Tweet = ({ id }) => {
  return <TweetEmbed tweetId={id} />
}

export default NotionPage
