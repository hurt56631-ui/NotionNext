// components/MotionTest.js

import React from 'react';
import { motion } from 'framer-motion';

const MotionTest = () => {
  // 定义一个动画变体，让元素从左边滑入并淡入
  const boxVariants = {
    hidden: { 
      x: -200, // 从左侧 200px 的位置开始
      opacity: 0 
    },
    visible: {
      x: 0,      // 移动到原始位置
      opacity: 1,
      transition: {
        type: 'spring', // 使用弹簧动画，效果更自然
        stiffness: 120, // 弹簧的硬度
        delay: 0.2
      }
    }
  };

  // 定义一个按钮的动画效果
  const buttonVariants = {
    hover: {
      scale: 1.1, // 鼠标悬停时放大 1.1 倍
      textShadow: '0px 0px 8px rgb(255,255,255)',
      boxShadow: '0px 0px 8px rgb(255,255,255)',
      transition: {
        duration: 0.3,
        repeat: Infinity, // 无限重复
        repeatType: 'reverse' // 反向重复，产生呼吸灯效果
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      border: '2px dashed #007bff',
      borderRadius: '15px',
      margin: '20px auto',
      maxWidth: '500px',
      backgroundColor: '#f0f8ff'
    }}>
      <h2 style={{ marginBottom: '30px' }}>Framer Motion 动画测试</h2>

      {/* 这是一个会从左侧滑入的动画盒子 */}
      <motion.div
        style={{
          width: 150,
          height: 150,
          backgroundColor: '#2b6cb0',
          borderRadius: '20px'
        }}
        variants={boxVariants}
        initial="hidden" // 初始状态
        animate="visible" // 动画到这个状态
      />

      <p style={{ margin: '30px 0', color: '#4a5568' }}>
        上面的方块展示了入场动画。
        <br />
        下面的按钮展示了悬停动画。
      </p>

      {/* 这是一个鼠标悬停时会有呼吸灯效果的按钮 */}
      <motion.button
        style={{
          padding: '15px 30px',
          fontSize: '1.2rem',
          backgroundColor: '#38a169',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer'
        }}
        variants={buttonVariants}
        whileHover="hover" // 当鼠标悬停时，应用 'hover' 变体
      >
        把鼠标放上来
      </motion.button>
    </div>
  );
};

export default MotionTest;
