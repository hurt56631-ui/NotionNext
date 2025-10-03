import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import Link from 'next/link';
import styles from '../../styles/Bottle.module.css';
const defaultPrompt = `你是一个专业的翻译引擎，请将文本翻译成[TARGET_LANG]。\n**翻译要求**:\n自然直译：在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。\n**输出格式**:\n严格按照以下格式提供翻译和回译，不要添加任何额外的解释或说明：\n**[翻译结果]**\n回译：[将翻译结果再翻译回原文的语言]`;
export default function BottleSettingsPage() {
  const [user] = useAuthState(auth);
  const [settings, setSettings] = useState({ apiEndpoint: '', apiKey: '', model: 'gpt-3.5-turbo', targetLanguage: 'English', prompt: defaultPrompt });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (user) {
      const fetchSettings = async () => {
        const settingsRef = doc(db, `users/${user.uid}/settings`, 'translation');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) setSettings(prev => ({...prev, ...docSnap.data()}));
        setIsLoading(false);
      };
      fetchSettings();
    } else { setIsLoading(false); }
  }, [user]);
  const handleChange = (e) => setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSave = async () => {
    if (!user) return; setIsSaving(true);
    try { const settingsRef = doc(db, `users/${user.uid}/settings`, 'translation'); await setDoc(settingsRef, settings, { merge: true }); alert('设置已保存！'); } catch (error) { alert('保存失败！'); }
    setIsSaving(false);
  };
  if (isLoading) return <div className={styles.settingsContainer}>加载设置中...</div>;
  if (!user) return <div className={styles.settingsContainer}><p>请先登录再进行设置。</p><Link href="/login">去登录</Link></div>;
  return (
    <div className={styles.settingsContainer}>
      <Link href="/bottle">← 返回漂流瓶</Link>
      <h1>漂流瓶翻译设置</h1>
      <div className={styles.formGroup}><label>目标翻译语言</label><input name="targetLanguage" value={settings.targetLanguage} onChange={handleChange} placeholder="例如：English, Japanese"/></div>
      <div className={styles.formGroup}><label>AI 接口地址 (Endpoint)</label><input name="apiEndpoint" value={settings.apiEndpoint} onChange={handleChange} placeholder="例如：https://api.openai.com/v1/chat/completions"/></div>
      <div className={styles.formGroup}><label>API 密钥 (Key)</label><input type="password" name="apiKey" value={settings.apiKey} onChange={handleChange} placeholder="你的 API Key"/></div>
      <div className={styles.formGroup}><label>模型 (Model)</label><input name="model" value={settings.model} onChange={handleChange} placeholder="例如：gpt-4, gpt-3.5-turbo"/></div>
      <div className={styles.formGroup}><label>翻译提示词 (Prompt)</label><p>提示：你可以使用 `[TARGET_LANG]` 作为目标语言的占位符。</p><textarea name="prompt" value={settings.prompt} onChange={handleChange} rows="10"/></div>
      <button className={styles.button} onClick={handleSave} disabled={isSaving}>{isSaving ? '保存中...' : '保存设置'}</button>
    </div>
  );
}
