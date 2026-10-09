import {getDevice,subscribeDevice} from "./device.js";
import {t} from "./i18n.js";
import {dispatch} from "./store.js";
export function h(tag,attrs={},...children){
 const el=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){if(v===null||v===undefined||v===false)continue;
  if(k==="class")el.className=String(v);
  else if(k==="text")el.textContent=String(v);
  else if(k==="style"&&typeof v==="object")for(const [a,b] of Object.entries(v))el.style.setProperty(a,String(b));
  else if(k.startsWith("on")&&typeof v==="function")el.addEventListener(k.slice(2).toLowerCase(),v);
  else if(k==="innerHTML"||k==="html")throw Error("Unsafe HTML is forbidden");
  else if(k==="href"||k==="src"){if(!/^\s*(javascript:|data:text\/html)/i.test(String(v)))el.setAttribute(k,String(v));}
  else if(v===true)el.setAttribute(k,"");else el.setAttribute(k,String(v));
 }
 function append(c){if(Array.isArray(c))c.forEach(append);else if(c instanceof Node)el.append(c);else if(c!==null&&c!==undefined&&c!==false)el.append(document.createTextNode(String(c)));}
 children.forEach(append);if(el.getAttribute("target")==="_blank")el.setAttribute("rel","noopener noreferrer");return el;
}
let overlay=null;
const root=()=>document.getElementById("overlay-root");
function focusables(el){return [...el.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(n=>n.getClientRects().length);}
export function closeOverlay(){if(!overlay)return;const {trigger,cleanup,onClose}=overlay;overlay=null;cleanup();root().replaceChildren();document.body.style.overflow="";trigger?.focus?.({preventScroll:true});onClose?.();}
export function openOverlay({title="",content="",size="md",footer=null,onClose=()=>{}}={}){
 if(overlay)closeOverlay();const trigger=document.activeElement;
 const body=h("div",{class:"min-h-0 flex-1 overflow-auto px-5 py-5",tabindex:"0"});body.append(content instanceof Node?content:typeof content==="function"?content():document.createTextNode(String(content)));
 const foot=footer?h("footer",{class:"sticky bottom-0 border-t border-white/10 bg-[#14141A] p-4 pb-[max(16px,env(safe-area-inset-bottom))]"},footer instanceof Node?footer:footer()):null;
 function render(){const phone=getDevice().kind==="phone";
  const panel=h("section",{role:"dialog","aria-modal":"true","aria-label":title,tabindex:"-1",class:"relative flex w-full flex-col overflow-hidden border border-white/10 bg-[#14141A] shadow-2xl "+(phone?"mt-auto max-h-[90dvh] rounded-t-[24px]": "max-h-[88dvh] rounded-2xl "+({sm:"max-w-md",md:"max-w-2xl",lg:"max-w-5xl"}[size]||"max-w-2xl"))});
  let handle=null;
  if(phone){handle=h("div",{class:"mx-auto my-3 h-1 w-12 rounded-full bg-white/30","aria-hidden":"true"});panel.append(handle);}
  panel.append(h("header",{class:"flex items-center justify-between border-b border-white/10 px-5 py-4"},h("h2",{class:"text-xl font-semibold",text:title}),h("button",{type:"button","aria-label":t("close"),class:"rounded-full p-2",onclick:closeOverlay},"×")),body);
  if(foot)panel.append(foot);
  const backdrop=h("div",{class:"fixed inset-0 z-[100] flex bg-black/75 "+(phone?"items-end":"items-center justify-center p-5"),onclick:e=>{if(e.target===backdrop)closeOverlay();}},panel);
  root().replaceChildren(backdrop);panel.focus();document.body.style.overflow="hidden";
  if(handle){let y=0;handle.addEventListener("touchstart",e=>y=e.touches[0].clientY,{passive:true});handle.addEventListener("touchend",e=>{const d=e.changedTouches[0].clientY-y;if(d>90)closeOverlay();else if(d>30)panel.style.maxHeight="50dvh";else if(d< -30)panel.style.maxHeight="90dvh";},{passive:true});}
 }
 const key=e=>{if(e.key==="Escape"){e.preventDefault();closeOverlay();}else if(e.key==="Tab"){const items=focusables(root()),first=items[0],last=items.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 document.addEventListener("keydown",key);
 const unsub=subscribeDevice((_next,old)=>{if(old&&overlay)render();});
 overlay={trigger,onClose,cleanup:()=>{unsub();document.removeEventListener("keydown",key);}};
 render();return closeOverlay;
}
export function toast(text,{undo=null,duration=3000}={}){
 const host=document.getElementById("toast-root");host.className="fixed bottom-24 end-4 z-[200] flex max-w-sm flex-col gap-2";
 const item=h("div",{class:"flex items-center gap-3 rounded-xl border border-white/10 bg-[#1C1C24] px-4 py-3 text-sm shadow-xl",role:"status"},h("span",{text}));
 if(undo)item.append(h("button",{class:"text-[#F2B84B]",onclick:()=>{undo();item.remove();}},t("undo")));
 host.append(item);setTimeout(()=>item.remove(),duration);return()=>item.remove();
}
export function reportError(error,source="application"){
 try{dispatch({type:"DIAGNOSTIC",value:{source,message:String(error?.message||error),stack:String(error?.stack||"").slice(0,4000)}});}catch{}
 toast(t("errorGeneric"));
}
export function button(text,onclick,secondary=false){return h("button",{type:"button",class:"min-h-11 rounded-full px-5 font-medium "+(secondary?"border border-white/15 bg-white/5":"bg-[#F2B84B] text-[#0B0B0E]"),onclick},text);}
export function skeleton(count=6){return h("div",{class:"grid grid-cols-3 gap-3 md:grid-cols-5 xl:grid-cols-7"},Array.from({length:count},()=>h("div",{class:"aspect-[2/3] animate-pulse rounded-xl bg-white/10","aria-hidden":"true"})));}
export function emptyState(title,description="",action=null){return h("section",{class:"rounded-2xl border border-white/10 bg-[#14141A] p-8 text-center"},h("h2",{class:"text-xl font-semibold",text:title}),h("p",{class:"mt-3 text-[#9A9AA6]",text:description}),action);}
export function errorState(retry){return emptyState(t("errorGeneric"),"",button(t("retry"),retry));}
export function posterCard(item,{onSelect=()=>{},actions=[]}={}){
 const art=h("button",{type:"button",class:"relative block aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#1C1C24]",onclick:()=>onSelect(item)});
 if(item.poster){const image=h("img",{src:item.poster,alt:item.title||"",loading:"lazy",decoding:"async",class:"h-full w-full object-cover"});image.addEventListener("error",()=>image.replaceWith(h("div",{class:"grid h-full place-items-center",text:"▣"})),{once:true});art.append(image);}else art.append(h("div",{class:"grid h-full place-items-center",text:"▣"}));
 if(Number.isFinite(item.rating))art.append(h("span",{class:"absolute end-2 top-2 rounded-full bg-black/80 px-2 py-1 text-xs text-[#F2B84B]",text:"★ "+Number(item.rating).toFixed(1)}));
 return h("article",{class:"min-w-0"},art,h("p",{class:"mt-2 truncate text-sm font-medium",text:item.title||""}),h("p",{class:"text-xs text-[#9A9AA6]",text:item.year||""}),h("div",{class:"mt-2 flex gap-2"},actions.map(a=>button(a.label,()=>a.onClick(item),true))));
}
export function chip(text,onclick,active=false){return h("button",{type:"button",class:"min-h-11 rounded-full border px-4 text-sm "+(active?"border-[#F2B84B] bg-[#F2B84B]/10 text-[#F2B84B]":"border-white/15 bg-[#1C1C24]"),"aria-pressed":String(active),onclick},text);}
export function progressBar(value,max=100){return h("progress",{value,max,class:"h-2 w-full accent-[#F2B84B]","aria-label":t("progress")});}
export function wizardShell({title,step,total,content,onBack,onNext,onSkip}){return h("section",{class:"mx-auto max-w-2xl space-y-5 rounded-2xl bg-[#14141A] p-6"},h("p",{class:"text-sm text-[#9A9AA6]",text:step+" / "+total}),progressBar(step,total),h("h2",{class:"text-2xl font-semibold",text:title}),content,h("footer",{class:"flex justify-between gap-3"},button(t("back"),onBack,true),button(t("skip"),onSkip,true),button(t("next"),onNext)));}
