// pages/books.js

import { getAllPosts } from '@/lib/notion'
import BLOG from '@/blog.config'
import { useGlobal } from '@/lib/global'
import BooksContentBlock from '@/components/BooksContentBlock'
import { getLayoutByTheme } from '@/themes/theme'

/**
 * 图书页面
 * @param {*} props
 * @returns
 */
export default function Books(props) {
  const { locale } = useGlobal()
  const { Layout, ...layoutProps } = getLayoutByTheme({ ...props, theme: BLOG.THEME })

  const meta = {
    title: `${locale.NAV.BOOKS} | ${BLOG.TITLE}`,
    description: BLOG.BIO,
    type: 'website'
  }

  return (
    <Layout {...layoutProps} meta={meta}>
      <main className="md:py-8 py-4 px-2">
         {/* 将获取到的notion数据传递给BooksContentBlock组件 */}
        <BooksContentBlock notionBooks={props.books} />
      </main>
    </Layout>
  )
}

export async function getStaticProps() {
  // 从配置中获取图书数据库ID
  const databaseId = BLOG.NOTION_BOOK_DATABASE_ID
  // 从Notion获取所有书籍数据
  const allBooks = await getAllPosts({
    databaseId,
    // 如果您想按分类排序，可以在Notion数据库中添加一个'Sort'或'排序'字段，并在这里指定
    // sort: [{ property: 'Sort', direction: 'ascending' }], 
    from: 'books-page' // 自定义一个标识，避免与文章列表冲突
  })

  return {
    props: {
      books: allBooks
    },
    revalidate: BLOG.NEXT_REVALIDATE_SECOND
  }
}
