import {TMDB_TOKEN,TMDB_PROXY_URL} from "../config.js";
import {language} from "./i18n.js";
import {cacheGet,cacheSet,cacheDeduplicate} from "./cache.js";
export class ApiError extends Error{constructor(code,message,status=0){super(message);this.name="ApiError";this.code=code;this.status=status;}}
const limit=6;let active=0;const queue=[];
async function slot(signal){
 if(signal?.aborted)throw new DOMException("Aborted","AbortError");
 if(active<limit){active++;return;}
 await new Promise((resolve,reject)=>{const ticket={resolve,reject,signal};queue.push(ticket);if(signal)signal.addEventListener("abort",()=>{const i=queue.indexOf(ticket);if(i>=0){queue.splice(i,1);reject(new DOMException("Aborted","AbortError"));}},{once:true});});
}
function release(){active--;while(queue.length){const next=queue.shift();if(next.signal?.aborted)continue;active++;next.resolve();break;}}
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"));},{once:true});});
const isSafePath=p=>/^\/(?:discover|search|movie|tv|trending|genre|configuration|watch|keyword|person|collection|network|company)(?:\/[\w-]+)*$/.test(p);
export async function tmdb(path,params={},options={}){
 if(!isSafePath(path))throw new ApiError("InvalidPath","Unsupported TMDB path");
 if(!TMDB_PROXY_URL&&(!TMDB_TOKEN||TMDB_TOKEN==="PASTE_TOKEN_HERE"))throw new ApiError("NotConfigured","TMDB is not configured");
 const lang=options.language|| (language()==="ar"?"ar-SA":"en-US");
 const query=new URLSearchParams();
 for(const [k,v]of Object.entries({...params,language:lang})){if(v!==null&&v!==undefined&&v!=="")query.set(k,String(v));}
 query.set("include_adult","false");
 const base=TMDB_PROXY_URL?TMDB_PROXY_URL.replace(/\/$/,""):"https://api.themoviedb.org/3";
 const key=path+"?"+query.toString(),ttl=options.ttl??900000;
 const cached=await cacheGet(key);if(cached!==null)return cached;
 return cacheDeduplicate(key,async()=>{
  await slot(options.signal);
  try{
   const url=base+path+"?"+query.toString(),controller=new AbortController();
   const abort=()=>controller.abort(options.signal?.reason);
   options.signal?.addEventListener("abort",abort,{once:true});
   try{
    for(let attempt=0;attempt<4;attempt++){
     if(options.signal?.aborted)throw new DOMException("Aborted","AbortError");
     const timeout=setTimeout(()=>controller.abort(),10000);
     try{
      const response=await fetch(url,{headers:TMDB_PROXY_URL?{"Accept":"application/json"}:{"Accept":"application/json","Authorization":"Bearer "+TMDB_TOKEN},signal:controller.signal,mode:"cors"});
      if(response.status===404)throw new ApiError("NotFound","Title not found",404);
      if(response.status===429||response.status>=500){
       if(attempt===3)throw new ApiError(response.status===429?"RateLimited":"Server","TMDB temporarily unavailable",response.status);
       const wait=response.headers.get("Retry-After");
       const ms=wait?( /^\d+$/.test(wait)?Number(wait)*1000:Math.max(0,Date.parse(wait)-Date.now())):400*2**attempt;
       clearTimeout(timeout);await sleep(Math.min(10000,ms)+Math.random()*100,options.signal);continue;
      }
      if(!response.ok)throw new ApiError("Server","TMDB request failed",response.status);
      const data=await response.json();
      await cacheSet(key,data,{ttl,tier:ttl>3600000?"disk":"session"});
      return data;
     }catch(error){
      if(error instanceof ApiError)throw error;
      if(options.signal?.aborted)throw error;
      if(controller.signal.aborted)throw new ApiError("Timeout","Request timed out");
      if(!navigator.onLine)throw new ApiError("Offline","You are offline");
      if(attempt===3)throw new ApiError("Network","Network unavailable");
      await sleep(400*2**attempt+Math.random()*150,options.signal);
     }finally{clearTimeout(timeout);}
    }
   }finally{options.signal?.removeEventListener("abort",abort);}
  }finally{release();}
 });
}
export function imageUrl(path,size="w342"){return typeof path==="string"&&/^\/[a-zA-Z0-9_.-]+$/.test(path)?"https://image.tmdb.org/t/p/"+size+path:null;}
export function normalize(raw,type){
 const kind=type||raw.media_type||(raw.title?"movie":"tv");
 if(!["movie","tv"].includes(kind))return null;
 const title=raw.title||raw.name||raw.original_title||raw.original_name||"";
 const originalTitle=raw.original_title||raw.original_name||title;
 const year=String(raw.release_date||raw.first_air_date||"").slice(0,4);
 const genres=(raw.genres||raw.genre_ids||[]).map(g=>typeof g==="number"?g:g.id).filter(Number.isFinite);
 const language=raw.original_language||"",countries=raw.origin_country||raw.production_countries?.map(c=>c.iso_3166_1)||[];
 const keywords=(raw.keywords?.keywords||raw.keywords?.results||[]).map(x=>({id:x.id,name:x.name}));
 const isAnime=genres.includes(16)&&(language==="ja"||((language==="zh"||language==="ko")&&raw.isAnime!==false)||keywords.some(k=>/anime|donghua/i.test(k.name)));
 return {id:raw.id,type:kind,title,originalTitle,year,overview:raw.overview||"",poster:imageUrl(raw.poster_path),backdrop:imageUrl(raw.backdrop_path,"w1280"),poster_path:raw.poster_path||null,genre_ids:genres,genres,language,countries,rating:Number(raw.vote_average)||0,voteCount:Number(raw.vote_count)||0,popularity:Number(raw.popularity)||0,runtime:raw.runtime??null,episodeRuntime:raw.episode_run_time?.[0]??null,seasons:raw.number_of_seasons??null,status:raw.status||null,isAnime,keywords,cast:raw.credits?.cast?.slice(0,20)||[],directors:raw.credits?.crew?.filter(x=>x.job==="Director")||[],providers:raw["watch/providers"]?.results||{}};
}
const shared=new Set(["with_genres","without_genres","with_keywords","with_original_language","with_origin_country","vote_average.gte","vote_count.gte","with_watch_providers","watch_region","with_watch_monetization_types","sort_by","page","with_companies","with_runtime.gte","with_runtime.lte"]);
const movie=new Set(["primary_release_date.gte","primary_release_date.lte","certification","certification_country","with_people","region"]);
const tv=new Set(["first_air_date.gte","first_air_date.lte","with_networks","with_status","with_type","air_date.gte","air_date.lte"]);
export function buildQuery(filters={}){
 const type=filters.type==="tv"?"tv":"movie",allow=new Set([...shared,...(type==="movie"?movie:tv)]);
 const query={include_adult:false};
 for(const [key,value]of Object.entries(filters)){if(allow.has(key)&&value!==null&&value!==undefined&&value!=="")query[key]=value;}
 if(filters.anime===true){query.with_genres=query.with_genres?String(query.with_genres)+",16":"16";delete query.without_genres;}
 if(filters.anime===false)query.without_genres=query.without_genres?String(query.without_genres)+",16":"16";
 const regions={E:["en","US"],K:["ko","KR"],C:["zh","CN"],J:["ja","JP"]};
 if(regions[filters.region]){query.with_original_language??=regions[filters.region][0];query.with_origin_country??=regions[filters.region][1];}
 if(filters.year){const prefix=type==="movie"?"primary_release_date":"first_air_date";query[prefix+".gte"]??=filters.year+"-01-01";query[prefix+".lte"]??=filters.year+"-12-31";}
 if(filters.season&&filters.year&&!filters.yearEnd){const quarter={winter:[1,3],spring:[4,6],summer:[7,9],fall:[10,12]}[filters.season];if(quarter){const prefix=type==="movie"?"primary_release_date":"first_air_date";query[prefix+".gte"]=filters.year+"-"+String(quarter[0]).padStart(2,"0")+"-01";query[prefix+".lte"]=filters.year+"-"+String(quarter[1]).padStart(2,"0")+"-"+new Date(Number(filters.year),quarter[1],0).getDate();}}
 if(!query.watch_region)delete query.with_watch_providers;
 return query;
}
export async function details(type,id,{signal}={}){
 if(!["movie","tv"].includes(type)||!Number.isSafeInteger(Number(id)))throw new ApiError("InvalidPath","Invalid title");
 const path="/"+type+"/"+id,append="credits,keywords,videos,watch/providers,recommendations,similar";
 let raw=await tmdb(path,{append_to_response:append},{signal,ttl:86400000}),item=normalize(raw,type);
 if(language()==="ar"&&(!item.title||!item.overview)){const fallback=await tmdb(path,{append_to_response:append},{signal,ttl:86400000,language:"en-US"});item={...item,title:item.title||fallback.title||fallback.name,overview:item.overview||fallback.overview};}
 return item;
}
export async function discover(filters,{signal,page=1}={}){const type=filters.type==="tv"?"tv":"movie",query=buildQuery({...filters,page});const data=await tmdb("/discover/"+type,query,{signal});return {...data,results:(data.results||[]).map(x=>normalize(x,type)).filter(Boolean)};}
export function qualified(items,{minVotes=50,allowDocumentary=false,allowNonScripted=false}={}){
 const seen=new Set();return items.filter(item=>{
  if(!item||!item.poster||!item.overview||item.voteCount<minVotes||item.adult)return false;
  if(!allowDocumentary&&item.genres.includes(99))return false;
  if(!allowNonScripted&&item.type==="tv"&&item.genres.some(x=>[10767,10763,10764,10766].includes(x)))return false;
  const key=item.type+"_"+item.id;if(seen.has(key))return false;seen.add(key);return true;
 });
}
export async function searchEntity(category,name,{signal}={}){
 if(!["network","company"].includes(category))throw new ApiError("InvalidPath","Invalid category");
 return (await tmdb("/search/"+category,{query:name},{signal,ttl:604800000})).results||[];
}
export async function bootstrapMetadata(){return Promise.allSettled(["/configuration","/genre/movie/list","/genre/tv/list","/watch/providers/movie","/watch/providers/tv"].map(path=>tmdb(path,{}, {ttl:604800000})));}
