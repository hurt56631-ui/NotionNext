import React from 'react';
import Link from 'next/link';
import { Mic2, Music4, BookText, Info, Keyboard, Layers } from 'lucide-react'; // 引入了 Layers 图标
import { motion } from 'framer-motion';

// 拼音模块数据
const pinyinModules = [
  { 
    title: '声母表 (Initials)', 
    description: '汉语拼音的辅音部分，如 b, p, m, f',
    href: '/pinyin/initials', 
    icon: Mic2, 
    color: 'text-blue-500', 
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800' 
  },
  { 
    title: '韵母表 (Finals)', 
    description: '汉语拼音的元音部分，如 a, o, e, i',
    href: '/pinyin/finals', 
    icon: Music4, 
    color: 'text-green-500', 
    bg: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800' 
  },
  { 
    title: '声调表 (Tones)', 
    description: '汉语的四个声调，决定字义',
    href: '/pinyin/tones', 
    icon: BookText, 
    color: 'text-yellow-500', 
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800' 
  },
  { 
    title: '整体认读 (Whole Syllables)', 
    description: '不需拼读，直接作为一个整体朗读的音节',
    href: '/pinyin/whole',  // 这里对应 [chartType] 为 'whole'
    icon: Layers, 
    color: 'text-purple-500', 
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800' 
  },
];

const PinyinContentBlock = () => {
  // 容器动画配置
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 } 
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-20">
      {/* 头部介绍 */}
      <div className="text-center mb-8 pt-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          汉语拼音基础
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Pinyin is the stepping stone to learning Chinese.
        </p>
      </div>

      {/* 核心功能卡片网格 - 修改布局以适应4个卡片 (2x2 或 1x4) */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {pinyinModules.map((module) => (
          <Link key={module.title} href={module.href} passHref legacyBehavior>
            <motion.a
              variants={itemVariants}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              className={`block p-6 rounded-2xl border ${module.borderColor} ${module.bg} cursor-pointer transition-shadow hover:shadow-lg relative overflow-hidden group`}
            >
              <div className="flex flex-col items-center text-center z-10 relative">
                <div className={`p-4 rounded-full bg-white dark:bg-gray-800 shadow-sm mb-4 ${module.color}`}>
                  <module.icon size={32} />
                </div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-1">
                  {module.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 px-2 leading-relaxed">
                  {module.description}
                </p>
              </div>
            </motion.a>
          </Link>
        ))}
      </motion.div>

      {/* 底部补充信息区域 */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
            <Info className="text-blue-500" size={20}/>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">拼音小贴士</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 为什么要学拼音？
                </h4>
                <p className="text-xs text-gray-500 leading-5">
                    拼音是汉字发音的标注工具。掌握拼音能帮助你正确读出汉字，并在电脑或手机上使用拼音输入法打字。它是学习汉语的第一把钥匙。
                </p>
            </div>
            <div className="space-y-3">
                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 输入法练习
                </h4>
                 <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-gray-500">尝试使用拼音输入法</span>
                    <Keyboard size={16} className="text-gray-400"/>
                 </div>
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PinyinContentBlock;
