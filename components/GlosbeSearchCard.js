// ✅ [集成] 采纳最终版“高准确率提示词”，并移除重复的函数定义
const getAIPrompt = (word, fromLang, toLang) => `
请将以下 ${fromLang} 内容翻译成 ${toLang}：
“${word}”

请严格按照以下格式输出多个风格版本。
所有翻译必须 首先准确表达原文的核心意思，在任何情况下都不得添加、删减或改变语义。
不要输出任何额外解释、备注或说明。

---

**自然直译版**:
在完全忠实保留原文结构和语义的前提下，使译文符合${toLang}的语法习惯，读起来自然但不改动意思。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]

---

**自然流畅版**:
在意思不变的情况下，稍作调整，使译文更贴近${toLang}日常表达，语气顺畅自然。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]

---

**口语版**:
使用${toLang === '缅甸语' ? '缅甸' : '中国'}年轻人日常生活中常说的自然表达方式，语气轻松但仍保持原意准确。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]

---

**地道表达版**:
遵循${toLang}母语者的思维方式和表达习惯进行意译，使句子听起来自然真实，但绝不偏离原意。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]

---

**文学润色版**:
在精准传达原意的基础上，运用更丰富、更具表现力的词汇和句式进行优化，使表达更显文采和感染力，适合书面语或正式场合。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]
`;


// ✅ [优化] 重构解析函数，使其更健壮、更高效，优先使用 '---' 作为分隔符
const parseAIResponse = (responseText) => {
    if (!responseText) return [];

    // 基于Prompt中要求的'---'进行分割，这是最可靠的方式
    const blocks = responseText.trim().split(/\n---\n/);
    const results = [];

    for (const block of blocks) {
        // 使用更精确的正则表达式一次性捕获所有需要的信息
        const titleMatch = block.match(/\*\*(.*?)\*\*:/);
        const translationMatch = block.match(/\*\s+\*\*([\s\S]*?)\*\*/); // 匹配多行翻译
        const meaningMatch = block.match(/回译:\s*\[(.*?)\]/);

        if (titleMatch && translationMatch && meaningMatch) {
            results.push({
                title: titleMatch[1].trim(),
                translation: translationMatch[1].trim(),
                meaning: `回译: ${meaningMatch[1].trim()}`,
            });
        }
    }
    
    // 如果主要解析逻辑失败，则启动备用方案（适用于格式不完全匹配的情况）
    if (results.length === 0 && responseText.includes('**')) {
         const sections = responseText.split(/\*\*(.*?)\*\*:/).slice(1);
         for(let i = 0; i < sections.length; i+=2) {
             const title = sections[i].trim();
             const content = sections[i+1];
             const translationMatch = content.match(/\*\s+\*\*([\s\S]*?)\*\*/);
             const meaningMatch = content.match(/回译:\s*\[?(.*?)\]?/);
             if (translationMatch && meaningMatch) {
                 results.push({
                     title: title,
                     translation: translationMatch[1].trim(),
                     meaning: `回译: ${meaningMatch[1].trim()}`,
                 });
             }
         }
    }

    return results;
};


import { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Settings, X, Loader2, Bot, Copy, Volume2, Repeat } from 'lucide-react';

// 语言检测辅助函数
const containsChinese = (text) => /[\u4e00-\u9fa5]/.test(text);

const GlosbeSearchCard = () => {
    const [word, setWord] = useState('');
    const [searchDirection, setSearchDirection] = useState('my2zh');
    const [isListening, setIsListening] = useState(false);
    const [useAI, setUseAI] = useState(true);
    const [isAISearching, setIsAISearching] = useState(false);
    
    // ✅ [优化] 分离流式文本和最终解析结果的状态，使逻辑更清晰
    const [streamingText, setStreamingText] = useState(''); // 用于存储和显示流式响应的原始文本
    const [aiResults, setAiResults] = useState([]); // 用于存储最终解析好的结果数组
    
    const [aiError, setAiError] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [apiSettings, setApiSettings] = useState({
        url: 'https://open-gemini-api.deno.dev/v1/chat/completions',
        model: 'gemini-pro-flash',
        key: '',
        useThirdParty: false,
        thirdPartyUrl: 'https://gy.zenscaleai.com/v1',
        disableThinking: true,
    });

    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [word]);

    useEffect(() => {
        // 当用户输入时自动检测语言并切换方向
        const detectedDirection = containsChinese(word) ? 'zh2my' : 'my2zh';
        if (detectedDirection !== searchDirection) {
            setSearchDirection(detectedDirection);
        }
    }, [word]);

    useEffect(() => {
        const savedSettings = localStorage.getItem('aiApiSettings_v9');
        if (savedSettings) {
            setApiSettings(prevSettings => ({ ...prevSettings, ...JSON.parse(savedSettings) }));
        }
    }, []);
    
    // ... (其他未更改的函数: handleSaveSettings, handleLegacySearch, SpeechRecognition useEffect等)

    const handleAiTranslate = async (text) => {
        const trimmedWord = (text || word).trim();
        if (!trimmedWord) return;
        if (!apiSettings.key) {
            setAiError('请点击设置图标，填写API密钥。');
            return;
        }

        let apiUrl = apiSettings.useThirdParty ? `${apiSettings.thirdPartyUrl.replace(/\/$/, '')}/chat/completions` : apiSettings.url;
        if (apiSettings.useThirdParty && !apiSettings.thirdPartyUrl) {
            setAiError('请在设置中填写第三方 OpenAI 兼容地址。');
            return;
        }

        setIsAISearching(true);
        // ✅ [优化] 重置所有相关状态
        setAiResults([]);
        setStreamingText('');
        setAiError('');

        const currentDirection = containsChinese(trimmedWord) ? 'zh2my' : 'my2zh';
        const fromLang = currentDirection === 'my2zh' ? '缅甸语' : '中文';
        const toLang = currentDirection === 'my2zh' ? '中文' : '缅甸语';
        const prompt = getAIPrompt(trimmedWord, fromLang, toLang);

        const requestBody = {
            model: apiSettings.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            ...(apiSettings.disableThinking && { generation_config: { thinking_budget_tokens: 0 } }) // 更简洁的条件属性
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiSettings.key}` },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API请求失败: ${response.status} - ${errorBody}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
                
                for (const line of lines) {
                    const jsonStr = line.replace(/^data: /, '');
                    if (jsonStr.includes('[DONE]')) continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const delta = parsed.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            fullResponse += delta;
                            setStreamingText(fullResponse); // ✅ [优化] 更新流式文本状态
                        }
                    } catch (e) { 
                        console.error("解析流式JSON失败:", e);
                    }
                }
            }
            
            const validResults = parseAIResponse(fullResponse);
            if (validResults.length === 0) {
                console.error("最终解析失败，原始输出: ", fullResponse);
                setAiError("AI未能按预期格式返回翻译，请检查API设置或重试。");
            } else {
                 setAiResults(validResults); // ✅ [优化] 更新最终解析结果状态
            }

        } catch (error) {
            console.error('AI翻译错误:', error);
            setAiError(`翻译失败: ${error.message}`);
        } finally {
            setIsAISearching(false);
            setStreamingText(''); // ✅ [优化] 请求结束后清空流式文本
        }
    };
    
    const handleSearch = () => {
        if (useAI) handleAiTranslate();
        else handleLegacySearch();
    };

    // ... (其他未更改的函数: toggleListening, handleCopy, etc.)
    
    // ✅ [优化] 渲染逻辑现在更清晰
    return (
      <div className="w-full max-w-lg mx-auto bg-white/90 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/50 shadow-lg rounded-2xl p-4 sm:p-6 transition-all duration-300">
          {/* ... (设置和输入框部分 JSX 未改变) ... */}
          
          {useAI && (
               <div className="mt-6 min-h-[50px]">
                  {/* 在搜索期间，如果流式文本存在，则显示它 */}
                  {isAISearching && streamingText && (
                      <div className="p-4 rounded-xl bg-violet-50 dark:bg-gray-900/50 border border-violet-200 dark:border-gray-700/50 whitespace-pre-wrap font-semibold text-gray-800 dark:text-white">
                          {streamingText}
                          <Loader2 className="inline-block w-4 h-4 ml-2 animate-spin text-cyan-500" />
                      </div>
                  )}

                  {aiError && (
                      <div className="p-3 rounded-lg bg-red-100 dark:bg-red-800/20 text-red-700 dark:text-red-300 text-sm">
                          {aiError}
                      </div>
                  )}
                  
                  {/* 当搜索完成且有解析结果时，显示最终结果 */}
                  {!isAISearching && aiResults.length > 0 && (
                      <div className="space-y-3">
                      {aiResults.map((result, index) => (
                        <div key={index}  className="p-4 rounded-xl bg-violet-50 dark:bg-gray-900/50 border border-violet-200 dark:border-gray-700/50">
                          <h4 className="text-sm font-bold text-violet-600 dark:text-violet-400 mb-1">{result.title}</h4>
                          <p className="text-base font-semibold text-gray-800 dark:text-white">
                            {result.translation}
                          </p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{result.meaning}</p>
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-violet-200 dark:border-gray-700/50 -mx-4 px-3">
                            <button onClick={() => handleCopy(result.translation)} title="复制" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700 transition-colors"><Copy size={14}/></button>
                            <button onClick={() => handleSpeak(result.translation)} title="朗读" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700 transition-colors"><Volume2 size={14}/></button>
                            <button onClick={() => handleBackTranslate(result.translation)} title="回译" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700 transition-colors"><Repeat size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
          )}
      </div>
  );

};

export default GlosbeSearchCard;
