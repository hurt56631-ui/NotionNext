// /components/InterstitialAd.js (修改为全屏样式)

import React from 'react';
import { AdSlot } from '@/components/GoogleAdsense';
import { X } from 'lucide-react'; 

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
    <div style={styles.overlay} onClick={onClose}>
      {/* 内容面板，阻止事件冒泡到上层 overlay */}
      <div style={styles.adPanel} onClick={e => e.stopPropagation()}>
        <div style={styles.adContent}>
          <p style={styles.adLabel}>Advertisement</p>
          <AdSlot />
        </div>
      </div>
       {/* 关闭按钮放在面板之外，更清晰 */}
       <button onClick={onClose} style={styles.closeButton}>
          <X size={28} color="white" />
        </button>
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)', // 更暗的背景
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20000, 
  },
  adPanel: {
    backgroundColor: 'white',
    width: '100%', // 占据全部宽度
    height: '100%', // 占据全部高度
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%', // 广告内容区域宽度
    maxWidth: '400px',
    minHeight: '250px',
  },
  adLabel: {
    color: '#aaa',
    fontSize: '12px',
    marginBottom: '10px',
  },
  closeButton: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default InterstitialAd;
