// components/PostContent.js (示例 - 确保它能安全处理 content prop)

import React from 'react';

// 假设这是一个简单的组件，只渲染纯文本
// 如果你处理 Markdown 或富文本，可能需要更多的库和逻辑
export default function PostContent({ content }) {
  // 如果 content 为 null, undefined 或空字符串，则不渲染任何内容或渲染一个默认提示
  if (!content || content.trim() === '') {
    return <p className="text-gray-400 dark:text-gray-500 italic">暂无内容。</p>; // 或返回 null
  }

  // 假设 content 是纯文本，按换行符分割成段落
  const paragraphs = content.split('\n').filter(p => p.trim() !== '');

  return (
    <div className="post-content-container">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="mb-2 last:mb-0">{paragraph}</p>
      ))}
    </div>
  );
}
