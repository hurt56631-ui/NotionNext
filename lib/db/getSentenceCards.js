// lib/db/getSentenceCards.js

import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { getPage } from '@/lib/notion/getPostBlocks'
import { idToUuid } from 'notion-utils'

export async function getSentenceCards({ databaseId }) {
    if (!databaseId) return [];
    try {
        const pageRecordMap = await getPage(databaseId, 'card-db-final');
        if (!pageRecordMap) return [];
        const id = idToUuid(databaseId);
        const block = pageRecordMap.block || {};
        const rawMetadata = block[id]?.value;
        if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') return [];

        const collection = Object.values(pageRecordMap.collection)[0]?.value || {};
        const schema = collection?.schema;

        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata.collection_id, pageRecordMap.collection_view, rawMetadata.view_ids, block);
        
        const data = [];
        for (const pageId of pageIds) {
          const value = block[pageId]?.value;
          const properties = await getPageProperties(pageId, value, schema, null, null);
          const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');

          if (isPublished) {
            // 【核心修正】: 关联属性的值深埋在原始 value 对象中
            // 我们需要从原始的 block[pageId].value.properties 中手动提取它
            let courseIds = [];
            const relationProperty = Object.entries(schema).find(([, v]) => v.name === '所属课程')?.[0];
            if (relationProperty && value.properties?.[relationProperty]) {
                courseIds = value.properties[relationProperty][1][0][1].map(relation => relation[1]);
            }
            
            const cleanTopic = { 
                id: properties.id, 
                word: properties['中文'] || '无内容', 
                meaning: properties['缅语'] || '', 
                example: properties['中文例句'] || '', 
                burmeseExample: properties['缅文例句'] || '', 
                pinyin: properties['拼音'] || null, 
                imageUrl: properties['图片'] || null, 
                courseIds: courseIds // 使用我们手动提取出的 courseIds
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
