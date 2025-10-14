// lib/db/getSpeakingCourses.js

import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { getPage } from '@/lib/notion/getPostBlocks'
import { idToUuid } from 'notion-utils'

export async function getSpeakingCourses({ databaseId }) {
    if (!databaseId) return [];
    try {
        const pageRecordMap = await getPage(databaseId, 'course-db');
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
                // 【核心修正】: 使用从日志中看到的正确属性名 "话题"
                data.push({
                    id: properties.id,
                    title: properties['话题'] || '无标题',
                    description: properties['描述'] || '' // 保持对“描述”字段的兼容
                });
            }
        }
        return data;
    } catch (error) { 
        console.error('获取口语课程时出错:', error); 
        return []; 
    }
}
