import {Suspense,useEffect,useState} from 'react';import {BrowserRouter,Route,Routes,Navigate} from 'react-router-dom';import {navigation} from './config/navigation.config';import {pageRegistry} from './config/pageRegistry';import MainLayout from './components/layout/MainLayout';import MarginSettingsModal from './components/modals/MarginSettingsModal';
export default function App(){
 const [dark,setDark]=useState(()=>localStorage.getItem('pinargold-theme')!=='light');
 const [settingsOpen,setSettingsOpen]=useState(false);
 useEffect(()=>{document.documentElement.classList.toggle('dark',dark);document.body.classList.toggle('dark',dark);localStorage.setItem('pinargold-theme',dark?'dark':'light')},[dark]);
 return <BrowserRouter><Routes><Route element={<MainLayout dark={dark} onToggleTheme={()=>setDark(x=>!x)} onOpenSettings={()=>setSettingsOpen(true)}/>}>{navigation.map(item=>{const Page=pageRegistry[item.page];return Page?<Route key={item.id} path={item.path} element={<Suspense fallback={<p className="muted p-8">Sayfa yükleniyor...</p>}><Page/></Suspense>}/>:null})}<Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes><MarginSettingsModal open={settingsOpen} onClose={()=>setSettingsOpen(false)}/></BrowserRouter>;
}
