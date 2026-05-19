// sw.js - Service Worker لتشغيل التطبيق دون إنترنت

const CACHE_NAME = 'grocery-debt-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/bootstrap.min.css',
    '/css/style.css',
    '/css/all.min.css',
    '/js/bootstrap.bundle.min.js',
    '/js/app.js',
    '/js/db.js',
    '/js/sync.js',
    '/js/firebase-config.js',
    '/offline.html'
];

// تثبيت Service Worker وتخزين الملفات
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// اعتراض الطلبات وتقديم النسخة المخزنة
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(event.request, responseToCache));
                        return response;
                    })
                    .catch(() => {
                        if (event.request.destination === 'ducument') {
                            return caches.match('/offline.html');
                        }
                        return null;
                    });
            })
    );
});
//تحديث تلقائي
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
// تحديث Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});