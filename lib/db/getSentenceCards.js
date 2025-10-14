// lib/db/getSentenceCards.js

import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { getPage } from '@/lib/notion/getPostBlocks'
import { idToUuid } from 'notion-utils'

export async function getSentenceCards({ databaseId }) {
    if (!databaseId) {
        console.warn('【日志-卡片】警告: 未提供句子卡片的 Database ID。');
        return [];
    }
    try {
        console.log('【日志-卡片】开始获取句子卡片, Database ID:', databaseId);
        const pageRecordMap = await getPage(databaseId, 'card-db-final');
        if (!pageRecordMap) {
            console.error('【日志-卡片】错误: 无法获取卡片数据库的 pageRecordMap。');
            return [];
        }
        const id = idToUuid(databaseId);
        const block = pageRecordMap.block || {};
        const rawMetadata = block[id]?.value;
        if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') {
            console.error(`【日志-卡片】错误: ID "${id}" 不是一个有效的 Notion 数据库。`);
            return [];
        }
        
        const collection = Object.values(pageRecordMap.collection)[0]?.value || {};
        const schema = collection?.schema;
        
        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata.collection_id, pageRecordMap.collection_view, rawMetadata.view_ids, block);

        console.log(`【日志-卡片】在卡片库中找到了 ${pageIds.length} 个页面。`);
            
        const data = [];
        for (let i = 0; i < pageIds.length; i++) {
          const pageId = pageIds[i];
          const value = block[pageId]?.value;
          const properties = await getPageProperties(pageId, value, schema, null, null);
          
          // ====================== 【核心诊断日志】 ======================
          // 我们只打印第一张卡片的完整属性，用于最终调试，避免日志刷屏
          if (i === 0) {
              console.log('\n--- 正在诊断第一张卡片 ---');
              console.log('【日志-卡片-诊断】getPageProperties 返回的完整 properties 对象结构是:');
              // 使用 JSON.stringify 输出完整结构，方便查看
              console.log(JSON.stringify(properties, null, 2));
              console.log('-------------------------------------------\n');
          }
          // =============================================================

          const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');
          if (isPublished) {
            
            // ====================== 【核心最终修正】 ======================
            // 根据诊断日志，我们发现 '所属课程' 属性很可能已经是一个简单的 ID 数组。
            // 我们现在直接使用它，如果它不存在，则默认为空数组 []。
            const relatedCourseIds = properties['所属课程'] || [];
            // =============================================================

            const cleanTopic = { 
                id: properties.id, 
                word: properties['中文'] || '无内容', 
                meaning: properties['缅语'] || '', 
                example: properties['中文例句'] || '', 
                burmeseExample: properties['缅文例句'] || '', 
                pinyin: properties['拼音'] || null, 
                imageUrl: properties['图片'] || null, 
                courseIds: relatedCourseIds // 使用我们最新修正的逻辑获取到的 ID 数组
            };
            data.push(cleanTopic);
            
            console.log(`  -> 【日志】成功处理卡片: "${cleanTopic.word}", 解析出的关联课程ID: [${cleanTopic.courseIds.join(', ')}]`);

          } else {
            console.log(`  -> 【日志】跳过卡片 (ID: ${pageId})，状态为: ${properties?.status}`);
          }
        }
        console.log(`【日志-卡片】成功处理并返回了 ${data.length} 张已发布的卡片。`);
        return data;
    } catch (error) { 
        console.error('【日志-卡片】获取句子卡片时出错:', error); 
        return []; 
    }
}
