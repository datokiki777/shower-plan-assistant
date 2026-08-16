// Compatibility entry point for clients still registered to the former V2
// service worker URL. Loading the V1 worker here lets the browser's normal
// update check replace V2 without clearing IndexedDB or other user data.
importScripts("./service-worker.js");
