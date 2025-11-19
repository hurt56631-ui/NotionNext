// /components/InterstitialAd.js (底部关闭按钮版)

import React, { useEffect } from 'react';
import { AdSlot } from '@/components/GoogleAdsense';
import { X } from 'lucide-react'; 

/**
 * 全屏插页式广告组件
 * 优化点：关闭按钮移至底部中间，方便单手操作
 */
const InterstitialAd = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  // 禁止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div style={styles.overlay} onClick={onClose}>
      {/* 
         adPanel 设置为白色全屏背景 
         onClick 阻止冒泡，防止点击空白处关闭（为了提高广告展示率，通常建议只能点关闭按钮关闭）
      */}
      <div style={styles.adPanel} onClick={e => e.stopPropagation()}>
        
        <div style={styles.contentContainer}>
          <p style={styles.adLabel}>Advertisement / 广告</p>
          
          {/* 广告容器 */}
          <div style={styles.adWrapper}>
            <AdSlot />
          </div>
        </div>

        {/* 关闭按钮 - 放置在底部中间 */}
        <button onClick={onClose} style={styles.closeButton}>
          <X size={24} color="#333" />
          <span style={styles.closeText}>关闭广告</span>
        </button>

      </div>
    </div>
  );
};

// --- 样式表 ---
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // 深色遮罩
    zIndex: 20000, // 确保在最顶层
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adPanel: {
    position: 'relative', // 为了绝对定位关闭按钮
    backgroundColor: '#fff', // 广告背景通常是白色
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center', // 内容垂直居中
  },
  contentContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    // 给底部留出空间，防止广告太长被按钮挡住
    paddingBottom: '100px', 
  },
  adLabel: {
    color: '#999',
    fontSize: '12px',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  adWrapper: {
    // 限制广告最大宽度，防止在大屏上太宽难看
    width: '100%',
    maxWidth: '340px', // 适配常见手机广告宽度
    minHeight: '250px', // 预留高度减少布局抖动
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    // 核心修改：放置在底部，并居中
    bottom: '60px', // 距离底部 60px，避开手机底部手势条
    left: '50%', 
    transform: 'translateX(-50%)', // 水平居中
    
    // 样式美化
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid #eee',
    borderRadius: '30px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    zIndex: 10, // 确保在广告上方
  },
  closeText: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500',
  }
};

export default InterstitialAd;
