// lib/db/getBooks.js

// 【最终修正】: 从最原始的 notion 工具文件中导入
import getAllPageIds from '@/lib/notion/getAllPageIds'
import getPageProperties from '@/lib/notion/getPageProperties'
import { getPage } from '@/lib/notion/getPostBlocks'
import { idToUuid } from 'notion-utils'

export async function getAllBooks({ databaseId }) {
    if (!databaseId) return [];
    try {
        const pageRecordMap = await getPage(databaseId, 'books-db');
        if (!pageRecordMap) return [];
        const id = idToUuid(databaseId);
        const block = pageRecordMap.block || {};
        const rawMetadata = block[id]?.value;
        if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') return [];
        const collection = Object.values(pageRecordMap.collection)[0]?.value || {};
        const schema = collection?.schema;
        // 现在 getAllPageIds 是一个被正确导入的函数，不再是 undefined
        const pageIds = getAllPageIds(pageRecordMap.collection_query, rawMetadata?.collection_id, pageRecordMap.collection_view, rawMetadata?.view_ids);
        const data = [];
        for (const pageId of pageIds) {
            const value = block[pageId]?.value;
            const properties = await getPageProperties(pageId, value, schema, null, null);
            const isPublished = properties && (properties.status === 'Published' || properties.status === 'P');
            if (isPublished) {
                const cleanBook = { id: properties.id, title: properties['书名'] || '无标题', category: properties.category || '未分类', imageUrl: properties['封面链接'] || null, readUrl: properties['阅读链接'] || null };
                if (cleanBook.imageUrl && cleanBook.readUrl) { data.push(cleanBook); }
            }
        }
        return data;
    } catch (error) { console.error('获取书籍数据时出错:', error); return []; }
}
