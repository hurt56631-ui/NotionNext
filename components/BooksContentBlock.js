// components/BooksContentBlock.js

import { useMemo } from 'react'

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

const BooksContentBlock = ({ notionBooks }) => {
  // 【核心修改】数据分组逻辑也需要相应简化
  const groupedBooks = useMemo(() => {
    // 如果 notionBooks 不存在或不是数组，返回空数组
    if (!notionBooks || !Array.isArray(notionBooks)) return []

    const categories = {}

    notionBooks.forEach(book => {
      // 现在 book 对象非常干净，直接使用即可
      const category = book.category || '未分类'
      
      if (!categories[category]) {
        categories[category] = {
          category: category,
          items: []
        }
      }

      // 直接将干净的 book 对象 push 进去
      categories[category].items.push(book)
    })

    return Object.values(categories)
  }, [notionBooks])

  if (!groupedBooks || groupedBooks.length === 0) {
    return <p className="text-center text-gray-500">暂无书籍数据，请检查Notion数据库配置。</p>
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {groupedBooks.map(section => (
        <div key={section.category} className="bg-white dark:bg-gray-800/50 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50">
          <h2 className="font-bold text-2xl text-gray-900 dark:text-gray-100 mb-6">{section.category}</h2>
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
