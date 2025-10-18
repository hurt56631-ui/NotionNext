// lib/db/getWords.js (模仿 getSentenceCards.js 的自定义数据库逻辑)

import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { getPage } from '@/lib/notion/getPostBlocks'
import { idToUuid } from 'notion-utils'
import { pinyin as pinyinConverter } from 'pinyin-pro'; // 引入拼音生成库

/**
 * 从 Notion 获取 HSK 单词数据库的所有内容
 * @param {object} param0
 * @param {string} param0.databaseId - HSK 单词数据库ID
 * @returns {Promise<any>}
 */
export async function getWords({ databaseId }) {
    if (!databaseId) {
        console.warn('【日志-单词】警告: 未提供 HSK 单词的 Database ID。');
        return [];
    }
    try {
        console.log('【日志-单词】开始获取 HSK 单词, Database ID:', databaseId);
        // 使用一个唯一标识符作为缓存键
        const pageRecordMap = await getPage(databaseId, 'hsk-word-db-final'); 
        if (!pageRecordMap) {
            console.error('【日志-单词】错误: 无法获取 HSK 单词数据库的 pageRecordMap。');
            return [];
        }
        const id = idToUuid(databaseId);
        const block = pageRecordMap.block || {};
        const rawMetadata = block[id]?.value;
        if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') {
            console.error(`【日志-单词】错误: ID "${id}" 不是一个有效的 Notion 数据库。`);
            return [];
        }
        
        const collection = Object.values(pageRecordMap.collection)[0]?.value || {};
        const schema = collection?.schema;
        
        // 修正 getAllPageIds 的调用方式，确保参数完整
        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata.collection_id, pageRecordMap.collection_view, rawMetadata.view_ids, block);

        console.log(`【日志-单词】在单词库中找到了 ${pageIds.length} 个页面。`);
        
        const data = [];
        for (const pageId of pageIds) {
          const value = block[pageId]?.value;
          if (!value) {
            console.warn(`【日志-警告】找不到 Page ID: ${pageId} 的 value 数据块，跳过。`);
            continue;
          }
          
          const properties = await getPageProperties(pageId, value, schema, null, null);
          
          // 根据您的 Notion 截图，Status 列值为 Published
          const isPublished = properties && (properties.status === 'Published' || properties.status === 'P'); 
          const chineseWord = properties.title;
          
          if (isPublished && chineseWord) {
            
            // 自动生成拼音
            let pinyin = properties['拼音'] || properties.pinyin || ''; // 尝试获取 Notion 中的拼音列
            if (!pinyin) {
               pinyin = pinyinConverter(chineseWord, { toneType: 'num', separator: ' ' }); 
            }
            
            // 获取 tags (等级) 属性
            const tagSchemaKey = Object.keys(schema).find(key => schema[key].name === '等级');
            let tags = [];
            if (tagSchemaKey && properties[tagSchemaKey]) {
                 // getPageProperties 处理过的 Multi-Select 属性通常直接返回一个数组
                 tags = properties[tagSchemaKey];
            } else if (properties['等级']) {
                 // 尝试使用映射后的属性名
                 tags = Array.isArray(properties['等级']) ? properties['等级'] : [properties['等级']].filter(Boolean);
            }
            
            // 获取释义 (对应WordCard的 burmese 属性)
            const burmeseMeaning = properties['释义'] || properties['meaning'] || properties.translation || '';
            // 获取图片 (对应WordCard的 imageUrl 属性)
            const imageUrl = properties['图片'] || properties.img || properties.imageUrl || null;


            const cleanWord = { 
                id: properties.id, 
                chinese: chineseWord, 
                burmese: burmeseMeaning, 
                pinyin: pinyin,
                imageUrl: imageUrl, 
                tags: tags, // 用于 HskPageClient 过滤，值为 ['hsk1', 'hsk2', ...]
            };
            data.push(cleanWord);
            
            console.log(`  -> 【日志】成功处理单词: "${cleanWord.chinese}", 等级: [${cleanWord.tags.join(', ')}]`);

          } else {
            console.log(`  -> 【日志】跳过单词 (ID: ${pageId})，状态为: ${properties?.status} 或中文单词为空`);
          }
        }

        console.log(`【日志-单词】成功处理并返回了 ${data.length} 个已发布的 HSK 单词。`);
        return data;
    } catch (error) { 
        console.error('【日志-单词】获取 HSK 单词时发生严重错误:', error); 
        return []; 
    }
}
