import { useMarketData } from '../../hooks/useMarketData';
import {formatPrice} from '../../utils/format';
export default function TickerBar(){
 const data=useMarketData();
 return <div className="overflow-hidden border-b border-slate-200 bg-slate-100 py-2 text-xs dark:border-slate-800 dark:bg-[#080b11]" aria-label="Simülasyon piyasa bandı"><div className="ticker-track">{[0,1].map(n=><div key={n} className="flex shrink-0 items-center gap-10 px-5">{data.map(item=><span key={item.id} className="whitespace-nowrap"><span className="mr-2 font-semibold text-slate-500 dark:text-slate-400">{item.name}</span><span className="font-mono font-semibold">{formatPrice(item.sell)} ₺</span><span className={`ml-2 ${item.direction==='down'?'text-red-500':'text-emerald-500'}`}>{item.direction==='down'?'▼':'▲'}</span></span>)}</div>)}</div></div>;
}
