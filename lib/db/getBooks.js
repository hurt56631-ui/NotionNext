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
  // 如果没有配置ID，直接返回空数组
  if (!databaseId) {
    return []
  }

  try {
    // 1. 获取数据库的原始记录
    const pageRecordMap = await getPage(databaseId, 'books-db')
    if (!pageRecordMap) {
      console.error('无法获取图书数据库，请检查ID是否正确：', databaseId)
      return []
    }

    const id = idToUuid(databaseId)
    const block = pageRecordMap.block || {}
    const rawMetadata = block[id]?.value

    // 2. 检查数据库类型是否正确
    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view'
    ) {
      console.error(`ID "${id}" 不是一个 Notion 数据库。`)
      return []
    }

    // 3. 提取数据库的核心信息
    const collection = Object.values(pageRecordMap.collection)[0]?.value || {}
    const collectionId = rawMetadata?.collection_id
    const collectionQuery = pageRecordMap.collection_query
    const collectionView = pageRecordMap.collection_view
    const schema = collection?.schema
    const viewIds = rawMetadata?.view_ids

    // 4. 获取数据库中所有页面的 ID 列表
    const pageIds = getAllPageIds(
      collectionQuery,
      collectionId,
      collectionView,
      viewIds
    )

    const data = []
    // 5. 遍历所有页面 ID，获取每个页面的详细属性
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const value = block[pageId]?.value
      
      // 使用 getPageProperties 函数来格式化每个页面的数据
      const properties = await getPageProperties(
        pageId,
        value,
        schema,
        null,
        getTagOptions(schema)
      )
      
      // 只需要发布的书籍
      if (properties && properties.status === 'Published') {
        data.push(properties)
      }
    }

    return data
  } catch (error) {
    console.error('获取图书数据时发生错误:', error)
    return [] // 即使出错也返回空数组，防止网站崩溃
  }
}
