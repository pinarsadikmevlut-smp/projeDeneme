import {useMemo,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {loadZiraatFile,maskTckn} from '../services/ziraatStatement.service';
import './InvoiceWorkflow.css';

export const BANK_DOCUMENT_TEMPLATES=[
 {value:'e-arsiv',label:'Fatura · e-Arşiv',short:'Fatura',icon:'ϟ',tone:'invoice'},
 {value:'e-fatura',label:'Fatura · e-Fatura',short:'Fatura',icon:'ϟ',tone:'invoice'},
 {value:'g-pusulasi',label:'G.P. · Gider Pusulası',short:'G.P.',icon:'▣',tone:'voucher'}
];
const trMoney=value=>Number(value||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺';
const norm=value=>String(value??'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();
const months=['','Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
function dateParts(value){
 const raw=String(value??'').trim();
 const tr=raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
 if(tr){
  const [,day,month,year,hour='00',minute='00']=tr;
  if(+day>=1&&+day<=31&&+month>=1&&+month<=12)return {
   iso:year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0'),
   sort:year+month.padStart(2,'0')+day.padStart(2,'0')+hour.padStart(2,'0')+minute,
   label:Number(day)+' '+months[Number(month)]+' '+year+(tr[4]?' '+hour.padStart(2,'0')+':'+minute:'')
  };
 }
 const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
 return {iso:iso?.[0]||'',sort:iso?.[0]?.replace(/-/g,'')||'',label:raw||'—'};
}
const redact=value=>String(value||'').replace(/(?<!\d)[1-9]\d{6}(\d{4})(?!\d)/g,'*******$1');

export default function BankaFaturaPage(){
 const navigate=useNavigate();
 const [rows,setRows]=useState([]),[filename,setFilename]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(''),[direction,setDirection]=useState('all');
 const [startDate,setStartDate]=useState(''),[endDate,setEndDate]=useState('');
 const [sortDesc,setSortDesc]=useState(true),[page,setPage]=useState(1);
 const [selectedIds,setSelectedIds]=useState([]),[documents,setDocuments]=useState({});
 const [bulkType,setBulkType]=useState(''),[detailId,setDetailId]=useState(null);
 const counts=useMemo(()=>({
  in:rows.filter(r=>r.direction==='in').length,
  out:rows.filter(r=>r.direction==='out').length,
  unknown:rows.filter(r=>r.direction==='unknown').length,
  incoming:rows.filter(r=>r.direction==='in').reduce((sum,r)=>sum+r.amount,0),
  outgoing:rows.filter(r=>r.direction==='out').reduce((sum,r)=>sum+r.amount,0)
 }),[rows]);
 const filtered=useMemo(()=>rows.filter(row=>{
  if(direction!=='all'&&row.direction!==direction)return false;
  const date=dateParts(row.date).iso;
  if(startDate&&(!date||date<startDate))return false;
  if(endDate&&(!date||date>endDate))return false;
  return !search||[row.fullName,row.description,row.reference,row.tckn,...Object.values(row.rawFields||{})]
   .some(value=>norm(value).includes(norm(search)));
 }).sort((a,b)=>{
  const comparison=dateParts(a.date).sort.localeCompare(dateParts(b.date).sort)||a.id-b.id;
  return sortDesc?-comparison:comparison;
 }),[rows,direction,startDate,endDate,search,sortDesc]);
 const pageCount=Math.max(1,Math.ceil(filtered.length/25));
 const activePage=Math.min(page,pageCount);
 const activeRows=filtered.slice((activePage-1)*25,activePage*25);
 const allSelected=activeRows.length>0&&activeRows.every(row=>selectedIds.includes(row.id));
 const detail=rows.find(row=>row.id===detailId);
 const resetFilters=()=>{setSearch('');setDirection('all');setStartDate('');setEndDate('');setPage(1);setSelectedIds([]);};
 const changeDirection=next=>{setDirection(next);setPage(1);setSelectedIds([]);};
 const toggleRow=id=>setSelectedIds(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const togglePage=()=>setSelectedIds(old=>allSelected?old.filter(id=>!activeRows.some(r=>r.id===id)):
  [...new Set([...old,...activeRows.map(r=>r.id)])]);
 const choose=(id,value)=>{setDocuments(old=>({...old,[id]:value}));setNotice('');};
 const applyBulk=()=>{
  if(!bulkType||!selectedIds.length)return;
  setDocuments(old=>({...old,...Object.fromEntries(selectedIds.map(id=>[id,bulkType]))}));
  setNotice(selectedIds.length+' hareket için belge şablonu seçildi. Her satırın devam düğmesiyle sürece geçebilirsiniz.');
 };
 const proceed=row=>{
  const documentType=documents[row.id];
  if(!BANK_DOCUMENT_TEMPLATES.some(t=>t.value===documentType)){
   setError('Önce Belge sütunundan şablon seçmelisiniz.');return;
  }
  setError('');
  // Send only a transient reference/amount/template; statement and identity remain local.
  navigate('/fatura-olustur',{state:{bank:{
   reference:row.reference||'',amount:row.amount,direction:row.direction,documentType,
   bankName:'Ziraat Bankası'
  }}});
 };
 async function upload(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  setBusy(true);setError('');setNotice('');
  try{
   const loaded=await loadZiraatFile(file);
   setRows(loaded.records);setFilename(file.name);
   resetFilters();setDocuments({});setBulkType('');setDetailId(null);
   setNotice(loaded.records.length+' hareket okundu. Belge sütunundan şablon seçerek işleme başlayabilirsiniz.');
  }catch(err){setRows([]);setFilename('');setSelectedIds([]);setDocuments({});
   setError(err.message||'Ekstre okunamadı.');
  }finally{setBusy(false);}
 }
 return <div className="inv-page bank-page">
  <header className="inv-head">
   <div><div className="inv-overline">PINARGOLD · BANKA → BELGE</div><h1>Banka hareketleri</h1>
    <p>Ekstreyi yükleyin, belge şablonunu satır üzerinde seçin ve taslak işlemine devam edin.</p></div>
   <div className="bank-heading-actions">
    <Link to="/excel-yukle" className="inv-link">Excel Yükle ↗</Link>
    <label className="inv-primary bank-upload">⇧ {busy?'Dosya okunuyor...':'Banka ekstresi yükle'}
     <input type="file" disabled={busy} accept=".xlsx,.csv" hidden onChange={upload} aria-label="Banka ekstresi seç"/>
    </label>
   </div>
  </header>
  <div className="inv-alert" role="note"><strong>YEREL ÖNİZLEME</strong> — Ziraat Excel/CSV hareketleri tarayıcıda işlenir.
   Belge seçimi yalnızca taslak sürecini başlatır; resmî fatura veya gider pusulası düzenlenmez. TCKN listede maskelenir.</div>
  <div className="bank-metrics">
   <div><span>TOPLAM HAREKET</span><strong>{rows.length}</strong></div>
   <div><span>GELEN / ALACAK</span><strong className="bank-positive">{trMoney(counts.incoming)}</strong></div>
   <div><span>GİDEN / BORÇ</span><strong className="bank-negative">{trMoney(counts.outgoing)}</strong></div>
  </div>
  {filename&&<div className="bank-file-note"><span>▣</span><strong>{filename}</strong><span>· {rows.length} hareket · {selectedIds.length} seçili · Belge seçimleri sadece bu ekranın belleğinde.</span></div>}
  {notice&&<div className="inv-banner" role="status">{notice}</div>}
  {error&&<div className="inv-error" role="alert">{error}</div>}
  <section className="inv-card bank-panel" aria-label="Banka hareketleri tablosu">
   <div className="bank-toolbar">
    <div className="bank-filter-left">
     <div className="bank-date-range">
      <span aria-hidden="true">▦</span>
      <label>Başlangıç <input aria-label="Başlangıç tarihi" type="date" value={startDate} max={endDate||undefined} onChange={e=>{setStartDate(e.target.value);setPage(1);}}/></label>
      <span>–</span>
      <label>Bitiş <input aria-label="Bitiş tarihi" type="date" value={endDate} min={startDate||undefined} onChange={e=>{setEndDate(e.target.value);setPage(1);}}/></label>
     </div>
     <div className="bank-flow-filter" role="group" aria-label="İşlem yönü">
      <button className={direction==='all'?'active':''} onClick={()=>changeDirection('all')}>Tümü <small>{rows.length}</small></button>
      <button className={direction==='in'?'active':''} onClick={()=>changeDirection('in')} aria-label="Gelen hareketler"><span className="bank-positive">↙</span> Gelen <small>{counts.in}</small></button>
      <button className={direction==='out'?'active':''} onClick={()=>changeDirection('out')} aria-label="Giden hareketler"><span className="bank-negative">↗</span> Giden <small>{counts.out}</small></button>
      {counts.unknown>0&&<button className={direction==='unknown'?'active':''} onClick={()=>changeDirection('unknown')}>Belirsiz <small>{counts.unknown}</small></button>}
     </div>
    </div>
    <div className="bank-filter-right">
     <input className="bank-search" aria-label="Banka hareketi ara" placeholder="İşlem, kişi veya açıklama ara..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
     <button className="bank-tool-button" onClick={()=>setSortDesc(old=>!old)} aria-label="Tarihe göre sırala">{sortDesc?'↓':'↑'}</button>
     <button className="bank-tool-button" onClick={resetFilters}>↻ Filtreleri sıfırla</button>
    </div>
   </div>
   {selectedIds.length>0&&<div className="bank-bulk-bar">
    <strong>{selectedIds.length} hareket seçildi</strong>
    <select aria-label="Seçililer için belge şablonu" value={bulkType} onChange={e=>setBulkType(e.target.value)}>
     <option value="">Toplu belge şablonu seç...</option>
     {BANK_DOCUMENT_TEMPLATES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
    <button className="inv-outline" disabled={!bulkType} onClick={applyBulk}>Şablonu uygula</button>
    <button className="bank-clear" onClick={()=>setSelectedIds([])}>Seçimi temizle</button>
   </div>}
   <div className="bank-grid-scroll">
    <table className="bank-grid">
     <thead><tr>
      <th className="bank-check-column"><input type="checkbox" aria-label="Sayfadaki tüm hareketleri seç" checked={allSelected} onChange={togglePage} disabled={!activeRows.length}/></th>
      <th className="bank-date-column">TARİH / SAAT</th>
      <th className="bank-source-column">BANKA / YÖN</th>
      <th className="bank-description-column">KARŞI TARAF / AÇIKLAMA</th>
      <th className="bank-amount-column">TUTAR</th>
      <th className="bank-document-column">BELGE</th>
      <th className="bank-actions-column">İŞLEM</th>
     </tr></thead>
     <tbody>{activeRows.map(row=>{
      const chosen=BANK_DOCUMENT_TEMPLATES.find(t=>t.value===documents[row.id]);
      return <tr key={row.id} className={selectedIds.includes(row.id)?'bank-selected-row':''}>
       <td className="bank-checkbox-cell"><input type="checkbox" aria-label={'Hareket seç '+row.id} checked={selectedIds.includes(row.id)} onChange={()=>toggleRow(row.id)}/></td>
       <td className="bank-date-cell"><span>{dateParts(row.date).label}</span><small>{row.reference||'Referans yok'}</small></td>
       <td><div className="bank-source"><span className="bank-logo" title="Ziraat Bankası">ZB</span>
        <div><strong>Ziraat</strong><small className={row.direction==='in'?'bank-positive':row.direction==='out'?'bank-negative':''}>{row.direction==='in'?'↙ Gelen':row.direction==='out'?'↗ Giden':'— Belirsiz'}</small></div>
       </div></td>
       <td className="bank-description-cell"><div className="bank-counterparty">
        <span className="bank-person-icon" aria-hidden="true">▧</span>
        <strong>{row.fullName||'Karşı taraf belirlenemedi'}</strong>
        {row.tckn&&<small className="bank-tckn">{maskTckn(row.tckn)}</small>}
        <span className="bank-description-text" title={redact(row.description)}>{redact(row.description)||'—'}</span>
       </div></td>
       <td className={'bank-amount-cell '+(row.direction==='out'?'bank-negative':'bank-positive')}>
        {row.direction==='out'?'-':row.direction==='in'?'+':''}{trMoney(row.amount)}
       </td>
       <td className="bank-doc-cell">
        <label className={'bank-document-picker '+(chosen?'bank-doc-'+chosen.tone:'')} title="Bu hareket için belge şablonu">
         <span aria-hidden="true" className="bank-document-icon">{chosen?.icon||'◇'}</span>
         <select aria-label={'Belge şablonu '+row.id} value={documents[row.id]||''} onChange={e=>choose(row.id,e.target.value)}>
          <option value="">Şablon seç</option>
          {BANK_DOCUMENT_TEMPLATES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
         </select>
        </label>
       </td>
       <td className="bank-action-cell"><div className="bank-row-actions">
        <button type="button" title="Hareket ayrıntısı" aria-label={'Hareket ayrıntısı '+row.id} onClick={()=>setDetailId(row.id)}>◉</button>
        <button type="button" title={chosen?'Seçili belge taslağına ilerle':'Önce belge şablonu seçin'} disabled={!chosen} aria-label={'Belge sürecine ilerle '+row.id} onClick={()=>proceed(row)}>↗</button>
       </div></td>
      </tr>
     })}</tbody>
    </table>
    {!activeRows.length&&!busy&&<div className="inv-empty">
     <span>▤</span><strong>{rows.length?'Filtreye uygun hareket bulunamadı':'Henüz banka hareketi yüklenmedi'}</strong>
     <p>{rows.length?'Filtreleri sıfırlayarak yeniden deneyin.':'.xlsx veya .csv dosyanızı seçerek başlayın.'}</p>
    </div>}
    {busy&&<div className="inv-loading" role="status">Banka hareketleri okunuyor...</div>}
   </div>
   <div className="bank-table-footer">
    <span>{filtered.length} hareket · {activePage}/{pageCount} sayfa</span>
    <span className="bank-footer-hint">Belge seç → Şablon belirle → ↗ İlerle</span>
    <div><button disabled={activePage<=1} onClick={()=>setPage(p=>p-1)}>‹ Önceki</button><button disabled={activePage>=pageCount} onClick={()=>setPage(p=>p+1)}>Sonraki ›</button></div>
   </div>
  </section>
  {detail&&<div className="bank-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDetailId(null)}}>
   <div role="dialog" aria-modal="true" aria-label="Banka hareketi ayrıntıları" className="inv-card bank-modal">
    <div className="bank-modal-head"><h2>Hareket ayrıntıları</h2><button aria-label="Ayrıntıları kapat" onClick={()=>setDetailId(null)}>✕</button></div>
    <dl><dt>Tarih</dt><dd>{dateParts(detail.date).label}</dd>
     <dt>Banka / yön</dt><dd>Ziraat Bankası · {detail.direction==='in'?'Gelen':detail.direction==='out'?'Giden':'Belirsiz'}</dd>
     <dt>İşlem no</dt><dd>{detail.reference||'—'}</dd>
     <dt>Karşı taraf</dt><dd>{detail.fullName||'Belirlenemedi'}</dd>
     <dt>TCKN</dt><dd>{maskTckn(detail.tckn)}</dd>
     <dt>Açıklama</dt><dd>{redact(detail.description)}</dd>
     <dt>Tutar</dt><dd>{detail.direction==='out'?'-':''}{trMoney(detail.amount)}</dd>
    </dl>
    <p className="inv-hint">Banka kaydındaki karşı taraf ve ürün bilgileri taslak ekranında doğrulanmalıdır.</p>
    <button className="inv-outline" onClick={()=>setDetailId(null)}>Kapat</button>
   </div>
  </div>}
 </div>;
}
