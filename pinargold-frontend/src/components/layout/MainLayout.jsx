import {Outlet,useLocation} from 'react-router-dom';
import TickerBar from './TickerBar';
import TopNavbar from './TopNavbar';
import Footer from './Footer';

export default function MainLayout({dark,onToggleTheme,onOpenSettings}){
 const {pathname}=useLocation();
 const isSales=pathname==='/satis-yap';
 return <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100">
  <TickerBar/>
  <TopNavbar dark={dark} onToggleTheme={onToggleTheme} onOpenSettings={onOpenSettings}/>
  <main className={isSales?'mx-auto w-full max-w-none flex-1 px-2 py-2 lg:px-3 lg:py-2':'mx-auto w-full max-w-[1800px] flex-1 px-4 py-7 lg:px-7'}>
   <Outlet/>
  </main>
  <Footer/>
 </div>;
}
