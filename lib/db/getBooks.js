// lib/db/getBooks.js

import { getPage } from '@/lib/notion/getPostBlocks'
import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { idToUuid } from 'notion-utils'

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
    const pageRecordMap = await getPage(databaseId, 'books-db-debug')
    if (!pageRecordMap) {
      console.error('【日志-错误】无法获取图书数据库，请检查ID是否正确：', databaseId)
      return []
    }

    const id = idToUuid(databaseId)
    const block = pageRecordMap.block || {}
    const rawMetadata = block[id]?.value

    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view'
    ) {
      console.error(`【日志-错误】ID "${id}" 不是一个 Notion 数据库。`)
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

    console.log(`【日志-源头】在图书数据库中找到了 ${pageIds.length} 个页面(书籍)。`);

    const data = []
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const value = block[pageId]?.value
      
      const properties = await getPageProperties(
        pageId,
        value,
        schema,
        null,
        null 
      )
      
      // --- 【最终极诊断日志】 ---
      // 打印每一本书从Notion获取到的、经过getPageProperties处理后的完整对象
      // 这是我们解决问题的唯一钥匙！
      console.log(`\n--- 正在诊断第 ${i + 1} 本书 (ID: ${pageId}) ---`);
      console.log('【日志-诊断】这本书的完整 properties 对象结构是:');
      // 使用 JSON.stringify 确保能看到所有嵌套内容
      console.log(JSON.stringify(properties, null, 2));
      console.log('-------------------------------------------\n');
      // --- 日志结束 ---

      // 为了确保日志能打印，我们暂时只处理第一本书就跳出循环
      if (i === 0) {
        break;
      }
    }
    
    console.log(`【日志-诊断】诊断完成，已打印第一本书的数据结构。`);
    return data; // 返回空数组是正常的，因为我们只为诊断
  } catch (error) {
    console.error('【日志-错误】获取图书数据时发生严重错误:', error)
    return []
  }
}
