// lib/DrawerContext.js

import React, { createContext, useContext, useState } from 'react';

const DrawerContext = createContext();

export const useDrawer = () => useContext(DrawerContext);

export const DrawerProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState(null); // 存放要显示的内容

  const openDrawer = (content) => {
    setDrawerContent(content);
    setIsOpen(true);
  };

  const closeDrawer = () => {
    setIsOpen(false);
    // 延迟清空内容，让关闭动画更流畅
    setTimeout(() => setDrawerContent(null), 300); 
  };

  const value = {
    isOpen,
    drawerContent,
    openDrawer,
    closeDrawer,
  };

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};
