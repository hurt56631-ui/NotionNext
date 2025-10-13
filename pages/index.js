// pages/index.js

import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
// import { getGlobalData, getPostBlocks } from '@/lib/db/getSiteData' // getPostBlocks 移到下方按需加载
import { getGlobalData, getPostBlocks } from '@/lib/db/getSiteData' // 保持原有导入
import { getAllBooks } from '@/lib/db/getBooks' // <--- 【新增】导入我们创建的图书获取函数
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

  // 2. 【新增】获取图书数据
  const databaseId = BLOG.NOTION_BOOK_DATABASE_ID
  let allBooks = []; // 默认一个空数组
  if (databaseId) {
    allBooks = await getAllBooks({ databaseId })
  }
  
  // --- 【新增】关键日志 ---
  // 打印在服务器端，即将发送到浏览器的最终数据
  console.log('\n================ VERCEL 服务端日志 (getStaticProps) ================');
  console.log(`【日志-服务端】获取到 ${allBooks.length} 本书的数据，准备将其作为 props 发送到浏览器。`);
  console.log('【日志-服务端】完整的 props.books 数据是:');
  console.log(JSON.stringify(allBooks, null, 2));
  console.log('====================================================================\n');
  // --- 日志结束 ---

  // 3. 【新增】将图书数据添加到 props 中
  props.books = allBooks;

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
