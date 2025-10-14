// pages/index.js

import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { getGlobalData, getPostBlocks } from '@/lib/db/getSiteData'
import { getAllBooks } from '@/lib/db/getBooks'
import { getSpeakingCourses } from '@/lib/db/getSpeakingCourses'
import { getSentenceCards } from '@/lib/db/getSentenceCards'
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
  const [allBooks, speakingCourses, sentenceCards] = await Promise.all([
    getAllBooks({ databaseId: BLOG.NOTION_BOOK_DATABASE_ID }),
    getSpeakingCourses({ databaseId: BLOG.NOTION_SPEAKING_COURSE_ID }),
    getSentenceCards({ databaseId: BLOG.NOTION_SENTENCE_CARD_ID })
  ]);

  // --- 【新增】服务端日志 ---
  console.log('\n================ VERCEL 服务端日志 (getStaticProps) ================');
  console.log(`【日志-服务端】获取到 ${allBooks?.length ?? 0} 本书。`);
  console.log(`【日志-服务端】获取到 ${speakingCourses?.length ?? 0} 个口语课程。`);
  console.log(`【日志-服务端】获取到 ${sentenceCards?.length ?? 0} 张句子卡片。`);
  // 为了调试，打印一部分获取到的数据样本
  if (speakingCourses?.length > 0) {
    console.log('【日志-服务端】口语课程样本:', JSON.stringify(speakingCourses.slice(0, 2), null, 2));
  }
  if (sentenceCards?.length > 0) {
    console.log('【日志-服务端】句子卡片样本:', JSON.stringify(sentenceCards.slice(0, 2), null, 2));
  }
  console.log('====================================================================\n');
  // --- 日志结束 ---


  // 3. 将所有获取到的数据添加到 props 中
  props.books = allBooks || [];
  props.speakingCourses = speakingCourses || [];
  props.sentenceCards = sentenceCards || [];

  // 4. 继续处理文章数据（沿用您原有的逻辑）
  const POST_PREVIEW_LINES = siteConfig(
    'POST_PREVIEW_LINES',
    12,
    props?.NOTION_CONFIG
  )
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
  // 生成robotTxt
  generateRobotsTxt(props)
  // 生成Feed订阅
  generateRss(props)
  // 生成
  generateSitemapXml(props)
  // 检查数据是否需要从algolia删除
  checkDataFromAlgolia(props)
  if (siteConfig('UUID_REDIRECT', false, props?.NOTION_CONFIG)) {
    // 生成重定向 JSON
    generateRedirectJson(props)
  }

  // 生成全文索引 - 仅在 yarn build 时执行 && process.env.npm_lifecycle_event === 'build'

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
