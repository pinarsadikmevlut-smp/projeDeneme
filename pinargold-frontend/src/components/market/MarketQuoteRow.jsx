import {memo} from 'react';
import {formatPrice} from '../../utils/format';
import PriceCell from './PriceCell';
function MarketQuoteRow({item}){
 return <tr className="border-b border-slate-100 last:border-0 hover:bg-gold-500/5 dark:border-slate-800/70" data-quote-id={item.id}>
  <td className="px-2 py-3"><div className="whitespace-nowrap font-semibold">{item.name}{item.stale&&<span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600">ESKİ</span>}</div><div className="mt-0.5 text-[10px] text-slate-400" title={item.providerName}>{item.sourceCode} · {item.sourceType==='currency'?'Döviz':'Altınkaynak altın'}</div></td>
  <td className="whitespace-nowrap px-2 py-3 text-[11px] text-slate-500 dark:text-slate-400">{item.purity}</td>
  <td className="px-1 py-2"><PriceCell value={item.buy} direction={item.buyDirection} revision={item.buyRevision}/></td>
  <td className="px-1 py-2"><PriceCell value={item.sell} direction={item.sellDirection} revision={item.sellRevision} highlight/></td>
  <td className="whitespace-nowrap px-2 py-3 font-mono text-[11px]">{formatPrice(item.sell-item.buy)}</td>
  <td className="whitespace-nowrap px-2 py-3 font-mono text-[11px]" title={item.sourceUpdatedAt||'Kaynak zamanı yok'}><span className={item.change<0?'text-red-500':item.change>0?'text-emerald-500':'text-slate-500'}>{item.change<0?'▼':item.change>0?'▲':'—'} {Math.abs(item.change).toFixed(3)}%</span></td>
 </tr>;
}
export default memo(MarketQuoteRow);
