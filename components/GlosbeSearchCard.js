// /components/GlosbeSearchCard.js <-- 最终修复版：功能增强与AI集成 (基于用户提供的版本修改)

import { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, Mic, Settings, Send, Loader2, Copy, Volume2, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- AI翻译提示词模板 (保持不变) ---
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
 * Glosbe 高端汉缅互译卡片 (V-UserFinal - 根据用户需求全新重构)
 * ====================================================================
 * 新功能与优化:
 * 1.  **AI/普通搜索分离**: 新增AI模式圆形开关，用户可自由选择。普通搜索不再需要API Key。
 * 2.  **自动化流程**: 语音识别后，根据当前模式（AI或普通）自动执行搜索并展示结果。
 * 3.  **全新UI布局**:
 *     *   翻译方向切换按钮移至顶部，与设置图标并列。
 *     *   设置面板默认展开，窗口更大，所有选项一目了然。
 *     *   AI模式开关采用圆形图标按钮，状态（绿/灰）清晰，取代了原有的 "AI 翻译" 大按钮。
 *     *   移除了语音语言选择按钮 (`Globe` 图标)，界面更简洁。
 * 4.  **美化设计**: 整体布局和翻译结果面板经过重新设计，更显简洁、高端、大方。
 * 5.  **保留智能按钮**: 输入框内的语音/发送合并按钮逻辑保持不变。
 */
const GlosbeSearchCard = () => {
  const [word, setWord] = useState('');
  const [searchDirection, setSearchDirection] = useState('my2zh');
  const [isListening, setIsListening] = useState(false);
  
  // --- 新增: AI模式状态 ---
  const [useAI, setUseAI] = useState(false); // 默认关闭AI模式

  // --- AI翻译与设置相关State ---
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiError, setAiError] = useState('');
  const [apiSettings, setApiSettings] = useState({
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    model: 'gemini-pro',
    key: '',
  });

  const recognitionRef = useRef(null);

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

  // 新增: 普通搜索函数 (打开Google翻译)
  const handleLegacySearch = (searchText) => {
    const textToSearch = (searchText || word).trim();
    if (!textToSearch) return;

    const fromLangCode = searchDirection === 'my2zh' ? 'my' : 'zh-CN';
    const toLangCode = searchDirection === 'my2zh' ? 'zh-CN' : 'my';
    
    const url = `https://translate.google.com/?sl=${fromLangCode}&tl=${toLangCode}&text=${encodeURIComponent(textToSearch)}&op=translate`;
    
    window.open(url, '_blank');
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
        throw new Error(`API请求失败，状态码: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      
      // 优化解析逻辑以去除所有`*`和`**`
      const parsedResults = text.split(/📖|💬|💡|🐼/).filter(p => p.trim()).map(part => {
        const lines = part.trim().split('\n');
        const title = lines[0]?.replace(/\*+/g, '').trim() || '翻译结果';
        const translation = lines[1]?.replace(/\*+/g, '').replace(/-/g, '').trim() || '';
        const meaning = lines[2]?.replace(/\*+/g, '').replace(/-/g, '').trim() || '';
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

      // 修改: 语音识别后自动执行搜索
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setWord(transcript);
        if (useAI) {
            // 使用 setTimeout 确保 state 更新后执行
            setTimeout(() => handleAiTranslate(), 100);
        } else {
            handleLegacySearch(transcript);
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('当前浏览器不支持语音识别API。');
    }
  }, [useAI, searchDirection, apiSettings.key]); // 依赖项必须包含useAI等，确保回调能获取最新状态


  // --- 事件处理函数 ---
  const toggleDirection = () => {
    setSearchDirection(prev => (prev === 'my2zh' ? 'zh2my' : 'my2zh'));
    setWord('');
    setAiResults([]);
    setAiError('');
  };

  const handleMicOrSend = () => {
    if (word.trim()) {
      // 修改: 根据AI模式决定操作
      if (useAI) {
        handleAiTranslate();
      } else {
        handleLegacySearch();
      }
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
      // 自动设置识别语言
      recognitionRef.current.lang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
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
    setTimeout(() => {
        setWord(text);
        // 回译后如果AI模式开启，自动再次翻译
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
        <div className="flex items-center gap-4">
            {/* 缅甸语<->中文 切换按钮 */}
            <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-gray-900/50 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300">
                <span className="font-semibold pl-2">{fromLang}</span>
                <motion.button 
                    whileTap={{ scale: 0.9, rotate: 180 }}
                    onClick={toggleDirection} 
                    title="切换翻译方向" 
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    <ArrowLeftRight size={18} />
                </motion.button>
                <span className="font-semibold pr-2">{toLang}</span>
            </div>
            {/* 设置按钮 */}
            <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => document.getElementById('settings-panel').scrollIntoView({ behavior: 'smooth' })}
                className="p-2.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="滚动到API设置"
            >
                <Settings size={20} />
            </motion.button>
        </div>
      </div>
      
      {/* 输入框与智能按钮 */}
      <div className="relative">
        <motion.textarea
          layout
          rows="3"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleMicOrSend())}
          placeholder={isListening ? '正在聆听，请说话...' : placeholderText}
          className="w-full pl-4 pr-16 py-3 text-base resize-none text-gray-900 dark:text-gray-100 bg-gray-100/60 dark:bg-gray-900/60 border-2 border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 shadow-inner"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleMicOrSend}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-lg transition-all duration-300 ${
            word.trim()
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              : isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
          title={word.trim() ? '发送' : (isListening ? '停止识别' : '语音输入')}
        >
          {word.trim() ? ( <Send size={20} /> ) : 
           isListening ? ( <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}><Mic size={20} /></motion.div> ) : 
           ( <Mic size={20} /> )}
        </motion.button>
      </div>

      {/* AI 模式切换开关 */}
      <div className="flex justify-end items-center mt-4">
        <div className="flex items-center gap-3">
            <span className={`text-sm font-medium transition-colors ${useAI ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {useAI ? 'AI 翻译' : '普通翻译'}
            </span>
            <motion.button
                onClick={() => setUseAI(!useAI)}
                className={`w-12 h-7 rounded-full transition-colors flex items-center shadow-inner ${useAI ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                title="切换 AI / 普通模式"
            >
                <motion.div
                    className="w-5 h-5 bg-white rounded-full shadow"
                    layout
                    transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                    initial={false}
                    animate={{ x: useAI ? 25 : 3 }}
                />
            </motion.button>
        </div>
      </div>

      {/* 设置面板 (默认展开) */}
      <div id="settings-panel" className="mt-8 p-6 bg-gray-100/50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700/50 scroll-mt-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">API 设置 (仅AI翻译模式需要)</h3>
        <div className="space-y-4">
            <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">接口地址</label>
                <input type="text" value={apiSettings.url} onChange={(e) => setApiSettings({...apiSettings, url: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
            </div>
            <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">模型 (可选)</label>
                <input type="text" value={apiSettings.model} onChange={(e) => setApiSettings({...apiSettings, model: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
            </div>
            <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">密钥 (Key)</label>
                <input type="password" value={apiSettings.key} onChange={(e) => setApiSettings({...apiSettings, key: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
            </div>
        </div>
        <button onClick={handleSaveSettings} className="w-full mt-5 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-600 transition-colors">
            保存设置
        </button>
      </div>

      {/* AI 翻译结果展示区 */}
      <div className="mt-8 relative z-10 min-h-[100px]">
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
                  className="p-5 rounded-xl bg-gradient-to-br from-white/90 to-gray-50/90 dark:from-gray-900/80 dark:to-gray-800/80 border dark:border-gray-700/80 shadow-lg shadow-gray-500/5"
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
