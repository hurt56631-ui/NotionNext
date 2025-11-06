import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronDown, ChevronUp, Mic2, Music4, BookText, ListTodo } from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

// 动态导入 WordCard 组件
const WordCard = dynamic(
  () => import('@/components/WordCard'),
  { ssr: false }
);

// --- 数据中心：一次性导入所有 HSK 等级的词汇数据 ---
// 确保这些 JSON 文件都存在于你的 data/hsk 目录下
// 如果某个文件不存在，导入会失败，但我们的代码会优雅地处理这种情况
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) { console.warn("HSK 1 words not found."); }
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) { console.warn("HSK 2 words not found."); }
try { hskWordsData[3] = require('@/data/hsk/hsk3.json'); } catch (e) { console.warn("HSK 3 words not found."); }
try { hskWordsData[4] = require('@/data/hsk/hsk4.json'); } catch (e) { console.warn("HSK 4 words not found."); }
try { hskWordsData[5] = require('@/data/hsk/hsk5.json'); } catch (e) { console.warn("HSK 5 words not found."); }
try { hskWordsData[6] = require('@/data/hsk/hsk6.json'); } catch (e) { console.warn("HSK 6 words not found."); }
// ----------------------------------------------------

// --- HSK 等级卡片数据 (完整版) ---
const hskData = [
    { 
        level: 1, 
        title: '入门水平', 
        description: '掌握最常用词语和基本语法', 
        imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 你好' },
            { id: 2, title: '第 2 课 谢谢你' },
            { id: 3, title: '第 3 课 你叫什么名字？' },
            { id: 4, title: '第 4 课 她是我的汉语老师' },
            { id: 5, title: '第 5 课 她女儿今年二十岁' },
            { id: 6, title: '第 6 课 我会说汉语' },
            { id: 7, title: '第 7 课 今天几号？' },
            { id: 8, title: '第 8 课 我想喝茶' },
            { id: 9, title: '第 9 课 你儿子在哪儿工作？' },
            { id: 10, title: '第 10 课 我能坐这儿吗？' },
            { id: 11, title: '第 11 课 现在几点？' },
            { id: 12, title: '第 12 课 明天天气怎么样？' },
            { id: 13, title: '第 13 课 他在学做中国菜呢' },
            { id: 14, title: '第 14 课 她买了不少衣服' },
            { id: 15, title: '第 15 课 我是坐飞机来的' },
        ]
    },
    { 
        level: 2, 
        title: '基础水平', 
        description: '就熟悉的日常话题进行交流', 
        imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 九月去北京旅游最好' },
            { id: 2, title: '第 2 课 我每天六点起床' },
            { id: 3, title: '第 3 课 左边那个红色的是我的' },
            { id: 4, title: '第 4 课 这个工作是他帮我介绍的' },
            { id: 5, title: '第 5 课 喂，您好' },
            { id: 6, title: '第 6 课 我已经找了工作了' },
            { id: 7, title: '第 7 课 门开着呢' },
            { id: 8, title: '第 8 课 你别忘了带手机' },
            { id: 9, title: '第 9 课 他比我大三岁' },
            { id: 10, title: '第 10 课 你看过那个电影吗' },
            { id: 11, title: '第 11 课 虽然很累，但是很高兴' },
            { id: 12, title: '第 12 课 你穿得太少了' },
            { id: 13, title: '第 13 课 我是走回来的' },
            { id: 14, title: '第 14 课 你把水果拿过来' },
            { id: 15, title: '第 15 课 其他的都没问题' },
        ]
    },
    { 
        level: 3, 
        title: '进阶水平', 
        description: '完成生活、学习、工作的基本交际', 
        imageUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 周末你有什么打算' },
            { id: 2, title: '第 2 课 他什么时候回来' },
            { id: 3, title: '第 3 课 桌子上放着很多饮料' },
            { id: 4, title: '第 4 课 我总是饿' },
            { id: 5, title: '第 5 课 我家离公司很远' },
            { id: 6, title: '第 6 课 我最近越来越胖了' },
            { id: 7, title: '第 7 课 你感冒了？' },
            { id: 8, title: '第 8 课 我们去看电影吧' },
            { id: 9, title: '第 9 课 你的腿怎么了？' },
            { id: 10, title: '第 10 课 别忘了把空调关了' },
            { id: 11, title: '第 11 课 我把护照放在哪儿了？' },
            { id: 12, title: '第 12 课 你为什么那么高兴？' },
            { id: 13, title: '第 13 课 我是走着去学校的' },
            { id: 14, title: '第 14 课 你把这个句子抄十遍' },
            { id: 15, title: '第 15 课 新年就要到了' },
            { id: 16, title: '第 16 课 我要跟你一起去' },
            { id: 17, title: '第 17 课 我觉得他好多了' },
            { id: 18, title: '第 18 课我相信他们会同意的' },
            { id: 19, title: '第 19 课 你没看出来吗？' },
            { id: 20, title: '第 20 课 我被他影响了' },
        ]
    },
    { 
        level: 4, 
        title: '中级水平', 
        description: '流畅地与母语者进行交流', 
        imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 简单的爱情' },
            { id: 2, title: '第 2 课 真正的朋友' },
            { id: 3, title: '第 3 课 经理对我印象不错' },
            { id: 4, title: '第 4 课 不要太着急赚钱' },
            { id: 5, title: '第 5 课 只买对的，不买贵的' },
            { id: 6, title: '第 6 课 一分钱一分货' },
            { id: 7, title: '第 7 课 最好的医生是自己' },
            { id: 8, title: '第 8 课 话说得越高，摔得越重' },
            { id: 9, title: '第 9 课 阳光总在风雨后' },
            { id: 10, title: '第 10 课 幸福的标准' },
            { id: 11, title: '第 11 课 阅读是种享受' },
            { id: 12, title: '第 12 课 用心发现世界' },
            { id: 13, title: '第 13 课 喝着茶看京剧' },
            { id: 14, title: '第 14 课 保护地球母亲' },
            { id: 15, title: '第 15 课 教育孩子的“学问”' },
            { id: 16, title: '第 16 课 生活可以更美好' },
            { id: 17, title: '第 17 课 人与自然' },
            { id: 18, title: '第 18 课 科技与世界' },
            { id: 19, title: '第 19 课 生活的味道' },
            { id: 20, title: '第 20 课 路上的风景' },
        ]
    },
    { 
        level: 5, 
        title: '高级水平', 
        description: '阅读报刊杂志，欣赏影视节目', 
        imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 爱的细节' }, { id: 2, title: '第 2 课 父母的“唠叨”' }, { id: 3, title: '第 3 课 丈量“幸福”' },
            { id: 4, title: '第 4 课 “朝三暮四”的“猴子”' }, { id: 5, title: '第 5 课 “差不多”先生' }, { id: 6, title: '第 6 课 一张照片' },
            { id: 7, title: '第 7 课 “另类”的母亲' }, { id: 8, title: '第 8 课 “漫画”的启示' }, { id: 9, title: '第 9 课 友谊的“保鲜期”' },
            { id: 10, title: '第 10 课 成长的“痕迹”' }, { id: 11, title: '第 11 课 “跨界”的魅力' }, { id: 12, title: '第 12 课 “一见钟情”的背后' },
            { id: 13, title: '第 13 课 “慢”的智慧' }, { id: 14, title: '第 14 课 “英雄”的定义' }, { id: 15, title: '第 15 课 “距离”的学问' },
            { id: 16, title: '第 16 课 生活中的“发现”' }, { id: 17, title: '第 17 课 “真实”的价值' }, { id: 18, title: '第 18 课 “压力”是“动力”' },
            { id: 19, title: '第 19 课 “明星”的烦恼' }, { id: 20, title: '第 20 课 汉字“三美”' }, { id: 21, title: '第 21 课 京剧的“脸谱”' },
            { id: 22, title: '第 22 课 “环保”从我做起' }, { id: 23, title: '第 23 课 “克隆”的争议' }, { id: 24, title: '第 24 课 “网络”改变生活' },
            { id: 25, title: '第 25 课 “火锅”里的文化' }, { id: 26, title: '第 26 课 “丝绸之路”的今昔' }, { id: 27, title: '第 27 课 “功夫”的魅力' },
            { id: 28, title: '第 28 课 “中医”的智慧' }, { id: 29, title: '第 29 课 “城市”让生活更美好？' }, { id: 30, title: '第 30 课 “乡村”的变迁' },
            { id: 31, title: '第 31 课 “广告”的陷阱' }, { id: 32, title: '第 32 课 “消费”的观念' }, { id: 33, title: '第 33 课 “创新”的力量' },
            { id: 34, title: '第 34 课 “竞争”与“合作”' }, { id: 35, title: '第 35 课 “全球化”的挑战' }, { id: 36, title: '第 36 课 “未来”的展望' },
        ]
    },
    { 
        level: 6, 
        title: '流利水平', 
        description: '轻松理解信息，流利表达观点', 
        imageUrl: 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 创新的“智慧”' }, { id: 2, title: '第 2 课 走进“杂交水稻之父”袁隆平' }, { id: 3, title: '第 3 课 “诺贝尔奖”的背后' },
            { id: 4, title: '第 4 课 “奥运”精神' }, { id: 5, title: '第 5 课 “世界杯”的激情' }, { id: 6, title: '第 6 课 “电子商务”的革命' },
            { id: 7, title: '第 7 课 “人工智能”的未来' }, { id: 8, title: '第 8 课 “大数据”时代' }, { id: 9, title: '第 9 课 “共享经济”的浪潮' },
            { id: 10, title: '第 10 课 “移动支付”的便捷' }, { id: 11, title: '第 11 课 “高铁”的速度' }, { id: 12, title: '第 12 课 “航天”的梦想' },
            { id: 13, title: '第 13 课 “孔子”的智慧' }, { id: 14, title: '第 14 课 “老子”的道' }, { id: 15, title: '第 15 课 “孙子兵法”的谋略' },
            { id: 16, title: '第 16 课 “唐诗”的韵味' }, { id: 17, title: '第 17 课 “宋词”的婉约' }, { id: 18, title: '第 18 课 “元曲”的豪放' },
            { id: 19, title: '第 19 课 “红楼梦”的悲欢' }, { id: 20, title: '第 20 课 “西游记”的奇幻' }, { id: 21, title: '第 21 课 “三国演义”的英雄' },
            { id: 22, title: '第 22 课 “水浒传”的江湖' }, { id: 23, title: '第 23 课 “故宫”的雄伟' }, { id: 24, title: '第 24 课 “长城”的壮丽' },
            { id: 25, title: '第 25 课 “兵马俑”的震撼' }, { id: 26, title: '第 26 课 “敦煌”的瑰宝' }, { id: 27, title: '第 27 课 “茶”的文化' },
            { id: 28, title: '第 28 课 “酒”的故事' }, { id: 29, title: '第 29 课 “筷子”的哲学' }, { id: 30, title: '第 30 课 “春节”的习俗' },
            { id: 31, title: '第 31 课 “中秋”的团圆' }, { id: 32, title: '第 32 课 “端午”的纪念' }, { id: 33, title: '第 33 课 “清明”的追思' },
            { id: 34, title: '第 34 课 “家庭”的变迁' }, { id: 35, title: '第 35 课 “教育”的改革' }, { id: 36, title: '第 36 课 “健康”的追求' },
            { id: 37, title: '第 37 课 “旅游”的意义' }, { id: 38, title: '第 38 课 “时尚”的潮流' }, { id: 39, title: '第 39 课 “幸福”的感悟' },
            { id: 40, title: '第 40 课 “梦想”的力量' },
        ]
    },
];

const pinyinModules = [
  { title: '声母表', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500', borderColor: 'border-blue-500' },
  { title: '韵母表', href: '/pinyin/finals', icon: Music4, color: 'text-green-500', borderColor: 'border-green-500' },
  { title: '声调表', href: '/pinyin/tones', icon: BookText, color: 'text-yellow-500', borderColor: 'border-yellow-500' },
];

const HskCard = ({ level, onVocabularyClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMore = level.lessons.length > 5;
    const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 5);

    const cardVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
    };

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="relative rounded-xl shadow-lg overflow-hidden group transition-all duration-300 hover:shadow-2xl"
        >
            <img src={level.imageUrl} alt={level.title} className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-10"></div>
            
            <div className="relative z-20 p-6 flex flex-col h-full text-white">
                <div>
                    <h2 className="font-extrabold text-2xl">HSK {level.level} - {level.title}</h2>
                    <p className="text-sm opacity-80 mt-1">{level.description}</p>
                </div>
                
                <div className="space-y-1.5 mt-4 flex-grow">
                    {visibleLessons.map(lesson => (
                        <Link key={lesson.id} href={`/hsk/${level.level}/lessons/${lesson.id}`} passHref>
                            <a className="block p-2 rounded-md hover:bg-white/20 transition-colors cursor-pointer">
                                <span className="font-medium">{lesson.title}</span>
                            </a>
                        </Link>
                    ))}
                </div>
                
                <div className="mt-auto pt-4 space-y-2">
                    {hasMore && (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-center text-sm py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors flex items-center justify-center gap-1 font-semibold backdrop-blur-sm">
                            {isExpanded ? '收起列表' : `展开所有 ${level.lessons.length} 门课程`}
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    )}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            onVocabularyClick(level);
                        }} 
                        className="w-full text-center text-sm py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors flex items-center justify-center gap-2 font-semibold backdrop-blur-sm"
                    >
                        <ListTodo size={16} />
                        词汇列表 (全屏)
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

export default function HskPageClient() { 
  const router = useRouter();
  const [activeHskWords, setActiveHskWords] = useState(null);
  const [activeLevelTag, setActiveLevelTag] = useState(null);

  const isCardViewOpen = router.asPath.includes('#hsk-vocabulary');

  const handleVocabularyClick = useCallback((level) => {
    // 从我们的映射中动态获取对应等级的单词
    const words = hskWordsData[level.level];

    // 检查单词数据是否存在且不为空
    if (words && words.length > 0) {
      setActiveHskWords(words);
      setActiveLevelTag(`hsk${level.level}`); // 设置唯一的 progressKey
      // 使用 hash 路由来显示全屏卡片
      router.push(router.pathname + '#hsk-vocabulary', undefined, { shallow: true });
    } else {
      // 如果数据不存在或为空，给出提示
      alert(`HSK ${level.level} 的词汇列表正在准备中，敬请期待！`);
    }
  }, [router]);

  const handleCloseCard = useCallback(() => {
    setActiveHskWords(null);
    setActiveLevelTag(null);
    if (window.location.hash.includes('#hsk-vocabulary')) {
        // 使用 router.back() 来清除 hash
        router.back(); 
    }
  }, [router]);

  useEffect(() => {
    // 这个 effect 监听浏览器前进后退事件，确保 hash 变化时状态能同步
    const handleHashChange = () => {
      if (!window.location.hash.includes('hsk-vocabulary')) {
        setActiveHskWords(null);
        setActiveLevelTag(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);
  
  return (
    <>
      <div 
          className="relative min-h-screen bg-gray-100 dark:bg-gray-900"
          style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1534777367048-a53b2d1ac68e?fit=crop&w=1600&q=80)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed'
          }}
      >
          <div className="space-y-10 p-4 max-w-4xl mx-auto md:py-10 bg-white/80 dark:bg-black/70 backdrop-blur-md rounded-lg my-8 shadow-2xl">
              <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-center"
              >
                  <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 text-gray-800 dark:text-white">汉语学习中心</h1>
                  <p className="text-xl text-gray-600 dark:text-gray-300">开启你的中文学习之旅</p>
              </motion.div>
        
              <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-l-4 border-cyan-500 pl-4 py-1">拼音基础</h2>
                  <div className="grid grid-cols-3 gap-4">
                      {pinyinModules.map((module) => (
                          <Link key={module.title} href={module.href} passHref>
                              <motion.a
                                  whileHover={{ y: -5 }}
                                  whileTap={{ scale: 0.95 }}
                                  className={`block p-4 rounded-xl shadow-md border ${module.borderColor} transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center group bg-white dark:bg-gray-800 hover:shadow-lg`}
                              >
                                  <module.icon className={`${module.color} w-8 h-8 mb-2 transition-transform group-hover:scale-110`} />
                                  <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{module.title}</h3>
                              </motion.a>
                          </Link>
                      ))}
                  </div>
              </div>

              <div className="space-y-8 pt-4">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-l-4 border-purple-500 pl-4 py-1">HSK 等级课程</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {hskData.map(level => (
                        <HskCard 
                          key={level.level} 
                          level={level} 
                          onVocabularyClick={handleVocabularyClick}
                        />
                      ))}
                  </div>
              </div>
          </div>
      </div>

      <WordCard 
        isOpen={isCardViewOpen}
        words={activeHskWords || []}
        onClose={handleCloseCard}
        progressKey={activeLevelTag || 'hsk-vocab'}
      />
    </>
  );
};
