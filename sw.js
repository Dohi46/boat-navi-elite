const CACHE='boat-navi-v14-course-trial-1';
const SHELL=['./index.html','./app.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('boat-navi-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin)return;
 if(u.pathname.endsWith('/app.js')||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/boat-navi-elite/')){
  e.respondWith(fetch(new Request(r,{cache:'no-store'})).catch(()=>caches.match(r).then(x=>x||caches.match('./index.html'))));
  return;
 }
 e.respondWith(fetch(r).catch(()=>caches.match(r).then(x=>x||Response.error())));
});
