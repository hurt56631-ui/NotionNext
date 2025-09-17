import { siteConfig } from '@/lib/config'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import Logo from './Logo'
import { MenuListTop } from './MenuListTop'
import SearchButton from './SearchButton'
import SlideOver from './SlideOver'
import SocialLogins from '@/components/SocialLogins'

const Header = props => {
  const router = useRouter()
  const slideOverRef = useRef()
  const { user } = useAuth()

  const toggleMenuOpen = () => {
    slideOverRef?.current?.toggleSlideOvers()
  }

  return (
    <>
      <nav
        id='nav'
        className='z-20 h-16 top-0 w-full relative bg-white dark:bg-[#18171d] shadow'
      >
        <div className='flex h-full mx-auto justify-between items-center max-w-[86rem] px-6'>
          <Logo {...props} />
          <div
            id='nav-bar-swipe'
            className='hidden lg:flex flex-grow flex-col items-center justify-center h-full relative w-full'
          >
            <MenuListTop {...props} />
          </div>
          <div className='flex flex-shrink-0 justify-end items-center space-x-4'>
            {user && (
              <Link href="/forum/messages" passHref>
                <a className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-500 transition-colors" aria-label="Messages">
                  <i className="fas fa-paper-plane text-lg"></i>
                </a>
              </Link>
            )}
            <SocialLogins />
            <SearchButton {...props} />
            <div
              onClick={toggleMenuOpen}
              className='flex lg:hidden w-8 justify-center items-center h-8 cursor-pointer'
            >
              <i className='fas fa-bars' />
            </div>
          </div>
          <SlideOver cRef={slideOverRef} {...props} />
        </div>
      </nav>
    </>
  )
}
export default Header
