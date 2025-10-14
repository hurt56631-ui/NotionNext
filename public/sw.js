// public/sw.js  <-- 最终修复版，采用网络优先策略

// 每次部署时，Vercel 都会重新生成这个文件，这个时间戳会变化，从而触发 Service Worker 更新
const CACHE_NAME = `notion-next-cache-v${new Date().getTime()}`;

self.addEventListener('install', (event) => {
  // 安装阶段，强制新的 Service Worker 跳过等待，立即进入激活状态
  event.waitUntil(self.skipWaiting()); 
  console.log('Service Worker: installed');
});

self.addEventListener('activate', (event) => {
  // 激活阶段，清理所有旧的缓存
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 如果缓存名不是当前最新的，就删除它
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 激活后，立即取得对所有客户端的控制权
      console.log('Service Worker: activated and claimed clients');
      return self.clients.claim(); 
    })
  );
});

self.addEventListener('fetch', (event) => {
  // 我们只处理 GET 请求
  if (event.request.method !== 'GET') {
    return;
  }
  
  // 对于导航请求 (HTML页面)，总是网络优先
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/_offline')) // 如果断网，可以显示一个离线页面（可选）
    );
    return;
  }

  // 对于其他资源 (CSS, JS, 图片)，采用网络优先策略
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 请求成功，将最新的响应存入新缓存，并返回给页面
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // 网络请求失败 (比如断网了)，才尝试从缓存中获取
        return caches.match(event.request);
      })
  );
});
