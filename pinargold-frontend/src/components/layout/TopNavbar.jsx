import {useEffect,useState} from 'react';
import {NavLink} from 'react-router-dom';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faSun,faMoon,faRotate,faExpand,faSliders,faBars} from '@fortawesome/free-solid-svg-icons';
import {navigation} from '../../config/navigation.config';
import {formatTime} from '../../utils/format';
import {refreshMarketData} from '../../services/marketData.service';
export default function TopNavbar({dark,onToggleTheme,onOpenSettings}){
 const [now,setNow]=useState(()=>new Date());const [menu,setMenu]=useState(false);
 useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return ()=>clearInterval(id)},[]);
 const fullScreen=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.().catch(()=>{});};
 return <header className="border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-[#101620]/95">
 <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 lg:px-7">
 <NavLink to="/" className="mr-4 whitespace-nowrap font-outfit text-2xl font-bold tracking-tight"><span className="gold-gradient-text">pinarGold</span><span className="ml-2 rounded bg-gold-500/10 px-2 py-1 align-middle text-[10px] tracking-wider text-gold-600 dark:text-gold-400">PRO</span></NavLink>
 <button className="control lg:hidden" aria-label="Menüyü aç" onClick={()=>setMenu(x=>!x)}><FontAwesomeIcon icon={faBars}/></button>
 <nav aria-label="Ana navigasyon" className={`${menu?'flex':'hidden'} order-3 w-full flex-wrap gap-1 lg:order-none lg:flex lg:w-auto lg:flex-1`}>
 {navigation.map(item=><NavLink key={item.id} to={item.path} end={item.path==='/'} onClick={()=>setMenu(false)} className={({isActive})=>`flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors ${isActive?'border-gold-500/20 bg-gold-500/10 text-gold-600 dark:text-gold-400':'border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>{({isActive})=><><FontAwesomeIcon icon={item.icon}/>{item.label}{item.badge>0&&<span className="rounded-full bg-slate-200 px-1.5 text-[9px] dark:bg-slate-700">{item.badge}</span>}{isActive&&<span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-emerald-400"/>}</>}</NavLink>)}
 </nav>
 <div className="ml-auto flex items-center gap-1.5">
 <div className="mr-1 hidden text-right sm:block"><div className="text-[9px] font-bold tracking-widest text-emerald-500">● CANLI SAAT</div><time className="font-mono text-xs font-bold" dateTime={now.toISOString()}>{formatTime(now)}</time></div>
 <button className="control" title="Tema değiştir" aria-label="Tema değiştir" onClick={onToggleTheme}><FontAwesomeIcon icon={dark?faSun:faMoon}/></button>
 <button className="control" title="Altınkaynak fiyatlarını yenile" aria-label="Yenile" onClick={refreshMarketData}><FontAwesomeIcon icon={faRotate}/></button>
 <button className="control hidden sm:block" title="Tam ekran" aria-label="Tam ekran" onClick={fullScreen}><FontAwesomeIcon icon={faExpand}/></button>
 <button className="control" onClick={onOpenSettings}><FontAwesomeIcon icon={faSliders}/><span className="ml-2 hidden xl:inline">Ayar & Marj</span></button>
 <div className="ml-1 hidden items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700 xl:flex"><div className="grid h-9 w-9 place-items-center rounded-full bg-gold-500/15 font-outfit font-bold text-gold-600 dark:text-gold-400">MP</div><span className="text-xs font-semibold">Metin Pınar</span></div>
 </div></div></header>;
}
