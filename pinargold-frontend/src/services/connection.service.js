import {apiConfig} from '../config/api.config';
const listeners=new Set();
let state={status:'idle',lastUpdated:null,attempt:0};
let socket=null,timer=null,active=false;
const publish=(patch)=>{state={...state,...patch};listeners.forEach(fn=>fn({...state}));};
export function getConnectionSnapshot(){return {...state};}
export function subscribeConnection(fn){
 listeners.add(fn);fn(getConnectionSnapshot());
 if(listeners.size===1)start();
 return ()=>{listeners.delete(fn);if(!listeners.size)stop();};
}
function start(){active=true;connect();}
function connect(){
 if(!active)return;
 if(!apiConfig.wsUrl){publish({status:'simulation',attempt:0});return;}
 if(!/^wss:\/\//.test(apiConfig.wsUrl)&&!(import.meta.env.DEV&&/^ws:\/\/localhost(?::\d+)?\//.test(apiConfig.wsUrl))){publish({status:'invalid-config'});return;}
 publish({status:'connecting'});
 try {
  socket=new WebSocket(apiConfig.wsUrl);
  socket.onopen=()=>{if(!active)return;publish({status:'connected',attempt:0,lastUpdated:new Date().toISOString()});};
  socket.onmessage=()=>{if(active)publish({lastUpdated:new Date().toISOString()});};
  socket.onclose=()=>retry();
  socket.onerror=()=>socket?.close();
 }catch{retry();}
}
function retry(){
 if(!active)return;
 socket=null;
 const attempt=state.attempt+1;
 publish({status:'reconnecting',attempt});
 timer=setTimeout(connect,Math.min(30000,1000*2**Math.min(attempt,5))+Math.random()*500);
}
function stop(){active=false;clearTimeout(timer);timer=null;if(socket){socket.onclose=null;socket.close();socket=null;}publish({status:'idle',attempt:0});}
