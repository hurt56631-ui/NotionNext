import { useState, useEffect } from 'react';

// 设置提醒周期（天）
const REMINDER_PERIOD_IN_DAYS = 1;

export const usePWAInstall = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      // 阻止浏览器默认的 mini-infobar
      event.preventDefault();
      
      // 检查是否已经安装
      if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('PWA is already installed.');
        return;
      }

      // 检查上次拒绝的时间，实现“多次提醒”
      const lastDismissed = localStorage.getItem('pwaDismissedTimestamp');
      if (lastDismissed) {
        const daysSinceDismissed = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < REMINDER_PERIOD_IN_DAYS) {
          console.log(`PWA install prompt dismissed within the last ${REMINDER_PERIOD_IN_DAYS} days. Not showing again yet.`);
          return;
        }
      }

      // 保存事件，以便稍后触发
      setInstallPromptEvent(event);
      // 显示我们自己的弹窗
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
        // 用户安装后，清除事件和隐藏弹窗
        setInstallPromptEvent(null);
        setShowInstallPrompt(false);
        localStorage.removeItem('pwaDismissedTimestamp');
        console.log('PWA has been installed.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      return;
    }
    // 触发浏览器原生的安装提示
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
        localStorage.removeItem('pwaDismissedTimestamp');
    }

    // 清理
    setInstallPromptEvent(null);
    setShowInstallPrompt(false);
  };

  const handleDismissClick = () => {
    // 记录拒绝的时间戳
    localStorage.setItem('pwaDismissedTimestamp', Date.now().toString());
    setShowInstallPrompt(false);
  };

  return { showInstallPrompt, handleInstallClick, handleDismissClick };
};
