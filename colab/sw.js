// Finn & Sylvara CoLab Unified Studio v0.13.3 PWA.
// NEVER discard local IndexedDB project/recovery data. NEVER reload an editing session
// until the artist taps Save & update in Unified Studio.
const CACHE='bt3d-colab-v0133-local-pose-reach-1';
const PREFIX='bt3d-colab-';
const SHELL=[
 './','./index.html','./director.html','./manifest.webmanifest',
 './icon-192.png','./icon-512.png',
 './director-tools.js','./assembly-tools.js','./geometry-workshop.js',
 './sculpt-tools.js','./skeleton-points.js',
 './vector-paint.js','./vector-outline-preview.js',
 './ai-paint-bridge.js','./ai-paint-uv-guard.js',
 './connected-humanoid-mannequin.js'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 // Intentionally do NOT skipWaiting here; update is by explicit user action.
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith(PREFIX)&&n!==CACHE).map(n=>caches.delete(n)));
  await self.clients.claim(); // Triggers controllerchange only after explicit SKIP_WAITING.
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin===self.location.origin){
  event.respondWith(fetch(event.request).then(response=>{
   if(response.ok){
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
   }
   return response;
  }).catch(async()=>{
   const match=await caches.match(event.request);
   if(match)return match;
   if(event.request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
   return Response.error(); // No HTML fallbacks for uncached JavaScript modules.
  }));
  return;
 }
 // Pin just the existing Three.js dependency. Never cache unapproved remote data.
 if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('/npm/three@0.164.1/')){
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
   return response;
  })));
 }
});
