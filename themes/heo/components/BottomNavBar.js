// themes/heo/components/BottomNavBar.js
import Link from 'next/link';
import { useRouter } from 'next/router';
// 确保你已经安装了 lucide-react: npm install lucide-react
import { Home, Bot, MessageSquare, Briefcase, Library } from 'lucide-react';

const navItems = [
  { href: '/', label: '主页', icon: Home },
  { href: '/ai-assistant', label: 'AI助手', icon: Bot },
  { href: '/forum', label: '社区', icon: MessageSquare },
  { href: '/jobs', label: '找工作', icon: Briefcase },
  { href: '/bookshelf', label: '书柜', icon: Library },
];

const BottomNavBar = () => {
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden">
      {navItems.map(item => {
        const isActive = router.pathname === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <a className={`flex flex-col items-center justify-center w-full transition-colors ${isActive ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
              <Icon size={24} />
              <span className="text-xs mt-1">{item.label}</span>
            </a>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
