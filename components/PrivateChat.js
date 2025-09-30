import React, { useEffect, useState, useRef, useCallback } from 'react'; import { Virtuoso } from 'react-virtuoso'; import { motion, AnimatePresence } from 'framer-motion'; import { Send, Settings, X, Volume2, Pencil, Check, BookText, Trash2 } from 'lucide-react'; import { doc, collection, query, orderBy, onSnapshot, addDoc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore'; import { db } from '@/lib/firebase'; import { pinyin as pinyinLib } from 'pinyin-pro';

// PrivateChat V7 - 全功能版（覆盖全屏、禁止背景滚动、背景上传、磨砂玻璃、6 条翻译、拼音模式等） export default function PrivateChat({ peerUid, peerDisplayName, currentUser, onClose }) { const user = currentUser; const chatId = React.useMemo(() => { if (!user?.uid || !peerUid) return null; return [user.uid, peerUid].sort().join('_'); }, [user, peerUid]);

// state const [messages, setMessages] = useState([]); const [input, setInput] = useState(''); const [cfg, setCfg] = useState(() => { try { const saved = typeof window !== 'undefined' ? localStorage.getItem('pcfg') : null; return saved ? JSON.parse(saved) : { backgroundDataUrl: '', autoPlayTTS: false, autoTranslate: false, showTitles: false, ai: { endpoint: '', apiKey: '', model: 'gpt-4o-mini' }, glassOpacity: 0.6, bubbleStyle: 'rounded', themeColor: '#2563eb', fontSize: 15, fontWeight: 500 }; } catch { return { backgroundDataUrl: '', autoPlayTTS: false, autoTranslate: false, showTitles: false, ai: { endpoint: '', apiKey: '', model: 'gpt-4o-mini' }, glassOpacity: 0.6, bubbleStyle: 'rounded', themeColor: '#2563eb', fontSize: 15, fontWeight: 500 }; } }); const [settingsOpen, setSettingsOpen] = useState(false); const [translationOptions, setTranslationOptions] = useState(null); const [isTranslating, setIsTranslating] = useState(false); const [longPressedMessage, setLongPressedMessage] = useState(null); const [showPinyinOnlyFor, setShowPinyinOnlyFor] = useState(null); const [searchTerm, setSearchTerm] = useState(''); const [showSearch, setShowSearch] = useState(false); const virtuosoRef = useRef(null);

// tts cache const ttsCache = useRef(new Map()).current; const preloadTTS = useCallback(async (text) => { if (!text) return; if (ttsCache.has(text)) return; try { const url = https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20; const res = await fetch(url); if (!res.ok) throw new Error('TTS API Error'); const blob = await res.blob(); const audio = new Audio(URL.createObjectURL(blob)); ttsCache.set(text, audio); } catch (e) { console.error('preloadTTS error', e); } }, [ttsCache]); const playCachedTTS = useCallback((text) => { if (!text) return; if (ttsCache.has(text)) ttsCache.get(text).play(); else preloadTTS(text).then(() => { if (ttsCache.has(text)) ttsCache.get(text).play(); }); }, [preloadTTS, ttsCache]);

// persist cfg useEffect(() => { try { localStorage.setItem('pcfg', JSON.stringify(cfg)); } catch {} }, [cfg]);

// prevent body scroll while mounted useEffect(() => { const prev = typeof document !== 'undefined' ? document.body.style.overflow : undefined; if (typeof document !== 'undefined') document.body.style.overflow = 'hidden'; return () => { if (typeof document !== 'undefined') document.body.style.overflow = prev || ''; }; }, []);

// ensure chat meta and subscribe to messages useEffect(() => { if (!chatId) return; let unsub = () => {}; (async () => { try { const metaRef = doc(db, 'privateChats', chatId); const metaSnap = await getDoc(metaRef); if (!metaSnap.exists()) await setDoc(metaRef, { members: [user.uid, peerUid].filter(Boolean), createdAt: serverTimestamp() }); } catch (e) { console.warn('ensure meta failed', e); } try { const messagesRef = collection(db, privateChats/${chatId}/messages); const q = query(messagesRef, orderBy('createdAt', 'asc')); unsub = onSnapshot(q, async (snap) => { const docs = []; for (const d of snap.docs) docs.push({ id: d.id, ...d.data() }); setMessages(docs); if (docs.length) { const last = docs[docs.length-1]; if (last.uid !== user.uid && cfg.autoPlayTTS) playCachedTTS(last.text); if (last.uid !== user.uid && cfg.autoTranslate) handleTranslateMessage(last); } // auto-scroll handled by Virtuoso via followOutput prop }, (err) => console.error('msg listen err', err)); } catch (err) { console.error('subscribe msgs err', err); } })(); return () => { try { unsub(); } catch {} }; }, [chatId, user?.uid, peerUid, cfg.autoPlayTTS, cfg.autoTranslate]);

// send message const sendMessage = useCallback(async (text) => { if (!chatId || !user?.uid) { alert('请先登录'); return; } const content = (text ?? input).trim(); if (!content) return; try { const messagesRef = collection(db, privateChats/${chatId}/messages); await addDoc(messagesRef, { text: content, uid: user.uid, displayName: user.displayName || '匿名', createdAt: serverTimestamp() }); setInput(''); setTranslationOptions(null); } catch (e) { console.error('send err', e); alert('发送失败'); } }, [chatId, user, input]);

// delete single message const deleteMessage = useCallback(async (messageId) => { if (!chatId) return; try { await deleteDoc(doc(db, privateChats/${chatId}/messages, messageId)); } catch (e) { console.error('delete msg err', e); } }, [chatId]);

// recall (edit) message - mark as recalled const recallMessage = useCallback(async (messageId) => { if (!chatId) return; try { await updateDoc(doc(db, privateChats/${chatId}/messages, messageId), { recalled: true, recalledAt: serverTimestamp() }); } catch (e) { console.error('recall err', e); } }, [chatId]);

// delete all messages const deleteAllMessages = useCallback(async () => { if (!chatId) return; if (!confirm('确认删除本会话所有消息？')) return; try { const msgsSnap = await getDocs(collection(db, privateChats/${chatId}/messages)); const batchDeletes = msgsSnap.docs.map(d => deleteDoc(doc(db, privateChats/${chatId}/messages, d.id))); await Promise.all(batchDeletes); setMessages([]); } catch (e) { console.error('deleteAll err', e); alert('删除失败'); } }, [chatId]);

// AI helper const callAIHelper = useCallback(async (prompt, textToTranslate) => { const { endpoint, apiKey, model } = cfg.ai; if (!endpoint || !apiKey) throw new Error('请在设置中配置 AI 接口与密钥'); try { const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': Bearer ${apiKey} }, body: JSON.stringify({ model, messages: [{ role: 'user', content: ${prompt}\n\n${textToTranslate} }] }) }); if (!response.ok) { const t = await response.text(); throw new Error('AI Error: '+t); } const data = await response.json(); return data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? ''; } catch (e) { console.error('ai err', e); throw e; } }, [cfg.ai]);

// parse AI output for six sections const parseMyTranslation = useCallback((raw) => { if (!raw || typeof raw !== 'string') return []; const markers = ['📖','💬','💡','🐼','🌸','👨']; const results = []; // normalize newlines const norm = raw.replace(/\r\n/g,'\n'); // find indices of markers const idxs = markers.map(m => ({ m, i: norm.indexOf(m) })).filter(x => x.i >= 0).sort((a,b)=>a.i-b.i); if (idxs.length === 0) return []; for (let k=0;k<idxs.length;k++) { const start = idxs[k].i; const end = (k+1<idxs.length)?idxs[k+1].i : norm.length; const seg = norm.slice(start, end).trim(); // try extract bolded Burmese ... or first line after title const boldMatch = seg.match(/**(.+?)**/s); const burmese = boldMatch ? boldMatch[1].trim() : (seg.split('\n').slice(1).join('\n').split('\n')[0]||'').trim(); // Chinese meaning: look for lines containing 回译|中文意思|中文 const chiMatch = seg.match(/(?:回译|中文意思|中文)[^\n][:：]?\s([\s\S]+)/i); const chi = chiMatch ? chiMatch[1].split('\n').map(s=>s.trim()).filter(Boolean)[0] : ''; results.push({ marker: idxs[k].m, burmeseText: burmese, chineseText: chi }); } // ensure length 6 by filling blanks if necessary while (results.length < 6) results.push({ marker: null, burmeseText: '', chineseText: '' }); return results.slice(0,6); }, []);

// request AI 6 versions (MyInputPrompt should instruct model to output six labeled sections) const MyInputPrompt = 请按照下面六个标签依次输出翻译，每一部分用对应 emoji 开头（📖、💬、💡、🐼、🌸、👨），并在每部分中以 **加粗** 包裹目标语言（缅甸语）翻译，随后给出中文回译（标注为“中文意思”或“回译”）：\n\n;

const handleTranslateMyInput = useCallback(async () => { if (!input?.trim()) return; setIsTranslating(true); setTranslationOptions(null); try { const raw = await callAIHelper(MyInputPrompt, input.trim()); const parsed = parseMyTranslation(raw); setTranslationOptions(parsed); } catch (e) { alert(e.message); } finally { setIsTranslating(false); } }, [input, callAIHelper, parseMyTranslation]);

// translate a single message (peer->local) const PeerMessagePrompt = 请将下面的缅甸语（或目标语）翻译成中文，要求自然、直译且保留原意，只返回中文翻译：\n\n; const [translationResult, setTranslationResult] = useState(null); const handleTranslateMessage = useCallback(async (message) => { if (!message?.text) return; setTranslationResult({ id: message.id, loading: true }); try { const raw = await callAIHelper(PeerMessagePrompt, message.text); setTranslationResult({ id: message.id, text: raw }); } catch (e) { alert(e.message); setTranslationResult(null); } }, [callAIHelper]);

// upload background: read file and store dataURL in localStorage per chat const handleBackgroundUpload = useCallback((file) => { if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { const url = ev.target.result; setCfg(c => ({ ...c, backgroundDataUrl: url })); try { localStorage.setItem(chat_bg_${chatId}, url); } catch {} }; reader.readAsDataURL(file); }, [chatId]);

// load persisted bg useEffect(() => { try { const stored = typeof window !== 'undefined' ? localStorage.getItem(chat_bg_${chatId}) : null; if (stored) setCfg(c => ({ ...c, backgroundDataUrl: stored })); } catch {} }, [chatId]);

// toggle pinyin-only view for a message (show pinyin, hide Chinese) const togglePinyinOnly = useCallback((msg) => { if (!msg?.text) return; if (showPinyinOnlyFor === msg.id) { setShowPinyinOnlyFor(null); return; } // generate pinyin try { const py = pinyinLib(msg.text || '', { toneType: 'none' }); setShowPinyinOnlyFor({ id: msg.id, pinyin: py }); } catch (e) { console.error('pinyin gen err', e); setShowPinyinOnlyFor(null); } }, [showPinyinOnlyFor]);

// long press menu actions const openLongPressMenu = useCallback((message) => { setLongPressedMessage(message); }, []); const closeLongPressMenu = useCallback(() => setLongPressedMessage(null), []);

// render single message const MessageRow = ({ item }) => { const mine = item.uid === user.uid; const isPinyin = showPinyinOnlyFor?.id === item.id; return ( <div className={flex items-start gap-3 ${mine ? 'justify-end' : 'justify-start'} py-2 px-1}> {!mine && <img src={item.photoURL || '/img/avatar.svg'} className="w-8 h-8 rounded-full" />} <div className="relative max-w-[72%]"> <div onClick={() => togglePinyinOnly(item)} onContextMenu={(e)=>{ e.preventDefault(); openLongPressMenu(item); }} className={p-3 ${cfg.bubbleStyle==='rounded' ? 'rounded-2xl' : 'rounded-md'} shadow ${mine ? 'text-white' : 'text-gray-800'}'} style={{ backgroundColor: mine ? cfg.themeColor : rgba(255,255,255,0.9), fontSize: cfg.fontSize, fontWeight: cfg.fontWeight }} > {item.recalled ? <em className="opacity-60">消息已撤回</em> : ( isPinyin ? <div className="whitespace-pre-wrap">{showPinyinOnlyFor?.pinyin}</div> : <div className="whitespace-pre-wrap">{item.text}</div> )} </div> {/* small translate icon */} {!mine && ( <button onClick={() => handleTranslateMessage(item)} aria-label="翻译" className="absolute -right-6 bottom-0 w-7 h-7 rounded-full bg-white/80 text-gray-700 flex items-center justify-center text-xs shadow-sm">译</button> )} </div> {mine && <img src={item.photoURL || '/img/avatar.svg'} className="w-8 h-8 rounded-full" />} </div> ); };

// filtered messages by search const displayedMessages = showSearch && searchTerm ? messages.filter(m => (m.text||'').includes(searchTerm)) : messages;

return ( <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: cfg.backgroundDataUrl ? url(${cfg.backgroundDataUrl}) center/cover : undefined }}> <div style={{ backdropFilter: 'blur(8px)', backgroundColor: rgba(255,255,255,${cfg.glassOpacity}) }} className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b border-gray-200"> <div className="flex items-center gap-3"> <button onClick={onClose} className="p-2 rounded-full"><X /></button> <div className="font-bold text-lg">{peerDisplayName || '聊天'}</div> </div> <div className="flex items-center gap-2"> <button onClick={() => playCachedTTS((messages[messages.length-1]||{}).text || '')} title="朗读最新" className="p-2 rounded-full"><Volume2 /></button> <button onClick={() => setSettingsOpen(true)} title="设置" className="p-2 rounded-full"><Settings /></button> </div> </div>

<div className="flex-1 overflow-hidden relative">
    <Virtuoso ref={virtuosoRef} style={{ height: '100%' }} data={displayedMessages} itemContent={(index, msg) => <MessageRow item={msg} key={msg.id} />} followOutput="smooth" />
  </div>

  {/* translation options panel */}
  <AnimatePresence>
    {translationOptions && (
      <motion.div initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }} className="bg-white shadow-lg p-3 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold">选择翻译版本 (6)</div>
          <button onClick={() => setTranslationOptions(null)} className="text-sm text-gray-500">关闭</button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {translationOptions.map((t,i) => (
            <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-gray-50">
              <div className="flex-1">
                {cfg.showTitles && t.marker && <div className="text-xs text-gray-500">{t.marker}</div>}
                <div className="font-bold text-blue-600">{t.burmeseText}</div>
                {t.chineseText && <div className="text-xs text-gray-600 mt-1">回译: {t.chineseText}</div>}
              </div>
              <button onClick={() => sendMessage(t.burmeseText)} className="px-3 py-2 bg-blue-600 text-white rounded">发送</button>
            </div>
          ))}
        </div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* input area */}
  <div style={{ backdropFilter: 'blur(6px)', backgroundColor: `rgba(255,255,255,${Math.max(0.02,cfg.glassOpacity)})` }} className="flex-shrink-0 p-3 border-t border-gray-200">
    <div className="flex items-end gap-2">
      <textarea rows={1} value={input} onChange={(e)=>setInput(e.target.value)} placeholder="输入消息..." className="flex-1 p-2 rounded-md border resize-none" onKeyDown={(e)=>{ if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} />
      <div className="flex items-center gap-2">
        <button onClick={handleTranslateMyInput} disabled={isTranslating} title="AI 多版本翻译" className="p-2 rounded-md bg-gray-100">译</button>
        <label className="p-2 rounded-md bg-gray-100 cursor-pointer">
          <input type="file" accept="image/*" capture="environment" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleBackgroundUpload(f); }} className="hidden" />
          背景
        </label>
        <button onClick={()=>sendMessage()} className="p-2 rounded-md bg-blue-600 text-white"><Send /></button>
      </div>
    </div>
    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
      <div>
        <button onClick={()=>setShowSearch(s=>!s)} className="mr-2">搜索</button>
        {showSearch && <input value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} placeholder="搜索消息" className="p-1 border rounded" />}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={()=>deleteAllMessages()} className="text-red-500">删除所有</button>
      </div>
    </div>
  </div>

  {/* settings drawer */}
  <AnimatePresence>
    {settingsOpen && (
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg z-50 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold">聊天设置</div>
          <button onClick={()=>setSettingsOpen(false)}><X/></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">背景透明度</label>
            <input type="range" min="0.1" max="0.95" step="0.05" value={cfg.glassOpacity} onChange={(e)=>setCfg(c=>({...c, glassOpacity: Number(e.target.value)}))} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">主题色</label>
            <input type="color" value={cfg.themeColor} onChange={(e)=>setCfg(c=>({...c, themeColor: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium">气泡样式</label>
            <select value={cfg.bubbleStyle} onChange={(e)=>setCfg(c=>({...c, bubbleStyle: e.target.value}))} className="w-full p-2 border rounded">
              <option value="rounded">圆角</option>
              <option value="pill">胶囊</option>
              <option value="flat">扁平</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">字体大小</label>
            <input type="range" min="12" max="22" step="1" value={cfg.fontSize} onChange={(e)=>setCfg(c=>({...c, fontSize: Number(e.target.value)}))} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">字体粗细</label>
            <input type="range" min="300" max="800" step="50" value={cfg.fontWeight} onChange={(e)=>setCfg(c=>({...c, fontWeight: Number(e.target.value)}))} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">AI 翻译设置（OpenAI 兼容）</label>
            <input placeholder="接口地址" value={cfg.ai.endpoint} onChange={(e)=>setCfg(c=>({...c, ai:{...c.ai, endpoint: e.target.value}}))} className="w-full p-2 border rounded mb-2" />
            <input placeholder="API Key" value={cfg.ai.apiKey} onChange={(e)=>setCfg(c=>({...c, ai:{...c.ai, apiKey: e.target.value}}))} className="w-full p-2 border rounded mb-2" />
            <input placeholder="模型" value={cfg.ai.model} onChange={(e)=>setCfg(c=>({...c, ai:{...c.ai, model: e.target.value}}))} className="w-full p-2 border rounded" />
          </div>
          <div className="flex gap-2">
            <label className="flex-1 p-2 bg-gray-100 rounded">自动朗读 <input type="checkbox" checked={cfg.autoPlayTTS} onChange={(e)=>setCfg(c=>({...c, autoPlayTTS: e.target.checked}))} /></label>
            <label className="flex-1 p-2 bg-gray-100 rounded">自动翻译 <input type="checkbox" checked={cfg.autoTranslate} onChange={(e)=>setCfg(c=>({...c, autoTranslate: e.target.checked}))} /></label>
          </div>
          <div className="pt-2">
            <label className="block text-sm font-medium">聊天背景（上传）</label>
            <input type="file" accept="image/*" capture="environment" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleBackgroundUpload(f); }} />
            <div className="mt-2 flex gap-2">
              <button onClick={()=>{ setCfg(c=>({...c, backgroundDataUrl:''})); localStorage.removeItem(`chat_bg_${chatId}`); }} className="px-3 py-1 bg-red-500 text-white rounded">移除</button>
            </div>
          </div>
          <div className="pt-3 border-t">
            <button onClick={deleteAllMessages} className="w-full px-3 py-2 bg-red-600 text-white rounded">删除本会话全部消息</button>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* long press menu */}
  <AnimatePresence>
    {longPressedMessage && (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/30" onClick={()=>setLongPressedMessage(null)}>
        <div className="bg-white p-2 rounded shadow">
          <button onClick={()=>{ playCachedTTS(longPressedMessage.text); setLongPressedMessage(null); }} className="block px-3 py-2">朗读</button>
          <button onClick={()=>{ handleTranslateMessage(longPressedMessage); setLongPressedMessage(null); }} className="block px-3 py-2">翻译</button>
          {(longPressedMessage.uid === user.uid) && <button onClick={()=>{ recallMessage(longPressedMessage.id); setLongPressedMessage(null); }} className="block px-3 py-2">撤回</button>}
          {(longPressedMessage.uid === user.uid || user.isAdmin) && <button onClick={()=>{ deleteMessage(longPressedMessage.id); setLongPressedMessage(null); }} className="block px-3 py-2 text-red-600">删除</button>}
          <button onClick={()=>{ try { const py = pinyinLib(longPressedMessage.text, {toneType:'none'}); setShowPinyinOnlyFor({id: longPressedMessage.id, pinyin:py}); } catch(e){console.error(e);} setLongPressedMessage(null); }} className="block px-3 py-2">显示拼音</button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

</div>

); }

