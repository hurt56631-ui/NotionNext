// /pages/settings/bottle.js
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const defaultPrompt = `你是一个专业的翻译引擎，请将文本翻译成[TARGET_LANG]。
**翻译要求**:
自然直译：在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。
**输出格式**:
严格按照以下格式提供翻译和回译，不要添加任何额外的解释或说明：
**[翻译结果]**
回译：[将翻译结果再翻译回原文的语言]`;


export default function BottleSettingsPage() {
  const [user] = useAuthState(auth);
  const [settings, setSettings] = useState({
    apiEndpoint: '',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    targetLanguage: 'English',
    prompt: defaultPrompt
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (user) {
        const settingsRef = doc(db, `users/${user.uid}/settings`, 'translation');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings`, 'translation');
      // 使用 setDoc 和 merge:true 来创建或更新文档
      await setDoc(settingsRef, settings, { merge: true });
      alert('设置已保存！');
    } catch (error) {
      console.error("Error saving settings:", error);
      alert('保存失败，请检查控制台错误。');
    }
    setIsSaving(false);
  };

  if (isLoading) return <div>加载中...</div>;

  return (
    <div className="settings-container">
      <h1>漂流瓶翻译设置</h1>
      
      <div className="form-group">
        <label>目标翻译语言</label>
        <input name="targetLanguage" value={settings.targetLanguage} onChange={handleChange} placeholder="例如：English, Japanese"/>
      </div>

      <div className="form-group">
        <label>AI 接口地址 (Endpoint)</label>
        <input name="apiEndpoint" value={settings.apiEndpoint} onChange={handleChange} placeholder="例如：https://api.openai.com/v1/chat/completions"/>
      </div>

      <div className="form-group">
        <label>API 密钥 (Key)</label>
        <input type="password" name="apiKey" value={settings.apiKey} onChange={handleChange} placeholder="你的 API Key"/>
      </div>
      
      <div className="form-group">
        <label>模型 (Model)</label>
        <input name="model" value={settings.model} onChange={handleChange} placeholder="例如：gpt-4, gpt-3.5-turbo"/>
      </div>
      
      <div className="form-group">
        <label>翻译提示词 (Prompt)</label>
        <p>提示：你可以使用 `[TARGET_LANG]` 作为目标语言的占位符。</p>
        <textarea name="prompt" value={settings.prompt} onChange={handleChange} rows="10"/>
      </div>
      
      <button onClick={handleSave} disabled={isSaving}>
        {isSaving ? '保存中...' : '保存设置'}
      </button>

      {/* ... 添加你的 CSS 样式 ... */}
      <style jsx>{`
        .settings-container { max-width: 600px; margin: auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input, textarea { width: 100%; padding: 8px; font-size: 1rem; }
      `}</style>
    </div>
  );
}
