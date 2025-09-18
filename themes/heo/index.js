// themes/heo/components/BottomNavBar.js (最终的、功能强大的抽屉版  修正导出)

import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState, useEffect, createContext, useContext } from 'react'; // 导入 createContext 和 useContext
import AIChatDrawer from './AIChatDrawer'; 
import ChatDrawer from './ChatDrawer'; 

// 【核心修改】: 新增一个局部的 DrawerContext，只在 BottomNavBar 的子组件中使用
const LocalDrawerContext = createContext(null);
export const useDrawer = () => useContext(LocalDrawerContext); // 导出 useDrawer Hook

const BottomNavBar = () => {
  const router = useRouter();
  const [activeDrawer, setActiveDrawer] = useState(null); // null, 'ai', 'chat'
  const [chatConversation, setChatConversation] = useState(null);

  const navItems = [
    { name: '主页', path: '/', icon: 'fas fa-home', type: 'link' },
    { name: 'AI助手', type: 'ai', icon: 'fas fa-robot' },
    { name: '社区', path: '/forum', icon: 'fas fa-comments', type: 'link' },
    { name: '娱乐', path: '/entertainment', icon: 'fas fa-play-circle', type: 'link' }, 
    { name: '消息', path: '/forum/messages', icon: 'fas fa-paper-plane', type: 'link' }
  ];

  const openDrawer = (type, data = {}) => {
    setActiveDrawer(type);
    if (type === 'chat') {
      setChatConversation(data.conversation);
    }
    // 添加 hash 以支持手势返回
    router.push(router.pathname + `#${type}-drawer`, undefined, { shallow: true });
  };

  const closeDrawer = () => {
    if (window.location.hash.includes('-drawer')) {
      router.back();
    } else {
      setActiveDrawer(null);
    }
  };
  
  useEffect(() => {
    const handleHashChange = () => {
      if (!window.location.hash.includes('-drawer') && activeDrawer) {
        setActiveDrawer(null);
      }
    };
    window.addEventListener('popstate', handleHashChange);
    return () => window.removeEventListener('popstate', handleHashChange);
  }, [activeDrawer]);

  return (
    <>
      <style jsx global>{`
        @media (max-width: 767px) {
          body {
            padding-bottom: 4rem; 
          }
        }
      `}</style>

      {/* 【核心修改】: 使用 LocalDrawerContext.Provider 包裹 BottomNavBar 的内容 */}
      <LocalDrawerContext.Provider value={{ openDrawer, closeDrawer }}>
        <div id='bottom-nav' className='fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden'>
          {navItems.map(item => {
            if (item.type === 'link') {
              const isActive = router.pathname === item.path;
              return (
                <Link key={item.name} href={item.path}>
                  <a className={`flex flex-col items-center justify-center flex-1 px-2 py-1 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                    <i className={`${item.icon} text-xl mb-1`}></i>
                    <span className='text-xs'>{item.name}</span>
                  </a>
                </Link>
              );
            }
            return (
              <button key={item.name} onClick={() => openDrawer(item.type)} className='flex flex-col items-center justify-center flex-1 px-2 py-1 text-gray-600 dark:text-gray-300'>
                <i className={`${item.icon} text-xl mb-1`}></i>
                <span className='text-xs'>{item.name}</span>
              </button>
            );
          })}
        </div>

        <AIChatDrawer isOpen={activeDrawer === 'ai'} onClose={closeDrawer} />
        <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} conversation={chatConversation} />
      </LocalDrawerContext.Provider>
    </>
  );
};

export default BottomNavBar;
