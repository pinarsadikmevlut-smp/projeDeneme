import {useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useMarketData} from '../hooks/useMarketData';
import {useMarketStatus} from '../hooks/useMarketStatus';
import {formatPrice} from '../utils/format';
import './SatisYapPage.css';

const catalogMeta={
 gram:['🪙','Gram Altın','1 gr · Milyem 1','PNR-GRM'],
 has995:['◇','Has Altın · 0,995','1 gr · Milyem 0,995','PNR-H995'],
 has1000:['◆','Has Altın · 1,000','1 gr · Milyem 1','PNR-H1000'],
 bilezik22:['💍','22 Ayar Bilezik','1 gr · Milyem 0,916','PNR-22A'],
 altin18:['✦','18 Ayar Altın','1 gr · Milyem 0,75','PNR-18A'],
 altin14:['✧','14 Ayar Altın','1 gr · Milyem 0,585','PNR-14A'],
 ceyrek:['🥇','Çeyrek Altın','1 Adet · Milyem 1','PNR-CEY'],
 yarim:['🏅','Yarım Altın','1 Adet · Milyem 1','PNR-YRM'],
 tam:['🏆','Ziynet / Tam Altın','1 Adet · Milyem 1','PNR-TAM'],
 usd:['＄','Amerikan Doları / TL','Döviz · USD','PNR-USD'],
 eur:['€','Euro / TL','Döviz · EUR','PNR-EUR']
};
const productOrder=['gram','has995','has1000','bilezik22','altin18','altin14','ceyrek','yarim','tam','usd','eur'];
const money=value=>'₺'+formatPrice(value);
const dateText=()=>new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date());
const invoiceNo='SAT-DEMO-0001';

export default function SatisYapPage(){
 const navigate=useNavigate();
 const market=useMarketData();
 const marketStatus=useMarketStatus();
 const [search,setSearch]=useState('');
 const [customerSearch,setCustomerSearch]=useState('');
 const [customer,setCustomer]=useState(null);
 const [customerOpen,setCustomerOpen]=useState(false);
 const [payment,setPayment]=useState('Nakit');
 const [cart,setCart]=useState([]);
 const [message,setMessage]=useState('');
 const products=useMemo(()=>productOrder.map(id=>{
  const price=market.find(item=>item.id===id);
  return price?{...price,icon:catalogMeta[id][0],label:catalogMeta[id][1],detail:catalogMeta[id][2],sku:catalogMeta[id][3]}:null;
 }).filter(Boolean),[market]);
 const quoteAvailable=p=>Number.isFinite(p.sell)&&p.sell>0&&!p.stale&&['live','partial'].includes(marketStatus.state);
 const marketLabel={live:'● Güncel',partial:'● Kısmen güncel',warming:'● Bağlanıyor',stale:'● Veri eski',error:'● Bağlantı hatası',unavailable:'● Kullanılamıyor'}[marketStatus.state]||'● Bekleniyor';
 const filtered=products.filter(p=>[p.label,p.sku,p.detail].join(' ').toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
 const lines=cart.map(row=>({...row,product:products.find(p=>p.id===row.id)})).filter(row=>row.product);
 const total=lines.reduce((sum,row)=>sum+row.qty*row.unitPrice,0);
 // Demo totals only: no fiscal or legal tax calculation.
 const add=id=>{
  const product=products.find(p=>p.id===id);
  if(!product||!quoteAvailable(product))return;
  setCart(rows=>{
   const exists=rows.find(row=>row.id===id);
   return exists?rows.map(row=>row.id===id?{...row,qty:row.qty+1}:row):[...rows,{id,qty:1,unitPrice:product.sell}];
  });
 };
 const changeQty=(id,qty)=>setCart(rows=>rows.map(row=>row.id===id?{...row,qty:Math.max(0,Math.min(999,Number(qty)||0))}:row).filter(row=>row.qty>0));
 const reset=()=>{setCart([]);setCustomer(null);setCustomerSearch('');setPayment('Nakit');setMessage('Demo sepeti temizlendi.');};
 return <div className="sales-page">
  <div className="sales-demo-note" role="note">SATIŞ TASARIM ÖNİZLEMESİ · Altınkaynak fiyatları bilgilendirme amaçlıdır; eski fiyatlar sepete eklenmez. Resmî ödeme veya fatura oluşturulmaz.</div>
  <div className="sales-workspace">
   <aside className="sales-panel sales-catalog" aria-label="Ürün kataloğu">
    <div className="sales-panel-heading">
     <div><span className="sales-eyebrow">CANLI KATALOG</span><h1>Ürünler</h1></div>
     <div className="sales-heading-badges"><span role="status" className={`sales-live ${marketStatus.state==='live'?'':'sales-not-live'}`}>{marketLabel}</span><span className="sales-gold-tag">{products.length} ürün</span></div>
    </div>
    <div className="sales-catalog-search"><span aria-hidden="true">⌕</span><input aria-label="Ürün ara" placeholder="Ürün adı veya kod ara..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="sales-product-list">
     {filtered.map(p=><article className="sales-product" key={p.id}>
      <div className="sales-product-icon" aria-hidden="true">{p.icon}</div>
      <div className="sales-product-info"><strong>{p.label}</strong><small>{p.detail}</small><span>{p.sku}</span></div>
      <div className="sales-product-action"><strong>{money(p.sell)}</strong><button type="button" disabled={!quoteAvailable(p)} title={quoteAvailable(p)?'Demo sepete ekle':'Güncel fiyat bekleniyor: sepete eklenemez'} aria-label={p.label+' sepete ekle'} onClick={()=>add(p.id)}>＋</button></div>
     </article>)}
     {!filtered.length&&<p className="sales-no-results">{products.length?'Aramanıza uygun ürün bulunamadı.':'Fiyatlar bekleniyor. Backend bağlantısını kontrol edin.'}</p>}
    </div>
   </aside>
   <section className="sales-panel sales-basket" aria-label="Satış sepeti">
    <div className="sales-panel-heading">
     <div><span className="sales-eyebrow">AKTİF İŞLEM</span><h2>Satış Sepeti</h2></div>
     <div className="sales-heading-badges"><span className="sales-order-tag">{invoiceNo}</span><span className="sales-gold-tag">{lines.length} kalem</span></div>
    </div>
    <div className="sales-basket-tablehead"><span>ÜRÜN</span><span>MİKTAR</span><span>TUTAR</span></div>
    <div className="sales-basket-content">
     {!lines.length?<div className="sales-empty"><span className="sales-empty-icon">◇</span><strong>Sepetiniz boş</strong><small>Sol panelden bir ürüne tıklayarak satışa başlayın.</small></div>:
      <div className="sales-cart-lines">{lines.map(row=><div className="sales-cart-line" key={row.id}>
       <div className="sales-cart-product"><span className="sales-product-icon" aria-hidden="true">{row.product.icon}</span><div><strong>{row.product.label}</strong><small>Birim: {money(row.unitPrice)} · {row.product.sku}</small></div></div>
       <div className="sales-qty"><button aria-label={row.product.label+' azalt'} onClick={()=>changeQty(row.id,row.qty-1)}>−</button><input type="number" min="1" max="999" aria-label={row.product.label+' miktar'} value={row.qty} onChange={e=>changeQty(row.id,e.target.value)}/><button aria-label={row.product.label+' artır'} onClick={()=>changeQty(row.id,row.qty+1)}>+</button></div>
       <div className="sales-line-total"><strong>{money(row.qty*row.unitPrice)}</strong><button onClick={()=>changeQty(row.id,0)} aria-label={row.product.label+' kaldır'}>Kaldır</button></div>
      </div>)}</div>}
    </div>
    <div className="sales-basket-summary">
     <div className="sales-summary-inner">
      <div><span>Toplam Tutar</span><strong>{money(total)}</strong></div>
      <div><span>Has Altın Bedeli</span><strong>{money(0)}</strong></div>
      <div className="sales-summary-highlight"><span>Özel Matrah <small>(Demo)</small></span><strong>{money(0)}</strong></div>
      <div><span>KDV (%20) <small>— Demo</small></span><strong>{money(0)}</strong></div>
      <div className="sales-summary-total"><strong>GENEL TOPLAM</strong><strong>{money(total)}</strong></div>
     </div>
    </div>
   </section>
   <aside className="sales-panel sales-checkout" aria-label="Müşteri ve ödeme">
    <div className="sales-checkout-scroll">
     <section className="sales-checkout-section">
      <div className="sales-section-title"><span>01</span><h2>Müşteri / Cari</h2><button onClick={()=>setCustomerOpen(true)}>+ Yeni</button></div>
      <div className="sales-customer-search"><span aria-hidden="true">⌕</span><input aria-label="Müşteri ara" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="TCKN veya ad soyad ile ara..."/></div>
      {customerSearch&&<p className="sales-help">Müşteri veritabanı henüz bağlı değil. Arama demo modundadır.</p>}
      {customer&&<p className="sales-help">{customer}</p>}
     </section>
     <section className="sales-checkout-section">
      <div className="sales-section-title"><span>02</span><h2>Ödeme Yöntemi</h2></div>
      <div className="sales-payment-options">{[['Nakit','₺'],['Kredi Kartı','▣'],['Havale / EFT','↗']].map(([label,symbol])=><button type="button" key={label} aria-pressed={payment===label} onClick={()=>setPayment(label)} className={payment===label?'selected':''}><span>{symbol}</span><small>{label}</small>{payment===label&&<i>✓</i>}</button>)}</div>
     </section>
     <section className="sales-invoice-section">
      <span className="sales-invoice-eyebrow">FATURA ÖNİZLEME</span>
      <div className="sales-invoice">
       <div className="sales-invoice-brand"><strong>SARRAFİYE KUYUMCU</strong><span>Özel Matrah Faturası — 805</span><small>DEMO · RESMİ BELGE DEĞİLDİR</small><span>{dateText()}</span></div>
       <div className="sales-invoice-detail"><span>Alıcı</span><strong>{customer||'Müşteri seçilmedi'}</strong><span>TCKN:</span><strong>—</strong><span>Ödeme</span><strong>{payment.toLocaleUpperCase('tr-TR')}</strong></div>
       {lines.length?<div className="sales-invoice-lines">{lines.map(row=><div key={row.id}><span>{row.product.label} × {row.qty}</span><strong>{money(row.qty*row.unitPrice)}</strong></div>)}</div>:<p className="sales-invoice-empty">Sepete ürün eklendiğinde fatura kalemleri burada gösterilir.</p>}
       <div className="sales-invoice-totals"><div><span>Toplam</span><strong>{money(total)}</strong></div><div><span>Has Altın</span><strong>{money(0)}</strong></div><div><span>Matrah (805)</span><strong>{money(0)}</strong></div><div><span>KDV %20</span><strong>{money(0)}</strong></div></div>
       <div className="sales-invoice-grand"><span>GENEL TOPLAM</span><strong>{money(total)}</strong></div>
       <p className="sales-invoice-disclaimer">Bu yalnızca görsel taslak önizlemesidir. Özel matrah ve KDV hesaplamaları uygulanmamıştır.</p>
      </div>
     </section>
    </div>
    <div className="sales-checkout-bottom"><div><span>Ödenecek Tutar</span><strong>{money(total)}</strong></div><button type="button" disabled={!lines.length||!lines.every(row=>quoteAvailable(row.product))} className="sales-finish"
  onClick={()=>navigate('/fatura-olustur',{state:{salesLines:lines.map(row=>({name:row.product.label,
   karat:row.id==='bilezik22'?'22':row.id==='altin18'?'18':row.id==='altin14'?'14':'diger',
   fineness:row.id==='bilezik22'?'0.916':row.id==='altin18'?'0.75':row.id==='altin14'?'0.585':'1',
   unit:row.id==='usd'||row.id==='eur'?'adet':row.id==='ceyrek'||row.id==='yarim'||row.id==='tam'?'adet':'gram',
   weightGram:'1',quantity:row.qty,unitPrice:row.unitPrice,workmanship:'0'
  }))}})}>Fatura taslağına aktar <span>⟶</span><small>Resmî fatura oluşturmaz</small></button><button disabled className="sales-reset" type="button">Satış Tamamla / Fatura Kes (resmî işlem kapalı)</button><button className="sales-reset" type="button" onClick={reset}>Sepeti temizle</button>{message&&<span role="status" className="sales-help">{message}</span>}</div>
   </aside>
  </div>
  {customerOpen&&<div className="sales-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCustomerOpen(false)}}><div className="sales-modal" role="dialog" aria-modal="true" aria-labelledby="sales-modal-title"><h2 id="sales-modal-title">Yeni müşteri</h2><p>Müşteri kayıt altyapısı henüz etkin değil. Bu alan sonraki geliştirme aşamasında açılacak.</p><button onClick={()=>setCustomerOpen(false)}>Kapat</button></div></div>}
 </div>;
}
