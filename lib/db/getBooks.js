// lib/db/getBooks.js

import { getPage } from '@/lib/notion/getPostBlocks'
import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { idToUuid } from 'notion-utils'

// 【最终修正】: 在函数声明前添加 'export' 关键字
export async function getAllBooks({ databaseId }) {
  if (!databaseId) {
    return []
  }

  try {
    const pageRecordMap = await getPage(databaseId, 'books-db-final')
    if (!pageRecordMap) {
      return []
    }

    const id = idToUuid(databaseId)
    const block = pageRecordMap.block || {}
    const rawMetadata = block[id]?.value

    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view'
    ) {
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
        null 
      )
      
      const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');

      if (isPublished) {
        
        const title = properties['书名'] || '无标题';
        const imageUrl = properties['封面链接'] || null;
        const readUrl = properties['阅读链接'] || null;
        
        const categoryArray = properties['分类'];
        const category = (Array.isArray(categoryArray) && categoryArray.length > 0) ? categoryArray[0] : '未分类';

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
    console.error('获取图书数据时发生严重错误:', error)
    return []
  }
}
