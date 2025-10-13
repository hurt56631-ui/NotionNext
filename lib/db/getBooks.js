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
        getTagOptions(schema)
      )

      // --- 关键日志 ---
      // 打印每一本书从Notion获取到的最原始的、处理过的属性对象
      console.log(`\n--- 正在处理第 ${i + 1} 本书 (ID: ${pageId}) ---`);
      console.log('【日志-源头】这本书的完整 properties 对象是:');
      // 使用 JSON.stringify 确保能看到所有嵌套内容
      console.log(JSON.stringify(properties, null, 2));
      console.log('-------------------------------------------\n');
      // --- 日志结束 ---

      if (properties && properties.status === 'Published') {
        
        const title = properties.title || '无标题';
        const category = properties.category || '未分类';
        
        const getPropertyVal = (key) => properties.property?.[key] || null;
        const imageUrl = getPropertyVal('封面链接');
        const readUrl = getPropertyVal('阅读链接');
        
        if (imageUrl && readUrl && title) {
            const cleanBook = {
                id: properties.id,
                title: title,
                category: category,
                imageUrl: imageUrl, 
                readUrl: readUrl
            };
            data.push(cleanBook);
        } else {
            console.log(`【日志-源头】警告：书籍 "${title}" 因缺少封面或链接而被跳过。`);
        }
      } else {
        console.log(`【日志-源头】警告：书籍 (ID: ${pageId}) 因状态不是 'Published' 而被跳过。当前状态: ${properties.status}`);
      }
    }
    
    console.log(`【日志-源头】成功处理并净化了 ${data.length} 本书的数据。`);
    return data
  } catch (error) {
    console.error('【日志-错误】获取图书数据时发生严重错误:', error)
    return []
  }
}
