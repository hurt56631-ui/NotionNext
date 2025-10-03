import { useState } from 'react';
import { FaLanguage, FaVolumeUp } from 'react-icons/fa';
import { callAIHelper, parseSingleTranslation, playCachedTTS, preloadTTS } from '../../lib/aiUtils';
import styles from '../../styles/Bottle.module.css';
export default function TranslationView({ originalText, userSettings }) {
  const [translation, setTranslation] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState('');
  const handleTranslate = async () => {
    if (!userSettings || !userSettings.apiKey || !userSettings.apiEndpoint) { setError("请先在“漂流瓶设置”中配置翻译API！"); return; }
    setIsTranslating(true); setError(''); setTranslation(null);
    const finalPrompt = userSettings.prompt.replace(/\[TARGET_LANG\]/g, userSettings.targetLanguage);
    try {
      const resultText = await callAIHelper(finalPrompt, originalText, userSettings.apiKey, userSettings.apiEndpoint, userSettings.model);
      const parsedResult = parseSingleTranslation(resultText);
      setTranslation(parsedResult);
      preloadTTS(parsedResult.translation);
    } catch (err) { setError(err.message); } finally { setIsTranslating(false); }
  };
  return (
    <div className={styles.translationContainer}>
      {error && <p className={styles.errorMessage}>{error}</p>}
      {translation && (<div className={styles.translationResult}><hr /><h4>{userSettings.targetLanguage} 翻译:</h4><div className={styles.textWithTts}><p>{translation.translation}</p><button onClick={() => playCachedTTS(translation.translation)} className={`${styles.button} ${styles.ttsButton}`}><FaVolumeUp /></button></div><p className={styles.backTranslation}><em>回译: {translation.backTranslation}</em></p></div>)}
      <button className={`${styles.button} ${styles.buttonTranslate}`} onClick={handleTranslate} disabled={isTranslating}><FaLanguage /> {isTranslating ? '翻译中...' : `翻译成 ${userSettings?.targetLanguage || '...'}`}</button>
    </div>
  );
}
