import {apiConfig} from '../config/api.config';
export async function apiRequest(path, {signal,method='GET',body}={}){
 const controller=new AbortController();
 const abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,apiConfig.timeoutMs);
 try {
  const response=await fetch(apiConfig.baseUrl+path,{
   method,credentials:'same-origin',headers:{'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,signal:controller.signal
  });
  if(!response.ok)throw new Error('API HTTP '+response.status);
  return await response.json();
 } finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
