<div className="xzt-container">
    <div className="xzt-content-padding">
      
      {/* --- 题目区域 --- */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        
        {/* 听力模式大按钮 */}
        {isListeningMode && (
          <button 
            className={`xzt-listen-btn ${isTTsPlaying ? 'playing' : ''}`} 
            onClick={handlePlayTTS}
            aria-label="播放题目音频"
          >
            <FaVolumeUp size={30} />
          </button>
        )}

        {/* 视频播放器 */}
        {question.videoUrl && (
          <div className="media-wrapper">
            <ReactPlayer 
              url={question.videoUrl} 
              controls 
              width="100%" 
              height="100%" 
              className="react-player-absolute"
            />
          </div>
        )}

        {/* 普通音频播放器 */}
        {question.audioUrl && !isListeningMode && (
          <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            <ReactPlayer 
              url={question.audioUrl} 
              controls 
              width="100%" 
              height="50px" 
              playing={false} 
            />
          </div>
        )}

        {/* 题目图片 */}
        {question.imageUrl && !question.videoUrl && (
          <img 
            src={question.imageUrl} 
            alt="题目配图" 
            style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', display: 'block' }} 
          />
        )}
        
        {/* 题干文本 */}
        {question.text && (!isListeningMode || showTranscript) && (
          <h3 className="xzt-question-text fade-in" style={{ 
            margin: 0, 
            color: 'var(--text-main)', 
            lineHeight: 1.6, 
            whiteSpace: 'pre-wrap'
          }}>
            {question.text}
          </h3>
        )}

        {/* 查看原文开关 */}
        {isListeningMode && question.text && (
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            style={{
              background: 'transparent',
              border: '1px solid var(--gray)',
              color: 'var(--gray)',
              padding: '8px 16px',
              borderRadius: '20px',
              marginTop: '16px',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            {showTranscript ? <><FaEyeSlash /> 隐藏原文</> : <><FaEye /> 查看原文</>}
          </button>
        )}
      </div>

      {/* --- 选项区域 --- */}
      <div className="xzt-options-grid">
        {options.map(option => {
          // 计算卡片样式类名
          let cardClass = 'xzt-option-card';
          if (selectedAnswers.includes(option.id)) cardClass += ' selected';
          
          if (isSubmitted) {
            if (correctAnswer.includes(option.id)) {
              cardClass += ' correct';
            } else if (selectedAnswers.includes(option.id)) {
              cardClass += ' incorrect';
            }
          }

          return (
            <div 
              key={option.id} 
              className={cardClass} 
              onClick={() => handleSelect(option.id)}
            >
              {option.imageUrl && (
                <img src={option.imageUrl} alt={option.text || '选项'} className="xzt-option-image"/>
              )}
              {option.text && <div className="xzt-option-text">{option.text}</div>}
              
              {/* 状态图标 */}
              {isSubmitted && correctAnswer.includes(option.id) && (
                <FaCheckCircle style={{ position: 'absolute', top: 8, right: 8, color: 'var(--success)', fontSize: '1.4rem' }}/>
              )}
              {isSubmitted && selectedAnswers.includes(option.id) && !correctAnswer.includes(option.id) && (
                <FaTimesCircle style={{ position: 'absolute', top: 8, right: 8, color: 'var(--error)', fontSize: '1.4rem' }}/>
              )}
            </div>
          );
        })}
      </div>

      {/* --- 按钮与反馈区域 --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!isSubmitted ? (
          <button 
            className={`xzt-btn ${selectedAnswers.length === 0 ? 'xzt-btn-disabled' : 'xzt-btn-primary'}`} 
            onClick={handleSubmit} 
            disabled={selectedAnswers.length === 0}
          >
            提交答案
          </button>
        ) : (
          <div className="fade-in" style={{ width: '100%' }}>
            {/* 结果反馈条 */}
            <div style={{ 
              padding: '12px', 
              borderRadius: '12px', 
              backgroundColor: isCorrect ? 'var(--bg-success)' : (isPartiallyCorrect ? 'var(--bg-warning)' : '#fee2e2'),
              color: isCorrect ? 'var(--success)' : (isPartiallyCorrect ? 'var(--warning)' : 'var(--error)'),
              textAlign: 'center', 
              fontWeight: 'bold',
              marginBottom: '16px',
              border: `1px solid ${isCorrect ? 'var(--success)' : 'currentColor'}`
            }}>
              {isCorrect ? '🎉 太棒了，全部答对！' : isPartiallyCorrect ? `😄 答对 ${correctCount} 个，继续加油！` : '❌ 回答错误，请看解析'}
            </div>

            {/* 解析部分 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {explanation ? (
                <button className="xzt-btn xzt-btn-warning" onClick={() => setShowExplanation(s => !s)}>
                  <FaLightbulb /> {showExplanation ? '收起解析' : '查看解析'}
                </button>
              ) : (
                <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', color: 'var(--text-sub)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaHourglassHalf style={{ marginRight: '8px' }}/> 智能解析生成中...
                </div>
              )}

              {showExplanation && explanation && (
                <div className="fade-in" style={{ 
                  backgroundColor: '#fffbeb', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  color: '#92400e',
                  lineHeight: '1.6',
                  fontSize: '0.95rem',
                  borderLeft: '4px solid var(--warning)'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>💡 题目解析：</div>
                  {explanation}
                </div>
              )}

              {/* 底部导航按钮 */}
              <button className="xzt-btn xzt-btn-gray" onClick={handleNextOrReset}>
                {onNext ? <><FaArrowRight /> 下一题</> : <><FaRedo /> 再试一次</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</>
