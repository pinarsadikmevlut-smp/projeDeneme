import {useMarketStatus} from '../../hooks/useMarketStatus';
export default function Footer(){
 const market=useMarketStatus();
 const label=market.state==='live'?'Güncel':market.state==='partial'?'Kısmen güncel':market.state==='warming'?'Bağlanıyor':'Güncel değil';
 return <footer className="mt-auto border-t border-slate-200 px-5 py-4 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400"><div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2"><span>© {new Date().getFullYear()} pinarGold • Canlı Altın & Döviz Panosu</span><span>Altınkaynak: {label} • 10 sn sorgulama • {market.quoteCount} varlık</span><span>Frontend v0.4.0</span></div></footer>;
}
