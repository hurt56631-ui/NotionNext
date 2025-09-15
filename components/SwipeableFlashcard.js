// components/SwipeableFlashcard.js

import React, { useState } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

// 卡片数据
const initialCards = [
  { word: '你好', pinyin: 'nǐ hǎo', meaning: 'Hello' },
  { word: '谢谢', pinyin: 'xiè xiè', meaning: 'Thank you' },
  { word: '再见', pinyin: 'zài jiàn', meaning: 'Goodbye' },
  { word: '不客气', pinyin: 'bú kè qì', meaning: 'You\'re welcome' },
  { word: '对不起', pinyin: 'duì bu qǐ', meaning: 'Sorry' },
];

const SwipeableFlashcard = ({ cards = initialCards }) => {
  const [gone] = useState(() => new Set());
  const [props, api] = useSprings(cards.length, i => ({
    x: 0,
    y: 0,
    rot: 0,
    scale: 1,
    from: { x: 0, y: -1000, rot: -10, scale: 1.5 },
  }));

  const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx] }) => {
    const trigger = vx > 0.2;
    const dir = xDir < 0 ? -1 : 1;
    if (!down && trigger) gone.add(index);
    api.start(i => {
      if (index !== i) return;
      const isGone = gone.has(index);
      const x = isGone ? (200 + window.innerWidth) * dir : down ? mx : 0;
      const rot = mx / 100 + (isGone ? dir * 10 * vx : 0);
      const scale = down ? 1.1 : 1;
      return {
        x,
        rot,
        scale,
        delay: undefined,
        config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 },
      };
    });
    if (!down && gone.size === cards.length)
      setTimeout(() => {
        gone.clear();
        api.start(i => ({
            x: 0, y: 0, rot: 0, scale: 1, delay: i * 100,
            from: { x: 0, y: -1000, rot: -10, scale: 1.5 }
        }));
      }, 600);
  });

  return (
    <div style={styles.wrapper}>
      <h3 style={styles.title}>滑动单词卡</h3>
      <div style={styles.container}>
        {props.map(({ x, y, rot, scale }, i) => (
          <animated.div style={{ ...styles.deck, x, y }} key={i}>
            <animated.div
              {...bind(i)}
              style={{
                ...styles.card,
                transform: rot.to(r => `rotateX(10deg) rotateZ(${r}deg)`),
                scale,
              }}
            >
              <div style={styles.cardContent}>
                <p style={styles.pinyin}>{cards[i].pinyin}</p>
                <h2 style={styles.word}>{cards[i].word}</h2>
                <p style={styles.meaning}>{cards[i].meaning}</p>
              </div>
            </animated.div>
          </animated.div>
        ))}
      </div>
      <p style={styles.instructions}>向左或向右滑动卡片</p>
    </div>
  );
};

// 样式对象
const styles = {
    wrapper: {
        padding: '2rem',
        textAlign: 'center'
    },
    title: {
        color: '#2d3748',
        fontSize: '1.5rem',
        marginBottom: '1rem'
    },
    container: {
        width: '100%',
        height: '350px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'grab',
    },
    deck: {
        position: 'absolute',
        width: '300px',
        height: '300px',
        willChange: 'transform',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        backgroundColor: 'white',
        width: '100%',
        height: '100%',
        willChange: 'transform',
        borderRadius: '1rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
    },
    cardContent: {
        padding: '1rem'
    },
    word: {
        fontSize: '4rem',
        margin: '0',
        color: '#2b6cb0'
    },
    pinyin: {
        fontSize: '1.5rem',
        color: '#718096',
        margin: '0 0 0.5rem 0'
    },
    meaning: {
        fontSize: '1.2rem',
        color: '#4a5568',
        marginTop: '1rem'
    },
    instructions: {
        color: '#a0aec0',
        marginTop: '1rem'
    }
};

export default SwipeableFlashcard;
