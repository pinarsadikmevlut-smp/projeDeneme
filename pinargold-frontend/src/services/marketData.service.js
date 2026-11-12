import {apiRequest} from './apiClient';

const listeners = new Set();
const statusListeners = new Set();
let prices = [];
let status = {state:'connecting',source:'Altınkaynak',fetchedAt:null,stale:true,error:null};
let timer = null;
let inFlight = false;
let controller = null;
const POLL_MS = 10000;

export const MARKET_DATA_MODE = 'live';
export const getMarketSnapshot = () => prices.map(item=>({...item}));
export const getMarketStatus = () => ({...status});
const publish = () => {
 const snapshot = getMarketSnapshot();
 listeners.forEach(fn=>fn(snapshot));
 statusListeners.forEach(fn=>fn(getMarketStatus()));
};
async function poll(){
 if(inFlight)return;
 inFlight=true;
 controller=new AbortController();
 try {
  const payload=await apiRequest('/market/prices',{signal:controller.signal});
  if(!Array.isArray(payload.quotes))throw Error('Geçersiz fiyat yanıtı');
  const previous=new Map(prices.map(x=>[x.id,x]));
  prices=payload.quotes.map(item=>{
   const old=previous.get(item.id);
   const delta=old?item.sell-old.sell:0;
   return {...item,change:old&&old.sell?+(delta/old.sell*100).toFixed(3):0,
    direction:delta>0?'up':delta<0?'down':null,
    revision:old?(delta!==0||old.buy!==item.buy?old.revision+1:old.revision):0};
  });
  status={state:payload.stale?'stale':'live',source:payload.source||'Altınkaynak',
   fetchedAt:payload.fetchedAt,stale:!!payload.stale,error:payload.error||null};
 }catch(err){
  if(!controller.signal.aborted)status={...status,state:'error',stale:true,error:'Fiyat servisine ulaşılamıyor'};
 }finally{inFlight=false;controller=null;publish();}
}
function start(){poll();timer=setInterval(poll,POLL_MS);}
function stop(){clearInterval(timer);timer=null;controller?.abort();}
export function subscribeMarketData(callback){
 listeners.add(callback);callback(getMarketSnapshot());
 if(!timer)start();
 return ()=>{listeners.delete(callback);if(!listeners.size&&!statusListeners.size)stop();};
}
export function subscribeMarketStatus(callback){
 statusListeners.add(callback);callback(getMarketStatus());
 if(!timer)start();
 return ()=>{statusListeners.delete(callback);if(!listeners.size&&!statusListeners.size)stop();};
}
export function refreshMarketData(){return poll();}
