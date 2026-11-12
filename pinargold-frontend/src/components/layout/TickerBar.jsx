import {useMarketData} from '../../hooks/useMarketData';
import {useMarketStatus} from '../../hooks/useMarketStatus';
import {formatPrice} from '../../utils/format';
const featured=['gram','has1000','ceyrek','yarim','tam','bilezik22','usd','eur'];
export default function TickerBar(){
 const data=useMarketData(),status=useMarketStatus();
 const chosen=featured.map(id=>data.find(q=>q.id===id)).filter(Boolean);
 return <div className="overflow-hidden border-b border-slate-200 bg-slate-100 py-2 text-xs dark:border-slate-800 dark:bg-[#080b11]" aria-label="Altınkaynak piyasa bandı">
 <div className="ticker-track">{[0,1].map(n=><div key={n} className="flex shrink-0 items-center gap-10 px-5">{chosen.length?chosen.map(item=><span key={item.id} className="whitespace-nowrap"><span className="mr-2 font-semibold text-slate-500 dark:text-slate-400">{item.name}</span><span className="font-mono font-semibold">{formatPrice(item.sell)} ₺</span><span className="ml-2 text-slate-500">{item.stale?'ESKİ VERİ':item.direction==='down'?'▼':item.direction==='up'?'▲':'●'}</span></span>):<span className="text-amber-600">Altınkaynak fiyatları bekleniyor… {status.state==='error'?'Bağlantı hatası':''}</span>}</div>)}</div></div>;
}
