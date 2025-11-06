// components/PinyinRenderer.js

import React from 'react';

// 映射表：带声调元音 -> { 基础元音, 声调 }
const pinyinToneMap = {
  'ā': { base: 'a', tone: 1 }, 'á': { base: 'a', tone: 2 }, 'ǎ': { base: 'a', tone: 3 }, 'à': { base: 'a', tone: 4 },
  'ō': { base: 'o', tone: 1 }, 'ó': { base: 'o', tone: 2 }, 'ǒ': { base: 'o', tone: 3 }, 'ò': { base: 'o', tone: 4 },
  'ē': { base: 'e', tone: 1 }, 'é': { base: 'e', tone: 2 }, 'ě': { base: 'e', tone: 3 }, 'è': { base: 'e', tone: 4 },
  'ī': { base: 'i', tone: 1 }, 'í': { base: 'i', tone: 2 }, 'ǐ': { base: 'i', tone: 3 }, 'ì': { base: 'i', tone: 4 },
  'ū': { base: 'u', tone: 1 }, 'ú': { base: 'u', tone: 2 }, 'ǔ': { base: 'u', tone: 3 }, 'ù': { base: 'u', tone: 4 },
  'ǖ': { base: 'ü', tone: 1 }, 'ǘ': { base: 'ü', tone: 2 }, 'ǚ': { base: 'ü', tone: 3 }, 'ǜ': { base: 'ü', tone: 4 },
  'ê\u0304': { base: 'ê', tone: 1 }, 'ế': { base: 'ê', tone: 2 }, 'ê̌': { base: 'ê', tone: 3 }, 'ề': { base: 'ê', tone: 4 },
};

// 辅助函数，确保能正确处理Unicode字符
const getChars = (str) => Array.from(str);

const PinyinRenderer = ({ text, style, className }) => {
  if (!text) return null;

  // 统一进行NFC规范化
  const normalizedText = text.normalize('NFC');
  const syllables = normalizedText.split(' ');

  const renderSyllable = (syllable, syllableIndex) => {
    const chars = getChars(syllable);
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (pinyinToneMap[char]) {
        const { base, tone } = pinyinToneMap[char];
        const prefix = chars.slice(0, i).join('');
        const suffix = chars.slice(i + 1).join('');

        return (
          <React.Fragment key={syllableIndex}>
            {prefix}
            <span style={styles.pinyinVowelContainer}>
              {/* 渲染基础元音，例如 a, o, e */}
              {base}
              {/* 为一声手动绘制声调 */}
              {tone === 1 && <span style={styles.pinyinTone1}></span>}
              {/* 
                对于2,3,4声, 我们在基础元音的上方绝对定位一个包含原始带声调字符的 span。
                然后通过 CSS 将这个 span 里的基础字母部分设为透明，只留下声调。
                这样声调就会精准地叠加在下方我们渲染的基础元音上。
              */}
              {tone !== 1 && <span style={styles.pinyinToneOther}>{char}</span>}
            </span>
            {suffix}
          </React.Fragment>
        );
      }
    }
    // 如果没有声调，直接返回
    return syllable;
  };

  return (
    <div style={style} className={className}>
      {syllables.map((syllable, index) => (
        <React.Fragment key={index}>
          {renderSyllable(syllable, index)}
          {index < syllables.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </div>
  );
};

// 在组件内部定义样式，使其自包含
const styles = {
    pinyinVowelContainer: {
        position: 'relative',
        display: 'inline-block',
    },
    pinyinTone1: {
        position: 'absolute',
        top: '0.1em', // 精细调整平调的垂直位置
        left: '0',
        width: '100%',
        height: '0.1em',
        backgroundColor: 'currentColor',
    },
    pinyinToneOther: {
        position: 'absolute',
        top: '0',
        left: '0',
        color: 'transparent', // 隐藏基础字母
        textShadow: `0 0 currentColor`, // 只显示声调部分
    }
};


export default PinyinRenderer;
