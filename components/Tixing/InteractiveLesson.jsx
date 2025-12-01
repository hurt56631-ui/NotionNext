import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave, HiCheckCircle, HiXCircle } from "react-icons/hi2";
import confetti from 'canvas-confetti';

// --- 1. 导入子组件 ---
// 注意：为了配合多邻国模式，你的子组件(如XuanZeTi)可能需要微调，
// 接受一个 `submitted` 属性来决定是否显示红绿色框。
import XuanZeTi from './XuanZeTi'; 
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. TTS & 音效 ---
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
let currentAudio = null;

const playTTS = async (text, lang = 'zh', rate = 0) => {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (!text) return;
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${ttsVoices[lang]||ttsVoices['zh']}&r=${rate}`;
        const audio = new Audio(url);
        currentAudio = audio;
        await audio.play();
    } catch (e) { console.error("TTS error:", e); }
};

const playSound = (type) => {
    // 这里你可以换成真实的 mp3 URL
    const audio = new Audio(type === 'correct' 
        ? 'https://codesandbox.io/static/sound/correct.mp3' // 示例正确音效
        : 'https://codesandbox.io/static/sound/error.mp3');  // 示例错误音效
    audio.play().catch(()=>null);
};

// --- 3. [核心] 多邻国风格底部 Footer ---
const DuolingoFooter = ({ status, onCheck, onContinue, correctMessage = "非常好！", wrongMessage = "答案错误" }) => {
    // status: 'idle'(不可点) | 'selected'(可点检测) | 'correct'(显示绿条) | 'wrong'(显示红条)
    
    // 根据状态计算样式
    const isResultShown = status === 'correct' || status === 'wrong';
    const isCorrect = status === 'correct';

    // 容器背景色
    let containerBg = "bg-white border-t border-slate-200";
    if (status === 'correct') containerBg = "bg-[#d7ffb8] border-t-transparent"; // 多邻国绿背景
    if (status === 'wrong') containerBg = "bg-[#ffdfe0] border-t-transparent";   // 多邻国红背景

    // 按钮样式
    let btnClass = "w-full py-3 rounded-xl font-bold text-lg shadow-[0_4px_0_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[4px] transition-all uppercase tracking-wider";
    if (status === 'idle') {
        btnClass += " bg-slate-200 text-slate-400 cursor-not-allowed shadow-none active:translate-y-0";
    } else if (status === 'selected') {
        btnClass += " bg-[#58cc02] text-white hover:bg-[#46a302] shadow-[#46a302]"; // 绿色检测按钮
    } else if (status === 'correct') {
        btnClass += " bg-[#58cc02] text-white hover:bg-[#46a302] shadow-[#46a302]"; // 继续按钮(绿)
    } else if (status === 'wrong') {
        btnClass += " bg-[#ff4b4b] text-white hover:bg-[#d63e3e] shadow-[#d63e3e]"; // 继续按钮(红)
    }

    return (
        <div className={`fixed bottom-0 left-0 w-full z-50 transition-colors duration-300 pb-safe ${containerBg}`}>
            <div className="max-w-2xl mx-auto px-4 py-4 md:px-6">
                
                {/* 结果反馈区 (只在检测后显示) */}
                {isResultShown && (
                    <div className="flex items-center mb-4 animate-fade-in-up">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mr-3 ${isCorrect ? 'bg-white text-[#58cc02]' : 'bg-white text-[#ff4b4b]'}`}>
                            {isCorrect ? <HiCheckCircle className="w-6 h-6 md:w-8 md:h-8" /> : <HiXCircle className="w-6 h-6 md:w-8 md:h-8" />}
                        </div>
                        <div>
                            <h3 className={`font-extrabold text-xl md:text-2xl ${isCorrect ? 'text-[#58a700]' : 'text-[#ea2b2b]'}`}>
                                {isCorrect ? "非常好！" : "再接再厉"}
                            </h3>
                            {!isCorrect && <p className="text-[#ea2b2b] text-sm md:text-base">{wrongMessage}</p>}
                        </div>
                    </div>
                )}

                {/* 按钮区 */}
                <button 
                    onClick={isResultShown ? onContinue : onCheck}
                    disabled={status === 'idle'}
                    className={btnClass}
                >
                    {isResultShown ? "继续" : "检测"}
                </button>
            </div>
        </div>
    );
};

// --- 4. 页面组件 (简化版) ---
// 对于不需要“检测”的页面（如Teaching, End），status直接设为 'selected' 并修改按钮文字逻辑

const TeachingBlock = ({ data }) => {
    useEffect(() => {
        if (data.narrationScript) setTimeout(() => playTTS(data.narrationScript, 'my'), 600);
    }, [data]);
    return (
        <div className="flex flex-col items-center text-center">
            <h1 className="text-4xl font-black text-slate-800 mb-6">{data.displayText}</h1>
            <button onClick={() => playTTS(data.displayText, 'zh')} className="p-4 bg-white rounded-2xl shadow-sm border mb-4"><HiSpeakerWave className="w-8 h-8 text-blue-500"/></button>
            <div className="text-slate-500">{data.translation}</div>
        </div>
    );
};

const CompletionBlock = ({ router }) => (
    <div className="flex flex-col items-center">
        <div className="text-7xl mb-4 animate-bounce">🎉</div>
        <h2 className="text-2xl font-bold">课程完成</h2>
    </div>
);

// --- 5. 主逻辑组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const router = useRouter();
    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;

    // --- 状态管理 ---
    // 'idle': 用户没操作
    // 'selected': 用户选了，但没点检测
    // 'correct': 检测通过
    // 'wrong': 检测错误
    const [footerStatus, setFooterStatus] = useState('idle'); 
    
    // 用于通知子组件“提交了” (以便子组件显示红绿框)
    const [isSubmitted, setIsSubmitted] = useState(false);
    
    // 暂存用户当前的答案正确性 (由子组件通过 onSelect 回传，或者父组件校验)
    // 这里为了兼容性，假设子组件在 onSelect 时告诉父组件 "我选的这个是对是错" 或者 "我选了xxx"
    // 简化方案：我们假设子组件传递 `isCorrect` 给 onSelect
    const [pendingCorrectness, setPendingCorrectness] = useState(false);

    // --- 副作用 ---
    useEffect(() => {
        if (!currentBlock) return;
        
        // 切题时重置状态
        setIsSubmitted(false);
        setFooterStatus('idle');
        setPendingCorrectness(false);
        window.scrollTo(0,0);

        // 自动类型直接允许“继续”
        const type = currentBlock.type.toLowerCase();
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        if (autoUnlockTypes.includes(type)) {
            // 这些页面不需要“检测”，直接变成“继续”的状态，或者变成“可点击”状态
            // 为了复用Footer逻辑，我们把它们视为“已选择”，且点击直接跳下一题
            setFooterStatus('correct'); // 这里借用correct样式(绿色)，或者你可以新增一个 'continue' 状态
        }

        // 自动播放
        if (currentBlock.content?.narrationScript) {
            setTimeout(() => playTTS(currentBlock.content.narrationScript, 'zh'), 500);
        }
    }, [currentIndex, currentBlock]);

    // --- 交互处理 ---

    // 子组件通知父组件：用户选择了一个选项
    // isCorrectNow: 用户当前选的这个答案是否正确 (需要在子组件里判断好传出来，或者传值由父组件判断)
    const handleUserSelect = useCallback((isCorrectNow) => {
        if (isSubmitted) return; // 提交后不能改
        setFooterStatus('selected'); // 按钮变绿（检测）
        setPendingCorrectness(isCorrectNow);
    }, [isSubmitted]);

    // 点击“检测”按钮
    const handleCheck = () => {
        setIsSubmitted(true); // 通知子组件显示红绿框
        
        if (pendingCorrectness) {
            setFooterStatus('correct');
            playSound('correct');
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 } });
        } else {
            setFooterStatus('wrong');
            playSound('wrong');
        }
    };

    // 点击“继续”按钮
    const handleContinue = () => {
        if (currentIndex < blocks.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            router.push('/'); // 结束
        }
    };

    // --- 渲染内容 ---
    const renderContent = () => {
        if (!currentBlock) return null;
        if (currentIndex >= blocks.length) return <CompletionBlock router={router} />;

        const type = currentBlock.type.toLowerCase();
        const commonProps = {
            data: currentBlock.content,
            // 关键：把状态传给子组件
            isSubmitted: isSubmitted, 
            // 关键：子组件选择时调用，参数 true/false 代表选的对不对
            onSelect: (isCorrect) => handleUserSelect(isCorrect), 
            settings: { playTTS }
        };

        // 针对不同组件，你可能需要稍微修改一下组件内部逻辑，
        // 让它们在 isSubmitted=true 时显示答案样式
        switch (type) {
            case 'teaching': 
            case 'word_study': 
            case 'dialogue_cinematic':
            case 'grammar_study':
                // 这些组件本身没有对错之分，直接渲染
                // 在 useEffect 里已经设置了 status 为 'correct' (即可以直接点继续)
                return type === 'teaching' ? <TeachingBlock {...commonProps} /> : <div>非题目页面内容</div>;

            case 'choice': 
                // 示例：选择题
                // 你需要修改 XuanZeTi，让它在点击选项时调用 props.onSelect(item.isCorrect)
                return <XuanZeTi {...commonProps} 
                    question={currentBlock.content} 
                    options={currentBlock.content.choices} 
                    correctId={currentBlock.content.correctId} 
                />;
            
            // ... 其他题型同理
            default: return <div>{type}</div>;
        }
    };

    // 进度条
    const progress = ((currentIndex + 1) / blocks.length) * 100;

    return (
        <div className="min-h-[100dvh] w-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans">
            
            {/* 顶部进度条 (极简) */}
            <div className="w-full h-4 bg-slate-100 sticky top-0 z-40">
                <div className="h-full bg-[#58cc02] transition-all duration-500 rounded-r-full" style={{ width: `${progress}%` }} />
            </div>

            {/* 内容区 */}
            {/* pb-48: 给底部的 Footer 留出足够的空间，防止内容被遮挡 */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 pt-10 pb-48 w-full max-w-2xl mx-auto">
                {renderContent()}
            </div>

            {/* 底部多邻国风格 Footer */}
            <DuolingoFooter 
                status={footerStatus}
                onCheck={handleCheck}
                onContinue={handleContinue}
                wrongMessage={currentBlock?.content?.explanation || "正确答案是..."}
            />
        </div>
    );
}
