const CACHE='pomfit-v30';
const CORE=[
  './?v=30',
  './styles.css?v=30',
  './app.js?v=30',
  './data.js?v=30',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>Promise.all(
      CORE.map(url=>fetch(url,{cache:'no-store'}).then(resp=>{
        if(resp.ok) return cache.put(url,resp.clone());
      }).catch(()=>null))
    ))
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('pomfit-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const req=event.request;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;

  const isDynamic=req.mode==='navigate' || /\/(index\.html|app\.js|data\.js|styles\.css)$/.test(url.pathname);
  if(isDynamic){
    event.respondWith((async()=>{
      try{
        const resp=await fetch(req,{cache:'no-store'});
        if(resp && resp.ok){
          const cache=await caches.open(CACHE);
          cache.put(req,resp.clone()).catch(()=>{});
        }
        return resp;
      }catch{
        return (await caches.match(req))
          || (await caches.match('./?v=30'))
          || new Response('PomFit is temporarily offline. Reopen when connected.',{
            status:503,
            headers:{'Content-Type':'text/plain'}
          });
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached) return cached;
    try{
      const resp=await fetch(req);
      if(resp && resp.ok){
        const cache=await caches.open(CACHE);
        cache.put(req,resp.clone()).catch(()=>{});
      }
      return resp;
    }catch{
      return new Response('',{status:503});
    }
  })());
});