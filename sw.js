const CACHE_NAME = 'your-learning-site-v1';
// 你需要缓存的核心文件列表
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/images/logo.png'
  // 根据你的网站结构，添加其他需要离线访问的 CSS, JS, 图片等文件
];

// 安装 Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 拦截网络请求并从缓存中提供资源
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果缓存中有匹配的资源，则返回它
        if (response) {
          return response;
        }
        // 否则，通过网络请求资源
        return fetch(event.request);
      }
    )
  );
});
