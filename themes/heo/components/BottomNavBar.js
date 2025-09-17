// themes/heo/components/BottomNavBar.js (最终的、功能强大的抽屉版)

import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState, useEffect } from 'react';
import AIChatDrawer from './AIChatDrawer'; 
import ChatDrawer from './ChatDrawer'; 

const BottomNavBar = () => {
  const router = useRouter();
  // 状态管理现在在这个组件内部
  const [activeDrawer, setActiveDrawer] = useState(null); // null, 'ai', 'chat'
  const [chatConversation, setChatConversation] = useState(null);

  const navItems = [
    { name: '主页', path: '/', icon: 'fas fa-home', type: 'link' },
    { name: 'AI助手', type: 'ai', icon: 'fas fa-robot' },
    { name: '社区', path: '/forum', icon: 'fas fa-comments', type: 'link' },
    { name: '找工作', path: '/jobs', icon: 'fas fa-briefcase', type: 'link' },
    { name: '消息', path: '/forum/messages', icon: 'fas fa-paper-plane', type: 'link' }
  ];

  const openDrawer = (type, data = {}) => {
    setActiveDrawer(type);
    if (type === 'chat') {
      setChatConversation(data.conversation);
    }
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

      <div id='bottom-nav' className='fixed bottom-0 left-0 w-full bg-white dark:bg-[#18171d] shadow-lg flex justify-around items-center h-16 z-40 border-t border-gray-100 dark:border-gray-800 md:hidden'>
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
    </>
  );
};

export default BottomNavBar;
