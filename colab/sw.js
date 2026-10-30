// Better Together 3D CoLab v0.12 integration beta
// Updates are installed in the background but NEVER force a reload of an active editing session.
const CACHE='bt3d-colab-v012-integration-1';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('bt3d-colab-')&&key!==CACHE).map(key=>caches.delete(key)))));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting(); // Called ONLY after user taps Save & update.
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin===self.location.origin){
  // Network-first shell for a single, canonical installed app address; cache is offline fallback.
  event.respondWith(fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
   return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))));
  return;
 }
 // Library resources are pinned; cache only the specific Three.js version after online load.
 if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('/npm/three@0.164.1/')){
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
   return response;
  })));
 }
});