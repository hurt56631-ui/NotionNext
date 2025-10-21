// themes/heo/components/LayoutLesson.js

import { TTSProvider, InteractiveLessonBlock } from '@/components/Tixing/InteractiveHSKLesson'
import { useGlobal } from '@/lib/global'
import Footer from './Footer'
import Header from './Header'
import { Style } from '../style'
import { siteConfig } from '@/lib/config'
import LoadingCover from '@/components/LoadingCover'

/**
 * 解析 Notion 数据块，找到并返回课程的 JSON 数据
 * @param {object} blockMap - NotionNext 传递的页面所有数据块
 * @returns {object|null} 解析后的 lesson JSON 对象，或 null
 */
function parseLessonData(blockMap) {
  if (!blockMap || !blockMap.block) return null
  try {
    // 遍历页面上的所有块
    for (const blockId in blockMap.block) {
      const block = blockMap.block[blockId].value
      // 找到类型为 'code' 并且语言是 'JSON' 的块
      if (block.type === 'code' && block.properties?.language?.[0]?.[0]?.toLowerCase() === 'json') {
        const jsonString = block.properties.title[0][0]
        // 解析并返回 JSON 数据
        return JSON.parse(jsonString)
      }
    }
  } catch (error) {
    console.error('解析课程JSON数据失败:', error)
    return null // 解析失败返回 null
  }
  return null // 没有找到 JSON 块
}


export default function LayoutLesson(props) {
  const { blockMap, post } = props
  const { fullWidth } = useGlobal()

  // 解析课程数据
  const lesson = parseLessonData(blockMap)

  // 保存进度的函数 (您可以对接您的后端)
  const saveProgress = (p) => {
    console.log('正在保存进度:', p)
  }
  
  // 如果没有找到有效的课程数据，显示一个友好的提示
  if (!lesson) {
    return (
        <div className="text-center text-red-500 font-bold p-10">
            错误：未在此 Notion 页面中找到有效的课程 JSON 数据块。
        </div>
    )
  }

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-slate-800 h-full min-h-screen flex flex-col scroll-smooth`}>
      <Style />
      <Header {...props} />
      <main id='wrapper-outer' className={`flex-grow w-full ${fullWidth ? 'max-w-[96rem]' : 'max-w-[86rem]'} mx-auto relative md:px-5`}>
        <TTSProvider>
            <div className="min-h-screen py-10 px-4">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-3xl font-extrabold text-white mb-6 text-center">{lesson.title || post.title}</h1>
                    <InteractiveLessonBlock lesson={lesson} onProgress={saveProgress} />
                </div>
            </div>
        </TTSProvider>
      </main>
      <Footer />
      {siteConfig('HEO_LOADING_COVER', true, CONFIG) && <LoadingCover />}
    </div>
  )
}
