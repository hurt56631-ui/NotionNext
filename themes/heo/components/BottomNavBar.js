// themes/heo/components/BottomNavBar.js (已添加私信入口)

import Link from 'next/link';
import { useRouter } from 'next/router';

// 1. 将 "书柜" 修改为 "消息"
const navItems = [
  { href: '/', label: '主页', iconClass: 'fas fa-home' },
  { href: '/ai-assistant', label: 'AI助手', iconClass: 'fas fa-robot' },
  { href: '/forum', label: '社区', iconClass: 'fas fa-comments' },
  { href: '/jobs', label: '找工作', iconClass: 'fas fa-briefcase' },
  // 修改了这一行：标签、链接和图标都已更新
  { href: '/forum/messages', label: '消息', iconClass: 'fas fa-paper-plane' }, 
];

const BottomNavBar = () => {
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden">
      {navItems.map(item => {
        // 2. 增加对私信页面的高亮判断逻辑
        // 这样无论在 /forum/messages 还是 /forum/messages/具体聊天ID，图标都会高亮
        const isActive = router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);
        
        return (
          <Link key={item.href} href={item.href}>
            <a className={`flex flex-col items-center justify-center w-full transition-colors ${isActive ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
              <i className={`${item.iconClass} text-xl`}></i>
              <span className="text-xs mt-1">{item.label}</span>
            </a>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
