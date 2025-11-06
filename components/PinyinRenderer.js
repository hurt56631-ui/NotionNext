// components/PinyinRenderer.js

import React from 'react';

// 定义带声调的元音及其对应的无声调元音和声调类别
const pinyinToneMap = {
  'ā': { base: 'a', tone: 1 }, 'á': { base: 'a', tone: 2 }, 'ǎ': { base: 'a', tone: 3 }, 'à': { base: 'a', tone: 4 },
  'ō': { base: 'o', tone: 1 }, 'ó': { base: 'o', tone: 2 }, 'ǒ': { base: 'o', tone: 3 }, 'ò': { base: 'o', tone: 4 },
  'ē': { base: 'e', tone: 1 }, 'é': { base: 'e', tone: 2 }, 'ě': { base: 'e', tone: 3 }, 'è': { base: 'e', tone: 4 },
  'ī': { base: 'i', tone: 1 }, 'í': { base: 'i', tone: 2 }, 'ǐ': { base: 'i', tone: 3 }, 'ì': { base: 'i', tone: 4 },
  'ū': { base: 'u', tone: 1 }, 'ú': { base: 'u', tone: 2 }, 'ǔ': { base: 'u', tone: 3 }, 'ù': { base: 'u', tone: 4 },
  'ǖ': { base: 'ü', tone: 1 }, 'ǘ': { base: 'ü', tone: 2 }, 'ǚ': { base: 'ü', tone: 3 }, 'ǜ': { base: 'ü', tone: 4 },
  'ê̄': { base: 'ê', tone: 1 }, 'ế': { base: 'ê', tone: 2 }, 'ê̌': { base: 'ê', tone: 3 }, 'ề': { base: 'ê', tone: 4 },
};

const PinyinRenderer = ({ text, style }) => {
  if (!text) return null;

  // 1. 规范化字符串，避免组合字符问题
  const normalizedText = text.normalize('NFC');
  
  // 2. 按空格分割成拼音音节数组
  const syllables = normalizedText.split(' ');

  const renderSyllable = (syllable, index) => {
    for (let i = 0; i < syllable.length; i++) {
      const char = syllable[i];
      if (pinyinToneMap[char]) {
        const { base, tone } = pinyinToneMap[char];
        const prefix = syllable.substring(0, i);
        const suffix = syllable.substring(i + 1);
        
        // 关键渲染逻辑：将带声调的元音拆分为 "基础元音" 和 "声调符号"
        return (
          <React.Fragment key={index}>
            {prefix}
            <span className="pinyin-vowel-container">
              {base}
              {/* 只为一声特别渲染CSS声调，其他声调字体渲染效果通常可以接受 */}
              {tone === 1 && <span className="pinyin-tone-1" />}
            </span>
            {suffix}
          </React.Fragment>
        );
      }
    }
    // 如果音节中没有带声调的元音，则直接渲染
    return syllable;
  };

  return (
    <div style={style}>
      {syllables.map((syllable, index) => (
        <span key={index}>
          {renderSyllable(syllable, index)}
          {index < syllables.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
};

export default PinyinRenderer;
