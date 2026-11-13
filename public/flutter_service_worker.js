// Retire the previous Flutter offline cache when moving to the web application.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of ['flutter-app-cache','flutter-temp-cache','flutter-app-manifest'])await caches.delete(name);
 await self.clients.claim();
 await self.registration.unregister();
 const windows=await self.clients.matchAll({type:'window'});
 for(const client of windows)await client.navigate(client.url);
})()));
