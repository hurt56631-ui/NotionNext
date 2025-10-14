// lib/db/getSentenceCards.js
import { getPageProperties, getAllPageIds, getPage } from '@/lib/notion/getNotionData'
import { idToUuid } from 'notion-utils'

export async function getSentenceCards({ databaseId }) {
    if (!databaseId) {
        console.warn('【日志-卡片】警告: 未提供句子卡片的 Database ID。');
        return [];
    }
    try {
        console.log('【日志-卡片】开始获取句子卡片, Database ID:', databaseId);
        const pageRecordMap = await getPage(databaseId, 'card-db-debug');
        if (!pageRecordMap) {
            console.error('【日志-卡片】错误: 无法获取卡片数据库的 pageRecordMap。');
            return [];
        }
        const id = idToUuid(databaseId);
        const block = pageRecordMap.block || {};
        const rawMetadata = block[id]?.value;
        if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') return [];

        const collection = Object.values(pageRecordMap.collection)[0]?.value || {};
        const schema = collection?.schema;
        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata?.collection_id, pageRecordMap.collection_view, rawMetadata?.view_ids);

        console.log(`【日志-卡片】在卡片库中找到了 ${pageIds.length} 个页面。`);
        const data = [];

        for (let i = 0; i < pageIds.length; i++) {
          const pageId = pageIds[i];
          const value = block[pageId]?.value;
          const properties = await getPageProperties(pageId, value, schema, null, null);

          // --- 【终极诊断日志】 ---
          console.log(`\n--- 正在诊断卡片 #${i + 1} (ID: ${pageId}) ---`);
          console.log('【日志-卡片-诊断】该卡片的完整 properties 对象结构是:');
          console.log(JSON.stringify(properties, null, 2));
          console.log('-------------------------------------------\n');
          // --- 日志结束 ---

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
        console.log(`【日志-卡片】成功处理并返回了 ${data.length} 张已发布的卡片。`);
        return data;
    } catch (error) { 
        console.error('【日志-卡片】获取句子卡片时出错:', error); 
        return []; 
    }
}
