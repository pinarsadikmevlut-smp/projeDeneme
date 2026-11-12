import {apiRequest} from './apiClient';
import {reconcileQuotes,deriveMarketStatus} from './marketState';

// Only one timer and in-flight request regardless of the number of mounted components.
const POLL_MS=10000;
const WARMUP_MS=1000;
const quoteListeners=new Set(),statusListeners=new Set();
let prices=[];
let status={state:'warming',source:'Altınkaynak',stale:true,staleCount:0,
 quoteCount:0,fetchedAt:null,checkedAt:null,intervalSeconds:10,feedStatus:{},error:null};
let timer=null,controller=null,active=false,generation=0,requestPromise=null;

export const MARKET_DATA_MODE='live';
export const getMarketSnapshot=()=>prices;
export const getMarketStatus=()=>status;
const emitQuotes=()=>quoteListeners.forEach(fn=>fn());
const emitStatus=()=>statusListeners.forEach(fn=>fn());

async function poll(gen){
 if(!active||gen!==generation||requestPromise)return;
 const started=performance.now();
 const requestController=new AbortController();
 controller=requestController;
 let delay=POLL_MS;
 const running=(async()=>{
  try{
   const payload=await apiRequest('/market/prices',{signal:requestController.signal});
   if(gen!==generation||!active)return;
   if(!payload||!Array.isArray(payload.quotes))throw Error('Invalid market API response');
   const next=reconcileQuotes(prices,payload.quotes);
   if(next!==prices){prices=next;emitQuotes();}
   status=deriveMarketStatus(payload,status);
   emitStatus();
   if(!prices.length&&payload.state==='warming')delay=WARMUP_MS;
  }catch(error){
   if(gen!==generation||!active||requestController.signal.aborted)return;
   status={...status,state:'error',stale:true,error:'Fiyat servisine ulaşılamıyor'};
   if(prices.length){
    const marked=prices.map(q=>q.stale?q:{...q,stale:true});
    if(marked.some((q,i)=>q!==prices[i])){prices=marked;emitQuotes();}
   }
   emitStatus();
  }
 })();
 requestPromise=running;
 try{await running;}
 finally{
  if(controller===requestController)controller=null;
  if(requestPromise===running)requestPromise=null;
  if(gen===generation&&active){
   const elapsed=performance.now()-started;
   // Anchor to a 10s start-to-start cadence when the request is fast.
   // When a request runs longer, never overlap or issue a catch-up burst.
   const wait=delay===POLL_MS ? (elapsed<POLL_MS?POLL_MS-elapsed:POLL_MS) : delay;
   timer=setTimeout(()=>{timer=null;void poll(gen);},wait);
  }
 }
}

function resume(){
 if(!active||controller)return;
 clearTimeout(timer);timer=null;
 void poll(generation);
}
function onVisibility(){
 if(typeof document!=='undefined'&&document.visibilityState==='visible')resume();
}
function start(){
 if(active)return;
 active=true;generation++;
 if(typeof window!=='undefined'){
  window.addEventListener('online',resume);
  document?.addEventListener('visibilitychange',onVisibility);
 }
 void poll(generation);
}
function stop(){
 if(!active)return;
 active=false;generation++;
 clearTimeout(timer);timer=null;
 controller?.abort();controller=null;requestPromise=null;
 if(typeof window!=='undefined'){
  window.removeEventListener('online',resume);
  document?.removeEventListener('visibilitychange',onVisibility);
 }
}
function subscribe(set,listener){
 set.add(listener);
 if(!active)start();
 return ()=>{set.delete(listener);if(!quoteListeners.size&&!statusListeners.size)stop();};
}
export const subscribeMarketData=listener=>subscribe(quoteListeners,listener);
export const subscribeMarketStatus=listener=>subscribe(statusListeners,listener);
export function refreshMarketData(){
 if(!active)start();
 if(controller)return requestPromise;
 resume();
 return requestPromise;
}
