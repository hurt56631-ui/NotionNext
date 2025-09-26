// components/AdComponent.js - 广告占位组件

import React from 'react';

const styles = {
  adContainer: {
    width: '100%',
    minHeight: '50px',
    background: '#f0f0f0',
    border: '2px dashed #ccc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    color: '#888',
    borderRadius: '12px',
    marginTop: '15px',
    textAlign: 'center'
  }
};

const AdComponent = () => {
  // 在 useEffect 中加载谷歌广告脚本
  // useEffect(() => {
  //   try {
  //     (window.adsbygoogle = window.adsbygoogle || []).push({});
  //   } catch (e) {
  //     console.error("AdSense error:", e);
  //   }
  // }, []);

  return (
    <div style={styles.adContainer}>
      {/* 这里放置您的 Google AdSense 代码 */}
      {/* 
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client="ca-pub-xxxxxxxxxxxxxxxx"
           data-ad-slot="xxxxxxxxxx"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      */}
      广告位 (每次切换/翻面时刷新)
    </div>
  );
};

export default AdComponent;
