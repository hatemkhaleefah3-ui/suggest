import {firebaseModules,onAuthChange,configured} from "./auth.js";
import {getState,dispatch,subscribe,SCHEMA_VERSION} from "./store.js";
let firestore=null,api=null,user=null,unsubUser=()=>{},unsubLibrary=()=>{},unsubAuth=()=>{},unsubStore=()=>{},timer=null,started=false,applying=false;
const time=x=>Date.parse(x||"")||0;
export function mergeLibrary(local={},remote={}){
 const merged={...remote};
 for(const [key,item]of Object.entries(local)){
  const prior=merged[key];
  if(!prior){merged[key]=item;continue;}
  const latest=time(item.updatedAt)>=time(prior.updatedAt)?item:prior;
  const other=latest===item?prior:item;
  merged[key]={...other,...latest};
  if(item.status==="completed"||prior.status==="completed"){
   merged[key].status="completed";
   merged[key].completedAt=item.completedAt||prior.completedAt||latest.updatedAt;
  }
  const watched=new Set([...(item.progress?.watchedEpisodes||[]),...(prior.progress?.watchedEpisodes||[])]);
  if(watched.size)merged[key].progress={...other.progress,...latest.progress,watchedEpisodes:[...watched]};
 }
 return merged;
}
export function mergeState(local,remote){
 const source=remote||{},l=local||getState();
 return {...l,schemaVersion:SCHEMA_VERSION,
  settings:time(source.settings?.updatedAt)>time(l.settings?.updatedAt)?source.settings:l.settings,
  onboarding:time(source.onboarding?.updatedAt)>time(l.onboarding?.updatedAt)?source.onboarding:l.onboarding,
  library:mergeLibrary(l.library,source.library||{}),
  presets:[...(source.presets||[]),...(l.presets||[])].filter((x,i,a)=>a.findIndex(y=>JSON.stringify(y)===JSON.stringify(x))===i),
  suggestSession:time(source.suggestSession?.updatedAt)>time(l.suggestSession?.updatedAt)?source.suggestSession:l.suggestSession,
  recentSearches:[...new Set([...(l.recentSearches||[]),...(source.recentSearches||[])])].slice(0,20)};
}
const status=value=>dispatch({type:"SET_SYNC",value:{status:value}});
function stopListeners(){unsubUser();unsubLibrary();unsubUser=()=>{};unsubLibrary=()=>{};}
async function flush(){
 if(!user||!api||applying)return;
 status(navigator.onLine?"syncing":"offline");
 const snap=getState(),uid=user.uid,doc=api.doc(firestore,"users",uid);
 try{
  // Firestore's offline queue persists writes when IndexedDB persistence is supported.
  await api.setDoc(doc,{schemaVersion:SCHEMA_VERSION,profile:{displayName:user.displayName||"",email:user.email||""},settings:snap.settings,onboarding:snap.onboarding,presets:snap.presets,recentSearches:snap.recentSearches,suggestSession:snap.suggestSession,updatedAt:new Date().toISOString()},{merge:true});
  const items=Object.entries(snap.library);
  for(let i=0;i<items.length;i+=300){
   const batch=api.writeBatch(firestore);
   for(const [key,value]of items.slice(i,i+300))batch.set(api.doc(firestore,"users",uid,"library",key),{...value,schemaVersion:SCHEMA_VERSION},{merge:true});
   await batch.commit();
  }
  status(navigator.onLine?"synced":"offline");
 }catch(error){console.warn("Sync failed",error);status(navigator.onLine?"error":"offline");}
}
function schedule(){if(!user)return;clearTimeout(timer);timer=setTimeout(()=>{flush().catch(()=>status("error"));},1250);}
async function attach(nextUser){
 stopListeners();user=nextUser;clearTimeout(timer);
 if(!user){status("offline");return;}
 status("syncing");
 const profileRef=api.doc(firestore,"users",user.uid),libraryRef=api.collection(firestore,"users",user.uid,"library");
 let profile={},library={};
 try{
  const [a,b]=await Promise.all([api.getDoc(profileRef),api.getDocs(libraryRef)]);
  if(a.exists())profile=a.data();
  b.forEach(x=>{library[x.id]=x.data();});
  if(!user||nextUser.uid!==user.uid)return;
  applying=true;dispatch({type:"HYDRATE",value:mergeState(getState(),{...profile,library})});applying=false;
  schedule();
 }catch(error){applying=false;status("error");console.warn("Initial merge failed",error);return;}
 unsubUser=api.onSnapshot(profileRef,snap=>{
  if(!snap.exists()||applying||!user)return;
  applying=true;dispatch({type:"HYDRATE",value:mergeState(getState(),snap.data())});applying=false;
 },()=>status("error"));
 unsubLibrary=api.onSnapshot(libraryRef,snap=>{
  if(applying||!user)return;
  const remote={};snap.forEach(x=>{remote[x.id]=x.data();});
  applying=true;dispatch({type:"HYDRATE",value:{...getState(),library:mergeLibrary(getState().library,remote)}});applying=false;
 },()=>status("error"));
}
export async function startSync(){
 if(started)return;started=true;
 if(!configured()){status("offline");return;}
 try{
  const modules=await firebaseModules();api=modules.firestore;
  try{firestore=api.initializeFirestore(modules.instance,{localCache:api.persistentLocalCache({tabManager:api.persistentMultipleTabManager()})});}
  catch{firestore=api.getFirestore(modules.instance);}
  unsubStore=subscribe((_state,action)=>{if(!applying&&!["HYDRATE","SET_SYNC","DIAGNOSTIC"].includes(action.type))schedule();});
  unsubAuth=await onAuthChange(next=>{attach(next).catch(()=>status("error"));});
  addEventListener("online",schedule);
  addEventListener("offline",()=>status("offline"));
 }catch(error){started=false;status("error");console.warn("Sync initialization failed",error);}
}
export async function retrySync(){await flush();}
export async function deleteCloudData(){
 if(!user||!api)throw Error("Authentication required");
 const uid=user.uid,items=await api.getDocs(api.collection(firestore,"users",uid,"library"));
 const refs=items.docs;
 for(let i=0;i<refs.length;i+=300){const batch=api.writeBatch(firestore);for(const d of refs.slice(i,i+300))batch.delete(d.ref);await batch.commit();}
 await api.deleteDoc(api.doc(firestore,"users",uid));
}
export function stopSync(){
 clearTimeout(timer);stopListeners();unsubAuth();unsubStore();user=null;started=false;
 removeEventListener("online",schedule);status("offline");
}
