import {getDevice,subscribeDevice} from "./device.js";
import {t,ready} from "./i18n.js";
import {h,toast,reportError,openOverlay} from "./ui.js";
import {getState,subscribe} from "./store.js";
const targets={dashboard:"./dashboard.js",search:"./search.js",suggest:"./suggest.js",profile:"./profile.js",selftest:"./selftest.js"};
const nav=[["dashboard","navDashboard","⌂"],["search","navSearch","⌕"],["suggest","navSuggest","✦"],["profile","navProfile","◯"]];
const app=document.getElementById("app"),live=document.getElementById("live-region"),positions=new Map();
let current="",cleanup=()=>{},serial=0,navNode=null;
function navigation(){
 const phone=getDevice().kind==="phone",bar=h("nav",{"aria-label":t("mainNavigation"),class:phone?"fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/10 bg-[#14141A]/95 px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-xl":"fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-center gap-2 border-b border-white/10 bg-[#14141A]/95 px-4 backdrop-blur-xl"});
 if(!phone)bar.append(h("a",{href:"#/dashboard",class:"absolute start-5 text-xl font-bold text-[#F2B84B]",text:"SUGGEST"}));
 for(const [key,label,glyph]of nav){const active=key===current;bar.append(h("a",{href:"#/"+key,class:"flex min-h-11 min-w-14 items-center justify-center gap-2 rounded-full px-3 "+(phone?"flex-col text-xs ":"text-sm ")+(active?"bg-[#F2B84B]/15 text-[#F2B84B]":"text-[#9A9AA6] hover:text-white"),...(active?{"aria-current":"page"}:{})},h("span",{"aria-hidden":"true",class:"text-2xl",text:glyph}),h("span",{text:t(label)})));}
 if(!phone)bar.append(h("span",{class:"absolute end-5 text-xs text-[#9A9AA6]",text:t(getState().sync.status==="synced"?"synced":getState().sync.status==="syncing"?"syncing":getState().sync.status==="error"?"syncError":"offline")}));
 return bar;
}
function parse(){const parts=(location.hash||"#/dashboard").slice(2).split("?")[0].split("/").filter(Boolean);return {name:parts[0]||"dashboard",args:parts.slice(1)};}
async function navigate(){
 const request=++serial,route=parse();
 if(current)positions.set(current,scrollY);
 try{cleanup();}catch(e){console.warn("Route cleanup",e);}cleanup=()=>{};current=route.name;
 navNode=navigation();
 const host=h("main",{id:"main-content",class:"mx-auto w-full max-w-[1440px] px-4 md:px-6 xl:px-10",tabindex:"-1"},h("p",{class:"py-10 text-[#9A9AA6]",text:t("loading")}));
 app.replaceChildren(navNode,h("div",{class:"min-h-dvh pb-24 pt-5 md:pb-8 md:pt-24"},host));
 live.textContent=t(nav.find(n=>n[0]===route.name)?.[1]||"notFound");
 try{
  if(route.name==="privacy")host.replaceChildren(h("h1",{class:"text-2xl font-semibold",text:t("privacy")}),h("p",{class:"mt-4 text-[#9A9AA6]",text:t("privacySummary")}));
  else if(route.name==="title")host.replaceChildren(h("h1",{class:"text-2xl font-semibold",text:t("titleDetails")}),h("p",{class:"mt-4",text:t("unavailable")}));
  else if(targets[route.name]){
   let page;
   try{page=await import(targets[route.name]);}catch(err){
    if(err instanceof TypeError){host.replaceChildren(h("h1",{class:"text-2xl font-semibold",text:t(nav.find(n=>n[0]===route.name)?.[1]||"unavailable")}),h("p",{class:"mt-4 text-[#9A9AA6]",text:t("unavailable")}));return;}
    throw err;
   }
   if(request!==serial)return;
   if(typeof page.render!=="function")throw Error("Route must export render()");
   const result=await page.render({container:host,params:route.args,device:getDevice(),toast,openOverlay});
   if(typeof result==="function")cleanup=result;
  }else host.replaceChildren(h("h1",{class:"text-2xl font-semibold",text:t("notFound")}),h("a",{href:"#/dashboard",class:"mt-4 inline-block text-[#F2B84B]",text:t("navDashboard")}));
 }catch(error){reportError(error,"router");host.replaceChildren(h("p",{text:t("errorGeneric")}));}
 finally{if(request===serial)requestAnimationFrame(()=>scrollTo({top:positions.get(current)||0,behavior:"instant"}));}
}
addEventListener("error",event=>reportError(event.error||event.message,"window"));
addEventListener("unhandledrejection",event=>{event.preventDefault();reportError(event.reason,"promise");});
subscribeDevice((_device,old)=>{if(old)navigate();});
subscribe((_state,action)=>{if(action.type==="SET_SYNC"&&navNode){const next=navigation();navNode.replaceWith(next);navNode=next;}});
addEventListener("hashchange",navigate);
document.addEventListener("languagechange",()=>{if(current)navigate();});
document.addEventListener("keydown",event=>{
 const el=event.target;if(el instanceof HTMLElement&&(el.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(el.tagName)))return;
 if(getDevice().kind!=="desktop"||event.ctrlKey||event.altKey||event.metaKey)return;
 const n=Number(event.key);
 if(n>=1&&n<=4){event.preventDefault();location.hash="#/"+nav[n-1][0];}
 if(event.key==="/"){event.preventDefault();location.hash="#/search";}
 if(event.key==="?"){event.preventDefault();openOverlay({title:t("shortcuts"),content:h("p",{text:t("shortcutHelp")})});}
});
await ready;
if(!location.hash)location.hash="#/dashboard";
await navigate();
