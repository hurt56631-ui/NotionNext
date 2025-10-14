// lib/db/getShortSentences.js

import { getPage } from '@/lib/notion/getPostBlocks'
import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { idToUuid } from 'notion-utils'
import { pinyin } from 'pinyin-pro' 

export async function getAllShortSentences({ databaseId }) {
  if (!databaseId) {
    return []
  }

  try {
    const pageRecordMap = await getPage(databaseId, 'sentence-db-final')
    if (!pageRecordMap) { return [] }

    const id = idToUuid(databaseId)
    const block = pageRecordMap.block || {}
    const rawMetadata = block[id]?.value

    if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') {
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
      const properties = await getPageProperties(pageId, value, schema, null, null)
      
      const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');

      if (isPublished) {
        // 【最终简化】: 只获取核心的句子和翻译
        const chinese = properties['中文'] || '无内容';
        const burmese = properties['缅语'] || '';
        
        const categoryArray = properties['分类'];
        const category = (Array.isArray(categoryArray) && categoryArray.length > 0) ? categoryArray[0] : '未分类';

        if (chinese !== '无内容') {
            const cleanSentence = {
                id: properties.id,
                sentence: chinese,      // 对应卡片的正面
                translation: burmese,   // 对应卡片的反面
                pinyin: pinyin(chinese, { toneType: 'mark' }), // 自动为整个句子生成拼音
                category: category,
            };
            data.push(cleanSentence);
        }
      }
    }
    
    return data
  } catch (error) {
    console.error('获取短句数据时发生严重错误:', error)
    return []
  }
}
