import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {loadZiraatFile} from '../services/ziraatStatement.service';
import './InvoiceWorkflow.css';
const money=v=>'₺'+Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function BankaFaturaPage(){
 const navigate=useNavigate();
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [filename,setFilename]=useState('');
 async function upload(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  setBusy(true);setError('');setRows([]);
  try{
   const data=await loadZiraatFile(file);
   setRows(data.records.filter(row=>row.direction==='in'&&row.amount>0));
   setFilename(file.name);
  }catch(err){setError(err.message||'Excel okunamadı.');}finally{setBusy(false);}
 }
 return <div className="inv-page">
  <header className="inv-head"><div><div className="inv-overline">PINARGOLD · BANKA → BELGE</div><h1>Banka hareketinden taslak</h1><p>Ziraat ekstresindeki gelen hareketleri inceleyip fatura taslağına taşıyın.</p></div><Link className="inv-link" to="/excel-yukle">Excel Yükle ekranı ↗</Link></header>
  <div className="inv-alert" role="note"><strong>YEREL ÖNİZLEME</strong> — Ekstre tarayıcıda okunur; banka hareketleri sunucuya yüklenmez. Taslağa yalnızca seçtiğiniz referans ve tutar taşınır. Resmî banka entegrasyonu değildir.</div>
  <section className="inv-card inv-bank-import">
   <div><h2>Ziraat Excel / CSV seç</h2><p>Gelen FAST, havale ve EFT işlemleri</p></div>
   <label className="inv-primary inv-file-label">⇧ {busy?'Dosya ayrıştırılıyor...':'Ekstre dosyası seç'}
    <input type="file" disabled={busy} accept=".xlsx,.csv" hidden onChange={upload} aria-label="Ziraat ekstresi seç"/>
   </label>
  </section>
  {error&&<div role="alert" className="inv-error">{error}</div>}
  {filename&&<p className="inv-hint">{filename} · {rows.length} gelen işlem · Dosya içeriği yalnızca bu ekranın belleğindedir.</p>}
  <section className="inv-card inv-queue">
   <div className="inv-card-heading"><span>↗</span><div><h2>Gelen işlemler</h2><p>Hareketi seçin, ürün bilgisini taslak ekranında doğrulayın.</p></div></div>
   <div className="inv-table-wrap"><table className="inv-table">
    <thead><tr><th>Tarih</th><th>İşlem no</th><th>Açıklama</th><th>Tutar</th><th></th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}>
     <td>{row.date}</td><td>{row.reference||'—'}</td>
     <td className="inv-bank-desc">{row.description||'Açıklama bulunamadı'}</td>
     <td className="inv-table-money">{money(row.amount)}</td>
     <td><button className="inv-outline" onClick={()=>navigate('/fatura-olustur',{state:{bank:{reference:row.reference||'',amount:row.amount}}})}>Taslak oluştur ↗</button></td>
    </tr>)}</tbody>
   </table>
   {!rows.length&&!busy&&<div className="inv-empty"><span>↗</span><strong>Henüz gelen hareket seçilmedi</strong><p>Bir Ziraat Excel veya CSV dosyası yükleyin.</p></div>}
   </div>
  </section>
 </div>;
}
