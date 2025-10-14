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
        const pageRecordMap = await getPage(databaseId, 'card-db-final-defensive');
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
        // 使用 for...of 循环，更清晰
        for (const [index, pageId] of pageIds.entries()) {
          console.log(`\n--- [循环开始] 正在处理第 ${index + 1} 张卡片, Page ID: ${pageId} ---`);
          
          let properties;
          try {
            const value = block[pageId]?.value;
            // 如果 value 不存在，说明页面数据有问题，直接跳过
            if (!value) {
                console.warn(`  -> 【日志-警告】找不到 Page ID: ${pageId} 的 value 数据块，跳过此卡片。`);
                continue; // 继续下一个循环
            }

            console.log('  -> [步骤1] 即将调用 getPageProperties...');
            properties = await getPageProperties(pageId, value, schema, null, null);
            console.log('  -> [步骤2] getPageProperties 调用成功。');

            // 打印诊断日志
            console.log('  -> [步骤3] 【日志-卡片-诊断】获取到的属性 (properties) 结构如下:');
            console.log(JSON.stringify(properties, null, 2));

          } catch (error) {
            console.error(`  -> [步骤2-错误] 在为 Page ID: ${pageId} 调用 getPageProperties 时发生严重错误！`);
            console.error(error);
            console.log('  -> [步骤3-跳过] 由于上述错误，将跳过此卡片的处理。');
            continue; // 出错了，就跳过这张卡片，继续处理下一张
          }

          // 确保 properties 存在才继续
          if (!properties) {
              console.warn('  -> 【日志-警告】获取到的 properties 为空，无法处理此卡片。');
              continue;
          }

          const isPublished = properties.status === 'Published' || properties.status === 'P';
          if (isPublished) {
            console.log('  -> [步骤4] 卡片状态为 "Published"，准备提取数据...');
            const relatedCourseIds = properties['所属课程'] || [];
            
            const cleanTopic = { 
                id: properties.id, 
                word: properties['中文'] || '无内容', 
                meaning: properties['缅语'] || '', 
                example: properties['中文例句'] || '', 
                burmeseExample: properties['缅文例句'] || '', 
                pinyin: properties['拼音'] || null, 
                imageUrl: properties['图片'] || null, 
                courseIds: relatedCourseIds
            };
            data.push(cleanTopic);
            
            console.log(`  -> [步骤5-成功] 成功处理卡片: "${cleanTopic.word}", 解析出的关联课程ID: [${cleanTopic.courseIds.join(', ')}]`);

          } else {
            console.log(`  -> [步骤4-跳过] 跳过卡片，状态为: ${properties.status}`);
          }
          console.log(`--- [循环结束] 第 ${index + 1} 张卡片处理完毕 ---\n`);
        }

        console.log(`【日志-卡片】所有卡片循环处理完毕。成功处理并返回了 ${data.length} 张已发布的卡片。`);
        return data;
    } catch (error) { 
        console.error('【日志-卡片】在 getSentenceCards 函数的顶层 catch 中捕获到未处理的错误:', error); 
        return []; 
    }
}
