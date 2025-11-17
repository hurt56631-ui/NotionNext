// /components/InterstitialAd.js (重写后的可靠版本)

import React from 'react';
import { AdSlot } from '@/components/GoogleAdsense';
import { X } from 'lucide-react'; // 导入一个关闭图标，更美观

/**
 * 一个可控的全屏插页式广告容器组件
 * @param {boolean} isOpen - 是否显示广告
 * @param {function} onClose - 用户点击关闭按钮时的回调函数
 */
const InterstitialAd = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  // 阻止背景内容滚动
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    // 使用 createPortal 将组件渲染到 body 的顶层，避免 z-index 问题
    // (虽然此项目中 WordCard 已经是 portal, 但这是一个好习惯)
    <div style={styles.overlay}>
      <div style={styles.adPanel}>
        {/* 关闭按钮 */}
        <button onClick={onClose} style={styles.closeButton}>
          <X size={24} color="#333" />
        </button>
        
        {/* 广告容器 */}
        <div style={styles.adContent}>
          <p style={styles.adLabel}>广告</p>
          {/* 调用我们已经存在的 AdSlot 组件来显示广告 */}
          <AdSlot />
        </div>
      </div>
    </div>
  );
};

// --- 组件内联样式 ---
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20000, // 确保在最顶层
  },
  adPanel: {
    position: 'relative',
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  adContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '250px', // 确保广告有足够的显示空间
  },
  adLabel: {
    color: '#aaa',
    fontSize: '12px',
    marginBottom: '10px',
  },
  closeButton: {
    position: 'absolute',
    top: '-15px',
    right: '-15px',
    background: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
  },
};

export default InterstitialAd;
