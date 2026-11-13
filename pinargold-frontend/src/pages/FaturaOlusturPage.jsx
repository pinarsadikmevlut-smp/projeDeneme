import {useEffect,useMemo,useState} from 'react';
import {Link,useLocation,useNavigate,useSearchParams} from 'react-router-dom';
import {apiRequest} from '../services/apiClient';
import './InvoiceWorkflow.css';

const karats={'8':0.333,'14':0.585,'18':0.75,'21':0.875,'22':0.916,'24':0.995,'ziynet':1,'diger':1};
const fmt=n=>'₺'+Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
let lineId=0;
const blankLine=()=>({key:'line-'+(++lineId),name:'22 Ayar Bilezik',karat:'22',fineness:'0.916',
 unit:'gram',weightGram:'1',quantity:'1',unitPrice:'',workmanship:'0'});
const n=v=>Math.max(0,Number(v)||0);
const lineTotal=row=>((row.unit==='gram'?n(row.weightGram)*n(row.unitPrice):n(row.unitPrice))+n(row.workmanship))*n(row.quantity);
const fromBank=bank=>{
 if(!bank)return blankLine();
 return {...blankLine(),name:bank.direction==='out'?'Banka çıkışı — ürün/hizmeti doğrulayın':'Banka havalesi — ürün adını doğrulayın',karat:'diger',fineness:'1',
  unit:'adet',weightGram:'0',unitPrice:String(bank.amount||'')};
};

export default function FaturaOlusturPage(){
 const location=useLocation(),navigate=useNavigate(),[params]=useSearchParams();
 const bank=location.state?.bank||null;
 const salesLines=location.state?.salesLines||null;
 const editId=params.get('id');
 const [customers,setCustomers]=useState([]);
 const [customerId,setCustomerId]=useState(bank?.customerId||'');
 const [documentType,setDocumentType]=useState(bank?.documentType||'e-arsiv');
 const [paymentMethod,setPaymentMethod]=useState(bank?'Havale / EFT':'Nakit');
 const [notes,setNotes]=useState('');
 const [lines,setLines]=useState(salesLines?.length?salesLines.map((row,i)=>({...row,key:'cart-'+i})): [fromBank(bank)]);
 const [bankReference,setBankReference]=useState(bank?.reference||'');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true;
  Promise.all([
   apiRequest('/customers?perPage=100'),
   editId?apiRequest('/invoices/'+encodeURIComponent(editId)):Promise.resolve(null)
  ]).then(([list,edit])=>{
   if(!active)return;
   setCustomers(list.customers||[]);
   if(edit){
    const record=edit.invoice;
    setCustomerId(String(record.customerId));
    setDocumentType(record.documentType);
    setPaymentMethod(record.paymentMethod);
    setNotes(record.notes||'');
    setBankReference(record.bankReference||'');
    setLines(record.lines.map((row,i)=>({...row,key:'edit-'+i})));
   }
  }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false};
 },[editId]);
 const updateLine=(key,field,value)=>setLines(prev=>prev.map(row=>row.key===key?{
  ...row,[field]:value,...(field==='karat'?{fineness:String(karats[value])}:{})
 }:row));
 const total=useMemo(()=>lines.reduce((sum,row)=>sum+lineTotal(row),0),[lines]);
 const fine=useMemo(()=>lines.reduce((sum,row)=>sum+n(row.weightGram)*n(row.fineness)*n(row.quantity),0),[lines]);
 const amountDue=total;
 const save=async event=>{
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(lines.some(row=>row.name.startsWith('Banka havalesi —')||row.name.startsWith('Banka çıkışı —'))){
    setError('Havale tutarından gerçek ürün adı belirlenemez. Ürün adını doğrulayarak değiştirin.');
    return;
   }
   if(!customerId)throw Error('Önce müşteriyi seçin.');
   const payload={
    customerId:Number(customerId),documentType,paymentMethod,notes,
    bankReference:bankReference||null,
    lines:lines.map(({key,...row})=>row)
   };
   const result=await apiRequest(editId?'/invoices/'+editId:'/invoices',{
    method:editId?'PATCH':'POST',body:payload
   });
   navigate('/taslak-faturalar',{state:{saved:result.invoice.reference}});
  }catch(e){setError(e.message||'Taslak kaydedilemedi.');}
  finally{setBusy(false);}
 };
 return <div className="inv-page">
  <header className="inv-head">
   <div><div className="inv-overline">PINARGOLD · SATIŞTAN BELGEYE</div><h1>{editId?'Taslağı düzenle':documentType==='g-pusulasi'?'Yeni gider pusulası taslağı':'Yeni fatura taslağı'}</h1>
    <p>Müşteri, altın gramajı ve işçilik bilgisini tek akışta hazırlayın.</p></div>
   <Link to="/taslak-faturalar" className="inv-link">← Taslak listesi</Link>
  </header>
  <div className="inv-alert" role="note"><strong>DEMO / ÖN BELGE</strong> — Buradaki toplamlar vergi hariç ticari taslak hesaplamalarıdır. KDV, özel matrah, GİB belge numarası ve resmî iletim hesaplanmaz.</div>
  {salesLines?.length>0&&<div className="inv-banner">◎ Satış sepetinden {salesLines.length} ürün getirildi. Gramaj ve ayar varsayımlarını belgeye kaydetmeden önce doğrulayın. Sepet fiyatları gerçek fatura tutarını garanti etmez.</div>}
  {bank&&<div className="inv-banner">↗ Bankadan taslağa: <strong>{bank.reference||'Referans yok'}</strong> · {fmt(bank.amount)} · Belge türü, ürün/hizmet ve müşteri eşleşmesini doğrulamadan kaydetmeyin.</div>}
  {error&&<p className="inv-error" role="alert">{error}</p>}
  {loading?<p className="inv-loading">Kayıtlar yükleniyor...</p>:
  <form onSubmit={save}>
   <div className="inv-columns">
    <div className="inv-main">
     <section className="inv-card">
      <div className="inv-card-heading"><span>01</span><div><h2>Belge bilgileri</h2><p>Cari ve belge tipi</p></div></div>
      <div className="inv-grid-2">
       <label className="inv-field">Müşteri / Cari
        <select required value={customerId} onChange={e=>setCustomerId(e.target.value)}>
         <option value="">Müşteri seçin...</option>
         {customers.map(row=><option key={row.id} value={row.id}>{row.fullName}</option>)}
        </select>
       </label>
       <label className="inv-field">Belge tipi
        <select value={documentType} onChange={e=>setDocumentType(e.target.value)}>
         <option value="e-arsiv">e-Arşiv taslağı</option>
         <option value="e-fatura">e-Fatura taslağı</option>
         <option value="g-pusulasi">G.P. · Gider Pusulası taslağı</option>
        </select>
       </label>
       <label className="inv-field">Ödeme yöntemi
        <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
         <option>Nakit</option><option>Kredi Kartı</option><option>Havale / EFT</option>
        </select>
       </label>
       <label className="inv-field">Banka referansı (isteğe bağlı)
        <input maxLength={80} value={bankReference} onChange={e=>setBankReference(e.target.value)}
         placeholder="FAST / EFT işlem no"/>
       </label>
      </div>
      {!customers.length&&<p className="inv-hint">Henüz müşteri kaydı yok. Önce <Link to="/musteriler">Müşteri Listesi</Link> üzerinden cari oluşturun.</p>}
     </section>
     <section className="inv-card">
      <div className="inv-card-heading inv-heading-between"><span>02</span><div><h2>Altın ve ürün kalemleri</h2><p>Gram, milyem, birim tutar ve işçilik</p></div>
       <button type="button" className="inv-outline" disabled={lines.length>=30} onClick={()=>setLines(prev=>[...prev,blankLine()])}>+ Kalem ekle</button>
      </div>
      <div className="inv-lines">
       {lines.map((line,index)=><article className="inv-line" key={line.key}>
        <div className="inv-line-title"><strong>Kalem {String(index+1).padStart(2,'0')}</strong>
         <button type="button" disabled={lines.length===1} onClick={()=>setLines(prev=>prev.filter(r=>r.key!==line.key))}>Kaldır</button></div>
        <div className="inv-line-grid">
         <label className="inv-field inv-product-name">Ürün açıklaması
          <input required maxLength={100} minLength={2} value={line.name} onChange={e=>updateLine(line.key,'name',e.target.value)}/>
         </label>
         <label className="inv-field">Ayar
          <select value={line.karat} onChange={e=>updateLine(line.key,'karat',e.target.value)}>
           {Object.keys(karats).map(k=><option key={k} value={k}>{k==='ziynet'?'Ziynet':k==='diger'?'Diğer':k+' Ayar'}</option>)}
          </select>
         </label>
         <label className="inv-field">Milyem
          <input type="number" required min="0" max="1" step="0.001" value={line.fineness} onChange={e=>updateLine(line.key,'fineness',e.target.value)}/>
         </label>
         <label className="inv-field">Birim
          <select value={line.unit} onChange={e=>updateLine(line.key,'unit',e.target.value)}><option value="gram">Gram</option><option value="adet">Adet</option></select>
         </label>
         <label className="inv-field">Gram / ürün
          <input type="number" required min={line.unit==='gram'?'0.001':'0'} max="100000" step="0.001" value={line.weightGram} onChange={e=>updateLine(line.key,'weightGram',e.target.value)}/>
         </label>
         <label className="inv-field">Adet
          <input type="number" required min="1" max="1000" step="1" value={line.quantity} onChange={e=>updateLine(line.key,'quantity',e.target.value)}/>
         </label>
         <label className="inv-field">Birim fiyat ({line.unit==='gram'?'₺/gr':'₺/adet'})
          <input type="number" required min="0" step="0.01" max="100000000" value={line.unitPrice} onChange={e=>updateLine(line.key,'unitPrice',e.target.value)}/>
         </label>
         <label className="inv-field">İşçilik (₺/adet)
          <input type="number" required min="0" max="100000000" step="0.01" value={line.workmanship} onChange={e=>updateLine(line.key,'workmanship',e.target.value)}/>
         </label>
        </div>
        <div className="inv-line-foot"><span>Has karşılığı: {(n(line.weightGram)*n(line.fineness)*n(line.quantity)).toLocaleString('tr-TR',{maximumFractionDigits:4})} gr</span><strong>{fmt(lineTotal(line))}</strong></div>
       </article>)}
      </div>
     </section>
     <section className="inv-card">
      <div className="inv-card-heading"><span>03</span><div><h2>İç not</h2><p>Yalnızca taslak için</p></div></div>
      <textarea className="inv-textarea" maxLength={300} rows={3} placeholder="Kontrol, tahsilat veya müşteri notu..." value={notes} onChange={e=>setNotes(e.target.value)}/>
     </section>
    </div>
    <aside className="inv-side">
     <section className="inv-card inv-summary">
      <span className="inv-overline">TASLAK ÖZETİ</span><h2>Belge önizlemesi</h2>
      <div className="inv-sum-row"><span>Ürün kalemi</span><strong>{lines.length}</strong></div>
      <div className="inv-sum-row"><span>Has karşılığı</span><strong>{fine.toLocaleString('tr-TR',{maximumFractionDigits:4})} gr</strong></div>
      <div className="inv-sum-row"><span>Ürün + işçilik toplamı</span><strong>{fmt(amountDue)}</strong></div>
      <div className="inv-sum-row inv-sum-muted"><span>Özel matrah / KDV</span><em>Hesaplanmadı</em></div>
      <div className="inv-grand"><span>ÖN BELGE TOPLAMI</span><strong>{fmt(amountDue)}</strong></div>
      <button type="submit" className="inv-primary" disabled={busy||!customers.length}>{busy?'Kaydediliyor...':editId?'Taslağı güncelle':'Taslağı PostgreSQL’e kaydet'}</button>
      <p className="inv-hint">Onay sonrası Mysoft simülasyon kuyruğunda görünür. Gerçek fatura kesilmez veya GİB'e gönderilmez.</p>
     </section>
     <section className="inv-card inv-steps">
      <h3>İş akışı</h3>
      <div><b>1</b><span>Ürün ve müşteri girişi</span></div>
      <div><b>2</b><span>Taslak faturayı kaydet</span></div>
      <div><b>3</b><span>Kontrol ederek hazırla</span></div>
      <div><b>4</b><span>Mysoft aktarım simülasyonu</span></div>
     </section>
    </aside>
   </div>
  </form>}
 </div>;
}
