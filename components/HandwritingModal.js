// components/HandwritingModal.js (已修复触摸事件和样式，无省略)

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaTimes, FaUndo, FaPen, FaSpinner, FaEdit } from 'react-icons/fa';
import handwriting from 'handwriting';

const HandwritingModal = ({ isOpen, onClose }) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const isDrawingRef = useRef(false);

    const [isRecognizing, setIsRecognizing] = useState(false);
    const [results, setResults] = useState([]);

    // --- 核心修复：统一处理鼠标和触摸事件，获取在Canvas中的正确坐标 ---
    const getCoords = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // 检查是否为触摸事件
        if (event.touches && event.touches.length > 0) {
            return {
                offsetX: event.touches[0].clientX - rect.left,
                offsetY: event.touches[0].clientY - rect.top,
            };
        }
        // 否则为鼠标事件
        return { 
            offsetX: event.clientX - rect.left, 
            offsetY: event.clientY - rect.top 
        };
    };

    // --- 封装绘图逻辑 ---
    const startDrawing = useCallback((event) => {
        // 阻止默认行为，如在触摸设备上滚动页面
        event.preventDefault(); 
        const { offsetX, offsetY } = getCoords(event);
        if (contextRef.current) {
            contextRef.current.beginPath();
            contextRef.current.moveTo(offsetX, offsetY);
            isDrawingRef.current = true;
        }
    }, []);

    const finishDrawing = useCallback((event) => {
        event.preventDefault();
        if (contextRef.current) {
            contextRef.current.closePath();
        }
        isDrawingRef.current = false;
    }, []);

    const draw = useCallback((event) => {
        if (!isDrawingRef.current) return;
        event.preventDefault();
        const { offsetX, offsetY } = getCoords(event);
        if (contextRef.current) {
            contextRef.current.lineTo(offsetX, offsetY);
            contextRef.current.stroke();
        }
    }, []);
    
    // --- 初始化和事件绑定 ---
    useEffect(() => {
        if (!isOpen) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // 设置高DPI屏幕的Canvas分辨率，防止模糊
        const scale = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * scale;
        canvas.height = canvas.offsetHeight * scale;
        
        const context = canvas.getContext('2d');
        context.scale(scale, scale);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#FFFFFF'; // 白色笔迹
        context.lineWidth = 8; // 加粗一点，触摸更友好
        contextRef.current = context;
        
        // 关键：绑定所有需要的事件监听器
        // 鼠标事件
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mouseup', finishDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseleave', finishDrawing);
        
        // 触摸事件
        // { passive: false } 是为了让 preventDefault 生效
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchend', finishDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });

        // 组件卸载或关闭时，清理事件监听器，避免内存泄漏
        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mouseup', finishDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseleave', finishDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchend', finishDrawing);
            canvas.removeEventListener('touchmove', draw);
        };

    }, [isOpen, startDrawing, finishDrawing, draw]); // 依赖项包含回调函数


    // --- 控制功能 ---
    const handleClear = () => {
        const canvas = canvasRef.current;
        if (canvas && contextRef.current) {
            contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
        }
        setResults([]);
    };

    const handleRecognize = () => {
        if (isRecognizing) return;

        setIsRecognizing(true);
        setResults([]);
        const canvas = canvasRef.current;
        
        handwriting.recognize(canvas, {
            width: canvas.offsetWidth, 
            height: canvas.offsetHeight,
            language: 'zh_CN', // 使用简体中文识别
            numOfReturn: 10 
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
                <h3 style={styles.title}><FaEdit /> 手写练习</h3>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                
                <div style={styles.canvasContainer}>
                    <canvas ref={canvasRef} style={styles.canvas} />
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

// --- 样式表 (完整，无省略) ---
const styles = {
    overlay: { 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.7)', 
        backdropFilter: 'blur(8px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 11000 
    },
    modalContent: { 
        background: '#2d3748', 
        color: 'white', 
        padding: '25px', 
        borderRadius: '15px', 
        width: '90%', 
        maxWidth: '400px', 
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)', 
        position: 'relative' 
    },
    title: { 
        textAlign: 'center', 
        marginTop: 0, 
        marginBottom: '15px', 
        color: '#a0aec0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '10px' 
    },
    closeButton: { 
        position: 'absolute', 
        top: '15px', 
        right: '15px', 
        background: 'none', 
        border: 'none', 
        fontSize: '1.5rem', 
        cursor: 'pointer', 
        color: '#718096' 
    },
    canvasContainer: { 
        border: '2px dashed #4a5568', 
        borderRadius: '10px', 
        overflow: 'hidden', 
        background: '#1a202c',
        touchAction: 'none' // 关键：禁用元素上的默认触摸行为，如平移或缩放
    },
    canvas: { 
        display: 'block', 
        width: '100%', 
        height: '200px', 
        cursor: 'crosshair' 
    },
    controls: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginTop: '20px' 
    },
    button: { 
        border: 'none', 
        borderRadius: '10px', 
        padding: '12px 20px', 
        fontSize: '1rem', 
        fontWeight: 'bold', 
        cursor: 'pointer', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px' 
    },
    clearButton: { 
        background: '#718096', 
        color: 'white' 
    },
    recognizeButton: { 
        background: 'linear-gradient(135deg, #4299e1, #3182ce)', 
        color: 'white' 
    },
    resultsContainer: { 
        marginTop: '20px', 
        background: '#1a202c', 
        borderRadius: '10px', 
        padding: '15px', 
        minHeight: '60px', 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '10px', 
        alignItems: 'center' 
    },
    resultItem: { 
        background: '#4a5568', 
        padding: '5px 12px', 
        borderRadius: '8px', 
        fontSize: '1.2rem' 
    },
    placeholder: { 
        color: '#718096', 
        fontSize: '0.9rem' 
    }
};

// 确保旋转动画的CSS被注入，这部分逻辑保持不变
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`;
document.head.appendChild(styleSheet);

export default HandwritingModal;
