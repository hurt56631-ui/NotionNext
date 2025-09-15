// components/MarkdownRenderer.js

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// 导入一个您喜欢的主题，例如 vsc-dark-plus
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const MarkdownRenderer = ({ content }) => {
  if (!content) {
    return null;
  }

  return (
    <ReactMarkdown
      components={{
        // 核心部分：自定义 code 元素的渲染方式
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={vscDarkPlus} // 应用代码高亮主题
              language={match}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        // 您也可以在这里自定义其他 Markdown 元素的样式
        h1: ({node, ...props}) => <h1 style={{ fontSize: '2em', borderBottom: '1px solid #ddd', paddingBottom: '0.3em' }} {...props} />,
        p: ({node, ...props}) => <p style={{ lineHeight: '1.6' }} {...props} />,
        ul: ({node, ...props}) => <ul style={{ paddingLeft: '20px' }} {...props} />,
        ol: ({node, ...props}) => <ol style={{ paddingLeft: '20px' }} {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
