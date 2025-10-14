// lib/db/getSentenceCards.js

import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { getPage } from '@/lib/notion/getPostBlocks'
import { idToUuid } from 'notion-utils'

export async function getSentenceCards({ databaseId }) {
    if (!databaseId) return [];
    try {
        const pageRecordMap = await getPage(databaseId, 'card-db');
        if (!pageRecordMap) return [];
        const id = idToUuid(databaseId);
        const block = pageRecordMap.block || {};
        const rawMetadata = block[id]?.value;
        if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') return [];

        const collection = Object.values(pageRecordMap.collection)[0]?.value || {};
        const schema = collection?.schema;

        // 【核心修正】: 修正 getAllPageIds 的调用方式，补上缺失的 block 参数
        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata.collection_id, pageRecordMap.collection_view, rawMetadata.view_ids, block);
        
        const data = [];
        for (const pageId of pageIds) {
          const value = block[pageId]?.value;
          const properties = await getPageProperties(pageId, value, schema, null, null);
          const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');
          if (isPublished) {
            const cleanTopic = { 
                id: properties.id, 
                word: properties['中文'] || '无内容', 
                meaning: properties['缅语'] || '', 
                example: properties['中文例句'] || '', 
                burmeseExample: properties['缅文例句'] || '', 
                pinyin: properties['拼音'] || null, 
                imageUrl: properties['图片'] || null, 
                courseIds: properties['所属课程'] || [] 
            };
            data.push(cleanTopic);
          }
        }
        return data;
    } catch (error) { 
        console.error('获取句子卡片时出错:', error); 
        return []; 
    }
}
