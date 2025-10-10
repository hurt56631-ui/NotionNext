// /components/GlosbeSearchCard.js <-- 最终修复版：语音识别后自动发送

import { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, Search, Mic, Globe, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 支持的语音识别语言列表 ---
// 保持不变，可以按需扩展
const recognitionLanguages = [
  { code: 'my-MM', name: 'မြန်မာ' },
  { code: 'zh-CN', name: '中文' },
  { code: 'en-US', name: 'English' },
  { code: 'vi-VN', name: 'Tiếng Việt' },
];

/**
 * ====================================================================
 * Glosbe 高端汉缅互译卡片
 * ====================================================================
 * 经过美学和交互优化的最终版本。
 *
 * 功能亮点:
 * - 沉浸式设计: 采用现代渐变、辉光背景和精致动画，提供高端视觉体验。
 * - 智能与灵活并存: 切换翻译方向时，会自动设定最佳的语音识别语言，同时保留手动切换的地球图标，满足特殊使用场景。
 * - 增强的交互反馈: 所有按钮和输入框都有流畅的过渡动画和明确的状态指示。
 * - 核心逻辑: 语音识别后立即自动发送查询，操作更快捷。
 * - 结果在新标签页打开，确保搜索的稳定性和可靠性。
 */
const GlosbeSearchCard = () => {
  const [word, setWord] = useState('');
  const [searchDirection, setSearchDirection] = useState('my2zh');
  const [isListening, setIsListening] = useState(false);
  const [recognitionLang, setRecognitionLang] = useState('my-MM');
  const [showLangMenu, setShowLangMenu] = useState(false);

  const recognitionRef = useRef(null);
  const langMenuRef = useRef(null); // 用于处理语言菜单的外部点击

  // --- 事件处理函数 ---

  // 执行搜索
  // 这个函数现在可以被useEffect中的语音识别回调直接调用
  const handleSearch = (textToSearch) => {
    // 如果没有提供搜索文本，则使用state中的`word`
    const effectiveWord = textToSearch || word;
    const trimmedWord = effectiveWord.trim();
    if (trimmedWord) {
      const glosbeUrl = searchDirection === 'my2zh'
        ? `https://glosbe.com/my/zh/${encodeURIComponent(trimmedWord)}`
        : `https://glosbe.com/zh/my/${encodeURIComponent(trimmedWord)}`;
      window.open(glosbeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // --- 语音识别引擎初始化 ---
  useEffect(() => {
    // 检查并兼容不同浏览器的SpeechRecognition API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // 一次只识别一句话
      recognition.interimResults = false; // 不需要中间结果

      // 状态更新
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        console.error('语音识别发生错误:', event.error);
        setIsListening(false);
      };

      // ✅ 核心逻辑修改: 识别结束后，立即自动执行搜索
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setWord(transcript);      // 步骤1: 将识别结果填入输入框，让用户看到识别内容
        handleSearch(transcript); // 步骤2: 立即使用该结果执行搜索，无需等待用户确认
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('当前浏览器不支持语音识别API。');
    }

    // --- 点击外部关闭语言菜单的逻辑 ---
    const handleClickOutside = (event) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDirection]); // 依赖项中加入searchDirection确保handleSearch函数能获取到最新的翻译方向

  // --- 智能默认语言: 监听翻译方向，自动切换语音识别语言 ---
  useEffect(() => {
    const newLang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
    setRecognitionLang(newLang);
    if (recognitionRef.current) {
      recognitionRef.current.lang = newLang;
    }
  }, [searchDirection]);


  // --- 其他事件处理函数 ---

  // 切换翻译方向
  const toggleDirection = () => {
    setSearchDirection(prev => (prev === 'my2zh' ? 'zh2my' : 'my2zh'));
    setWord(''); // 切换后清空输入框
  };

  // 启动或停止语音识别
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('抱歉，您的浏览器不支持语音识别功能。');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.lang = recognitionLang; // 确保使用当前选定的语言
      recognitionRef.current.start();
    }
  };

  // --- 动态文本与样式 ---
  const placeholderText = searchDirection === 'my2zh' ? '输入缅甸语...' : '输入中文...';
  const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文';
  const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语';

  // --- JSX 渲染 ---
  return (
    <div className="relative w-full max-w-lg rounded-2xl bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/50 shadow-2xl shadow-gray-500/10 p-6 overflow-hidden transition-all duration-300 hover:shadow-lg">
      {/* 美化: 背景辉光效果，增加高端感 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400/20 dark:bg-cyan-500/20 rounded-full blur-3xl opacity-50"></div>
      
      {/* 标题 */}
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white relative z-10">
        汉缅互译词典
      </h2>
      
      {/* 搜索输入区 */}
      <div className="relative flex items-center gap-3">
        {/* 美化: 图标样式和输入框样式 */}
        <Search className="absolute left-4 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
        <motion.input
          layout
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={isListening ? '正在聆听，请说话...' : placeholderText}
          className="w-full pl-12 pr-4 py-3 text-base text-gray-900 dark:text-gray-100 bg-gray-100/50 dark:bg-gray-900/50 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 shadow-inner"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleListening}
          className={`p-3 rounded-lg transition-colors duration-300 ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-cyan-500 hover:text-white'}`}
          title={isListening ? "停止识别" : "语音输入"}
        >
          {/* 美化: 聆听时有呼吸动画效果 */}
          {isListening ? (
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
              <Mic size={20} />
            </motion.div>
          ) : (
            <Mic size={20} />
          )}
        </motion.button>
      </div>

      {/* 底部操作区 */}
      <div className="flex justify-between items-center mt-5">
        {/* 语言切换方向 */}
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          <span className="font-semibold">{fromLang}</span>
          <motion.button 
            whileTap={{ scale: 0.9, rotate: 180 }}
            onClick={toggleDirection} 
            title="切换翻译方向" 
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftRight size={18} />
          </motion.button>
          <span className="font-semibold">{toLang}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 语言选择菜单 (保留灵活性) */}
          <div className="relative" ref={langMenuRef}>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowLangMenu(!showLangMenu)} 
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" 
              title="选择语音识别语言"
            >
              <Globe size={18} />
            </motion.button>
            <AnimatePresence>
              {showLangMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-full right-0 mb-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-20 overflow-hidden"
                >
                  {recognitionLanguages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setRecognitionLang(lang.code); setShowLangMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${recognitionLang === lang.code ? 'bg-cyan-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* 搜索按钮 */}
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSearch()} 
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-cyan-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-75 transition-all"
          >
            查 询
          </motion.button>
        </div>
      </div>
    </div>
  )
}

export default GlosbeSearchCard;
