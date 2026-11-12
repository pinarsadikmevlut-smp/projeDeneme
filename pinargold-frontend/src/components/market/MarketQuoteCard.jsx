import {memo} from 'react';
import {formatPrice} from '../../utils/format';
import PriceCell from './PriceCell';
function MarketQuoteCard({item}){
 return <article className="glass-panel p-4" data-quote-id={item.id}>
  <div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.name}</span>{item.stale&&<span className="text-[10px] text-amber-500">ESKİ VERİ</span>}</div>
  <div className="muted mb-4 mt-1 text-xs">{item.purity} · {item.sourceCode}</div>
  <div className="flex justify-between gap-2 text-xs"><span>Alış</span><PriceCell value={item.buy} direction={item.buyDirection} revision={item.buyRevision}/></div>
  <div className="flex justify-between gap-2 text-xs"><span>Satış</span><PriceCell value={item.sell} direction={item.sellDirection} revision={item.sellRevision} highlight/></div>
  <div className="muted mt-3 text-xs">Makas: {formatPrice(item.sell-item.buy)} ₺</div>
  <div className="muted mt-1 text-[10px]">Kaynak zamanı: {item.sourceUpdatedAt||'Bilinmiyor'}</div>
 </article>;
}
export default memo(MarketQuoteCard);
