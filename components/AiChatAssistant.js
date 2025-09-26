// components/AiChatAssistantEnhanced.js
import React, { useEffect, useRef, useState } from 'react';
import { Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FaCog, FaVolumeUp, FaTrashAlt, FaCopy, FaTimes, FaPlay, FaStop, FaPaperPlane, FaSave } from 'react-icons/fa';

/**
 * AiChatAssistantEnhanced
 * - settings saved in localStorage
 * - can call arbitrary LLM HTTP endpoint (Gemini or other) via fetch
 * - supports TTS playback, copy message, delete, clear chat
 *
 * Props:
 *  - isOpen (bool)
 *  - onClose (fn)
 *
 * NOTE: The component does NOT bundle any Gemini SDK. It sends POST to the URL you provide.
 * The shape of request/response depends on that endpoint; the component tries to be flexible:
 *  - if response is JSON with `text` or `output` fields it uses them
 *  - otherwise it falls back to plain text body
 */

const LS_KEYS = {
  SETTINGS: 'ai_assistant_settings_v1',
  CHAT: 'ai_assistant_chat_v1'
};

const defaultSettings = {
  modelEndpoint: '',
  apiKey: '',
  apiKeyHeaderName: 'Authorization', // header name to send api key, default Authorization
  apiKeyPrefix: 'Bearer ', // prefix before token if needed
  systemPrompt: 'You are a helpful Chinese teacher. Keep replies concise and provide JSON when requested.',
  ttsEndpoint: 'https://t.leftsite.cn/tts?t=', // append encoded text & v param if desired
  ttsVoice: 'zh-CN-XiaochenMultilingualNeural'
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEYS.SETTINGS);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (e) {
    return defaultSettings;
  }
}
function saveSettings(s) {
  localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(s));
}

function loadChat() {
  try {
    const raw = localStorage.getItem(LS_KEYS.CHAT);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}
function saveChat(chat) {
  localStorage.setItem(LS_KEYS.CHAT, JSON.stringify(chat));
}

const AiChatAssistantEnhanced = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState(loadSettings());
  const [editingSettings, setEditingSettings] = useState(false);
  const [chat, setChat] = useState(loadChat());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveChat(chat); }, [chat]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chat, loading]);

  const pushMessage = (role, text, meta = {}) => {
    const msg = { id: Date.now().toString() + Math.random().toString(36).slice(2), role, text, ts: new Date().toISOString(), meta };
    setChat(prev => [...prev, msg]);
    return msg;
  };

  const deleteMessage = (id) => {
    setChat(prev => prev.filter(m => m.id !== id));
  };

  const clearChat = () => {
    setChat([]);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // optional: tiny visual feedback
    } catch (e) {
      console.warn('copy failed', e);
    }
  };

  const playTtsForText = async (text) => {
    // stop previous
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setTtsPlaying(false);
      setCurrentAudioUrl(null);
    }
    const encoded = encodeURIComponent(text);
    const url = `${settings.ttsEndpoint}${encoded}&v=${encodeURIComponent(settings.ttsVoice)}`;
    try {
      setTtsPlaying(true);
      setCurrentAudioUrl(url);
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { setTtsPlaying(false); audioRef.current = null; setCurrentAudioUrl(null); };
      a.onerror = () => { setTtsPlaying(false); audioRef.current = null; setCurrentAudioUrl(null); };
      await a.play();
    } catch (e) {
      console.warn('TTS play failed', e);
      setTtsPlaying(false);
      audioRef.current = null;
      setCurrentAudioUrl(null);
    }
  };

  const stopTts = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setTtsPlaying(false);
    setCurrentAudioUrl(null);
  };

  const buildHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) {
      const headerName = settings.apiKeyHeaderName || 'Authorization';
      const prefix = settings.apiKeyPrefix || '';
      headers[headerName] = `${prefix}${settings.apiKey}`;
    }
    return headers;
  };

  const extractTextFromResponse = async (resp) => {
    // Try to parse common JSON shapes, else return as text
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        const j = await resp.json();
        // common fields: { text }, { output: "..."} , { choices: [{text: "..."}] }
        if (typeof j.text === 'string') return j.text;
        if (typeof j.output === 'string') return j.output;
        if (Array.isArray(j.choices) && j.choices[0] && (j.choices[0].text || j.choices[0].message)) {
          return j.choices[0].text || (j.choices[0].message && j.choices[0].message.content) || JSON.stringify(j);
        }
        // fallback: stringify
        return JSON.stringify(j);
      } catch (e) {
        // fallback to text
      }
    }
    // fallback to plain text
    try {
      return await resp.text();
    } catch (e) {
      return '[无法解析的响应]';
    }
  };

  const sendMessageToModel = async (userText) => {
    if (!settings.modelEndpoint) {
      alert('请在设置中填写模型接口地址（modelEndpoint）。');
      return;
    }
    const userMsg = pushMessage('user', userText);
    setInput('');
    setLoading(true);

    // craft payload depending on likely interface. We'll send a flexible JSON:
    // { prompt: "...", system: "...", history: [ {role, text}, ... ] }
    const history = chat.concat([userMsg]).slice(-20).map(m => ({ role: m.role, text: m.text }));
    const payload = {
      prompt: userText,
      system: settings.systemPrompt,
      history
    };

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const resp = await fetch(settings.modelEndpoint, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        pushMessage('assistant', `模型返回错误：${resp.status} ${errText}`);
        setLoading(false);
        setAbortController(null);
        return;
      }
      const text = await extractTextFromResponse(resp);
      pushMessage('assistant', text);
    } catch (e) {
      if (e.name === 'AbortError') {
        pushMessage('assistant', '[已取消请求]');
      } else {
        console.error(e);
        pushMessage('assistant', `[请求失败] ${e.message || e.toString()}`);
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const handleSend = async () => {
    const txt = input.trim();
    if (!txt) return;
    await sendMessageToModel(txt);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  const saveSettingsHandler = () => {
    setEditingSettings(false);
    saveSettings(settings);
  };

  const cancelRequest = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
        {/* backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="absolute inset-0 bg-black bg-opacity-30 transition-opacity" />
        </Transition.Child>

        {/* panel */}
        <Transition.Child
          as={Fragment}
          enter="transform transition ease-in-out duration-300"
          enterFrom="translate-y-full"
          enterTo="translate-y-0"
          leave="transform transition ease-in-out duration-200"
          leaveFrom="translate-y-0"
          leaveTo="translate-y-full"
        >
          <div className="fixed inset-0 flex flex-col bg-white dark:bg-[#0b1020]">
            {/* header */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 h-16 border-b dark:border-gray-800">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI 助手</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400">模型：{settings.modelEndpoint ? settings.modelEndpoint.replace(/^https?:\/\//, '') : '未配置'}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingSettings(true)}
                  title="设置模型/密钥/提示词"
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <FaCog />
                </button>
                <button
                  onClick={() => { clearChat(); }}
                  title="清空对话"
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <FaTrashAlt />
                </button>
                <button
                  onClick={onClose}
                  aria-label="关闭AI助手"
                  className="p-2 rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <FaTimes />
                </button>
              </div>
            </header>

            {/* body */}
            <main className="flex-1 overflow-hidden flex">
              {/* messages area */}
              <div className="flex-1 p-4 overflow-y-auto">
                {chat.length === 0 && (
                  <div className="text-center text-gray-500 mt-8">暂无对话，开始聊天吧。</div>
                )}
                <div className="flex flex-col gap-4">
                  {chat.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'} max-w-[80%] p-3 rounded-lg relative shadow-sm`}>
                        <div className="whitespace-pre-wrap break-words">{m.text}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs opacity-80">
                          <div className="text-gray-500 dark:text-gray-400">{new Date(m.ts).toLocaleString()}</div>
                          <button title="复制" onClick={() => copyToClipboard(m.text)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><FaCopy /></button>
                          <button title="播放 TTS" onClick={() => playTtsForText(m.text)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><FaVolumeUp /></button>
                          <button title="删除" onClick={() => deleteMessage(m.id)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><FaTrashAlt /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* side panel: optional quick actions / settings preview */}
              <aside className="w-80 border-l dark:border-gray-800 p-4 hidden md:block">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">设置预览</div>
                <div className="text-xs text-gray-500 break-words mb-2"><strong>系统提示：</strong><div className="mt-1 text-sm text-gray-700 dark:text-gray-300 rounded p-2 bg-gray-50 dark:bg-gray-900">{settings.systemPrompt}</div></div>
                <div className="text-xs text-gray-500 mb-2"><strong>API Header:</strong> {settings.apiKeyHeaderName}</div>
                <div className="text-xs text-gray-500 mb-2"><strong>API Key 已配置：</strong>{settings.apiKey ? '是' : '否'}</div>

                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">操作</div>
                  <div className="flex flex-col gap-2">
                    <button className="px-3 py-2 rounded bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2" onClick={() => { if (chat.length) copyToClipboard(JSON.stringify(chat, null, 2)); }}>导出对话</button>
                    <button className="px-3 py-2 rounded bg-white/80 text-gray-800" onClick={() => { setChat(loadChat()); }}>恢复本地对话</button>
                    {loading ? (
                      <button onClick={cancelRequest} className="px-3 py-2 rounded bg-red-500 text-white">取消请求</button>
                    ) : (
                      <div className="text-xs text-gray-500">无进行中请求</div>
                    )}
                  </div>
                </div>
              </aside>
            </main>

            {/* footer: input */}
            <div className="p-4 border-t dark:border-gray-800">
              <div className="flex items-center gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的问题... (Ctrl/Cmd+Enter 发送)"
                  className="flex-1 min-h-[48px] max-h-44 resize-none px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:border-gray-800"
                />
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSend}
                    disabled={loading}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg flex items-center gap-2 shadow"
                    title="发送"
                  >
                    {loading ? '发送中...' : <><FaPaperPlane /> 发送</>}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // save quick preset: current prompt -> systemPrompt
                        setSettings(prev => ({ ...prev, systemPrompt: input }));
                      }}
                      className="px-3 py-2 rounded bg-white/80 text-gray-800"
                      title="把输入保存为系统提示词"
                    >
                      保存为提示词
                    </button>
                    <button
                      onClick={() => {
                        if (currentAudioUrl) {
                          stopTts();
                        } else if (chat.length) {
                          const last = chat.slice().reverse().find(m => m.role === 'assistant' || m.role === 'user');
                          if (last) playTtsForText(last.text);
                        }
                      }}
                      className="px-3 py-2 rounded bg-white/80 text-gray-800"
                      title="播放最近消息 TTS"
                    >
                      {ttsPlaying ? <><FaStop /> 停止</> : <><FaPlay /> 播放</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* settings modal */}
            <Transition appear show={editingSettings} as={Fragment}>
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                  <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl p-6 border dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">AI 助手设置</h3>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { saveSettingsHandler(); }} className="px-3 py-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded flex items-center gap-2"><FaSave/> 保存</button>
                        <button onClick={() => setEditingSettings(false)} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-800"><FaTimes/></button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">模型接口地址（POST）</label>
                        <input value={settings.modelEndpoint} onChange={(e)=>setSettings(s=>({...s, modelEndpoint: e.target.value}))} placeholder="https://api.your-llm.com/v1/generate" className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-800"/>
                        <p className="text-xs text-gray-500 mt-1">填写你的模型 HTTP 接口。该组件会以 POST JSON 的方式发送：{`{ prompt, system, history }`}。</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">API Key (可选)</label>
                          <input value={settings.apiKey} onChange={(e)=>setSettings(s=>({...s, apiKey: e.target.value}))} placeholder="sk-..." className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-800"/>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Header 名称</label>
                          <input value={settings.apiKeyHeaderName} onChange={(e)=>setSettings(s=>({...s, apiKeyHeaderName: e.target.value}))} className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-800"/>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">API Key 前缀（如 'Bearer '）</label>
                        <input value={settings.apiKeyPrefix} onChange={(e)=>setSettings(s=>({...s, apiKeyPrefix: e.target.value}))} className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-800"/>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">系统提示词（System Prompt）</label>
                        <textarea value={settings.systemPrompt} onChange={(e)=>setSettings(s=>({...s, systemPrompt: e.target.value}))} className="mt-1 block w-full px-3 py-2 border rounded-md h-28 dark:bg-gray-800"/>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-200">TTS Endpoint（可选）</label>
                          <input value={settings.ttsEndpoint} onChange={(e)=>setSettings(s=>({...s, ttsEndpoint: e.target.value}))} className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-800"/>
                          <div className="text-xs text-gray-500 mt-1">示例: https://t.leftsite.cn/tts?t=</div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-200">TTS Voice</label>
                          <input value={settings.ttsVoice} onChange={(e)=>setSettings(s=>({...s, ttsVoice: e.target.value}))} className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-800"/>
                        </div>
                      </div>

                    </div>
                  </div>
                </Transition.Child>
              </div>
            </Transition>
          </div>
        </Transition.Child>
      </div>
    </Transition.Root>
  );
};

export default AiChatAssistantEnhanced;
