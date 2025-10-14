// lib/db/getSpeakingCourses.js

import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { getPage } from '@/lib/notion/getPostBlocks'
import { idToUuid } from 'notion-utils'

export async function getSpeakingCourses({ databaseId }) {
    if (!databaseId) {
        console.warn('【日志-课程】警告: 未提供口语课程的 Database ID。');
        return [];
    }
    try {
        console.log('【日志-课程】开始获取口语课程, Database ID:', databaseId);
        const pageRecordMap = await getPage(databaseId, 'course-db-final');
        if (!pageRecordMap) {
            console.error('【日志-课程】错误: 无法获取课程数据库的 pageRecordMap。');
            return [];
        }
        const id = idToUuid(databaseId);
        const block = pageRecordMap.block || {};
        const rawMetadata = block[id]?.value;
        if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') {
            console.error(`【日志-课程】错误: ID "${id}" 不是一个有效的 Notion 数据库。`);
            return [];
        }
        
        const collection = Object.values(pageRecordMap.collection)[0]?.value || {};
        const schema = collection?.schema;
        
        // 【核心修正】: 修正 getAllPageIds 的调用方式，补上缺失的 block 参数
        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata.collection_id, pageRecordMap.collection_view, rawMetadata.view_ids, block);
        
        console.log(`【日志-课程】在课程库中找到了 ${pageIds.length} 个页面。`);

        const data = [];
        for (const pageId of pageIds) {
            const value = block[pageId]?.value;
            const properties = await getPageProperties(pageId, value, schema, null, null);

            const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');
            if (isPublished) {
                // 【核心修正】: 使用从日志中看到的正确属性名 "话题"
                const course = {
                    id: properties.id,
                    title: properties['话题'] || '无标题',
                    description: properties['描述'] || '' // 保持对“描述”字段的兼容
                };
                data.push(course);
                console.log(`  -> 【日志】成功处理课程: "${course.title}" (ID: ${course.id})`);
            } else {
                console.log(`  -> 【日志】跳过课程 (ID: ${pageId})，状态为: ${properties?.status}`);
            }
        }
        console.log(`【日志-课程】成功处理并返回了 ${data.length} 个已发布的课程。`);
        return data;
    } catch (error) { 
        console.error('【日志-课程】获取口语课程时发生严重错误:', error); 
        return []; 
    }
}
