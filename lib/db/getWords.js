// lib/db/getWords.js

import { NotionAPI } from 'notion-client';
import { getDatabaseData, notion } from './getDatabaseData'; // 假设您已经有 getDatabaseData 或类似的通用工具

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

  // notionnext 的 getDatabaseData 函数通常会处理数据并返回 post/page 数组
  const words = await getDatabaseData({
    databaseId,
    type: 'Post', // 默认为 Post 类型，或根据您的数据库类型调整
    notionHost
  });
  
  // getDatabaseData 返回的数据通常是处理过的 post 数组，直接返回即可
  return words || [];
}
