// conf/layout-map.config.js

/**
 * 这是一个动态决定布局的函数。
 * NotionNext 会在渲染每个页面前，调用这个函数，并传入页面的详细数据 (post)。
 * 我们可以通过检查 post 的属性（比如标签），来返回一个特定的布局名称，从而覆盖默认的路径匹配规则。
 * 
 * @param {object} post - NotionNext 从 Notion API 获取的完整页面数据对象。
 * @returns {string | null} - 返回布局组件的名称（例如 'LayoutLesson'），或者返回 null 以继续使用默认规则。
 */
const getLayoutByPost = (post) => {
  // 检查 post 对象是否存在，并且 post.tags 是否是一个包含 'Lesson' 的数组。
  if (post && post.tags && Array.isArray(post.tags) && post.tags.includes('Lesson')) {
    // 如果满足条件，就告诉系统使用我们为课程专门创建的 'LayoutLesson' 布局。
    return 'LayoutLesson'
  }
  
  // 如果不满足以上条件（即不是一个课程页面），则返回 null。
  // 返回 null 会让 NotionNext 继续使用下面的 LAYOUT_MAPPINGS 进行常规的 URL 路径匹配。
  return null
}

module.exports = {
  /**
   * 静态的 URL 路径到布局组件的映射。
   * 这是 NotionNext 的默认行为，作为我们的“兜底”规则。
   * 比如，访问首页 '/' 总是使用 'LayoutIndex'。
   * 访问文章页 '/posts/my-article' 会匹配到 '/[prefix]/[slug]'，从而使用 'LayoutSlug'。
   */
  LAYOUT_MAPPINGS: {
    '-1': 'LayoutBase',
    '/': 'LayoutIndex',
    '/archive': 'LayoutArchive',
    '/page/[page]': 'LayoutPostList',
    '/category/[category]': 'LayoutPostList',
    '/category/[category]/page/[page]': 'LayoutPostList',
    '/tag/[tag]': 'LayoutPostList',
    '/tag/[tag]/page/[page]': 'LayoutPostList',
    '/search': 'LayoutSearch',
    '/search/[keyword]': 'LayoutSearch',
    '/search/[keyword]/page/[page]': 'LayoutSearch',
    '/404': 'Layout404',
    '/tag': 'LayoutTagIndex',
    '/category': 'LayoutCategoryIndex',
    '/[prefix]': 'LayoutSlug',
    '/[prefix]/[slug]': 'LayoutSlug',
    '/[prefix]/[slug]/[...suffix]': 'LayoutSlug',
    '/auth/result': 'LayoutAuth',
    '/sign-in/[[...index]]': 'LayoutSignIn',
    '/sign-up/[[...index]]': 'LayoutSignUp',
    '/dashboard/[[...index]]': 'LayoutDashboard'
  },

  /**
   * 导出我们的动态布局函数。
   * NotionNext 的核心逻辑会优先调用这个函数。只有当这个函数返回 null 时，才会去使用上面的 LAYOUT_MAPPINGS。
   */
  getLayoutByPost
}
