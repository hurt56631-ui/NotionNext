// components/bottle/TranslationView.js
import { useState } from 'react';
import { FaLanguage, FaVolumeUp } from 'react-icons/fa';
import { callAIHelper, parseSingleTranslation, playCachedTTS, preloadTTS } from '../../lib/aiUtils';

export default function TranslationView({ originalText, userSettings }) {
  const [translation, setTranslation] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState('');

  const handleTranslate = async () => {
    if (!userSettings || !userSettings.apiKey || !userSettings.apiEndpoint) {
      setError("请先在“漂流瓶设置”中配置翻译API的地址和密钥！");
      return;
    }
    
    setIsTranslating(true);
    setError('');
    setTranslation(null);

    const finalPrompt = userSettings.prompt.replace(/\[TARGET_LANG\]/g, userSettings.targetLanguage);

    try {
      const resultText = await callAIHelper(
        finalPrompt, originalText, userSettings.apiKey,
        userSettings.apiEndpoint, userSettings.model
      );
      const parsedResult = parseSingleTranslation(resultText);
      setTranslation(parsedResult);
      preloadTTS(parsedResult.translation); // 预加载译文TTS
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="translation-container">
      {error && <p className="error-message">{error}</p>}
      
      {translation && (
        <div className="translation-result">
          <hr />
          <h4>{userSettings.targetLanguage} 翻译:</h4>
          <div className="text-with-tts">
            <p>{translation.translation}</p>
            <button onClick={() => playCachedTTS(translation.translation)} className="tts-button">
              <FaVolumeUp />
            </button>
          </div>
          <p className="back-translation"><em>回译: {translation.backTranslation}</em></p>
        </div>
      )}

      <button className="button-translate" onClick={handleTranslate} disabled={isTranslating}>
        <FaLanguage /> {isTranslating ? '翻译中...' : `翻译成 ${userSettings?.targetLanguage || '...'}`}
      </button>
    </div>
  );
}
