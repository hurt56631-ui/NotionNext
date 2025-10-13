// components/BooksContentBlock.js

import { useMemo } from 'react'

/**
 * 单个书籍卡片的组件
 * @param {{item: {readUrl: string, imageUrl: string, title: string}}} param0
 * @returns
 */
const BookItem = ({ item }) => (
    <a
      href={item.readUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
      title={item.title}
    >
      <div className="relative aspect-[3/4] w-full bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <p className="text-white text-center font-semibold">{item.title}</p>
        </div>
      </div>
    </a>
)

/**
 * 图书列表内容块
 * @param {{notionBooks: Array<any>}} param0
 * @returns
 */
const BooksContentBlock = ({ notionBooks }) => {
  // 使用 useMemo 进行数据转换，将Notion返回的扁平数据按“分类”进行分组
  // 只有当 notionBooks  prop 发生变化时，才会重新计算
  const groupedBooks = useMemo(() => {
    if (!notionBooks) return []

    const categories = {} // 使用一个对象来存放不同分类的书籍

    notionBooks.forEach(book => {
      // 从 Notion API 的返回结果中提取我们需要的属性
      // !!! 重要: 下方的'分类', '书名', '封面链接', '阅读链接' 必须和您在Notion数据库中设置的属性名完全一致
      const category = book.properties?.['分类']?.select?.name || '未分类'
      const title = book.properties?.['书名']?.title[0]?.plain_text
      const imageUrl = book.properties?.['封面链接']?.url
      const readUrl = book.properties?.['阅读链接']?.url

      // 如果关键信息不全，则跳过这本书，避免页面报错
      if (!title || !imageUrl || !readUrl) {
        return
      }

      // 如果这个分类在categories对象中还不存在，就初始化一个
      if (!categories[category]) {
        categories[category] = {
          category: category,
          items: []
        }
      }

      // 将当前这本书添加到对应的分类下
      categories[category].items.push({
        id: book.id,
        title,
        imageUrl,
        readUrl
      })
    })

    // 将 categories 对象转换为组件渲染时需要的数组格式 [ {category: 'xx', items: [...]}, ... ]
    return Object.values(categories)
  }, [notionBooks])

  // 如果没有数据，显示提示信息
  if (!groupedBooks || groupedBooks.length === 0) {
    return <p className="text-center text-gray-500">暂无书籍数据，请检查Notion数据库配置。</p>
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {groupedBooks.map(section => (
        <div key={section.category} className="bg-white dark:bg-gray-800/50 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50">
          {/* 分类标题 */}
          <h2 className="font-bold text-2xl text-gray-900 dark:text-gray-100 mb-6">{section.category}</h2>

          {/* 书籍封面网格 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {section.items.map(item => (
                <BookItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default BooksContentBlock
