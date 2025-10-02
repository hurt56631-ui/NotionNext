import React, { createContext, useState, useContext } from 'react';

// 1. 创建 Context 对象
const UnreadCountContext = createContext({
  totalUnreadCount: 0,
  setTotalUnreadCount: () => {},
});

// 2. 创建一个 Provider 组件
export const UnreadCountProvider = ({ children }) => {
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const value = {
    totalUnreadCount,
    setTotalUnreadCount,
  };

  return (
    <UnreadCountContext.Provider value={value}>
      {children}
    </UnreadCountContext.Provider>
  );
};

// 3. 创建一个自定义 Hook
export const useUnreadCount = () => {
  const context = useContext(UnreadCountContext);
  if (context === undefined) {
    throw new Error('useUnreadCount must be used within an UnreadCountProvider');
  }
  return context;
};
