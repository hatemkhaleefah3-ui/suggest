export const REGIONS=Object.freeze({
 E:{languages:["en"],countries:["US","GB","CA","AU"],movieStudios:["A24","Warner Bros.","Universal Pictures","Sony Pictures"],seriesNetworks:["Netflix","HBO","Disney+","Amazon Prime Video","Apple TV+","Hulu","BBC"],subtypes:[]},
 K:{languages:["ko"],countries:["KR"],movieStudios:["CJ ENM","Lotte Entertainment"],seriesNetworks:["tvN","JTBC","KBS","MBC","SBS"],subtypes:["romance","thriller","sageuk","fantasy","webtoon"]},
 C:{languages:["zh","cn"],countries:["CN","TW","HK"],movieStudios:["Huayi Brothers","Bona Film Group"],seriesNetworks:["iQIYI","Tencent Video","Youku","Mango TV"],subtypes:["wuxia","xianxia","historical","modern-romance"]},
 J:{languages:["ja"],countries:["JP"],movieStudios:["Toho","Shochiku"],seriesNetworks:["NHK","TBS","Fuji TV","NTV"],animeStudios:["Studio Ghibli","MAPPA","ufotable","Bones","Madhouse","Kyoto Animation","Wit Studio"],subtypes:["asadora","jidaigeki","renzoku"]}
});
const definitions=[
 {id:"type",label:"type",type:"single",options:["movie","tv","both"],defaults:()=> "movie"},
 {id:"format",label:"format",type:"single",options:["anime","real","any"],defaults:()=> "any",onChange:{reset:["studio","network","audience","animeStudio","seasonalPeriod"]}},
 {id:"region",label:"region",type:"single",options:["E","K","C","J","any"],visibleWhen:s=>s.format!=="any",defaults:s=>s.format==="anime"?"J":"any",onChange:{reset:["studio","network","subtype","animeStudio"],set:{}}},
 {id:"genre",label:"genre",type:"multi",options:["family","kids","animation","action","romance","drama","mystery","scifi","comedy","documentary"]},
 {id:"vibe",label:"vibe",type:"multi",options:["mature","philosophy","romance","action"]},
 {id:"audience",label:"audience",type:"multi",options:["shonen","seinen","shojo","josei","kids"],visibleWhen:s=>s.format==="anime"},
 {id:"animeStudio",label:"animeStudio",type:"multi",options:["Studio Ghibli","MAPPA","ufotable","Bones","Madhouse","Kyoto Animation","Wit Studio"],visibleWhen:s=>s.format==="anime"&&s.region==="J"},
 {id:"seasonalPeriod",label:"seasonalPeriod",type:"single",options:["winter","spring","summer","fall"],visibleWhen:s=>s.format==="anime"&&!s.yearEnd&&!!s.year,disabledWhen:s=>!!s.yearEnd},
 {id:"studio",label:"studio",type:"multi",options:[],visibleWhen:s=>s.format!=="anime"&&s.type==="movie"},
 {id:"network",label:"network",type:"multi",options:[],visibleWhen:s=>s.format!=="anime"&&s.type!=="movie"},
 {id:"subtype",label:"subtype",type:"multi",options:[],visibleWhen:s=>s.format==="real"&&s.region!=="any"},
 {id:"runtime",label:"runtime",type:"single",options:["short","medium","long"],visibleWhen:s=>s.type==="movie"},
 {id:"collection",label:"collection",type:"multi",options:[],visibleWhen:s=>s.type==="movie"},
 {id:"certification",label:"certification",type:"multi",options:["G","PG","PG-13","R","NC-17"],visibleWhen:s=>s.type==="movie"&&s.vibe?.includes("mature")},
 {id:"status",label:"status",type:"single",options:["ongoing","completed"],visibleWhen:s=>s.type!=="movie"},
 {id:"episodeCount",label:"episodeCount",type:"single",options:["limited","medium","long"],visibleWhen:s=>s.type!=="movie"},
 {id:"episodeLength",label:"episodeLength",type:"single",options:["short","medium","long"],visibleWhen:s=>s.type!=="movie"},
 {id:"year",label:"year",type:"single",options:[]},
 {id:"yearEnd",label:"yearEnd",type:"single",options:[]},
 {id:"completedOnly",label:"completedOnly",type:"single",options:[true,false]},
 {id:"maturityComfort",label:"maturityComfort",type:"single",options:["all","teen","mature"]}
];
export const fields=Object.freeze(definitions);
const list=x=>Array.isArray(x)?x:x==null?[]:[x];
function clean(s){const result={...s};for(const [k,v]of Object.entries(result))if(Array.isArray(v))result[k]=[...new Set(v)];return result;}
export function resolve(input={}){
 const state=clean(input),visibleFields=[],visibleOptions={},disabledOptions={},reasons={},removed=[];
 for(const field of fields){
  const visible=field.visibleWhen?!!field.visibleWhen(state):true;
  if(!visible){if(state[field.id]!==undefined&&state[field.id]!==null&&(Array.isArray(state[field.id])?state[field.id].length>0:state[field.id]!=="")){removed.push(field.id);delete state[field.id];}continue;}
  visibleFields.push(field.id);
  let options=[...field.options];
  if(field.id==="studio")options=REGIONS[state.region]?.movieStudios||REGIONS.E.movieStudios;
  if(field.id==="network")options=REGIONS[state.region]?.seriesNetworks||REGIONS.E.seriesNetworks;
  if(field.id==="subtype")options=REGIONS[state.region]?.subtypes||[];
  if(field.id==="genre"&&list(state.vibe).includes("mature"))options=options.filter(x=>!["family","kids"].includes(x));
  if(field.id==="audience"&&list(state.vibe).includes("mature"))options=options.filter(x=>x!=="kids");
  if(field.id==="vibe"&&state.maturityComfort==="all")options=options.filter(x=>x!=="mature");
  visibleOptions[field.id]=options;
  disabledOptions[field.id]={};
  if(field.id==="vibe"&&!state.maturityConfirmed)disabledOptions.vibe.mature="Confirm age 18+ in Settings";
  if(field.id==="seasonalPeriod"&&state.yearEnd){for(const option of options)disabledOptions.seasonalPeriod[option]="Select a single year";}
  if(field.id==="status"&&state.completedOnly)disabledOptions.status.ongoing="Completed only is enabled";
  const value=state[field.id];
  if(Array.isArray(value)){const kept=value.filter(x=>options.includes(x)&&!disabledOptions[field.id][x]);if(kept.length!==value.length){removed.push(field.id);state[field.id]=kept;}}
  else if(options.length&&value!==undefined&&!options.includes(value)){removed.push(field.id);delete state[field.id];}
 }
 if(list(state.genre).includes("family")&&list(state.vibe).includes("mature")){
  state.vibe=list(state.vibe).filter(x=>x!=="mature");removed.push("vibe");
 }
 if(state.format==="real"&&list(state.genre).includes("animation"))reasons.genre="Switch to Anime?";
 if(state.format==="anime")reasons.format="Anime uses animation genre 16";
 if(state.format==="real")reasons.format="Live action excludes animation genre 16";
 return {state,visibleFields,visibleOptions,disabledOptions,reasons,adjusted:[...new Set(removed)]};
}
export function updateRules(state,field,value){
 const definition=fields.find(f=>f.id===field);if(!definition)throw Error("Unknown field "+field);
 const next={...state,[field]:value};
 if(field==="format"){for(const k of ["studio","network","audience","animeStudio","seasonalPeriod","subtype"])delete next[k];if(value==="anime")next.region="J";}
 if(field==="region"){for(const k of ["studio","network","subtype","animeStudio"])delete next[k];}
 return resolve(next);
}
