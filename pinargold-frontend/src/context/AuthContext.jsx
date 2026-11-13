import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {apiRequest,clearAuthState,setCsrfToken,setUnauthorizedHandler} from '../services/apiClient';

const AuthContext=createContext(null);
const anonymous={loading:false,authenticated:false,user:null,permissions:[],csrfToken:null};

export function AuthProvider({children}){
 const [auth,setAuth]=useState({...anonymous,loading:true});
 const apply=useCallback(result=>{
  const next=result?.authenticated===true?{
   loading:false,authenticated:true,user:result.user,
   permissions:result.permissions||[],csrfToken:result.csrfToken||null
  }:anonymous;
  setCsrfToken(next.csrfToken);
  setAuth(next);
  return next;
 },[]);
 useEffect(()=>{
  setUnauthorizedHandler(()=>{clearAuthState();setAuth(anonymous);});
  return ()=>setUnauthorizedHandler(null);
 },[]);
 const refresh=useCallback(async(signal)=>{
  const result=await apiRequest('/auth/session',{signal});
  return apply(result);
 },[apply]);
 useEffect(()=>{
  const controller=new AbortController();
  refresh(controller.signal).catch(()=>{
   if(!controller.signal.aborted){clearAuthState();setAuth(anonymous);}
  });
  return ()=>controller.abort();
 },[refresh]);
 const login=useCallback(async(username,password)=>{
  const result=await apiRequest('/auth/login',{method:'POST',body:{username,password}});
  return apply(result);
 },[apply]);
 const register=useCallback(async(username,password)=>{
  const result=await apiRequest('/auth/register',{method:'POST',body:{username,password}});
  return apply(result);
 },[apply]);
 const logout=useCallback(async()=>{
  try{
   await apiRequest('/auth/logout',{method:'POST'});
  }finally{
   clearAuthState();
   setAuth(anonymous);
  }
 },[]);
 const value=useMemo(()=>({...auth,refresh,login,register,logout}),[auth,refresh,login,register,logout]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){
 const value=useContext(AuthContext);
 if(!value)throw Error('useAuth requires AuthProvider');
 return value;
}
