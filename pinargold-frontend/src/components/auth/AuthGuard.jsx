import {Navigate,Outlet,useLocation} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';

export default function AuthGuard(){
 const {loading,authenticated}=useAuth();
 const location=useLocation();
 if(loading)return <div className="p-10 text-center text-slate-600 dark:text-slate-300" role="status">Oturum doğrulanıyor...</div>;
 if(!authenticated)return <Navigate to="/login" replace state={{from:location.pathname}}/>;
 return <Outlet/>;
}
