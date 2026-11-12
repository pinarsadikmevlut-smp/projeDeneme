import {Outlet} from 'react-router-dom';
import TickerBar from './TickerBar';import TopNavbar from './TopNavbar';import Footer from './Footer';
export default function MainLayout({dark,onToggleTheme,onOpenSettings}){return <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100"><TickerBar/><TopNavbar dark={dark} onToggleTheme={onToggleTheme} onOpenSettings={onOpenSettings}/><main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-7 lg:px-7"><Outlet/></main><Footer/></div>;}
