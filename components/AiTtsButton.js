// /components/AiTtsButton.js - v23 修复版
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TTS_ENGINE } from './AiChatAssistant'; // 从主组件导入引擎类型

// 清理文本以进行语音合成的辅助函数
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  // 移除Markdown的加粗、标题、列表等格式
  return text.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
};

const AiTtsButton = ({ text, ttsSettings = {} }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  // 组件卸载时执行清理操作
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        // 确保释放通过 createObjectURL 创建的URL
        if (audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 语音合成的核心函数
  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    const {
      ttsEngine = TTS_ENGINE.THIRD_PARTY,
      thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural', 
      systemTtsVoiceURI = ''
    } = ttsSettings;
    
    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setIsLoading(true);

    // 在开始新的朗读前，先停止当前所有朗读
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();

    try {
      // 使用系统内置TTS引擎
      if (ttsEngine === TTS_ENGINE.SYSTEM && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        // 如果指定了声音，则尝试设置
        if (systemTtsVoiceURI) {
          const selectedVoice = window.speechSynthesis.getVoices().find(v => v.voiceURI === systemTtsVoiceURI);
          if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang; // 最好同时设置语言
          }
        }
        utterance.onend = () => setIsLoading(false);
        utterance.onerror = (e) => { 
          console.error('系统TTS错误:', e); 
          setIsLoading(false); 
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } 
      // 使用第三方TTS API
      else {
        // --- 核心修复点 ---
        // 修正了URL中错误拼接的参数，使其与工作示例保持一致
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}&r=-20`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API请求失败 (状态码: ${response.status})`);
        }
        
        const audioBlob = await response.blob();

        // 释放上一个音频的Blob URL，防止内存泄漏
        if (audioRef.current?.src && audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => setIsLoading(false);
        audio.onerror = (e) => { 
          console.error('音频播放错误:', e); 
          setIsLoading(false); 
        };
        // play()返回一个Promise，使用await可以更好地处理后续逻辑
        await audio.play();
      }
    } catch (err) {
      console.error('朗读失败:', err);
      setIsLoading(false);
    }
  }, [ttsSettings]);

  return (
    <button
      onClick={(e) => { 
        e.stopPropagation(); // 阻止事件冒泡
        synthesizeSpeech(text); 
      }}
      disabled={isLoading}
      className={`p-2 rounded-full transition-colors ${isLoading ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
      title="朗读"
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <i className="fas fa-volume-up"></i> // 确保你已引入Font Awesome的CSS
      )}
    </button>
  );
};

export default AiTtsButton;
