// components/HandwritingModal.js (新建文件)

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaTimes, FaUndo, FaPen, FaSpinner } from 'react-icons/fa';
import handwriting from 'handwriting';

const HandwritingModal = ({ isOpen, onClose }) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const isDrawingRef = useRef(false);

    const [isRecognizing, setIsRecognizing] = useState(false);
    const [results, setResults] = useState([]);

    // 初始化 Canvas
    useEffect(() => {
        if (!isOpen) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // 提高 Canvas 分辨率以避免模糊
        const scale = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * scale;
        canvas.height = canvas.offsetHeight * scale;

        const context = canvas.getContext('2d');
        context.scale(scale, scale);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#FFFFFF'; // 白色笔迹
        context.lineWidth = 6;
        contextRef.current = context;

    }, [isOpen]);

    // --- 繪圖邏輯 ---
    const startDrawing = useCallback(({ nativeEvent }) => {
        const { offsetX, offsetY } = nativeEvent;
        contextRef.current.beginPath();
        contextRef.current.moveTo(offsetX, offsetY);
        isDrawingRef.current = true;
    }, []);

    const finishDrawing = useCallback(() => {
        contextRef.current.closePath();
        isDrawingRef.current = false;
    }, []);

    const draw = useCallback(({ nativeEvent }) => {
        if (!isDrawingRef.current) return;
        const { offsetX, offsetY } = nativeEvent;
        contextRef.current.lineTo(offsetX, offsetY);
        contextRef.current.stroke();
    }, []);

    // --- 控制功能 ---
    const handleClear = () => {
        const canvas = canvasRef.current;
        contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
        setResults([]);
    };

    const handleRecognize = () => {
        if (isRecognizing) return;

        setIsRecognizing(true);
        setResults([]);

        const canvas = canvasRef.current;
        
        // handwriting.js 的使用方法
        handwriting.recognize(canvas, {
            width: canvas.offsetWidth, // 使用畫布的顯示寬度
            height: canvas.offsetHeight, // 使用畫布的顯示高度
            language: 'zh_TW', // 或者 'zh_CN'
            numOfReturn: 10 // 返回最多10個候選字
        }, (data, err) => {
            setIsRecognizing(false);
            if (err) {
                console.error("手写识别出错:", err);
                alert('识别失败，请检查网络连接或稍后再试。');
            } else {
                console.log("识别结果:", data);
                setResults(data || []);
            }
        });
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div style={styles.overlay}>
            <div style={styles.modalContent}>
                <h3 style={styles.title}>手写练习</h3>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                
                <div style={styles.canvasContainer}>
                    <canvas
                        ref={canvasRef}
                        style={styles.canvas}
                        onMouseDown={startDrawing}
                        onMouseUp={finishDrawing}
                        onMouseMove={draw}
                        onMouseLeave={finishDrawing} // 如果鼠标移出也要停止绘画
                    />
                </div>

                <div style={styles.controls}>
                    <button style={{...styles.button, ...styles.clearButton}} onClick={handleClear}>
                        <FaUndo /> 清除
                    </button>
                    <button style={{...styles.button, ...styles.recognizeButton}} onClick={handleRecognize} disabled={isRecognizing}>
                        {isRecognizing ? <FaSpinner className="spin" /> : <FaPen />} 识别
                    </button>
                </div>
                
                <div style={styles.resultsContainer}>
                    {results.length > 0 ? (
                        results.map((char, index) => (
                            <div key={index} style={styles.resultItem}>
                                {char}
                            </div>
                        ))
                    ) : (
                        <div style={styles.placeholder}>识别结果将显示在这里</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 样式表 ---
const styles = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 },
    modalContent: { background: '#2d3748', color: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', position: 'relative' },
    title: { textAlign: 'center', marginTop: 0, marginBottom: '15px', color: '#a0aec0' },
    closeButton: { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#718096' },
    canvasContainer: { border: '2px dashed #4a5568', borderRadius: '10px', overflow: 'hidden', background: '#1a202c' },
    canvas: { display: 'block', width: '100%', height: '200px', cursor: 'crosshair' },
    controls: { display: 'flex', justifyContent: 'space-between', marginTop: '20px' },
    button: { border: 'none', borderRadius: '10px', padding: '12px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    clearButton: { background: '#718096', color: 'white' },
    recognizeButton: { background: 'linear-gradient(135deg, #4299e1, #3182ce)', color: 'white' },
    resultsContainer: { marginTop: '20px', background: '#1a202c', borderRadius: '10px', padding: '15px', minHeight: '60px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' },
    resultItem: { background: '#4a5568', padding: '5px 12px', borderRadius: '8px', fontSize: '1.2rem' },
    placeholder: { color: '#718096', fontSize: '0.9rem' }
};

// 添加旋转动画的 CSS
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`;
document.head.appendChild(styleSheet);


export default HandwritingModal;
