import {useMemo,useRef,useState} from 'react';
import {loadZiraatFile,STANDARD_COLUMNS,enrichedCsv,validTckn,splitFullName} from '../services/ziraatStatement.service';
import './ExcelYuklePage.css';

const currency=n=>'₺'+new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
const normalize=value=>String(value??'').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g,' ');

export default function ExcelYuklePage(){
 const fileRef=useRef(null);
 const [records,setRecords]=useState([]);
 const [extraHeaders,setExtraHeaders]=useState([]);
 const [showExtras,setShowExtras]=useState(true);
 const [filter,setFilter]=useState('all');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState({key:'date',desc:true});
 const [perPage,setPerPage]=useState(10);
 const [page,setPage]=useState(1);
 const [selected,setSelected]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [filename,setFilename]=useState('');
 const counts=useMemo(()=>({in:records.filter(r=>r.direction==='in').length,out:records.filter(r=>r.direction==='out').length}),[records]);
 const incoming=records.filter(r=>r.direction==='in').reduce((sum,r)=>sum+r.amount,0);
 const outgoing=records.filter(r=>r.direction==='out').reduce((sum,r)=>sum+r.amount,0);
 const visible=useMemo(()=>records.filter(r=>(filter==='all'||r.direction===filter)&&[r.reference,r.description,r.fullName,r.firstName,r.lastName,r.tckn,...Object.values(r.rawFields||{})].some(x=>normalize(x).includes(normalize(query)))).sort((a,b)=>{const va=a[sort.key]??'',vb=b[sort.key]??'';const result=typeof va==='number'&&typeof vb==='number'?va-vb:String(va).localeCompare(String(vb),'tr-TR',{numeric:true});return sort.desc?-result:result;}),[records,filter,query,sort]);
 const pages=Math.max(1,Math.ceil(visible.length/perPage));
 const current=Math.min(page,pages);
 const shown=visible.slice((current-1)*perPage,current*perPage);
 const allSelected=shown.length>0&&shown.every(r=>selected.includes(r.id));
 async function upload(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  setBusy(true);setError('');
  try{const result=await loadZiraatFile(file);setRecords(result.records);setExtraHeaders(result.extraHeaders);setFilename(file.name);setSelected([]);setPage(1);setFilter('all');}
  catch(err){setError(err.message||'Dosya okunamadı.');}
  finally{setBusy(false);}
 }
 const changeFilter=value=>{setFilter(value);setPage(1);};
 const editIdentity=(id,key,value)=>setRecords(previous=>previous.map(row=>{
  if(row.id!==id)return row;
  const next={...row,[key]:value};
  if(key==='fullName'){
   const name=splitFullName(value);
   next.firstName=name?.firstName||'';
   next.lastName=name?.lastName||'';
  }
  next.identityReview=!next.firstName.trim()||!next.lastName.trim()||!!(next.tckn&&!validTckn(next.tckn));
  next.identitySource='Elle düzeltildi';
  return next;
 }));
 const downloadEnriched=()=>{
  if(!records.length)return;
  const blob=new Blob([enrichedCsv(records,extraHeaders)],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='ziraat-hareketleri-ayristirilmis.csv';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 };
 const toggleAll=()=>setSelected(previous=>allSelected?previous.filter(id=>!shown.some(r=>r.id===id)):[...new Set([...previous,...shown.map(r=>r.id)])]);
 const toggleOne=id=>setSelected(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);
 const changeSort=key=>setSort(prev=>({key,desc:prev.key===key?!prev.desc:false}));
 return <div className="excel-page">
  <header className="excel-hero">
   <div className="excel-hero-left"><span className="excel-gem" aria-hidden="true">♢</span><div><h1>Ziraat Bankası · Hesap Hareketleri</h1><p>Excel/CSV içe aktarım · Açıklamadan Ad, Soyad, TCKN ayrıştırma · Lokal önizleme</p></div></div>
   <div className="excel-actions"><input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={upload} aria-label="Ziraat hesap hareketleri dosyası seç"/><button className="excel-btn" onClick={()=>fileRef.current?.click()} disabled={busy}><span>⇧</span>{busy?'Dosya okunuyor...':'Ziraat Ekstresi Yükle'}</button><span className="excel-action-count"><b>{records.length}</b> İşlem Kaydı</span><button className="excel-btn excel-export" disabled={!records.length} onClick={downloadEnriched} title="Ayrıştırılmış hareketleri CSV olarak indir">▤ &nbsp; CSV İndir</button></div>
  </header>
  {error&&<div role="alert" className="excel-error">{error}</div>}
  {filename&&<div className="excel-file-info" role="status">Ziraat önizleme: <strong>{filename}</strong> · {records.length} hareket · {extraHeaders.length} ek kaynak sütunu · Veriler yalnızca tarayıcı belleğinde tutulur.</div>}
  <section className="excel-stats" aria-label="Hareket özeti">
   <div className="excel-stat"><span className="excel-stat-icon amber">≡</span><div><span>Okunan hareket</span><strong>{records.length}</strong></div></div>
   <div className="excel-stat"><span className="excel-stat-icon green">↗</span><div><span>Toplam alacak (giriş)</span><strong>{currency(incoming)}</strong></div></div>
   <div className="excel-stat"><span className="excel-stat-icon red">↗</span><div><span>Toplam borç (çıkış)</span><strong>{currency(outgoing)}</strong></div></div>
  </section>
  <section className="excel-table-panel">
   <div className="excel-toolbar">
    <div className="excel-tabs" role="group" aria-label="Hareket türü">
     <button className={filter==='all'?'active':''} onClick={()=>changeFilter('all')}>Tüm İşlemler <small>({records.length})</small></button>
     <button className={filter==='in'?'active':''} onClick={()=>changeFilter('in')}>Gelen / Alacak <small className="green-text">({counts.in})</small></button>
     <button className={filter==='out'?'active':''} onClick={()=>changeFilter('out')}>Giden / Borç <small className="red-text">({counts.out})</small></button>
    </div>
    <div className="excel-table-tools"><label className="excel-search"><span>○</span><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="TCKN, ad soyad veya işlem no ara..." aria-label="Hareket ara"/></label><label className="excel-page-size">Sayfada <select value={perPage} onChange={e=>{setPerPage(Number(e.target.value));setPage(1)}}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select> satır</label></div>
   </div>
   <div className="excel-import-options"><label><input type="checkbox" checked={showExtras} onChange={e=>setShowExtras(e.target.checked)}/> Diğer kaynak sütunları ({extraHeaders.length})</label><span>Ad Soyad tek sütunda, TCKN açık gösterilir. Açıklamadan çıkarılan kişi bilgilerini işlem öncesinde doğrulayın; veriler yalnızca tarayıcı belleğinde tutulur.</span></div>
   <div className="excel-table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Sayfadaki hareketleri seç" checked={allSelected} onChange={toggleAll}/></th>{STANDARD_COLUMNS.map(([key,label])=><th key={key}><button onClick={()=>changeSort(key)}>{label} <span>{sort.key===key?(sort.desc?'↓':'↑'):'↕'}</span></button></th>)}{showExtras&&extraHeaders.map(header=><th key={header}>{header}</th>)}</tr></thead>
   <tbody>{shown.map(r=><tr key={r.id}><td><input type="checkbox" aria-label={(r.reference||'Hareket '+r.id)+' seç'} checked={selected.includes(r.id)} onChange={()=>toggleOne(r.id)}/></td>
    <td>{r.date}</td><td>{r.reference||'—'}</td><td className="excel-description" title={r.description}>{r.description}</td>
    <td><div className="excel-person-cell"><input className="excel-identity-input" aria-label={'Ad Soyad '+r.id} value={r.fullName??[r.firstName,r.lastName].filter(Boolean).join(' ')} placeholder="Ad soyad bulunamadı" onChange={e=>editIdentity(r.id,'fullName',e.target.value)}/></div></td>
    <td><div className="excel-tckn"><input className="excel-identity-input" aria-label={'TCKN '+r.id} inputMode="numeric" maxLength={11} autoComplete="off" value={r.tckn} placeholder="—" onChange={e=>editIdentity(r.id,'tckn',e.target.value.replace(/\D/g,'').slice(0,11))}/></div></td>
    <td className="excel-amount"><span className={`excel-amount-badge ${r.direction==='in'?'in':r.direction==='out'?'out':'unknown'}`} title={r.direction==='in'?'Alacak / Gelen':r.direction==='out'?'Borç / Giden':'Yönü belirsiz'}><span className="excel-amount-kind">{r.direction==='in'?'↑ Gelen':r.direction==='out'?'↓ Giden':'— Belirsiz'}</span><strong>{currency(r.amount)}</strong></span></td>
    {showExtras&&extraHeaders.map(header=><td key={header} title={String(r.rawFields[header]??'')}>{String(r.rawFields[header]??'')}</td>)}
   </tr>)}</tbody></table>
   {!shown.length&&<div className="excel-empty"><span className="excel-empty-icon">↑</span><strong>{records.length?'Aramanıza uygun hareket bulunamadı':'Bu oturumda henüz hareket yok'}</strong><p>{records.length?'Arama veya filtre seçimini değiştirin.':'Ziraat hesap hareketleri .xlsx veya .csv dosyanızı seçin.'}</p></div>}
   </div>
   <footer className="excel-table-footer"><span>{visible.length?((current-1)*perPage+1)+'–'+Math.min(current*perPage,visible.length)+' / '+visible.length+' hareket':'Gösterilecek hareket yok'}{selected.length?' · '+selected.length+' seçili':''}</span><div><button aria-label="Önceki sayfa" disabled={current===1} onClick={()=>setPage(p=>p-1)}>‹</button><span>{current} / {pages}</span><button aria-label="Sonraki sayfa" disabled={current===pages} onClick={()=>setPage(p=>p+1)}>›</button></div></footer>
  </section>
  <p className="excel-demo-disclaimer">Dosya ve TCKN verileri sunucuya gönderilmez; yalnızca bu tarayıcı oturumunda işlenir. TCKN açık görüntülenir ve indirilen CSV’de de yer alır; ekranı ve dosyayı yetkisiz kişilerle paylaşmayın. Otomatik çıkarılan kişi bilgileri hatalı olabileceğinden doğrulanmalıdır. Banka muhasebe kaydı veya resmî fatura oluşturulmaz.</p>
 </div>;
}
