// components/BooksContentBlock.js
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const BookItem = ({ item }) => (
  <motion.a
    href={item.readUrl}
    target="_blank"
    rel="noopener noreferrer"
    title={item.title}
    whileHover={{ scale: 1.05 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className="group block relative rounded-xl overflow-hidden shadow-md hover:shadow-2xl bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700"
  >
    <div className="aspect-[3/4] w-full overflow-hidden rounded-xl">
      <img
        src={item.imageUrl}
        alt={item.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
    </div>
    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-center font-semibold px-2">{item.title}</p>
    </div>
  </motion.a>
)

const BooksContentBlock = ({ notionBooks }) => {
  // --- 日志 ---
  console.log('\n================ 浏览器客户端日志 (BooksContentBlock) ================')
  console.log(`【日志-客户端】组件收到了 notionBooks prop，包含 ${notionBooks?.length ?? 0} 项数据。`)
  console.log('【日志-客户端】接收到的 notionBooks prop 完整数据是:')
  console.log(notionBooks)
  console.log('====================================================================\n')

  const groupedBooks = useMemo(() => {
    if (!notionBooks || !Array.isArray(notionBooks)) return []
    const categories = {}
    notionBooks.forEach(book => {
      const category = book.category || '未分类'
      if (!categories[category]) {
        categories[category] = {
          category,
          items: []
        }
      }
      categories[category].items.push(book)
    })
    return Object.values(categories)
  }, [notionBooks])

  if (!groupedBooks || groupedBooks.length === 0) {
    return <p className="text-center text-gray-500">暂无书籍数据，请检查 Notion 数据库配置。</p>
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {groupedBooks.map(section => (
        <CategorySection key={section.category} section={section} />
      ))}
    </div>
  )
}

const CategorySection = ({ section }) => {
  const [expanded, setExpanded] = useState(false)

  const toggleExpanded = () => setExpanded(prev => !prev)

  const visibleItems = expanded ? section.items : section.items.slice(0, 3)

  return (
    <div
      className="relative bg-white/80 dark:bg-gray-800/60 p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/40 backdrop-blur-md transition-all duration-500"
    >
      {/* 分类标题 + 查看更多 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-bold text-2xl sm:text-3xl text-gray-900 dark:text-gray-100 tracking-tight">
          {section.category}
        </h2>
        {section.items.length > 3 && (
          <button
            onClick={toggleExpanded}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {expanded ? '收起 ▲' : '查看更多 ▼'}
          </button>
        )}
      </div>

      {/* 动画显示书籍区域 */}
      <AnimatePresence initial={false}>
        <motion.div
          key={expanded ? 'expanded' : 'collapsed'}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {visibleItems.map(item => (
              <BookItem key={item.id} item={item} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default BooksContentBlock
