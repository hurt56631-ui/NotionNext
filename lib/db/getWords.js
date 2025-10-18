// lib/db/getWords.js (最终修复版，使用 getDatabaseData)

// 假设 getDatabaseData 位于 lib/db/getSiteData.js 中
// 如果报错，可能需要改为 import { getDatabaseData } from './getSiteData'; 
import { getDatabaseData } from './getSiteData'; 

/**
 * 从 Notion 获取 HSK 单词数据库的所有内容
 * @param {object} param0
 * @param {string} param0.databaseId - HSK 单词数据库ID
 * @param {string} param0.notionHost - Notion API Host
 * @returns {Promise<any>}
 */
export async function getWords({ databaseId, notionHost }) {
  if (!databaseId) {
    console.log('getWords: NOTION_HSK_WORD_ID is missing');
    return [];
  }

  try {
    // 使用 getDatabaseData 来获取数据库中的所有项目
    const words = await getDatabaseData({
      databaseId,
      type: 'Post', // 默认为 Post 类型，或根据您的数据库类型调整
      notionHost
    });
    
    // getDatabaseData 返回的是处理过的 post 数组
    return words || [];
  } catch (error) {
    console.error(`getWords: Failed to fetch database data for ID ${databaseId}:`, error);
    return [];
  }
}
