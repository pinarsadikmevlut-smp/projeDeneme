import {Suspense,useEffect,useState} from 'react';
import {BrowserRouter,Route,Routes,Navigate,useLocation} from 'react-router-dom';
import {navigation} from './config/navigation.config';
import {pageRegistry} from './config/pageRegistry';
import MainLayout from './components/layout/MainLayout';
import MarginSettingsModal from './components/modals/MarginSettingsModal';
import ErrorBoundary from './components/errors/ErrorBoundary';
import {AuthProvider} from './context/AuthContext';
function PageGuard({children}){const location=useLocation();return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;}
export default function App(){
 const [dark,setDark]=useState(()=>localStorage.getItem('pinargold-theme')!=='light');
 const [settingsOpen,setSettingsOpen]=useState(false);
 useEffect(()=>{document.documentElement.classList.toggle('dark',dark);document.body.classList.toggle('dark',dark);localStorage.setItem('pinargold-theme',dark?'dark':'light')},[dark]);
 return <AuthProvider><BrowserRouter><Routes><Route element={<MainLayout dark={dark} onToggleTheme={()=>setDark(x=>!x)} onOpenSettings={()=>setSettingsOpen(true)}/>}>{navigation.map(item=>{const Page=pageRegistry[item.page];return Page?<Route key={item.id} path={item.path} element={<PageGuard><Suspense fallback={<p className="muted p-8">Sayfa yükleniyor...</p>}><Page/></Suspense></PageGuard>}/>:null})}<Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes><MarginSettingsModal open={settingsOpen} onClose={()=>setSettingsOpen(false)}/></BrowserRouter></AuthProvider>;
}
