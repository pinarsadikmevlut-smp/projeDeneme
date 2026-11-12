import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../services/apiClient';

const AuthContext=createContext(null);
const anonymous={loading:false,authenticated:false,user:null,permissions:[],csrfToken:null};

export function AuthProvider({children}){
 const [auth,setAuth]=useState({...anonymous,loading:true});
 const refresh=useCallback(async(signal)=>{
  const result=await apiRequest('/auth/session',{signal});
  const next=result.authenticated===true?
   {loading:false,authenticated:true,user:result.user,permissions:result.permissions||[],
    csrfToken:result.csrfToken||null}:anonymous;
  setAuth(next);
  return next;
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  refresh(controller.signal).catch(()=>{if(!controller.signal.aborted)setAuth(anonymous);});
  return ()=>controller.abort();
 },[refresh]);
 const login=useCallback(async(username,password)=>{
  const result=await apiRequest('/auth/login',{method:'POST',body:{username,password}});
  const next={loading:false,authenticated:true,user:result.user,
   permissions:result.permissions||[],csrfToken:result.csrfToken||null};
  setAuth(next);
  return next;
 },[]);
 const logout=useCallback(async()=>{
  // The browser session is never stored in localStorage.
  if(auth.authenticated&&auth.csrfToken){
   try{await apiRequest('/auth/logout',{method:'POST',headers:{'X-CSRF-Token':auth.csrfToken}});}
   finally{setAuth(anonymous);}
  }else setAuth(anonymous);
 },[auth.authenticated,auth.csrfToken]);
 const value=useMemo(()=>({...auth,refresh,login,logout}),[auth,refresh,login,logout]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){
 const value=useContext(AuthContext);
 if(!value)throw Error('useAuth requires AuthProvider');
 return value;
}
