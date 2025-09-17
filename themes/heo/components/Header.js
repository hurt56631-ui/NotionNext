// themes/heo/components/Header.js (已添加私信入口)

import { siteConfig } from '@/lib/config'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import Link from 'next/link' // 1. 引入 Link 组件
import { useAuth } from '@/lib/AuthContext' // 2. 引入 AuthContext
import Logo from './Logo'
import { MenuListTop } from './MenuListTop'
import SearchButton from './SearchButton'
import SlideOver from './SlideOver'
import SocialLogins from '@/components/SocialLogins'

/**
 * 页头：顶部导航 (已简化)
 * @param {*} props
 * @returns
 */
const Header = props => {
  const router = useRouter()
  const slideOverRef = useRef()
  const { user } = useAuth() // 3. 获取当前登录用户状态

  const toggleMenuOpen = () => {
    slideOverRef?.current?.toggleSlideOvers()
  }

  return (
    <>
      {/* 顶部导航菜单栏 */}
      <nav
        id='nav'
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
            {/* 4. 在这里添加私信入口 (仅当用户登录时显示) */}
            {user && (
              <Link href="/forum/messages" passHref>
                <a className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-500 transition-colors" aria-label="Messages">
                  <i className="fas fa-paper-plane text-lg"></i>
                </a>
              </Link>
            )}

            {/* 登录按钮 */}
            <SocialLogins />

            {/* 搜索按钮 */}
            <SearchButton {...props} />
            
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
