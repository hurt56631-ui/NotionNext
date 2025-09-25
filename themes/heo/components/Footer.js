import { BeiAnGongAn } from '@/components/BeiAnGongAn'
import CopyRightDate from '@/components/CopyRightDate'
import PoweredBy from '@/components/PoweredBy'
import { siteConfig } from '@/lib/config'
import SocialButton from './SocialButton'
import Link from 'next/link' // 导入 Link 组件
import { useRouter } from 'next/router' // 导入 useRouter

/**
 * 页脚
 * @returns
 */
const Footer = () => {
  const BEI_AN = siteConfig('BEI_AN')
  const BEI_AN_LINK = siteConfig('BEI_AN_LINK')
  const BIO = siteConfig('BIO')
  const router = useRouter() // 初始化 useRouter

  // 判断是否为文章详情页
  // 你可能需要根据实际的文章路由调整这里的路径，例如 '/post/' 或其他
  const isArticlePage = router.pathname.startsWith('/article/') || router.pathname.startsWith('/post/')

  return (
    <footer className='relative flex-shrink-0 bg-white dark:bg-[#1a191d] justify-center text-center m-auto w-full leading-6  text-gray-600 dark:text-gray-100 text-sm'>
      {/* 颜色过度区 */}
      <div
        id='color-transition'
        className='h-32 bg-gradient-to-b from-[#f7f9fe] to-white  dark:bg-[#1a191d] dark:from-inherit dark:to-inherit'
      />

      {/* 社交按钮 */}
      {/* 如果 RSS 是由 SocialButton 渲染的，你需要修改 SocialButton.js 或通过 siteConfig 来移除它。
          目前此 SocialButton 组件的代码未提供，无法直接修改。 */}
      <div className='w-full h-24'>
        <SocialButton />
      </div>

      <br />

      {/* 底部页面信息 */}
      <div
        id='footer-bottom'
        className='w-full h-20 flex flex-col p-3 lg:flex-row justify-between px-6 items-center bg-[#f1f3f7] dark:bg-[#21232A] border-t dark:border-t-[#3D3D3F]'>
        <div id='footer-bottom-left' className='text-center lg:text-start'>
          <PoweredBy />
          <div className='flex gap-x-1'>
            {/* 根据是否为文章页来条件渲染 CopyRightDate */}
            {!isArticlePage && <CopyRightDate />}
            <a
              href={'/about'}
              className='underline font-semibold dark:text-gray-300 '>
              {siteConfig('AUTHOR')}
            </a>
            {BIO && <span className='mx-1'> | {BIO}</span>}
          </div>
        </div>

        <div id='footer-bottom-right'>
          {BEI_AN && (
            <>
              <i className='fas fa-shield-alt' />{' '}
              <a href={BEI_AN_LINK} className='mr-2'>
                {siteConfig('BEI_AN')}
              </a>
            </>
          )}
          <BeiAnGongAn />

          {/* 这些是不蒜子统计，不是 RSS。
              如果之前有 RSS 相关的 div 或 span 留下了空白，你需要找到并移除它们。
              常见的 RSS 配置可能在 site.config.js 中，或者 SocialButton 组件里。 */}
          <span className='hidden busuanzi_container_site_pv'>
            <i className='fas fa-eye' />
            <span className='px-1 busuanzi_value_site_pv'> </span>{' '}
          </span>
          <span className='pl-2 hidden busuanzi_container_site_uv'>
            <i className='fas fa-users' />{' '}
            <span className='px-1 busuanzi_value_site_uv'> </span>{' '}
          </span>

          {/* <h1 className='text-xs pt-4 text-light-400 dark:text-gray-400'>{title} {siteConfig('BIO') && <>|</>} {siteConfig('BIO')}</h1> */}
        </div>
      </div>

      {/* 新增底部导航按钮，固定在底部，只在小屏幕显示 (lg:hidden) */}
      <div className='fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#1a191d] border-t dark:border-t-[#3D3D3F] shadow-lg lg:hidden z-30'>
        <div className='flex justify-around items-center h-14'>
          <Link href='/' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
            <i className='fas fa-home text-lg'></i>
            <span>主页</span>
          </Link>
          <Link href='/ai-assistant' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
            <i className='fas fa-robot text-lg'></i> {/* 使用机器人图标作为 AI 助手 */}
            <span>AI助手</span>
          </Link>
          <Link href='/community' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
            <i className='fas fa-users text-lg'></i> {/* 使用用户组图标作为社区 */}
            <span>社区</span>
          </Link>
          <Link href='/messages' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
            <i className='fas fa-comment-alt text-lg'></i> {/* 使用评论图标作为消息 */}
            <span>消息</span>
          </Link>
          <Link href='/me' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
            <i className='fas fa-user text-lg'></i> {/* 使用用户图标作为我 */}
            <span>我</span>
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer
