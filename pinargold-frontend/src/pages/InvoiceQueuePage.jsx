import {useCallback,useEffect,useMemo,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {apiRequest} from '../services/apiClient';
import './InvoiceWorkflow.css';
const money=v=>'₺'+Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const label={draft:'Taslak',ready:'Aktarıma hazır',simulated:'Simüle aktarıldı'};
const date=v=>v?new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—';

export default function InvoiceQueuePage({mode='drafts'}){
 const transferMode=mode==='transfer';
 const location=useLocation();
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [busyId,setBusyId]=useState(null),[filter,setFilter]=useState('all'),[refresh,setRefresh]=useState(0);
 const [notice,setNotice]=useState(location.state?.saved?'Taslak '+location.state.saved+' kaydedildi.':'');
 const load=useCallback(()=>{
  let active=true;
  setLoading(true);setError('');
  apiRequest('/invoices').then(data=>{if(active)setRows(data.invoices||[]);})
   .catch(e=>{if(active)setError(e.message||'Belgeler alınamadı.');})
   .finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false};
 },[]);
 useEffect(()=>load(),[load,refresh]);
 const available=useMemo(()=>rows.filter(r=>transferMode?r.status!=='draft':r.status!=='simulated'),[rows,transferMode]);
 const visible=available.filter(r=>filter==='all'||r.status===filter);
 const counts={draft:rows.filter(r=>r.status==='draft').length,ready:rows.filter(r=>r.status==='ready').length,simulated:rows.filter(r=>r.status==='simulated').length};
 async function action(id,operation){
  setBusyId(id);setError('');setNotice('');
  try{
   const result=await apiRequest('/invoices/'+id+'/'+operation,{method:'POST'});
   setNotice(operation==='simulate-transfer'
    ?'Sadece simülasyon tamamlandı. Mysoft veya GİB sistemine aktarım yapılmadı.'
    :result.invoice.reference+' durumu güncellendi.');
   setRefresh(x=>x+1);
  }catch(e){setError(e.message||'İşlem yapılamadı.');}
  finally{setBusyId(null);}
 }
 return <div className="inv-page">
  <header className="inv-head"><div><div className="inv-overline">PINARGOLD · BELGE İŞ AKIŞI</div>
   <h1>{transferMode?'Mysoft aktarım kuyruğu':'Taslak faturalar'}</h1>
   <p>{transferMode?'Hazır belgeleri simüle aktarın ve sonuçları takip edin.':'Kaydedilen taslakları kontrol edin, düzenleyin ve aktarıma hazırlayın.'}</p>
   </div><Link to="/fatura-olustur" className="inv-primary inv-top-button">+ Yeni taslak</Link>
  </header>
  <div className="inv-alert" role="note"><strong>RESMÎ BELGE DEĞİLDİR</strong> — {transferMode?'Aktarım butonu yalnızca yerel veritabanındaki durumu değiştirir; Mysoft API’sine veya GİB’e göndermez.':'Hazır durumuna geçiş, muhasebesel onay veya resmî fatura oluşturma değildir.'}</div>
  <div className="inv-metrics">
   <div><span>Taslak</span><strong>{counts.draft}</strong></div>
   <div><span>Aktarıma hazır</span><strong>{counts.ready}</strong></div>
   <div><span>Simüle aktarılan</span><strong>{counts.simulated}</strong></div>
  </div>
  {notice&&<div className="inv-banner" role="status">{notice}</div>}
  {error&&<div className="inv-error" role="alert">{error}</div>}
  <section className="inv-card inv-queue">
   <div className="inv-toolbar">
    <div className="inv-tabs">
     <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Tümü</button>
     {(transferMode?['ready','simulated']:['draft','ready']).map(value=>
      <button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label[value]} ({counts[value]})</button>)}
    </div>
    <button className="inv-outline" onClick={()=>setRefresh(x=>x+1)}>↻ Yenile</button>
   </div>
   <div className="inv-table-wrap"><table className="inv-table">
    <thead><tr><th>Taslak no</th><th>Müşteri</th><th>Belge</th><th>Oluşturulma</th><th>Tutar</th><th>Durum</th><th>İşlem</th></tr></thead>
    <tbody>{visible.map(row=><tr key={row.id}>
     <td><strong>{row.reference}</strong><small>{row.source==='bank_excel'?'↗ Banka hareketi':'Manuel giriş'}</small></td>
     <td>{row.customerName}</td>
     <td>{row.documentType==='e-fatura'?'e-Fatura taslağı':'e-Arşiv taslağı'}</td>
     <td>{date(row.createdAt)}</td><td className="inv-table-money">{money(row.total)}</td>
     <td><span className={'inv-state inv-'+row.status}>{label[row.status]}</span></td>
     <td><div className="inv-actions">
      {row.status==='draft'&&<><Link to={'/fatura-olustur?id='+row.id}>Düzenle</Link><button disabled={busyId===row.id} onClick={()=>action(row.id,'review')}>Kontrol edildi · Hazırla</button></>}
      {row.status==='ready'&&<>{!transferMode&&<button disabled={busyId===row.id} onClick={()=>action(row.id,'reopen')}>Taslağa al</button>}{transferMode?<button disabled={busyId===row.id} onClick={()=>action(row.id,'simulate-transfer')}>Aktarımı simüle et</button>:<Link to="/mysoft-aktarilanlar">Aktarım kuyruğu ↗</Link>}</>}
      {row.status==='simulated'&&<span>GİB'e gönderilmedi</span>}
     </div></td>
    </tr>)}</tbody>
   </table>
   {!visible.length&&!loading&&<div className="inv-empty"><span>◇</span><strong>Bu aşamada belge bulunmuyor</strong><p>Yeni belge taslağı oluşturarak başlayabilirsiniz.</p><Link to="/fatura-olustur">+ Fatura taslağı oluştur</Link></div>}
   {loading&&<div className="inv-loading">Belgeler yükleniyor...</div>}
   </div>
  </section>
  {transferMode&&<p className="inv-footnote">Mysoft entegrasyonuna bağlanmadan önce resmî API erişimi, UBL doğrulama, mükellef sorgulaması, gönderim idempotency ve durum sorgulama altyapısı kurulmalıdır.</p>}
 </div>;
}
