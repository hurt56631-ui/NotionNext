// themes/heo/components/BlogPostListPage.js

import BlogPostCard from './BlogPostCard'
import { Paginator } from './Paginator' // 确保 Paginator 被正确导入
import BlogPostListEmpty from './BlogPostListEmpty' // 确保空状态组件被导入

/**
 * 博客列表分页 (新版)
 * @param page 当前页
 * @param posts 当前页的文章
 * @param postCount 文章总数
 * @returns {JSX.Element}
 * @constructor
 */
const BlogPostListPage = ({ page, posts, postCount }) => {
  if (!posts || posts.length === 0) {
    return <BlogPostListEmpty />;
  }
  
  return (
    <div className="w-full">
        {/* 文章卡片网格布局 */}
        <div id="posts-wrapper" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts?.map(post => (
                <BlogPostCard key={post.id} post={post} />
            ))}
        </div>
        
        {/* 分页器 */}
        <Paginator page={page} postCount={postCount} />
    </div>
  )
}

export default BlogPostListPage
