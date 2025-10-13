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

      // 【核心修改】在这里进行数据净化
      if (properties && properties.status === 'Published') {
        // 从复杂的 properties 对象中，只提取我们需要的、干净的字符串数据
        const cleanBook = {
            id: properties.id,
            title: properties.title || '无标题',
            category: properties.category || '未分类',
            // 注意这里的属性名，必须和您Notion数据库的列名完全一致
            imageUrl: properties.property?.[ '封面链接'] || null, 
            readUrl: properties.property?.[ '阅读链接'] || null
        };

        // 只有当封面和阅读链接都存在时，才添加到最终结果中
        if (cleanBook.imageUrl && cleanBook.readUrl) {
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
