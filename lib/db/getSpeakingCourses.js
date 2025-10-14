// lib/db/getSpeakingCourses.js
import { getPageProperties, getAllPageIds, getPage } from '@/lib/notion/getNotionData'
import { idToUuid } from 'notion-utils'

export async function getSpeakingCourses({ databaseId }) {
    if (!databaseId) {
        console.warn('【日志-课程】警告: 未提供口语课程的 Database ID。');
        return [];
    }
    try {
        console.log('【日志-课程】开始获取口语课程, Database ID:', databaseId);
        const pageRecordMap = await getPage(databaseId, 'course-db-debug');
        if (!pageRecordMap) {
            console.error('【日志-课程】错误: 无法获取课程数据库的 pageRecordMap。');
            return [];
        }
        const id = idToUuid(databaseId);
        const block = pageRecordMap.block || {};
        const rawMetadata = block[id]?.value;
        if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') return [];
        
        const collection = Object.values(pageRecordMap.collection)[0]?.value || {};
        const schema = collection?.schema;
        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata?.collection_id, pageRecordMap.collection_view, rawMetadata?.view_ids);
        
        console.log(`【日志-课程】在课程库中找到了 ${pageIds.length} 个页面。`);
        const data = [];

        for (let i = 0; i < pageIds.length; i++) {
            const pageId = pageIds[i];
            const value = block[pageId]?.value;
            const properties = await getPageProperties(pageId, value, schema, null, null);

            // --- 【终极诊断日志】 ---
            console.log(`\n--- 正在诊断课程 #${i + 1} (ID: ${pageId}) ---`);
            console.log('【日志-课程-诊断】该课程的完整 properties 对象结构是:');
            console.log(JSON.stringify(properties, null, 2));
            console.log('-------------------------------------------\n');
            // --- 日志结束 ---

            const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');
            if (isPublished) {
                const course = {
                    id: properties.id,
                    title: properties['课程名称'] || '无标题',
                    description: properties['描述'] || ''
                };
                data.push(course);
            }
        }
        console.log(`【日志-课程】成功处理并返回了 ${data.length} 个已发布的课程。`);
        return data;
    } catch (error) { console.error('【日志-课程】获取口语课程时发生严重错误:', error); return []; }
}
