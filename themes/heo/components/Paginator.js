// themes/heo/components/Paginator.js  <-- 新建这个文件

import Link from 'next/link'
import { useRouter } from 'next/router'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'

export const Paginator = ({ page, postCount }) => {
  const { NOTION_CONFIG } = useGlobal()
  const router = useRouter()
  const POSTS_PER_PAGE = siteConfig('POSTS_PER_PAGE', 12, NOTION_CONFIG)
  const totalPage = Math.ceil(postCount / POSTS_PER_PAGE)
  const currentPage = +page

  const pagePrefix = router.asPath.split('?')[0].replace(/\/page\/[0-9]+/, '').replace(/\/$/, '')

  if (totalPage <= 1) return null

  return (
    <div className="flex justify-between my-10 font-medium text-gray-700 dark:text-gray-300">
      <Link
        href={{
          pathname: currentPage - 1 === 1 ? `${pagePrefix}/` : `${pagePrefix}/page/${currentPage - 1}`,
          query: router.query
        }}
        passHref
      >
        <a className={`${currentPage === 1 ? 'invisible pointer-events-none' : 'block'} py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}>
          ← Previous
        </a>
      </Link>
      <div className="flex items-center">
        Page {currentPage} of {totalPage}
      </div>
      <Link
        href={{
          pathname: `${pagePrefix}/page/${currentPage + 1}`,
          query: router.query
        }}
        passHref
      >
        <a className={`${currentPage >= totalPage ? 'invisible pointer-events-none' : 'block'} py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}>
          Next →
        </a>
      </Link>
    </div>
  )
}
