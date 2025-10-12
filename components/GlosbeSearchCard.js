// /components/GlosbeSearchCard.js <-- 最终版 (设置弹窗 + OpenAI兼容修复 + UI简化)

import { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, Mic, Settings, Send, Loader2, Copy, Volume2, Repeat, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- (辅助函数和提示词保持不变) ---
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

const GlosbeSearchCard = () => {
  const [word, setWord] = useState('');
  const [searchDirection, setSearchDirection] = useState('my2zh');
  const [isListening, setIsListening] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiError, setAiError] = useState('');
  
  // --- 核心修改: settingsOpen 控制弹窗 ---
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- 核心修改: 更新默认接口地址 ---
  const [apiSettings, setApiSettings] = useState({
    url: 'https://open-gemini-api.deno.dev/v1/chat/completions',
    model: 'gemini-pro',
    key: '',
  });

  const recognitionRef = useRef(null);

  useEffect(() => {
    const savedSettings = localStorage.getItem('aiApiSettings_v3');
    if (savedSettings) {
      setApiSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('aiApiSettings_v3', JSON.stringify(apiSettings));
    setSettingsOpen(false); // 保存后关闭弹窗
    alert('设置已保存！');
  };
  
  const handleLegacySearch = (searchText) => {
    const textToSearch = (searchText || word).trim();
    if (!textToSearch) return;
    const glosbeUrl = searchDirection === 'my2zh' ? `https://glosbe.com/my/zh/${encodeURIComponent(textToSearch)}` : `https://glosbe.com/zh/my/${encodeURIComponent(textToSearch)}`;
    window.open(glosbeUrl, '_blank');
  };

  // --- 核心修改: AI翻译请求改为OpenAI兼容格式 ---
  const handleAiTranslate = async () => {
    const trimmedWord = word.trim();
    if (!trimmedWord) return;
    if (!apiSettings.key) {
        setAiError('请点击右上角设置图标，填写您的API密钥。');
        return;
    }

    setIsAISearching(true);
    setAiResults([]);
    setAiError('');

    const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文';
    const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语';
    const prompt = getAIPrompt(trimmedWord, fromLang, toLang);
    
    try {
      const response = await fetch(apiSettings.url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiSettings.key}` // 使用 Bearer Token 认证
        },
        body: JSON.stringify({ 
          model: apiSettings.model,
          messages: [{ role: 'user', content: prompt }] 
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API请求失败: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      // 使用 OpenAI 兼容的响应格式解析
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error('API返回了非预期的格式。');
      }
      
      const parsedResults = text.split(/📖|💬|💡|🐼/).filter(p => p.trim()).map(part => {
        const lines = part.trim().split('\n');
        const title = lines[0]?.replace(/\*+/g, '').trim() || '翻译结果';
        const translation = lines[1]?.replace(/\*+/g, '').replace(/^-/, '').trim() || '';
        const meaning = lines[2]?.replace(/\*+/g, '').replace(/^-/, '').trim() || '';
        return { title, translation, meaning };
      });

      setAiResults(parsedResults);

    } catch (error) {
      console.error('AI翻译错误:', error);
      setAiError(`翻译失败: ${error.message} 请检查网络、API密钥和接口地址。`);
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
      recognition.onerror = (event) => { console.error('语音识别错误:', event.error); setIsListening(false); };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setWord(transcript);
        setTimeout(() => {
          // 此处直接引用 state hook 的 set 函数的回调来获取最新的 useAI 值
          setUseAI(currentUseAI => {
            if (currentUseAI) {
              handleAiTranslate();
            } else {
              handleLegacySearch(transcript);
            }
            return currentUseAI;
          });
        }, 100);
      };
      recognitionRef.current = recognition;
    }
  }, [searchDirection]); // 移除对 apiSettings 和 useAI 的依赖，避免重复制

  const toggleDirection = () => { setSearchDirection(prev => (prev === 'my2zh' ? 'zh2my' : 'my2zh')); setWord(''); setAiResults([]); setAiError(''); };
  const handleMicOrSend = () => { if (word.trim()) { if (useAI) { handleAiTranslate(); } else { handleLegacySearch(); } } else { toggleListening(); } };
  const toggleListening = () => { if (!recognitionRef.current) { alert('抱歉，您的浏览器不支持语音识别。'); return; } if (isListening) { recognitionRef.current.stop(); } else { recognitionRef.current.lang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN'; recognitionRef.current.start(); } };
  const handleCopy = (text) => navigator.clipboard.writeText(text);
  const handleSpeak = (textToSpeak) => { const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToSpeak)}&v=zh-CN-XiaochenMultilingualNeural`; new Audio(url).play(); };
  const handleBackTranslate = (text) => { toggleDirection(); setTimeout(() => { setWord(text); if (useAI) { handleAiTranslate(); } }, 100); }

  const placeholderText = searchDirection === 'my2zh' ? '输入缅甸语...' : '输入中文...';

  return (
    <div className="relative w-full max-w-lg rounded-2xl bg-white/80 dark:bg-gray-800/70 backdrop-blur-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-2xl shadow-gray-500/10 p-6 sm:p-8 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-400/20 dark:bg-cyan-500/20 rounded-full blur-3xl opacity-50"></div>
      
      <div className="flex justify-between items-center mb-5 relative z-10">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">汉缅互译</h2>
        {/* --- 核心修改: 设置按钮打开弹窗 --- */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSettingsOpen(true)} className="p-2.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="API设置">
            <Settings size={20} />
        </motion.button>
      </div>
      
      <div className="relative">
        <motion.textarea layout rows="3" value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMicOrSend(); } }} placeholder={placeholderText} className="w-full pl-4 pr-16 py-3 text-base resize-none text-gray-900 dark:text-gray-100 bg-gray-100/60 dark:bg-gray-900/60 border-2 border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 shadow-inner" />
        <motion.button whileTap={{ scale: 0.9 }} onClick={handleMicOrSend} className={`absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-lg transition-all duration-300 ${ word.trim() ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' }`} title={word.trim() ? '发送' : (isListening ? '停止' : '语音输入')}>
          {word.trim() ? <Send size={20} /> : isListening ? <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}><Mic size={20} /></motion.div> : <Mic size={20} />}
        </motion.button>
      </div>

      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-gray-900/50 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300">
          <span className="font-semibold pl-2">{searchDirection === 'my2zh' ? '缅甸语' : '中文'}</span>
          <motion.button whileTap={{ scale: 0.9, rotate: 180 }} onClick={toggleDirection} title="切换翻译方向" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><ArrowLeftRight size={18} /></motion.button>
          <span className="font-semibold pr-2">{searchDirection === 'my2zh' ? '中文' : '缅甸语'}</span>
        </div>
        {/* --- 核心修改: 移除多余文字 --- */}
        <div className="flex items-center gap-3">
            <motion.button onClick={() => setUseAI(!useAI)} className={`w-12 h-7 rounded-full transition-colors flex items-center shadow-inner ${useAI ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} title={`切换到 ${useAI ? 'Glosbe 翻译' : 'AI 翻译'}`}>
                <motion.div className="w-5 h-5 bg-white rounded-full shadow" layout transition={{ type: 'spring', stiffness: 700, damping: 30 }} initial={false} animate={{ x: useAI ? 25 : 3 }} />
            </motion.button>
        </div>
      </div>

      {/* --- 核心修改: 设置面板改为弹窗 Modal --- */}
      <AnimatePresence>
        {settingsOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSettingsOpen(false)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">API 设置 (AI翻译)</h3>
                        <button onClick={() => setSettingsOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20}/></button>
                    </div>
                    <div className="space-y-4">
                        <div><label className="text-sm font-medium text-gray-600 dark:text-gray-300">接口地址</label><input type="text" value={apiSettings.url} onChange={(e) => setApiSettings({...apiSettings, url: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/></div>
                        <div><label className="text-sm font-medium text-gray-600 dark:text-gray-300">模型</label><input type="text" value={apiSettings.model} onChange={(e) => setApiSettings({...apiSettings, model: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/></div>
                        <div><label className="text-sm font-medium text-gray-600 dark:text-gray-300">密钥 (API Key)</label><input type="password" value={apiSettings.key} onChange={(e) => setApiSettings({...apiSettings, key: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/></div>
                    </div>
                    <button onClick={handleSaveSettings} className="w-full mt-6 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-600 transition-colors">保存并关闭</button>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 relative z-10 min-h-[100px]">
        <AnimatePresence>
          {isAISearching && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center p-4"><Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan-500" /><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">AI正在努力翻译中...</p></motion.div>)}
          {aiError && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{aiError}</motion.div>)}
          {aiResults.length > 0 && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {aiResults.map((result, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="p-5 rounded-xl bg-gradient-to-br from-white/90 to-gray-50/90 dark:from-gray-900/80 dark:to-gray-800/80 border dark:border-gray-700/80 shadow-lg shadow-gray-500/5">
                  <h4 className="font-semibold text-base text-cyan-600 dark:text-cyan-400 mb-2">{result.title}</h4>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{result.translation}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{result.meaning}</p>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50"><button onClick={() => handleCopy(result.translation)} title="复制" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Copy size={16}/></button><button onClick={() => handleSpeak(result.translation)} title="朗读" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Volume2 size={16}/></button><button onClick={() => handleBackTranslate(result.translation)} title="回译" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Repeat size={16}/></button></div>
                </motion.div>
              ))}
          </motion.div>)}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default GlosbeSearchCard;
