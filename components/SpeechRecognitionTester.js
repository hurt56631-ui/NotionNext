// /components/SpeechRecognitionTester.js
// 这是一个独立的测试组件，用于验证浏览器是否能识别缅甸语。
// 其核心逻辑完全基于您提供的、曾经可以正常工作的 AiChatAssistant.js (v56) 文件。

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Globe } from 'lucide-react';

const SpeechRecognitionTester = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  
  // 语言选项，与您提供的 v56 版本完全一致
  const [speechLanguage, setSpeechLanguage] = useState('my-MM'); // 默认设为缅甸语
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

  const recognitionRef = useRef(null);

  // 核心语音识别逻辑，直接从 v56 版本中提取
  const startListening = useCallback(() => {
    // 检查浏览器是否支持语音识别API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('错误：您的浏览器不支持语音识别功能。');
      return;
    }

    // 关键：中止任何可能正在进行的识别任务。
    // v56 版本中存在此行，我们保留它以确保逻辑一致。
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    // 创建一个新的识别实例
    const recognition = new SpeechRecognition();
    
    // 设置识别语言，这是最关键的一步
    recognition.lang = speechLanguage;
    
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // 设置事件处理器
    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setError('');
    };

    recognition.onresult = (event) => {
      const recognizedText = event.results[0][0].transcript.trim();
      setTranscript(recognizedText);
    };

    recognition.onerror = (event) => {
      console.error("语音识别错误:", event.error);
      setError(`识别失败: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    // 启动识别
    recognition.start();
    recognitionRef.current = recognition;
  }, [speechLanguage]); // 依赖于当前选择的语言

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);


  return (
    <div className="w-full max-w-md mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border dark:border-gray-700">
      <h2 className="text-xl font-bold text-center mb-4 text-gray-800 dark:text-white">语音识别独立测试</h2>
      <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
        此组件用于诊断缅甸语识别问题。请选择语言并点击麦克风。
      </p>

      {/* 语言选择 */}
      <div className="mb-4">
        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
          <Globe size={16} className="mr-2" />
          选择识别语言:
        </label>
        <select
          value={speechLanguage}
          onChange={(e) => setSpeechLanguage(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}
        </select>
      </div>

      {/* 控制按钮 */}
      <div className="flex justify-center my-6">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`w-20 h-20 flex items-center justify-center rounded-full transition-all duration-300 text-white shadow-lg
            ${isListening 
              ? 'bg-red-500 animate-pulse' 
              : 'bg-blue-500 hover:bg-blue-600'
            }`}
          title="开始/停止语音输入"
        >
          <Mic size={32} />
        </button>
      </div>

      {/* 结果显示 */}
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-900/50 rounded-lg min-h-[80px]">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200">识别结果:</h3>
        {isListening && <p className="text-gray-500 italic animate-pulse">正在聆听...</p>}
        {transcript && <p className="mt-2 text-lg text-gray-900 dark:text-white font-mono break-words">{transcript}</p>}
        {error && <p className="mt-2 text-lg text-red-500 font-mono break-words">{error}</p>}
        {!isListening && !transcript && !error && <p className="text-gray-400">请点击麦克风开始说话</p>}
      </div>
    </div>
  );
};

export default SpeechRecognitionTester;
