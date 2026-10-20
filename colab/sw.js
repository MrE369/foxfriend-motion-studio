// Better Together 3D CoLab v0.10 PWA staging.
// Do NOT publish until approved; service worker does not force refresh.
const CACHE='bt3d-colab-v010-staging-1';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bt3d-colab-')&&k!==CACHE).map(k=>caches.delete(k)))))});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 // App shell: network first when online, cached fallback when offline.
 if(url.origin===self.location.origin){event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(res=>res||caches.match('./index.html'))));return}
 // Pinned Three.js CDN resources: cache after first successful online load.
 if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('/npm/three@0.164.1/')){
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return response})));
 }
});