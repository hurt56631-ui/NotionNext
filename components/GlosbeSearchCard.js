// /components/GlosbeSearchCard.js <-- 最终修复版 V3.0: 按钮合并与逻辑完善

import { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, Mic, Settings, Send, Loader2, Copy, Volume2, Repeat, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// AI翻译提示词模板 (保持不变)
const getAIPrompt = (word, fromLang, toLang, model) => `
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
Glosbe 高端汉缅互译卡片 (V3.0 - 最终用户需求版)
====================================================================
核心优化:
1.  **智能按钮合并**: 输入框右侧实现单一按钮逻辑。无内容时为语音输入，有内容时自动切换为发送按钮。
2.  **普通搜索实现**: "普通翻译"模式不再提示，而是直接调用Google翻译在新标签页中打开搜索结果，无需任何Key。
3.  **AI设置增强**: 设置面板中的模型选择改为下拉菜单，预置多个常用AI模型。
4.  **UI精简**: 模式切换标签简化为 "普通翻译" / "AI 翻译"。
*/
const GlosbeSearchCard = () => {
  const [word, setWord] = useState('');
  const [searchDirection, setSearchDirection] = useState('my2zh');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const [useAI, setUseAI] = useState(false);

  const [isAISearching, setIsAISearching] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiError, setAiError] = useState('');
  
  const [apiSettings, setApiSettings] = useState({
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    model: 'gemini-pro',
    key: '',
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('aiApiSettings');
    if (savedSettings) {
      setApiSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setApiSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = () => {
    localStorage.setItem('aiApiSettings', JSON.stringify(apiSettings));
    alert('设置已保存！');
  };
  
  // --- 核心功能函数 ---

  // 普通搜索函数 - 跳转到Google翻译
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
    const prompt = getAIPrompt(trimmedWord, fromLang, toLang, apiSettings.model);

    try {
      const apiUrl = apiSettings.url.includes(':generateContent') 
        ? `${apiSettings.url.split(':generateContent')[0].replace('gemini-pro', apiSettings.model)}:generateContent`
        : apiSettings.url; // 兼容用户自定义的URL

      const response = await fetch(`${apiUrl}?key=${apiSettings.key}`, {
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

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => console.error('语音识别发生错误:', event.error);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setWord(transcript);
        // 关键：语音识别后，立即根据当前模式触发相应操作
        if (useAI) {
          // 使用 setTimeout 确保 state 更新后执行
          setTimeout(() => document.getElementById('smart-button')?.click(), 100);
        } else {
          handleLegacySearch(transcript);
        }
      };
      recognitionRef.current = recognition;
    }
  }, [searchDirection, useAI, apiSettings.key]); // 依赖项更新

  const toggleDirection = () => {
    setSearchDirection(prev => (prev === 'my2zh' ? 'zh2my' : 'my2zh'));
    setWord('');
    setAiResults([]);
    setAiError('');
  };

  // 合并后的智能按钮点击事件
  const handleSmartButtonClick = () => {
    if (word.trim()) {
      // 发送逻辑
      if (useAI) {
        handleAiTranslate();
      } else {
        handleLegacySearch();
      }
    } else {
      // 语音输入逻辑
      if (!recognitionRef.current) {
        alert('抱歉，您的浏览器不支持语音识别功能。');
        return;
      }
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.lang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
        recognitionRef.current.start();
      }
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSmartButtonClick();
    }
  };

  const handleCopy = (text) => navigator.clipboard.writeText(text);
  const handleSpeak = (textToSpeak) => new Audio(`https://t.leftsite.cn/tts?t=${encodeURIComponent(textToSpeak)}&v=zh-CN-XiaochenMultilingualNeural`).play();
  const handleBackTranslate = (text) => {
    toggleDirection();
    setTimeout(() => setWord(text), 100);
  };

  const placeholderText = searchDirection === 'my2zh' ? '输入缅甸语...' : '输入中文...';
  const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文';
  const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语';

  return (
    <div className="relative w-full max-w-3xl rounded-2xl bg-white/80 dark:bg-gray-800/70 backdrop-blur-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-2xl shadow-gray-500/10 p-8 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-400/20 dark:bg-cyan-500/20 rounded-full blur-3xl opacity-50"></div>
      
      <div className="flex justify-between items-center mb-5 relative z-10">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">汉缅互译</h2>
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-gray-900/50 rounded-full">
              <span className="font-semibold pl-2">{fromLang}</span>
              <motion.button whileTap={{ scale: 0.9, rotate: 180 }} onClick={toggleDirection} title="切换翻译方向" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <ArrowLeftRight size={18} />
              </motion.button>
              <span className="font-semibold pr-2">{toLang}</span>
            </div>
        </div>
      </div>
      
      <div className="relative">
        <motion.textarea
          layout
          rows="3"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? '正在聆听...' : placeholderText}
          className="w-full pl-4 pr-16 py-3 text-base resize-none text-gray-900 dark:text-gray-100 bg-gray-100/60 dark:bg-gray-900/60 border-2 border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300 shadow-inner"
        />
        <motion.button
          id="smart-button"
          whileTap={{ scale: 0.9 }}
          onClick={handleSmartButtonClick}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-lg transition-all duration-300 flex items-center justify-center
            ${word.trim()
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              : isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          title={word.trim() ? '发送' : (isListening ? '停止识别' : '语音输入')}
        >
          <AnimatePresence mode="popLayout">
            {word.trim() ? (
              <motion.div key="send" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Send size={20} />
              </motion.div>
            ) : isListening ? (
              <motion.div key="mic-listening" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                <Mic size={20} />
              </motion.div>
            ) : (
              <motion.div key="mic-idle" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Mic size={20} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      
       <div className="flex justify-end items-center mt-4">
            <div className="flex items-center gap-3">
                <span className={`text-sm font-medium transition-colors ${useAI ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {useAI ? 'AI 翻译' : '普通翻译'}
                </span>
                <motion.div whileTap={{ scale: 0.95 }} className="flex">
                    <button
                        onClick={() => setUseAI(!useAI)}
                        className={`relative w-12 h-7 rounded-full transition-colors flex items-center shadow-inner ${useAI ? 'bg-cyan-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        title="切换翻译模式"
                    >
                        <motion.span layout className="w-5 h-5 bg-white rounded-full shadow" transition={{ type: 'spring', stiffness: 700, damping: 30 }} style={{ x: useAI ? 22 : 3 }} />
                    </button>
                </motion.div>
            </div>
        </div>

      <div id="settings-panel" className="mt-6 p-5 bg-gray-100/50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700/50">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2"><Settings size={20}/> API 设置 (仅AI翻译模式需要)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">模型 (Model)</label>
              <select name="model" value={apiSettings.model} onChange={handleSettingsChange} className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500">
                  <option value="gemini-pro">gemini-pro (默认)</option>
                  <option value="gemini-1.5-flash-latest">gemini-1.5-flash</option>
                  {/* 可以添加更多模型 */}
              </select>
          </div>
          <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">密钥 (Key)</label>
              <input type="password" name="key" value={apiSettings.key} onChange={handleSettingsChange} className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
          </div>
          <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">接口地址 (URL)</label>
              <input type="text" name="url" value={apiSettings.url} onChange={handleSettingsChange} className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
          </div>
        </div>
        <button onClick={handleSaveSettings} className="w-full md:w-auto mt-4 px-6 py-2 bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-600 transition-colors">
            保存设置
        </button>
      </div>

      <div className="mt-6 relative z-10 min-h-[100px]">
        <AnimatePresence>
          {isAISearching && ( /* ...加载动画... */ )}
          {aiError && ( /* ...错误提示... */ )}
          {aiResults.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {aiResults.map((result, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="p-5 rounded-xl bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/70 dark:to-gray-800/70 border dark:border-gray-700/80 shadow-md">
                  <h4 className="font-semibold text-base text-cyan-600 dark:text-cyan-400 mb-2">{result.title}</h4>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{result.translation}</p>
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
