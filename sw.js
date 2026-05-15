// sw.js - Service Worker for PWA
const CACHE_NAME = 'qr-scanner-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
];

// 安装时缓存资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('缓存资源中...');
            return cache.addAll(urlsToCache);
        })
    );
    // 立即激活，不等待旧 Service Worker
    self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    // 立即接管所有页面
    self.clients.claim();
});

// 请求拦截 - 缓存优先策略
self.addEventListener('fetch', (event) => {
    // 跳过 chrome-extension 和非 GET 请求
    if (event.request.method !== 'GET') return;
    if (event.request.url.startsWith('chrome-extension://')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // 命中缓存直接返回
            if (cachedResponse) {
                return cachedResponse;
            }

            // 否则请求网络，并缓存结果
            return fetch(event.request).then((response) => {
                // 只缓存成功的响应
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            });
        })
    );
});