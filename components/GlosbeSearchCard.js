// /components/GlosbeSearchCard.js  <-- 最终修复版：语音识别后不再自动发送

import { useState, useEffect, useRef } from 'react'
import { ArrowLeftRight, Search, Mic, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// 支持的语音识别语言列表
const recognitionLanguages = [
  { code: 'my-MM', name: 'မြန်မာ' },
  { code: 'zh-CN', name: '中文' },
  { code: 'en-US', name: 'English' },
  // 您可以按需在这里添加更多语言，例如越南语
  { code: 'vi-VN', name: 'Tiếng Việt' },
];

/**
 * Glosbe 词典搜索卡片 - 语音增强版
 * - 支持缅中双向互译
 * - 集成浏览器原生语音识别功能，支持多语言切换
 * - ✅ 语音识别后不再自动查询，而是将结果填入输入框，由用户确认
 * - 结果在新标签页打开，确保可靠性
 */
const GlosbeSearchCard = () => {
  const [word, setWord] = useState('');
  const [searchDirection, setSearchDirection] = useState('my2zh');
  const [isListening, setIsListening] = useState(false);
  const [recognitionLang, setRecognitionLang] = useState('my-MM');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const recognitionRef = useRef(null);
  const langMenuRef = useRef(null);

  // 初始化语音识别引擎
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        setIsListening(false);
      };
      
      // ✅ 核心修改：语音识别结束后，只更新输入框内容，不再自动提交搜索
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setWord(transcript);
        // handleSearch(transcript); // <-- 已注释掉此行，不再自动发送
      };

      recognitionRef.current = recognition;
    }

    const handleClickOutside = (event) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };

  }, []);

  // 监听翻译方向的变化，并自动切换默认的语音识别语言
  useEffect(() => {
    if (searchDirection === 'my2zh') {
      setRecognitionLang('my-MM');
    } else {
      setRecognitionLang('zh-CN');
    }
  }, [searchDirection]);


  // 切换翻译方向
  const toggleDirection = () => {
    setSearchDirection(prev => (prev === 'my2zh' ? 'zh2my' : 'my2zh'));
    setWord('');
  };

  // 处理搜索 (此函数本身不变，但现在只由用户手动触发)
  const handleSearch = (textToSearch = word) => {
    const trimmedWord = textToSearch.trim();
    if (trimmedWord) {
      const glosbeUrl = searchDirection === 'my2zh'
        ? `https://glosbe.com/my/zh/${encodeURIComponent(trimmedWord)}`
        : `https://glosbe.com/zh/my/${encodeURIComponent(trimmedWord)}`;
      window.open(glosbeUrl, '_blank');
    }
  };

  // 启动语音识别
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.lang = recognitionLang;
      recognitionRef.current.start();
    }
  };

  const placeholderText = searchDirection === 'my2zh' ? '请输入缅甸语...' : '请输入中文...';
  const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文';
  const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语';

  return (
    <div className="relative w-full rounded-2xl shadow-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 border dark:border-gray-700/50 overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 dark:bg-blue-400/10 rounded-full blur-2xl"></div>
      
      <h2 className="text-xl font-bold mb-5 text-center text-gray-800 dark:text-white relative z-10">汉缅互译词典</h2>
      
      {/* 搜索输入框 */}
      <div className="relative flex items-center gap-2">
        <Search className="absolute left-4 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={isListening ? '正在聆听...' : placeholderText}
          className="w-full pl-12 pr-4 py-3 text-lg text-gray-800 dark:text-gray-200 bg-white/50 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-sm"
        />
        <button
          onClick={startListening}
          className={`p-3 rounded-lg transition-all duration-300 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 hover:text-white'}`}
          title="语音输入"
        >
          <Mic size={20} />
        </button>
      </div>

      {/* 底部操作区 */}
      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          <span className="font-semibold">{fromLang}</span>
          <button onClick={toggleDirection} title="切换翻译方向" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><ArrowLeftRight size={18} /></button>
          <span className="font-semibold">{toLang}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 语言选择菜单 */}
          <div className="relative" ref={langMenuRef}>
            <button onClick={() => setShowLangMenu(!showLangMenu)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="选择语音识别语言">
              <Globe size={18} />
            </button>
            <AnimatePresence>
              {showLangMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-2 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-20"
                >
                  {recognitionLanguages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setRecognitionLang(lang.code); setShowLangMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-sm ${recognitionLang === lang.code ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => handleSearch()} className="px-6 py-2.5 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-all">
            查 询
          </button>
        </div>
      </div>
    </div>
  )
}

export default GlosbeSearchCard
