const DB="suggest-cache", STORE="entries", VERSION=1;
const memory=new Map(),pending=new Map();
let dbPromise;
function database(){
 if(!("indexedDB" in globalThis))return Promise.resolve(null);
 if(!dbPromise)dbPromise=new Promise(resolve=>{
  const req=indexedDB.open(DB,VERSION);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:"key"});};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);
 });
 return dbPromise;
}
async function disk(mode,operation){
 const db=await database();if(!db)return undefined;
 return new Promise(resolve=>{
  try{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),req=operation(store);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(undefined);
  }catch{resolve(undefined);}
 });
}
function valid(e){return e&&e.expiry>Date.now();}
export async function cacheGet(key){
 const mem=memory.get(key);if(valid(mem))return structuredClone(mem.value);
 if(mem)memory.delete(key);
 try{const raw=sessionStorage.getItem("suggest:cache:"+key);if(raw){const e=JSON.parse(raw);if(valid(e)){memory.set(key,e);return structuredClone(e.value);}sessionStorage.removeItem("suggest:cache:"+key);}}catch{}
 const diskEntry=await disk("readonly",s=>s.get(key));
 if(valid(diskEntry)){memory.set(key,diskEntry);return structuredClone(diskEntry.value);}
 return null;
}
async function removeOldest(count=75){
 const db=await database();if(!db)return;
 const entries=await disk("readonly",s=>s.getAll())||[];
 entries.sort((a,b)=>(a.saved||0)-(b.saved||0));
 await Promise.all(entries.slice(0,count).map(x=>disk("readwrite",s=>s.delete(x.key))));
}
export async function cacheSet(key,value,{ttl=900000,tier="session"}={}){
 const entry={key,value:structuredClone(value),saved:Date.now(),expiry:Date.now()+ttl};
 memory.set(key,entry);if(memory.size>250)memory.delete(memory.keys().next().value);
 if(tier==="memory")return;
 if(tier==="session"){try{sessionStorage.setItem("suggest:cache:"+key,JSON.stringify(entry));return;}catch{/* fallback to IDB */}}
 try{await disk("readwrite",s=>s.put(entry));}
 catch{await removeOldest();await disk("readwrite",s=>s.put(entry));}
}
export async function cacheDelete(key){memory.delete(key);try{sessionStorage.removeItem("suggest:cache:"+key);}catch{}await disk("readwrite",s=>s.delete(key));}
export function cacheDeduplicate(key,loader){
 if(pending.has(key))return pending.get(key);
 const job=Promise.resolve().then(loader).finally(()=>pending.delete(key));
 pending.set(key,job);return job;
}
export async function cacheClear(){memory.clear();try{for(const k of Object.keys(sessionStorage))if(k.startsWith("suggest:cache:"))sessionStorage.removeItem(k);}catch{}await disk("readwrite",s=>s.clear());}
