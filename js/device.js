const match = query => matchMedia(query).matches;
export function getDevice() {
  const width=innerWidth, ipad=/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1;
  const canHover=match("(hover:hover) and (pointer:fine)");
  const isTouch=navigator.maxTouchPoints>0||match("(pointer:coarse)");
  const kind=width<768?"phone":(width<1280||ipad||!match("(pointer:fine)"))?"tablet":"desktop";
  return {kind,canHover,isTouch,isStandalone:match("(display-mode:standalone)")||navigator.standalone===true,orientation:match("(orientation:landscape)")?"landscape":"portrait",width};
}
let current=getDevice(),queued=false;
const listeners=new Set();
export function subscribeDevice(fn){listeners.add(fn);fn(current);return()=>listeners.delete(fn);}
function update(){queued=false;const next=getDevice();document.documentElement.dataset.device=next.kind;document.documentElement.dataset.orientation=next.orientation;if(JSON.stringify(next)!==JSON.stringify(current)){const old=current;current=next;for(const fn of [...listeners]){try{fn(next,old);}catch(e){console.error(e);}}}}
function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
addEventListener("resize",schedule,{passive:true});
addEventListener("orientationchange",schedule,{passive:true});
document.documentElement.dataset.device=current.kind;
