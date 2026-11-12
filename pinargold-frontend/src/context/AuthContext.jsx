import {createContext,useContext,useEffect,useState} from 'react';
import {apiRequest} from '../services/apiClient';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [auth,setAuth]=useState({loading:true,authenticated:false,user:null,permissions:[]});
 useEffect(()=>{
  const controller=new AbortController();
  apiRequest('/auth/session',{signal:controller.signal})
   .then(result=>setAuth({loading:false,authenticated:result.authenticated===true,user:result.authenticated?result.user:null,permissions:result.authenticated?result.permissions||[]:[]}))
   .catch(()=>{if(!controller.signal.aborted)setAuth({loading:false,authenticated:false,user:null,permissions:[]})});
  return ()=>controller.abort();
 },[]);
 return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth requires AuthProvider');return value;}
