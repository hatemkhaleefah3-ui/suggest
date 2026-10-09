export const SCHEMA_VERSION=1;
export const STORAGE_KEY="suggest:v1";
const timestamp=()=>new Date().toISOString();
const defaults=()=>({schemaVersion:1,settings:{language:"en",region:"E",providers:[],maturityConfirmed:false},library:{},presets:[],recentSearches:[],dismissedPrompts:{},tasteProfile:{},onboarding:{completed:false,skippedAll:false,completedAt:null,sections:[],answers:{},lastStepId:null},suggestSession:{answers:{},shownIds:[],excludedIds:[],retryCount:0,negativeSignals:[],relaxationLog:[]},activity:[],sync:{status:"offline"},diagnostics:[]});
export function migrate(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return defaults();
 if(Number(raw.schemaVersion)>SCHEMA_VERSION)throw Error("Future schema");
 const d=defaults();return {...d,...raw,schemaVersion:SCHEMA_VERSION,settings:{...d.settings,...raw.settings},onboarding:{...d.onboarding,...raw.onboarding,answers:{...raw.onboarding?.answers}},suggestSession:{...d.suggestSession,...raw.suggestSession},library:raw.library&&!Array.isArray(raw.library)&&typeof raw.library==="object"?raw.library:{},activity:Array.isArray(raw.activity)?raw.activity.slice(-50):[],diagnostics:Array.isArray(raw.diagnostics)?raw.diagnostics.slice(-100):[]};
}
function load(){try{return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{return defaults();}}
let state=load();
const subscribers=new Set(),undoStack=[];
export function getState(){return state;}
export function subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){console.warn("Storage unavailable",e);}}
export function canUndo(){return undoStack.length>0;}
export function dispatch(action){
 if(!action||typeof action.type!=="string")throw TypeError("Invalid action");
 const old=state,ts=timestamp();let next=state;
 switch(action.type){
 case "SET_SETTINGS":next={...old,settings:{...old.settings,...structuredClone(action.value),updatedAt:ts}};break;
 case "LIBRARY_UPSERT":{const item=structuredClone(action.value),key=item.type+"_"+item.id;if(!/^(movie|tv)_\d+$/.test(key))throw Error("Invalid library id");next={...old,library:{...old.library,[key]:{...old.library[key],...item,updatedAt:item.updatedAt||ts}}};break;}
 case "LIBRARY_REMOVE":{const library={...old.library};delete library[action.key];next={...old,library};break;}
 case "SET_ONBOARDING":next={...old,onboarding:{...old.onboarding,...structuredClone(action.value),updatedAt:ts}};break;
 case "SET_SUGGEST_SESSION":next={...old,suggestSession:{...old.suggestSession,...structuredClone(action.value),updatedAt:ts}};break;
 case "SET_PRESETS":next={...old,presets:structuredClone(action.value)};break;
 case "SET_RECENT_SEARCHES":next={...old,recentSearches:structuredClone(action.value).slice(0,20)};break;
 case "SET_DISMISSED_PROMPTS":next={...old,dismissedPrompts:{...old.dismissedPrompts,...structuredClone(action.value)}};break;
 case "SET_TASTE_PROFILE":next={...old,tasteProfile:structuredClone(action.value)};break;
 case "ADD_ACTIVITY":next={...old,activity:[...old.activity,{...structuredClone(action.value),at:ts}].slice(-50)};break;
 case "SET_SYNC":next={...old,sync:{...old.sync,...structuredClone(action.value)}};break;
 case "DIAGNOSTIC":next={...old,diagnostics:[...old.diagnostics,{at:ts,...structuredClone(action.value)}].slice(-100)};break;
 case "HYDRATE":next=migrate(action.value);break;
 case "UNDO":next=undoStack.pop()||old;break;
 default:throw Error("Unknown action "+action.type);
 }
 if(next!==old){if(!["UNDO","SET_SYNC","DIAGNOSTIC","HYDRATE"].includes(action.type)){undoStack.push(structuredClone(old));if(undoStack.length>20)undoStack.shift();}state=next;save();for(const fn of [...subscribers]){try{fn(state,action);}catch(e){console.error("Store subscriber",e);}}}
 return state;
}
export function exportState(){return JSON.stringify(state,null,2);}
export function importState(input){dispatch({type:"HYDRATE",value:migrate(typeof input==="string"?JSON.parse(input):input)});}
