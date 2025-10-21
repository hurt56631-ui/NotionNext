// themes/heo/components/LayoutLesson.js (全屏修复版)

import { TTSProvider, InteractiveLessonBlock } from '@/components/Tixing/InteractiveHSKLesson'
import { Style } from '../style'

// 解析 Notion 数据块的函数 (保持不变)
function parseLessonData(blockMap) {
  if (!blockMap || !blockMap.block) return null
  try {
    for (const blockId in blockMap.block) {
      const block = blockMap.block[blockId].value
      if (block.type === 'code' && block.properties?.language?.[0]?.[0]?.toLowerCase() === 'json') {
        const jsonString = block.properties.title[0][0]
        return JSON.parse(jsonString)
      }
    }
  } catch (error) {
    console.error('解析课程JSON数据失败:', error)
    return null
  }
  return null
}

export default function LayoutLesson(props) {
  const { blockMap } = props
  const lesson = parseLessonData(blockMap)

  const saveProgress = (p) => {
    console.log('正在保存进度:', p)
  }
  
  if (!lesson) {
    return (
        <div className="text-center text-red-500 font-bold p-10">
            错误：未在此 Notion 页面中找到有效的课程 JSON 数据块。
        </div>
    )
  }

  // ✅ 核心修改：这里不再使用 LayoutBase，而是直接渲染一个占满全屏的容器
  return (
    <div id='theme-heo' className='h-screen w-screen bg-slate-800 overflow-hidden'>
      <Style />
      <TTSProvider>
        {/* InteractiveLessonBlock 组件现在是唯一的子元素，可以占满整个屏幕 */}
        <InteractiveLessonBlock lesson={lesson} onProgress={saveProgress} />
      </TTSProvider>
    </div>
  )
}
