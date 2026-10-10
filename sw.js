/* PICKGO PWA offline shell. Never cache Supabase/API traffic or third-party maps. */
const CACHE = 'pickgo-pwa-v2.1.4';
const CORE = ['/', '/index.html', '/court.html', '/site-config.js', '/app.js', '/features.css', '/account.js', '/support.js', '/inbox.js', '/matches.js', '/matches.css', '/venues-db.js', '/court-db.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/maskable-icon.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pickgo-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET' || !req.url.startsWith(self.location.origin+'/'))return;
 const url=new URL(req.url);
 if(url.pathname.startsWith('/auth/')||url.pathname.startsWith('/api/'))return;
 if(url.pathname==='/admin.html'){return;}
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(res=>res).catch(async()=>{
   const cache=await caches.open(CACHE);
   return (await cache.match(url.pathname==='/court.html'?'/court.html':'/index.html')) || Response.error();
  }));
  return;
 }
 if(CORE.includes(url.pathname)){
  event.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res})));
 }
});
