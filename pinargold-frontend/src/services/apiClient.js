import {apiConfig} from '../config/api.config';

// Access tokens are never persisted in localStorage/sessionStorage.
// The browser uses the HttpOnly cookie by default. A Bearer token can be
// supplied in-memory for explicitly configured non-cookie consumers.
let bearerToken=null,csrfToken=null,unauthorizedHandler=null;
export const setBearerToken=token=>{bearerToken=token||null;};
export const setCsrfToken=token=>{csrfToken=token||null;};
export const clearAuthState=()=>{bearerToken=null;csrfToken=null;};
export const setUnauthorizedHandler=handler=>{unauthorizedHandler=handler;};
const publicAuthPaths=new Set(['/auth/login','/auth/register','/auth/session']);

export async function apiRequest(path,{signal,method='GET',body,headers={}}={}){
 if(signal?.aborted)throw new DOMException('Request canceled','AbortError');
 const controller=new AbortController();
 const abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,apiConfig.timeoutMs);
 try{
  const safe=['GET','HEAD','OPTIONS'].includes(method.toUpperCase());
  const response=await fetch(apiConfig.baseUrl+path,{
   method,credentials:'same-origin',cache:'no-store',
   headers:{
    Accept:'application/json',
    ...(body!==undefined?{'Content-Type':'application/json'}:{}),
    ...(bearerToken?{Authorization:'Bearer '+bearerToken}:{}),
    ...(!safe&&csrfToken?{'X-CSRF-Token':csrfToken}:{}),
    ...headers
   },
   body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal
  });
  if(!response.ok){
   const detail=await response.json().catch(()=>({}));
   const error=new Error(detail?.message||('API HTTP '+response.status));
   error.status=response.status;
   error.code=detail?.error||null;
   if(response.status===401&&!publicAuthPaths.has(path)){
    clearAuthState();
    unauthorizedHandler?.();
   }
   throw error;
  }
  return await response.json();
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
