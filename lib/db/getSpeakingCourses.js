// lib/db/getSpeakingCourses.js
import { getPageProperties, getAllPageIds, getPage } from '@/lib/notion/getNotionData'
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
        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata?.collection_id, pageRecordMap.collection_view, rawMetadata?.view_ids);
        const data = [];
        for (let i = 0; i < pageIds.length; i++) {
            const pageId = pageIds[i];
            const value = block[pageId]?.value;
            const properties = await getPageProperties(pageId, value, schema, null, null);
            const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');
            if (isPublished) {
                data.push({
                    id: properties.id,
                    title: properties['课程名称'] || '无标题',
                    description: properties['描述'] || ''
                });
            }
        }
        return data;
    } catch (error) { console.error('获取口语课程时出错:', error); return []; }
}
