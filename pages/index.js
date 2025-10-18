// pages/index.js (最终修复版，移除错误的 getAllPosts 导入)

import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { getGlobalData, getPostBlocks } from '@/lib/db/getSiteData' // 移除 getAllPosts 的导入
import { getAllBooks } from '@/lib/db/getBooks'
import { getSpeakingCourses } from '@/lib/db/getSpeakingCourses'
import { getSentenceCards } from '@/lib/db/getSentenceCards'
import { getWords } from '@/lib/db/getWords' // 【新增】引入 getWords 函数
import { generateRobotsTxt } from '@/lib/robots.txt'
import { generateRss } from '@/lib/rss'
import { generateSitemapXml } from '@/lib/sitemap.xml'
import { DynamicLayout } from '@/themes/theme'
import { generateRedirectJson } from '@/lib/redirect'
import { checkDataFromAlgolia } from '@/lib/plugins/algolia'

/**
 * 首页布局
 * @param {*} props
 * @returns
 */
const Index = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutIndex' {...props} />
}

/**
 * SSG 获取数据
 * @returns
 */
export async function getStaticProps(req) {
  const { locale } = req
  const from = 'index'
  // 1. 先获取主要的站点数据
  const props = await getGlobalData({ from, locale })

  // 2. 并行获取所有额外的数据库数据
  const [allBooks, speakingCourses, sentenceCards, allWords] = await Promise.all([ // 【新增】allWords
    getAllBooks({ databaseId: BLOG.NOTION_BOOK_DATABASE_ID }),
    getSpeakingCourses({ databaseId: BLOG.NOTION_SPEAKING_COURSE_ID }),
    getSentenceCards({ databaseId: BLOG.NOTION_SENTENCE_CARD_ID }),
    getWords({ databaseId: BLOG.NOTION_HSK_WORD_ID, notionHost: BLOG.API_BASE_URL }) // 【新增】调用 getWords
  ]);

  // --- 【核心修正】: 增强服务端日志，用于最终确认 ---
  console.log('\n================ VERCEL 服务端日志 (getStaticProps) ================');
  console.log(`【日志-服务端】获取到 ${allBooks?.length ?? 0} 本书。`);
  console.log(`【日志-服务端】获取到 ${speakingCourses?.length ?? 0} 个口语课程。`);
  console.log(`【日志-服务端】获取到 ${sentenceCards?.length ?? 0} 张句子卡片。`);
  console.log(`【日志-服务端】获取到 ${allWords?.length ?? 0} 个 HSK 单词。`); // 【新增】单词日志
  if (allWords?.length > 0) {
    // 假设 WordCard 需要 id, chinese, burmese, pinyin, tags 属性
    console.log('【日志-服务端】HSK 单词样本:', JSON.stringify(allWords.slice(0, 2).map(w => ({
        id: w.id, 
        chinese: w.title, 
        burmese: w.translation || w.meaning || w.释义, 
        pinyin: w.pinyin, 
        tags: w.tag
    })), null, 2));
  }
  console.log('====================================================================\n');


  // 3. 将所有获取到的数据添加到 props 中
  props.books = allBooks || [];
  props.speakingCourses = speakingCourses || [];
  props.sentenceCards = sentenceCards || [];
  props.allWords = allWords || []; // 【新增】将全部单词数据注入 props

  // 4. 继续处理文章数据（沿用您原有的逻辑）
  const POST_PREVIEW_LINES = siteConfig(
    'POST_PREVIEW_LINES',
    12,
    props?.NOTION_CONFIG
  )
  // 这里使用的是 props.allPages，它是由 getGlobalData 提供的，不受 getAllPosts 导入的影响
  props.posts = props.allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )

  // 处理分页
  if (siteConfig('POST_LIST_STYLE') === 'scroll') {
    // 滚动列表默认给前端返回所有数据
  } else if (siteConfig('POST_LIST_STYLE') === 'page') {
    props.posts = props.posts?.slice(
      0,
      siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)
    )
  }

  // 预览文章内容
  if (siteConfig('POST_LIST_PREVIEW', false, props?.NOTION_CONFIG)) {
    for (const i in props.posts) {
      const post = props.posts[i]
      if (post.password && post.password !== '') {
        continue
      }
      post.blockMap = await getPostBlocks(post.id, 'slug', POST_PREVIEW_LINES)
    }
  }

  // 5. 继续执行您原有的其他构建任务
  generateRobotsTxt(props)
  generateRss(props)
  generateSitemapXml(props)
  checkDataFromAlgolia(props)
  if (siteConfig('UUID_REDIRECT', false, props?.NOTION_CONFIG)) {
    generateRedirectJson(props)
  }

  delete props.allPages

  return {
    props,
    revalidate: process.env.EXPORT
      ? undefined
      : siteConfig(
          'NEXT_REVALIDATE_SECOND',
          BLOG.NEXT_REVALIDATE_SECOND,
          props.NOTION_CONFIG
        )
  }
}

export default Index
