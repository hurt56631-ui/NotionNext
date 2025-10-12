// /components/GlosbeSearchCard.js <-- 最终修复版：功能增强与AI集成

import { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, Mic, Settings, Send, Loader2, Copy, Volume2, Repeat, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// AI翻译提示词模板 (保持不变)
const getAIPrompt = (word, fromLang, toLang) => `
请将以下 ${fromLang} 内容翻译成 ${toLang}：
"${word}"

请严格按照下面的格式提供多种风格的翻译结果，不要有任何多余的解释或标题：

📖 **自然直译版**
[此处为加粗的${toLang}翻译]
(此版本对应的中文意思)

💬 **口语版**
[此处为加粗的${toLang}翻译]
(此版本对应的中文意思)

💡 **自然意译版**
[此处为加粗的${toLang}翻译]
(此版本对应的中文意思)

🐼 **通顺意译版**
[此处为加粗的${toLang}翻译]
(此版本对应的中文意思)
`;


/**
====================================================================
Glosbe 高端汉缅互译卡片 (V2.0 - 根据用户反馈优化)
====================================================================
新功能与优化:
1.  **AI/普通搜索分离**: 新增AI模式开关，用户可自由选择是否使用AI翻译。普通搜索不再需要API Key。
2.  **自动化流程**: 语音识别后，根据当前模式（AI或普通）自动执行搜索并展示结果。
3.  **全新UI布局**:
    *   翻译方向切换按钮移至顶部，与设置按钮并列。
    *   设置面板默认展开，窗口更大，所有选项一目了然。
    *   AI模式开关采用圆形图标按钮，状态（绿/灰）清晰。
    *   移除了不必要的语音语言选择按钮，界面更简洁。
4.  **美化设计**: 整体布局和翻译结果面板经过重新设计，更显简洁、高端、大方。
*/
const GlosbeSearchCard = () => {
  const [word, setWord] = useState('');
  const [searchDirection, setSearchDirection] = useState('my2zh');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // --- 新增: AI模式状态 ---
  const [useAI, setUseAI] = useState(false); // 默认关闭AI模式

  // --- AI翻译相关State ---
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiError, setAiError] = useState('');
  
  // --- 设置相关State ---
  const [apiSettings, setApiSettings] = useState({
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    model: 'gemini-pro',
    key: '',
  });

  // --- 从localStorage加载/保存设置 ---
  useEffect(() => {
    const savedSettings = localStorage.getItem('aiApiSettings');
    if (savedSettings) {
      setApiSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('aiApiSettings', JSON.stringify(apiSettings));
    alert('设置已保存！');
  };

  // --- 核心功能函数 ---

  // 普通搜索函数 (占位)
  const handleLegacySearch = (searchText) => {
    const text = searchText || word.trim();
    if (!text) return;
    
    // =================================================================
    // TODO: 在这里填入您原来的普通搜索逻辑（例如：跳转到Glosbe页面）
    // 示例: 
    // const fromLang = searchDirection === 'my2zh' ? 'my' : 'zh';
    // const toLang = searchDirection === 'my2zh' ? 'zh' : 'my';
    // window.open(`https://glosbe.com/${fromLang}/${toLang}/${encodeURIComponent(text)}`, '_blank');
    // =================================================================
    
    console.log(`执行普通搜索: ${text}`);
    // 您可以在这里设置普通搜索的结果状态，或执行页面跳转等操作
    alert(`已执行普通搜索: "${text}"。请在函数 handleLegacySearch 中实现您的具体逻辑。`);
  };

  // AI翻译执行函数
  const handleAiTranslate = async () => {
    const trimmedWord = word.trim();
    if (!trimmedWord) return;

    if (!apiSettings.key) {
      setAiError('请在下方设置中填写您的API密钥才能使用AI翻译。');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API请求失败: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      
      const parsedResults = text.split(/📖|💬|💡|🐼/).filter(p => p.trim()).map(part => {
        const lines = part.trim().split('\n');
        const title = lines[0]?.replace(/\*+/g, '').trim() || '翻译结果';
        const translation = lines[1]?.replace(/\*+/g, '').trim() || '';
        const meaning = lines[2]?.trim() || '';
        return { title, translation, meaning };
      });

      setAiResults(parsedResults);

    } catch (error) {
      console.error('AI翻译错误:', error);
      setAiError(`翻译失败: ${error.message}. 请检查网络、API密钥和接口地址。`);
    } finally {
      setIsAISearching(false);
    }
  };

  // --- 语音识别引擎初始化与逻辑修改 ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      const recognitionLangCode = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
      recognition.lang = recognitionLangCode;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        console.error('语音识别发生错误:', event.error);
        setIsListening(false);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setWord(transcript);
        // 语音识别后，根据AI开关状态自动执行搜索
        if (useAI) {
          // 延迟执行以确保state更新
          setTimeout(() => handleAiTranslate(), 100);
        } else {
          handleLegacySearch(transcript);
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('当前浏览器不支持语音识别API。');
    }
  }, [searchDirection, useAI, apiSettings.key]); // 依赖项更新，确保回调函数能获取最新的状态

  // --- 事件处理函数 ---
  const toggleDirection = () => {
    setSearchDirection(prev => (prev === 'my2zh' ? 'zh2my' : 'my2zh'));
    setWord('');
    setAiResults([]);
    setAiError('');
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      alert('抱歉，您的浏览器不支持语音识别功能。');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      const recognitionLangCode = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
      recognitionRef.current.lang = recognitionLangCode;
      recognitionRef.current.start();
    }
  };
  
  const handleSendClick = () => {
      if (useAI) {
          handleAiTranslate();
      } else {
          handleLegacySearch();
      }
  }
  
  const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendClick();
      }
  }

  // --- 辅助功能函数 (复制, 朗读, 回译) ---
  const handleCopy = (text) => navigator.clipboard.writeText(text);

  const handleSpeak = (textToSpeak) => {
    const encodedText = encodeURIComponent(textToSpeak);
    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaochenMultilingualNeural&r=-20%&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;
    new Audio(url).play();
  };

  const handleBackTranslate = (text) => {
    toggleDirection();
    setTimeout(() => {
        setWord(text);
        if (useAI) {
            handleAiTranslate();
        }
    }, 100);
  }

  // --- 动态文本与样式 ---
  const placeholderText = searchDirection === 'my2zh' ? '输入缅甸语...' : '输入中文...';
  const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文';
  const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语';

  // --- JSX 渲染 ---
  return (
    <div className="relative w-full max-w-3xl rounded-2xl bg-white/80 dark:bg-gray-800/70 backdrop-blur-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-2xl shadow-gray-500/10 p-8 overflow-hidden transition-all duration-300">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-400/20 dark:bg-cyan-500/20 rounded-full blur-3xl opacity-50"></div>
      
      {/* 顶部控制区 */}
      <div className="flex justify-between items-center mb-5 relative z-10">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          汉缅互译
        </h2>
        <div className="flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{fromLang}</span>
              <motion.button 
                whileTap={{ scale: 0.9, rotate: 180 }}
                onClick={toggleDirection} 
                title="切换翻译方向" 
                className="p-2.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeftRight size={18} />
              </motion.button>
              <span className="font-semibold">{toLang}</span>
            </div>
            <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => document.getElementById('settings-panel').scrollIntoView({ behavior: 'smooth' })}
                className="p-2.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="API 设置"
            >
                <Settings size={20} />
            </motion.button>
        </div>
      </div>
      
      {/* 输入区 */}
      <div className="relative flex items-center gap-3">
        <motion.textarea
          layout
          rows="3"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? '正在聆听，请说话...' : placeholderText}
          className="w-full pl-4 pr-24 py-3 text-base resize-none text-gray-900 dark:text-gray-100 bg-gray-100/60 dark:bg-gray-900/60 border-2 border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 shadow-inner"
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleMicClick}
              className={`p-3 rounded-lg transition-all duration-300 ${
                isListening
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
              title={isListening ? '停止识别' : '语音输入'}
            >
                {isListening ? (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    <Mic size={20} />
                    </motion.div>
                ) : (
                    <Mic size={20} />
                )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSendClick}
              disabled={!word.trim()}
              className="p-3 rounded-lg bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 disabled:bg-gray-300 disabled:dark:bg-gray-600 disabled:shadow-none disabled:cursor-not-allowed transition-all"
              title="发送"
            >
              <Send size={20} />
            </motion.button>
        </div>
      </div>
      
      {/* AI 开关 */}
       <div className="flex justify-end items-center mt-4">
            <div className="flex items-center gap-3">
                <span className={`text-sm font-medium transition-colors ${useAI ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {useAI ? 'AI 翻译模式' : '普通词典模式'}
                </span>
                <motion.button
                    onClick={() => setUseAI(!useAI)}
                    className={`relative w-12 h-7 rounded-full transition-colors flex items-center shadow-inner ${useAI ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    title="切换 AI / 普通模式"
                >
                    <motion.div
                        className="w-5 h-5 bg-white rounded-full shadow"
                        layout
                        transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                        initial={{ x: 2 }}
                        animate={{ x: useAI ? 25 : 3 }}
                    >
                        {useAI && <BrainCircuit size={12} className="m-auto mt-1 text-green-500" />}
                    </motion.div>
                </motion.button>
            </div>
        </div>

      {/* 设置面板 (默认展开) */}
      <div id="settings-panel" className="mt-6 p-5 bg-gray-100/50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700/50">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">API 设置 (仅AI模式需要)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">接口地址</label>
                <input type="text" value={apiSettings.url} onChange={(e) => setApiSettings({...apiSettings, url: e.target.value})} className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
            </div>
            <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">密钥 (Key)</label>
                <input type="password" value={apiSettings.key} onChange={(e) => setApiSettings({...apiSettings, key: e.target.value})} className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
            </div>
        </div>
        <button onClick={handleSaveSettings} className="w-full md:w-auto mt-4 px-6 py-2 bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-600 transition-colors">
            保存设置
        </button>
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
                  className="p-5 rounded-xl bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/70 dark:to-gray-800/70 border dark:border-gray-700/80 shadow-md"
                >
                  <h4 className="font-semibold text-base text-cyan-600 dark:text-cyan-400 mb-2">{result.title}</h4>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {result.translation}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{result.meaning}</p>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                    <button onClick={() => handleCopy(result.translation)} title="复制" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Copy size={16}/></button>
                    <button onClick={() => handleSpeak(result.translation)} title="朗读" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Volume2 size={16}/></button>
                    <button onClick={() => handleBackTranslate(result.translation)} title="回译" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Repeat size={16}/></button>
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
