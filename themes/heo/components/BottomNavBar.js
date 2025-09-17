// themes/heo/components/BottomNavBar.js (智能遥控器版)

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDrawer } from '@/lib/DrawerContext'; // 1. 引入 useDrawer
import AIChatDrawer from './AIChatDrawer';
import ChatDrawer from './ChatDrawer';
import React from 'react';

const BottomNavBar = () => {
  const router = useRouter();
  // 2. 从全局管理器获取状态和方法
  const { isOpen, drawerContent, openDrawer, closeDrawer } = useDrawer();

  const navItems = [
    { href: '/', label: '主页', iconClass: 'fas fa-home' },
    { type: 'ai', label: 'AI助手', iconClass: 'fas fa-robot' }, // 用 type 区分
    { href: '/forum', label: '社区', iconClass: 'fas fa-comments' },
    { href: '/jobs', label: '找工作', iconClass: 'fas fa-briefcase' },
    { href: '/forum/messages', label: '消息', iconClass: 'fas fa-paper-plane' },
  ];

  const handleTriggerClick = (type) => {
    // 3. 点击按钮时，调用 openDrawer 并传入内容类型
    if (type === 'ai') {
      openDrawer({ type: 'ai' });
    }
    // 聊天的打开逻辑在其他地方
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden">
        {navItems.map(item => {
          if (item.href) { // 如果是链接
            const isActive = router.pathname === item.href;
            return (
              <Link key={item.label} href={item.href}>
                <a className={`flex flex-col items-center justify-center w-full transition-colors ${isActive ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                  <i className={`${item.iconClass} text-xl`}></i>
                  <span className="text-xs mt-1">{item.label}</span>
                </a>
              </Link>
            );
          }
          // 如果是触发器
          return (
            <button key={item.label} onClick={() => handleTriggerClick(item.type)} className="flex flex-col items-center justify-center w-full text-gray-500 dark:text-gray-400">
              <i className={`${item.iconClass} text-xl`}></i>
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 4. 根据 drawerContent 的类型，渲染不同的抽屉 */}
      <AIChatDrawer isOpen={isOpen && drawerContent?.type === 'ai'} onClose={closeDrawer} />
      <ChatDrawer isOpen={isOpen && drawerContent?.type === 'chat'} onClose={closeDrawer} conversation={drawerContent?.conversation} />
    </>
  );
};

export default BottomNavBar;
