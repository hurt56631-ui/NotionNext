import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- 【全新】的 AiTtsButton 组件 (v2 - 支持加载、播放动画和暂停) ---
const AiTtsButton = ({ text, ttsSettings }) => {
    const [playbackState, setPlaybackState] = useState('idle'); // 'idle', 'loading', 'playing', 'paused'
    const audioRef = useRef(null);
    const abortControllerRef = useRef(null);

    // 从 settings 中解构 TTS 参数，并提供默认值
    const {
        ttsVoice = 'zh-CN-XiaoxiaoMultilingualNeural',
        ttsRate = 0,
        ttsPitch = 0,
    } = ttsSettings || {};

    // 更强大的文本清理函数
    const cleanTextForSpeech = (rawText) => {
        if (!rawText) return '';
        let cleaned = rawText;
        cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, ''); 
        cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1'); 
        cleaned = cleaned.replace(/(\*\*|__|\*|_|~~|`)/g, ''); 
        cleaned = cleaned.replace(/^(#+\s*|[\*\-]\s*)/gm, '');
        cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');
        const pinyinRegex = /\b[a-zA-ZüÜ]+[1-5]\b\s*/g;
        cleaned = cleaned.replace(pinyinRegex, '');
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        cleaned = cleaned.replace(emojiRegex, '');
        return cleaned.trim();
    };

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            if (audioRef.current) {
                audioRef.current.pause();
                if (audioRef.current.src?.startsWith('blob:')) {
                    URL.revokeObjectURL(audioRef.current.src);
                }
            }
        };
    }, []);

    const startPlayback = useCallback(async (textToSpeak) => {
        if (playbackState === 'playing') {
            audioRef.current?.pause();
            return;
        }
        if (playbackState === 'paused') {
            audioRef.current?.play();
            return;
        }
        const cleanedText = cleanTextForSpeech(textToSpeak);
        if (!cleanedText) return;

        setPlaybackState('loading');
        abortControllerRef.current = new AbortController();

        try {
            const params = new URLSearchParams({ t: cleanedText, v: ttsVoice, r: `${ttsRate}%`, p: `${ttsPitch}%` });
            const url = `https://t.leftsite.cn/tts?${params.toString()}`;
            const response = await fetch(url, { signal: abortControllerRef.current.signal });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API 请求失败: ${response.status} ${errorText}`);
            }
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            audio.onplay = () => setPlaybackState('playing');
            audio.onpause = () => { if (audio.currentTime < audio.duration) setPlaybackState('paused'); };
            audio.onended = () => setPlaybackState('idle');
            audio.onerror = (e) => { console.error('音频播放错误:', e); setPlaybackState('idle'); };
            await audio.play();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('语音合成失败:', err);
                alert(`语音合成失败: ${err.message}`);
            }
            setPlaybackState('idle');
        }
    }, [ttsVoice, ttsRate, ttsPitch, playbackState]);

    const AnimatedMusicIcon = ({ state }) => {
        const barStyle = (animationDelay) => ({
            animation: state === 'playing' ? `sound-wave 1.2s ease-in-out ${animationDelay} infinite alternate` : 'none',
        });
        return (
            <div className="relative w-6 h-6 flex items-center justify-center">
                <div className={`absolute transition-opacity duration-300 ${state === 'loading' ? 'opacity-100' : 'opacity-0'}`}>
                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
                <div className={`absolute transition-opacity duration-300 ${state !== 'loading' ? 'opacity-100' : 'opacity-0'}`}>
                    {state === 'paused' ? (<i className="fas fa-play text-sm ml-0.5"></i>) : (
                        <div className="flex items-end justify-center w-6 h-6 gap-0.5">
                            <span className="w-1 h-2 bg-current rounded-full" style={barStyle('0s')}></span>
                            <span className="w-1 h-4 bg-current rounded-full" style={barStyle('0.2s')}></span>
                            <span className="w-1 h-5 bg-current rounded-full" style={barStyle('0.4s')}></span>
                            <span className="w-1 h-3 bg-current rounded-full" style={barStyle('0.6s')}></span>
                        </div>
                    )}
                </div>
                <style jsx>{`
                    @keyframes sound-wave { 0% { transform: scaleY(0.2); } 100% { transform: scaleY(1); } }
                `}</style>
            </div>
        );
    };

    return (
        <button
            onClick={(e) => { e.stopPropagation(); startPlayback(text); }}
            disabled={playbackState === 'loading'}
            className="p-2 rounded-full transition-colors duration-200 transform active:scale-90 hover:bg-black/10 text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
            title={playbackState === 'playing' ? "暂停" : (playbackState === 'paused' ? "继续播放" : "朗读")}
        >
            <AnimatedMusicIcon state={playbackState} />
        </button>
    );
};

export default AiTtsButton;
