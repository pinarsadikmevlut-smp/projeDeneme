import {useMemo,useRef,useState} from 'react';
import './ExcelYuklePage.css';

const currency=n=>'₺'+new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
const number=value=>{if(typeof value==='number')return value;const raw=String(value??'').replace(/[^\d,.-]/g,'');if(!raw)return 0;const decimal=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;return Number(decimal)||0;};
const normalize=value=>String(value??'').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g,' ');
const pick=(row,keys)=>{for(const key of keys){const hit=Object.keys(row).find(k=>normalize(k)===normalize(key));if(hit&&row[hit]!=null)return row[hit];}return '';};
function toRecords(rows){
 return rows.filter(row=>Object.values(row).some(v=>String(v??'').trim())).map((row,index)=>{
  const typeRaw=normalize(pick(row,['İşlem Tipi','İşlem Türü','Tip','Yön','Giriş Çıkış','Hareket Türü']));
  const amount=number(pick(row,['İşlem Tutarı','Tutar','Toplam','Tutar TL','TL Tutar']));
  const outgoing=typeRaw.includes('çık')||typeRaw.includes('satış')||typeRaw.includes('giden')||amount<0;
  return {id:index+1,date:String(pick(row,['Tarih','İşlem Tarihi','Date'])||'—'),receipt:String(pick(row,['Fiş No','Fiş Numarası','Belge No','Fiş'])||'—'),description:String(pick(row,['Açıklama','İşlem Açıklaması','Description'])||'—'),name:String(pick(row,['Ad Soyad','Müşteri','Cari','Adı Soyadı'])||'—'),tckn:String(pick(row,['TCKN','TC Kimlik No','Kimlik No'])||'—'),gold:number(pick(row,['Gram Altın Karşılığı','Gram Altın','Has Karşılığı','Gram'])),amount:Math.abs(amount),direction:outgoing?'out':'in'};
 });
}
function csvRows(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c===';'||c==='\t')){row.push(cell);cell='';}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const headers=rows.shift()||[];
 return rows.map(cells=>Object.fromEntries(headers.map((h,i)=>[h.trim(),cells[i]||''])));
}
async function parseFile(file){
 if(file.size>10*1024*1024)throw Error('En fazla 10 MB dosya yükleyebilirsiniz.');
 if(/\.csv$/i.test(file.name))return toRecords(csvRows(await file.text()));
 if(/\.xlsx$/i.test(file.name)){
  const ExcelJS=(await import('exceljs')).default;
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet=workbook.worksheets[0];
  if(!sheet)throw Error('Excel dosyasında çalışma sayfası bulunamadı.');
  const raw=[];sheet.eachRow((row)=>raw.push(row.values.slice(1).map(v=>v&&typeof v==='object'?(v.text??v.result??(v instanceof Date?v.toLocaleDateString('tr-TR'):String(v))):v)));
  const headers=(raw.shift()||[]).map(String);
  return toRecords(raw.map(cells=>Object.fromEntries(headers.map((h,i)=>[h,cells[i]??'']))));
 }
 throw Error('Lütfen .xlsx veya .csv uzantılı bir dosya seçin.');
}
const columns=[['date','TARİH'],['receipt','FİŞ NO'],['description','AÇIKLAMA'],['name','AD SOYAD'],['tckn','TCKN'],['gold','GRAM ALTIN KARŞILIĞI'],['amount','İŞLEM TUTARI']];
export default function ExcelYuklePage(){
 const fileRef=useRef(null);
 const [records,setRecords]=useState([]);
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
 const visible=useMemo(()=>records.filter(r=>(filter==='all'||r.direction===filter)&&[r.receipt,r.description,r.name,r.tckn].some(x=>normalize(x).includes(normalize(query)))).sort((a,b)=>{const va=a[sort.key],vb=b[sort.key];const result=typeof va==='number'&&typeof vb==='number'?va-vb:String(va).localeCompare(String(vb),'tr-TR',{numeric:true});return sort.desc?-result:result;}),[records,filter,query,sort]);
 const pages=Math.max(1,Math.ceil(visible.length/perPage));
 const current=Math.min(page,pages);
 const shown=visible.slice((current-1)*perPage,current*perPage);
 const allSelected=shown.length>0&&shown.every(r=>selected.includes(r.id));
 async function upload(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  setBusy(true);setError('');
  try{const next=await parseFile(file);if(!next.length)throw Error('Dosyada okunabilir hareket satırı bulunamadı. Sütun başlıklarını kontrol edin.');setRecords(next);setFilename(file.name);setSelected([]);setPage(1);setFilter('all');}
  catch(err){setError(err.message||'Dosya okunamadı.');}
  finally{setBusy(false);}
 }
 const changeFilter=value=>{setFilter(value);setPage(1);};
 const toggleAll=()=>setSelected(previous=>allSelected?previous.filter(id=>!shown.some(r=>r.id===id)):[...new Set([...previous,...shown.map(r=>r.id)])]);
 const toggleOne=id=>setSelected(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);
 const changeSort=key=>setSort(prev=>({key,desc:prev.key===key?!prev.desc:false}));
 return <div className="excel-page">
  <header className="excel-hero">
   <div className="excel-hero-left"><span className="excel-gem" aria-hidden="true">♢</span><div><h1>Kuyumcu Hesap &amp; Sarrafiye Hareketleri</h1><p>Has Karşılığı Entegrasyonu · e-Arşiv / e-Fatura Otomatik Eşleştirme Paneli</p></div></div>
   <div className="excel-actions"><input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={upload} aria-label="Kuyumcu ekstresi seç"/><button className="excel-btn" onClick={()=>fileRef.current?.click()} disabled={busy}><span>⇧</span>{busy?'Dosya okunuyor...':'Kuyumcu Ekstresi Yükle'}</button><span className="excel-action-count"><b>{records.length}</b> İşlem Kaydı</span><button className="excel-btn excel-export" disabled title="e-Fatura/e-Arşiv entegrasyonu henüz bağlı değil">▤ &nbsp; Seçilenleri e-Fatura/e-Arşiv'e Aktar</button></div>
  </header>
  {error&&<div role="alert" className="excel-error">{error}</div>}
  {filename&&<div className="excel-file-info" role="status">Önizleme: <strong>{filename}</strong> · {records.length} hareket · Yalnızca bu oturumda, tarayıcı belleğinde tutulur.</div>}
  <section className="excel-stats" aria-label="Hareket özeti">
   <div className="excel-stat"><span className="excel-stat-icon amber">≡</span><div><span>Oturumdaki hareket</span><strong>{records.length}</strong></div></div>
   <div className="excel-stat"><span className="excel-stat-icon green">↗</span><div><span>Toplam giriş</span><strong>{currency(incoming)}</strong></div></div>
   <div className="excel-stat"><span className="excel-stat-icon red">↗</span><div><span>Toplam çıkış</span><strong>{currency(outgoing)}</strong></div></div>
  </section>
  <section className="excel-table-panel">
   <div className="excel-toolbar">
    <div className="excel-tabs" role="group" aria-label="Hareket türü">
     <button className={filter==='all'?'active':''} onClick={()=>changeFilter('all')}>Tüm İşlemler <small>({records.length})</small></button>
     <button className={filter==='in'?'active':''} onClick={()=>changeFilter('in')}>Gelen / Alış <small className="green-text">({counts.in})</small></button>
     <button className={filter==='out'?'active':''} onClick={()=>changeFilter('out')}>Giden / Satış <small className="red-text">({counts.out})</small></button>
    </div>
    <div className="excel-table-tools"><label className="excel-search"><span>○</span><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="TCKN, ad soyad veya fiş no ara..." aria-label="Hareket ara"/></label><label className="excel-page-size">Sayfada <select value={perPage} onChange={e=>{setPerPage(Number(e.target.value));setPage(1)}}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select> satır</label></div>
   </div>
   <div className="excel-table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Sayfadaki hareketleri seç" checked={allSelected} onChange={toggleAll}/></th>{columns.map(([key,label])=><th key={key}><button onClick={()=>changeSort(key)}>{label} <span>{sort.key===key?(sort.desc?'↓':'↑'):'↕'}</span></button></th>)}</tr></thead>
   <tbody>{shown.map(r=><tr key={r.id}><td><input type="checkbox" aria-label={r.receipt+' seç'} checked={selected.includes(r.id)} onChange={()=>toggleOne(r.id)}/></td><td>{r.date}</td><td>{r.receipt}</td><td>{r.description}</td><td>{r.name}</td><td>{r.tckn}</td><td>{formatGold(r.gold)}</td><td className="excel-money">{currency(r.amount)}</td></tr>)}</tbody></table>
   {!shown.length&&<div className="excel-empty"><span className="excel-empty-icon">↑</span><strong>{records.length?'Aramanıza uygun hareket bulunamadı':'Bu oturumda henüz hareket yok'}</strong><p>{records.length?'Arama veya filtre seçimini değiştirin.':'Excel Dosyası Seç ve Yükle ile geçici listenizi oluşturun.'}</p></div>}
   </div>
   <footer className="excel-table-footer"><span>{visible.length?((current-1)*perPage+1)+'–'+Math.min(current*perPage,visible.length)+' / '+visible.length+' hareket':'Gösterilecek hareket yok'}{selected.length?' · '+selected.length+' seçili':''}</span><div><button aria-label="Önceki sayfa" disabled={current===1} onClick={()=>setPage(p=>p-1)}>‹</button><span>{current} / {pages}</span><button aria-label="Sonraki sayfa" disabled={current===pages} onClick={()=>setPage(p=>p+1)}>›</button></div></footer>
  </section>
  <p className="excel-demo-disclaimer">Önizleme modudur. Dosya içeriği sunucuya gönderilmez; muhasebe kaydı veya resmi e-Fatura oluşturulmaz.</p>
 </div>;
}
function formatGold(value){return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:4}).format(value);}
