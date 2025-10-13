// lib/db/getBooks.js

import { getPage } from '@/lib/notion/getPostBlocks'
import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { idToUuid } from 'notion-utils'
import { getTagOptions } from './getSiteData'

/**
 * 获取指定数据库的所有数据
 * @param {string} databaseId - 您在 blog.config.js 中配置的图书数据库 ID
 * @returns {Promise<Array>} - 返回一个包含所有书籍属性的数组
 */
export async function getAllBooks({ databaseId }) {
  if (!databaseId) {
    return []
  }

  try {
    const pageRecordMap = await getPage(databaseId, 'books-db')
    if (!pageRecordMap) {
      console.error('无法获取图书数据库，请检查ID是否正确：', databaseId)
      return []
    }

    const id = idToUuid(databaseId)
    const block = pageRecordMap.block || {}
    const rawMetadata = block[id]?.value

    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view'
    ) {
      console.error(`ID "${id}" 不是一个 Notion 数据库。`)
      return []
    }

    const collection = Object.values(pageRecordMap.collection)[0]?.value || {}
    const schema = collection?.schema
    const pageIds = getAllPageIds(
      pageRecordMap.collection_query,
      rawMetadata?.collection_id,
      pageRecordMap.collection_view,
      rawMetadata?.view_ids
    )

    const data = []
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const value = block[pageId]?.value
      
      const properties = await getPageProperties(
        pageId,
        value,
        schema,
        null,
        getTagOptions(schema)
      )

      // 【最终修正：数据净化】
      if (properties && properties.status === 'Published') {
        
        // 1. 获取书名 (Title) - 标题列的值直接存在 properties.title 中
        const title = properties.title || '无标题';

        // 2. 获取分类 (Select)
        const category = properties.category || '未分类';

        // 3. 获取封面和链接 (URL / Text) - 使用属性名['列名']
        // 为了兼容性，我们使用一个辅助函数来安全地提取属性值
        const getPropertyVal = (key) => properties.property?.[key] || null;

        const imageUrl = getPropertyVal('封面链接');
        const readUrl = getPropertyVal('阅读链接');
        
        // 只有当封面和阅读链接都存在时，才添加到最终结果中
        if (imageUrl && readUrl && title) {
            const cleanBook = {
                id: properties.id,
                title: title,
                category: category,
                imageUrl: imageUrl, 
                readUrl: readUrl
            };
            data.push(cleanBook);
        }
      }
    }

    return data
  } catch (error) {
    console.error('获取图书数据时发生错误:', error)
    return []
  }
}
