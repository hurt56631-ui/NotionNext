// /components/GlosbeSearchCard.js <-- 最终修复版：功能增强与AI集成

import { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, Mic, Globe, X, Settings, Send, Loader2, Copy, Volume2, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 支持的语音识别语言列表 ---
const recognitionLanguages = [
  { code: 'my-MM', name: 'မြန်မာ' },
  { code: 'zh-CN', name: '中文' },
  { code: 'en-US', name: 'English' },
  { code: 'vi-VN', name: 'Tiếng Việt' },
];

// --- AI翻译提示词模板 ---
const getAIPrompt = (word, fromLang, toLang) => `
请将以下 ${fromLang} 内容翻译成 ${toLang}： "${word}"

请严格按照下面的格式提供多种风格的翻译结果，不要有任何多余的解释或标题：

📖 **自然直译版**，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。
*   **[此处为加粗的${toLang}翻译]**
*   中文意思

💬 **口语版**，采用${toLang === '缅甸语' ? '缅甸' : '中国'}年轻人日常社交中的常用语和流行说法，风格自然亲切，避免书面语和机器翻译痕跡:
*   **[此处为加粗的${toLang}翻译]**
*   中文意思

💡 **自然意译版**，遵循${toLang}的思维方式和表达习惯进行翻译，确保语句流畅地道，适当口语化:
*   **[此处为加粗的${toLang}翻译]**
*   中文意思

🐼 **通顺意译**，将句子翻译成符合${toLang === '缅甸语' ? '缅甸人' : '中国人'}日常表达习惯的、流畅自然的${toLang}。
*   **[此处为加粗的${toLang}翻译]**
*   中文意思
`;


/**
 * ====================================================================
 * Glosbe 高端汉缅互译卡片 (AI增强版)
 * ====================================================================
 * 新功能:
 * - 智能按钮: 语音识别与发送按钮根据输入框内容自动切换，简化操作流程。
 * - 集成第三方AI翻译: 新增AI翻译按钮，可在卡片内直接获取多种风格的翻译结果。
 * - 内置设置面板: 允许用户自定义API接口地址、模型和密钥，默认使用Google Gemini。
 * - 丰富的结果展示: 多版本翻译结果并行显示，每条均支持回译、朗读和复制。
 * - 全新交互体验: AI翻译加载状态、结果展示动画等，提供更完善的用户反馈。
 */
const GlosbeSearchCard = () => {
  const [word, setWord] = useState('');
  const [searchDirection, setSearchDirection] = useState('my2zh');
  const [isListening, setIsListening] = useState(false);
  const [recognitionLang, setRecognitionLang] = useState('my-MM');
  const [showLangMenu, setShowLangMenu] = useState(false);
  
  // --- AI翻译与设置相关State ---
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiError, setAiError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [apiSettings, setApiSettings] = useState({
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    model: 'gemini-pro', // 备用或UI显示
    key: '',
  });

  const recognitionRef = useRef(null);
  const langMenuRef = useRef(null);
  const settingsRef = useRef(null);

  // --- 从localStorage加载/保存设置 ---
  useEffect(() => {
    const savedSettings = localStorage.getItem('aiApiSettings');
    if (savedSettings) {
      setApiSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSaveSettings = (newSettings) => {
    setApiSettings(newSettings);
    localStorage.setItem('aiApiSettings', JSON.stringify(newSettings));
    setShowSettings(false);
  };
  
  // --- 核心功能函数 ---

  // AI翻译执行函数
  const handleAiTranslate = async () => {
    const trimmedWord = word.trim();
    if (!trimmedWord) return;
    if (!apiSettings.key) {
        alert('请先在设置中填写您的API密钥。');
        setShowSettings(true);
        return;
    }

    setIsAISearching(true);
    setAiResults([]);
    setAiError('');

    const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文';
    const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语';
    const prompt = getAIPrompt(trimmedWord, fromLang, toLang);
    
    try {
      const response = await fetch(`${apiSettings.url}?key=${apiSettings.key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败，状态码: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      
      // 解析返回的文本
      const parsedResults = text.split(/📖|💬|💡|🐼/).filter(p => p.trim()).map(part => {
        const lines = part.trim().split('\n');
        const title = lines[0].trim();
        const translation = lines[1]?.replace('*', '').trim() || '';
        const meaning = lines[2]?.replace('*', '').trim() || '';
        return { title, translation, meaning };
      });

      setAiResults(parsedResults);

    } catch (error) {
      console.error('AI翻译错误:', error);
      setAiError(`翻译失败: ${error.message}. 请检查您的网络、API密钥和接口地址是否正确。`);
    } finally {
      setIsAISearching(false);
    }
  };


  // --- 语音识别引擎初始化 ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        console.error('语音识别发生错误:', event.error);
        setIsListening(false);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setWord(transcript);
        // 语音识别后不再自动搜索，而是填充输入框，让用户选择AI翻译或传统查询
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('当前浏览器不支持语音识别API。');
    }
  }, []);

  // --- 点击外部关闭菜单 ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- 智能默认语言切换 ---
  useEffect(() => {
    const newLang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
    setRecognitionLang(newLang);
    if (recognitionRef.current) {
      recognitionRef.current.lang = newLang;
    }
  }, [searchDirection]);

  // --- 事件处理函数 ---
  const toggleDirection = () => {
    setSearchDirection(prev => (prev === 'my2zh' ? 'zh2my' : 'my2zh'));
    setWord('');
    setAiResults([]);
    setAiError('');
  };

  const handleMicOrSend = () => {
    if (word.trim()) {
      handleAiTranslate(); // 有文字时，此按钮作为发送按钮触发AI翻译
    } else {
      toggleListening(); // 无文字时，作为语音识别按钮
    }
  };
  
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('抱歉，您的浏览器不支持语音识别功能。');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.lang = recognitionLang;
      recognitionRef.current.start();
    }
  };

  // --- 辅助功能函数 (复制, 朗读, 回译) ---
  const handleCopy = (text) => navigator.clipboard.writeText(text);

  const handleSpeak = (textToSpeak) => {
    const encodedText = encodeURIComponent(textToSpeak);
    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaochenMultilingualNeural&r=-20%&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;
    new Audio(url).play();
  };

  const handleBackTranslate = (text) => {
    toggleDirection();
    setTimeout(() => setWord(text), 100); // 延迟设置，确保方向切换完成
  }

  // --- 动态文本与样式 ---
  const placeholderText = searchDirection === 'my2zh' ? '输入缅甸语...' : '输入中文...';
  const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文';
  const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语';

  // --- JSX 渲染 ---
  return (
    <div className="relative w-full max-w-2xl rounded-2xl bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/50 shadow-2xl shadow-gray-500/10 p-6 overflow-hidden transition-all duration-300 hover:shadow-lg">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400/20 dark:bg-cyan-500/20 rounded-full blur-3xl opacity-50"></div>
      
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          汉缅互译词典
        </h2>
        <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="设置API"
        >
            <Settings size={20} />
        </motion.button>
      </div>
      
      {/* 设置面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            ref={settingsRef}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 right-6 w-80 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border dark:border-gray-700 z-30"
          >
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">API 设置</h3>
            <div className="space-y-3">
                <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300">接口地址</label>
                    <input type="text" value={apiSettings.url} onChange={(e) => setApiSettings({...apiSettings, url: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-100/50 dark:bg-gray-900/50 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300">模型 (可选)</label>
                    <input type="text" value={apiSettings.model} onChange={(e) => setApiSettings({...apiSettings, model: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-100/50 dark:bg-gray-900/50 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300">密钥 (Key)</label>
                    <input type="password" value={apiSettings.key} onChange={(e) => setApiSettings({...apiSettings, key: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-100/50 dark:bg-gray-900/50 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                </div>
            </div>
            <button onClick={() => handleSaveSettings(apiSettings)} className="w-full mt-4 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-600 transition-colors">
                保存
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-2">
        <motion.textarea
          layout
          rows="3"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAiTranslate())}
          placeholder={isListening ? '正在聆听，请说话...' : placeholderText}
          className="w-full px-4 py-3 text-base resize-none text-gray-900 dark:text-gray-100 bg-gray-100/50 dark:bg-gray-900/50 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 shadow-inner"
        />
        
        {/* 合并后的语音/发送按钮 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleMicOrSend}
          className={`absolute right-3 bottom-3 p-3 rounded-lg transition-all duration-300 ${
            word.trim()
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              : isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
          title={word.trim() ? '发送' : (isListening ? '停止识别' : '语音输入')}
        >
          {word.trim() ? (
            <Send size={20} />
          ) : isListening ? (
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
              <Mic size={20} />
            </motion.div>
          ) : (
            <Mic size={20} />
          )}
        </motion.button>
      </div>

      <div className="flex justify-between items-center mt-4">
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
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAiTranslate} 
            disabled={isAISearching || !word.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-cyan-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-75 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAISearching ? <Loader2 className="animate-spin" size={20}/> : 'AI 翻译'}
          </motion.button>
        </div>
      </div>

      {/* AI 翻译结果展示区 */}
      <div className="mt-6 relative z-10">
        <AnimatePresence>
          {isAISearching && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center p-4">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan-500" />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">AI正在努力翻译中...</p>
            </motion.div>
          )}
          {aiError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
                {aiError}
            </motion.div>
          )}
          {aiResults.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {aiResults.map((result, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border dark:border-gray-700/80"
                >
                  <h4 className="font-semibold text-base text-cyan-600 dark:text-cyan-400">{result.title}</h4>
                  <p className="my-2 text-lg">
                    <strong className="text-gray-900 dark:text-white">{result.translation}</strong>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{result.meaning}</p>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={() => handleCopy(result.translation)} title="复制" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Copy size={16}/></button>
                    <button onClick={() => handleSpeak(result.translation)} title="朗读" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Volume2 size={16}/></button>
                    <button onClick={() => handleBackTranslate(result.translation)} title="回译" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Repeat size={16}/></button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}

export default GlosbeSearchCard;
