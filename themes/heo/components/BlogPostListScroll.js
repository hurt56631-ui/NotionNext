// themes/heo/components/BlogPostListScroll.js

import BlogPostCard from './BlogPostCard'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { useEffect, useRef, useState } from 'react'
import { Paginator } from './Paginator' // 确保 Paginator 被正确导入

/**
 * 博客列表滚动分页 (新版)
 * @param posts 所有文章
 * @param postCount 文章总数
 * @returns {JSX.Element}
 * @constructor
 */
export default function BlogPostListScroll({ posts = [], postCount }) {
  const [page, setPage] = useState(1)
  const { NOTION_CONFIG } = useGlobal()
  const POSTS_PER_PAGE = siteConfig('POSTS_PER_PAGE', 12, NOTION_CONFIG)
  const totalPage = Math.ceil(postCount / POSTS_PER_PAGE)
  const showNext = page < totalPage
  
  // 根据当前页码过滤要显示的文章
  const filteredPosts = posts.slice(0, page * POSTS_PER_PAGE)

  const targetRef = useRef(null)
  const { locale } = useGlobal()

  // 使用 IntersectionObserver 监听滚动，实现无限加载
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && showNext) {
          setTimeout(() => {
            setPage(prevPage => prevPage + 1)
          }, 100)
        }
      },
      { threshold: 0.1 } // 当目标元素 10% 可见时触发
    )

    const currentTarget = targetRef.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [page, showNext])

  return (
     <div id="posts-wrapper" className="w-full">
        {/* 文章卡片网格布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {filteredPosts.map(post => (
                <BlogPostCard key={post.id} post={post} />
            ))}
        </div>

        {/* “加载更多”或“没有更多了”的提示 */}
        <div ref={targetRef} className="w-full my-6 py-4 text-center text-gray-500 dark:text-gray-400">
            {showNext ? (
              <span>{locale.COMMON.MORE}</span>
            ) : (
              // 当没有更多文章时，根据文章总数决定是否显示分页器
              postCount > 0 && totalPage > 1 && <Paginator page={page} postCount={postCount} />
            )}
        </div>
    </div>
  )
}
