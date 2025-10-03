// 文件路径: components/bottle/OceanBackground.js

import styles from '../../styles/Bottle.module.css';

// 这个组件现在直接从 Bottle.module.css 获取样式
// 我们将在 CSS 文件中定义动画
export default function OceanBackground() {
  return (
    <div className={styles.ocean}>
      <div className={styles.wave}></div>
      <div className={styles.wave}></div>
    </div>
  );
}
