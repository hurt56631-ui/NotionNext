import { Transition } from '@headlessui/react'
import { Fragment } from 'react'

const PwaInstallPrompt = ({ show, onInstall, onDismiss }) => {
  return (
    <Transition as={Fragment} show={show}>
      <div className="fixed inset-0 z-50 flex items-center justify-center" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        {/* 背景遮罩 */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onDismiss}></div>
        </Transition.Child>

        {/* 弹窗主体 */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div 
            className="relative w-11/12 max-w-sm overflow-hidden rounded-2xl bg-white/50 dark:bg-black/50 shadow-2xl backdrop-blur-2xl ring-1 ring-black/10"
            // 添加内联样式来实现背景图
            style={{ 
              backgroundImage: "url('/images/your-background.jpg')", // <-- 在这里替换成你的背景图路径
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* 添加一层半透明遮罩来让文字更清晰 */}
            <div className="absolute inset-0 bg-black/20"></div>

            <div className="relative p-8 text-center text-white">
              {/* 你的App图标 */}
              <img src="/images/icons/icon-192x192.png" alt="App Icon" className="w-20 h-20 mx-auto rounded-lg shadow-lg" />

              <h3 className="mt-6 text-2xl font-bold" id="modal-title" style={{ textShadow: '1px 1px 5px rgba(0,0,0,0.5)' }}>
                安装到桌面
              </h3>

              <p className="mt-2 text-sm" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>
                获得更流畅的离线体验和更快的访问速度。
              </p>

              <div className="mt-8 flex flex-col gap-4">
                <button
                  onClick={onInstall}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95"
                >
                  立即安装
                </button>
                <button
                  onClick={onDismiss}
                  className="w-full rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-opacity hover:bg-white/30"
                >
                  稍后再说
                </button>
              </div>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  )
}

export default PwaInstallPrompt
