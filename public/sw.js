// 定义缓存名称
const CACHE_NAME = 'your-learning-site-v1';
// 定义需要被缓存的核心文件列表
const urlsToCache = [
  '/',
  // 注意：这里需要根据您网站的实际文件进行调整
  // 例如 '/index.html', '/css/style.css', '/js/main.js' 等
  // 对于Next.js，通常缓存核心的页面路由和静态资源
];

// 监听 'install' 事件，在安装时缓存核心资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 监听 'fetch' 事件，拦截网络请求并优先从缓存中返回
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果缓存中有匹配的资源，则直接返回它
        if (response) {
          return response;
        }
        // 否则，通过网络发起请求
        return fetch(event.request);
      }
    )
  );
});
