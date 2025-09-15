// themes/heo/components/Header.js 【最终修改版】

import { siteConfig } from '@/lib/config'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import Logo from './Logo'
import { MenuListTop } from './MenuListTop'
import SearchButton from './SearchButton'
import SlideOver from './SlideOver'
import SocialLogins from '@/components/SocialLogins' // 1. 修正导入的组件名和路径

/**
 * 页头：顶部导航 (已简化)
 * @param {*} props
 * @returns
 */
const Header = props => {
  const router = useRouter()
  const slideOverRef = useRef()

  const toggleMenuOpen = () => {
    slideOverRef?.current?.toggleSlideOvers()
  }

  // 2. 删除了所有与滚动相关的 state 和 effects (fixedNav, scrollTrigger 等)

  return (
    <>
      {/* 顶部导航菜单栏 */}
      <nav
        id='nav'
        // 3. 简化了 className，移除了所有动态样式，让它始终保持静态
        className='z-20 h-16 top-0 w-full relative bg-white dark:bg-[#18171d] shadow'
      >
        <div className='flex h-full mx-auto justify-between items-center max-w-[86rem] px-6'>
          {/* 左侧logo */}
          <Logo {...props} />

          {/* 中间菜单 */}
          <div
            id='nav-bar-swipe'
            className='hidden lg:flex flex-grow flex-col items-center justify-center h-full relative w-full'
          >
            <MenuListTop {...props} />
          </div>

          {/* 右侧固定 */}
          <div className='flex flex-shrink-0 justify-end items-center space-x-4'>
            {/* 登录按钮 */}
            <SocialLogins />

            {/* 搜索按钮 */}
            <SearchButton {...props} />
            
            {/* 4. 删除了 RandomPostButton, DarkModeButton, ReadingProgress */}

            {/* 移动端菜单按钮 */}
            <div
              onClick={toggleMenuOpen}
              className='flex lg:hidden w-8 justify-center items-center h-8 cursor-pointer'
            >
              <i className='fas fa-bars' />
            </div>
          </div>

          {/* 右边侧拉抽屉 */}
          <SlideOver cRef={slideOverRef} {...props} />
        </div>
      </nav>
    </>
  )
}

export default Header
