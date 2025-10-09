// /components/AiAssistantV56_Test.js
// 这是一个独立的AI助手测试组件。
// 其核心语音识别逻辑【原封不动】地复刻自您确认可用的 v56 版本。

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Globe, Send } from 'lucide-react';

const AiAssistantV56_Test = () => {
  const [userInput, setUserInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  
  // --- 设置状态 (来自 v56 的 DEFAULT_SETTINGS) ---
  const [settings, setSettings] = useState({
    speechLanguage: 'my-MM', // 默认设为缅甸语
  });

  const recognitionRef = useRef(null);

  // --- 核心语音识别逻辑 (原封不动地从 v56 复制) ---
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音输入。');
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    const recognition = new SpeechRecognition();
    recognition.lang = settings.speechLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setError(''); // 清空之前的错误
    };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      setUserInput(transcript); // 将识别结果填入输入框
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setError(`语音识别失败: ${event.error}`);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.start();
    recognitionRef.current = recognition;
  }, [settings.speechLanguage]); // 依赖于 settings.speechLanguage

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);
  // --- 核心逻辑结束 ---

  // 语言选项 (来自 v56 的 speechLanguageOptions)
  const speechLanguageOptions = [
    { name: '中文 (普通话)', value: 'zh-CN' },
    { name: '缅甸语 (မြန်မာ)', value: 'my-MM' },
    { name: 'English (US)', value: 'en-US' },
    { name: 'Español (España)', value: 'es-ES' },
    { name: 'Français (France)', value: 'fr-FR' },
    { name: '日本語', value: 'ja-JP' },
    { name: '한국어', value: 'ko-KR' },
    { name: 'Tiếng Việt', value: 'vi-VN' },
  ];

  const handleLanguageChange = (e) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      speechLanguage: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userInput.trim()) {
      alert(`已提交内容: ${userInput}`);
      // 这里可以替换为实际的发送逻辑
      setUserInput('');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border dark:border-gray-700 flex flex-col">
      <h2 className="text-xl font-bold text-center mb-2 text-gray-800 dark:text-white">AI 助手最终诊断 (v56 逻辑复刻)</h2>
      <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-4">
        请选择“缅甸语”，点击麦克风，查看结果是否正确填入输入框。
      </p>

      {/* 语言选择 */}
      <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
          <Globe size={16} className="mr-2" />
          当前识别语言:
        </label>
        <select
          value={settings.speechLanguage}
          onChange={handleLanguageChange}
          className="w-full mt-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}
        </select>
      </div>
      
      {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg text-center text-sm">{error}</div>}

      {/* 模拟的输入框和发送按钮 */}
      <form onSubmit={handleSubmit} className="flex items-end w-full p-2 bg-gray-100 dark:bg-gray-900/80 rounded-2xl shadow-inner">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={isListening ? "正在聆听..." : "识别结果将显示在这里..."}
          className="flex-1 bg-transparent focus:outline-none dark:text-gray-100 text-base resize-none mx-2 py-1 leading-6 max-h-36 placeholder-gray-500 dark:placeholder-gray-400"
          rows="2"
          style={{ minHeight: '3.5rem' }}
        />
        <div className="flex items-center space-x-2 flex-shrink-0 ml-1">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors
              ${isListening 
                ? 'text-white bg-red-500 animate-pulse' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            title="语音输入"
          >
            <Mic size={24} />
          </button>
          <button
            type="submit"
            className="w-12 h-12 flex items-center justify-center bg-blue-500 text-white rounded-full shadow-md hover:bg-blue-600 disabled:opacity-50 transition-all"
            disabled={!userInput.trim()}
          >
            <Send size={24} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AiAssistantV56_Test;
