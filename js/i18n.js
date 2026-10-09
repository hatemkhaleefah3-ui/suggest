import {getState,dispatch} from "./store.js";
const dict={en:null,ar:null};
let lang="en";
export function language(){return lang;}
export function t(key,vars={}){const raw=dict[lang]?.[key]??dict.en?.[key]??key;return String(raw).replace(/\{(\w+)\}/g,(_,name)=>String(vars[name]??""));}
export async function setLanguage(value,{save=true}={}){
 const next=value==="ar"?"ar":"en";
 if(!dict[next]){try{const response=await fetch(new URL("../i18n/"+next+".json",import.meta.url));if(!response.ok)throw Error("i18n");dict[next]=await response.json();}catch{dict[next]={};}}
 lang=next;document.documentElement.lang=lang;document.documentElement.dir=lang==="ar"?"rtl":"ltr";
 document.dispatchEvent(new CustomEvent("languagechange",{detail:{language:lang}}));
 if(save&&getState().settings.language!==lang)dispatch({type:"SET_SETTINGS",value:{language:lang}});
}
export const ready=setLanguage(getState().settings.language,{save:false});
