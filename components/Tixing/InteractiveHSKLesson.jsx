import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import { useDrag } from '@use-gesture/react';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 1. 导入所有外部组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. 统一的TTS模块 (无修改) ---
const ttsVoices = {
    zh: 'zh-CN-XiaoyouNeural',
    my: 'my-MM-NilarNeural',
};
let currentAudio = null;
const playTTS = async (text, lang = 'zh', rate = 0, onEndCallback = null) => {
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
  if (!text) { if (onEndCallback) onEndCallback(); return; }
  const voice = ttsVoices[lang];
  if (!voice) { console.error(`Unsupported language for TTS: ${lang}`); if (onEndCallback) onEndCallback(); return; }
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => { if (currentAudio === audio) { currentAudio = null; } if (onEndCallback) onEndCallback(); };
    audio.onerror = (e) => { console.error("Audio element failed to play:", e); audio.onended(); };
    await audio.play();
  } catch (e) { console.error(`播放 "${text}" (lang: ${lang}, rate: ${rate}) 失败:`, e); if (onEndCallback) onEndCallback(); }
};
const stopAllAudio = () => { if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; } };


// --- 3. 内置的辅助UI组件 (无修改) ---
const TeachingBlock = ({ data, onComplete, settings }) => { /* ... (代码省略) ... */ };
const WordStudyBlock = ({ data, onComplete, settings }) => { /* ... (代码省略) ... */ };
const CompletionBlock = ({ data, router }) => { /* ... (代码省略) ... */ };
const UnknownBlockHandler = ({ type, onSkip }) => { /* ... (代码省略) ... */ };


// --- 4. 主播放器组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isJumping, setIsJumping] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    const router = useRouter();
    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    // --- 【新增】缓存与恢复逻辑 ---

    // [1] 缓存完整的课程数据
    useEffect(() => {
        // 确保 lesson 对象和其 ID 存在
        if (lesson && lesson.id) {
            const storageKey = `lesson-cache-${lesson.id}`;
            try {
                const lessonJson = JSON.stringify(lesson);
                localStorage.setItem(storageKey, lessonJson);
                console.log(`课程数据已缓存: ${lesson.id}`);
            } catch (error) {
                console.error("缓存课程数据失败:", error);
            }
        }
    }, [lesson]); // 依赖于 lesson 对象本身，当它变化时就重新缓存

    // [2] 读取已保存的学习进度
    useEffect(() => {
        if (lesson?.id) {
            const storageKey = `lesson-progress-${lesson.id}`;
            const savedProgress = localStorage.getItem(storageKey);
            if (savedProgress) {
                const savedIndex = parseInt(savedProgress, 10);
                if (!isNaN(savedIndex) && savedIndex > 0 && savedIndex < totalBlocks) {
                    console.log(`发现已保存的进度，正在跳转到第 ${savedIndex + 1} 页...`);
                    setCurrentIndex(savedIndex);
                }
            }
        }
    }, [lesson?.id, totalBlocks]);

    // [3] 保存当前学习进度
    useEffect(() => {
        if (lesson?.id) {
            const storageKey = `lesson-progress-${lesson.id}`;
            if (currentIndex > 0 && currentIndex < totalBlocks) {
                localStorage.setItem(storageKey, currentIndex.toString());
            }
            if (currentIndex === 0 || currentIndex >= totalBlocks) {
                localStorage.removeItem(storageKey);
            }
        }
    }, [currentIndex, lesson?.id, totalBlocks]);
    
    // --- 核心播放逻辑 (无修改) ---
    
    useEffect(() => { stopAllAudio(); }, [currentIndex]);

    useEffect(() => {
        if (currentBlock && currentBlock.type === 'choice' && currentBlock.content.narrationText) {
            const timer = setTimeout(() => { playTTS(currentBlock.content.narrationText, 'zh'); }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, currentBlock]);

    const nextStep = useCallback(() => { if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); } }, [currentIndex, totalBlocks]);
    const delayedNextStep = useCallback(() => { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); setTimeout(() => { if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); } }, 4500); }, [currentIndex, totalBlocks]);
    
    const handleJump = (e) => {
        e.preventDefault();
        const pageNum = parseInt(jumpValue, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalBlocks) { setCurrentIndex(pageNum - 1); }
        setIsJumping(false);
        setJumpValue('');
    };
    
    const renderBlock = () => {
        if (currentIndex >= totalBlocks) { return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />; }
        if (!currentBlock) { return <div className="text-white">正在加载...</div>; }
        const type = currentBlock.type.toLowerCase();
        const props = { data: currentBlock.content, onCorrect: delayedNextStep, onComplete: nextStep, settings: { playTTS } };
        try {
            switch (type) {
                case 'teaching': return <TeachingBlock {...props} />;
                case 'grammar_study': if (!props.data?.grammarPoints?.length) { return <UnknownBlockHandler type="grammar_study (数据为空)" onSkip={nextStep} />; } return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} />;
                case 'dialogue_cinematic': return <DuiHua {...props} />;
                case 'word_study': return <WordStudyBlock {...props} />;
                case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={props.onCorrect} onNext={props.onCorrect} />;
                case 'choice': const xuanZeTiProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices || [], correctAnswer: props.data.correctId ? [props.data.correctId] : [], onNext: props.onCorrect }; if(xuanZeTiProps.data.narrationText){ xuanZeTiProps.isListeningMode = true; xuanZeTiProps.question.text = props.data.prompt; } return <XuanZeTi {...xuanZeTiProps} />;
                case 'lianxian': { if (!props.data.pairs?.length) { return <UnknownBlockHandler type="lianxian (no pairs data)" onSkip={nextStep} />; } const columnA = props.data.pairs.map(p => ({ id: p.id, content: p.left })); const columnB_temp = props.data.pairs.map(p => ({ id: `${p.id}_b`, content: p.right })); const columnB = [...columnB_temp].sort(() => Math.random() - 0.5); const correctPairsMap = props.data.pairs.reduce((acc, p) => { acc[p.id] = `${p.id}_b`; return acc; }, {}); return <LianXianTi title={props.data.prompt} columnA={columnA} columnB={columnB} pairs={correctPairsMap} onCorrect={props.onCorrect} />; }
                case 'paixu': { if (!props.data.items) return <UnknownBlockHandler type="paixu (no items)" onSkip={nextStep} />; const paiXuProps = { title: props.data.prompt, items: props.data.items, correctOrder: [...props.data.items].sort((a, b) => a.order - b.order).map(item => item.id), onCorrect: props.onCorrect, onComplete: props.onComplete, settings: props.settings, }; return <PaiXuTi {...paiXuProps} />; }
                case 'panduan': return <PanDuanTi {...props} />;
                case 'gaicuo': return <GaiCuoTi {...props} />;
                case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
                default: return <UnknownBlockHandler type={type} onSkip={nextStep} />;
            }
        } catch (error) { console.error(`渲染环节 "${type}" 时发生错误:`, error); return <UnknownBlockHandler type={`${type} (渲染失败)`} onSkip={nextStep} />; }
    };
    
    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col" style={{ backgroundImage: "url(/background.jpg)" }}>
            {currentIndex < totalBlocks && (
                 <div className="fixed top-4 left-4 right-4 z-30">
                    <div className="max-w-5xl mx-auto">
                        <div className="bg-gray-600/50 rounded-full h-1.5"><div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${(currentIndex + 1) / totalBlocks * 100}%`, transition: 'width 0.5s ease' }}></div></div>
                    </div>
                    <div onClick={() => setIsJumping(true)} className="absolute top-[-6px] right-0 px-3 py-1 bg-black/30 text-white text-sm rounded-full cursor-pointer whitespace-nowrap">{currentIndex + 1} / {totalBlocks}</div>
                </div>
            )}
            
            {isJumping && ( <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in" onClick={() => setIsJumping(false)}> <div onClick={(e) => e.stopPropagation()} className="bg-gray-800 p-6 rounded-lg shadow-xl relative"> <h3 className="text-white text-lg mb-4">跳转到第几页？ (1-{totalBlocks})</h3> <form onSubmit={handleJump}> <input type="number" autoFocus value={jumpValue} onChange={(e) => setJumpValue(e.target.value)} className="w-full px-4 py-2 text-center bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" /> </form> <button onClick={() => setIsJumping(false)} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white"><IoMdClose size={24} /></button> </div> </div> )}
            
            <div className="w-full h-full pt-16">{renderBlock()}</div>
        </div>
    );
}
