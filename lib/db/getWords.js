// lib/db/getWords.js (修复 Module Not Found 错误)

import { getAllPosts } from './getSiteData'; // 修正导入路径，使用 NotionNext 提供的通用获取函数

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

  // 使用 getAllPosts 来获取数据库中的所有项目（NotionNext 中通常用于获取文章，但也可用于任何数据库）
  const words = await getAllPosts({
    notionPageId: databaseId, // 在 getAllPosts 中，数据库ID通常通过 notionPageId 传入
    from: 'database', // 标记数据来源是数据库
    notionHost
  });
  
  // getAllPosts 返回的是处理过的 post 数组，直接返回
  return words || [];
}
