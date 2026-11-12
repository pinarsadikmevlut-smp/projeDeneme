import {useEffect,useMemo,useState} from 'react';
import {useDemoCustomers} from '../context/DemoCustomersContext';
import {useAuth} from '../context/AuthContext';
import {apiRequest} from '../services/apiClient';
import {validTckn} from '../services/ziraatStatement.service';
import './MusterilerPage.css';

const INITIAL={fullName:'',tckn:''};
const displayTime=value=>{
 if(!value)return '—';
 const time=new Date(value);
 return Number.isNaN(time.getTime())?'—':time.toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'});
};

export default function MusterilerPage(){
 const {loading:authLoading,authenticated,user,csrfToken,logout,refresh}=useAuth();
 const {customers:demoCustomers,upsert:demoUpsert}=useDemoCustomers();
 const demoMode=!authenticated;
 const [rows,setRows]=useState([]);
 const [total,setTotal]=useState(0);
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [reload,setReload]=useState(0);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [edit,setEdit]=useState(null);
 const [form,setForm]=useState(INITIAL);
 const [saving,setSaving]=useState(false);
 const perPage=25;
 const demoFiltered=useMemo(()=>demoCustomers.filter(r=>[r.fullName,r.tckn].some(v=>String(v).toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')))),[demoCustomers,search]);
 const displayRows=demoMode?demoFiltered.slice((page-1)*perPage,page*perPage):rows;
 const displayTotal=demoMode?demoFiltered.length:total;

 useEffect(()=>{
  if(!authenticated){setRows([]);setTotal(0);return;}
  const controller=new AbortController();
  setLoading(true);setError('');
  apiRequest('/customers?page='+page+'&perPage='+perPage+'&q='+encodeURIComponent(search),{signal:controller.signal})
   .then(data=>{if(!controller.signal.aborted){setRows(data.customers||[]);setTotal(data.total||0);}})
   .catch(e=>{if(!controller.signal.aborted){setError(e.message||'Müşteri listesi yüklenemedi.');if(e.status===401)refresh().catch(()=>{});}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[authenticated,page,search,reload,refresh]);

 const openCreate=()=>{setEdit('new');setForm(INITIAL);setError('');};
 const openEdit=row=>{setEdit(row);setForm({fullName:row.fullName,tckn:row.tckn});setError('');};
 const save=async e=>{
  e.preventDefault();
  if(form.fullName.trim().split(/\s+/).length<2){setError('En az ad ve soyad girin.');return;}
  if(demoMode){
   const result=demoUpsert(form,edit==='new'?null:edit.id);
   if(!result.ok){setError(result.message);return;}
   setNotice(edit==='new'?'Demo müşteri eklendi.':'Demo müşteri güncellendi.');
   setEdit(null);setPage(1);return;
  }
  if(!validTckn(form.tckn)){setError('TCKN 11 haneli ve doğrulama kurallarına uygun olmalıdır.');return;}
  setSaving(true);setError('');
  try{
   const isNew=edit==='new';
   await apiRequest(isNew?'/customers':'/customers/'+edit.id,{
    method:isNew?'POST':'PATCH',
    headers:{'X-CSRF-Token':csrfToken},
    body:{fullName:form.fullName.trim(),tckn:form.tckn}
   });
   setNotice(isNew?'Müşteri kaydı oluşturuldu.':'Müşteri kaydı güncellendi.');
   setEdit(null);setReload(x=>x+1);
  }catch(e){setError(e.message||'Kayıt kaydedilemedi.');}
  finally{setSaving(false);}
 };
 if(authLoading)return <div className="customers-page"><p className="customers-help">Oturum kontrol ediliyor...</p></div>;
 return <div className="customers-page">
  <div className="customers-heading">
   <div><span className="customers-eyebrow">PINARGOLD · MÜŞTERİ YÖNETİMİ</span>
    <h1>Müşteri Listesi</h1>
    <p>{demoMode?'Örnek müşteriler ve Excel aktarımını giriş yapmadan deneyin.':'Excel’den aktarılan ve elle oluşturulan kayıtlar PostgreSQL’de kalıcı tutulur.'}</p></div>
   <div className="customers-heading-actions">
    {authenticated&&<span className="customers-user">● {user?.username||'Yetkili'}</span>}
    {authenticated&&<button className="customers-secondary" onClick={()=>{logout().catch(()=>{});}}>Çıkış</button>}
    <button className="customers-primary" onClick={openCreate}>+ Yeni Müşteri</button>
   </div>
  </div>
  {demoMode&&<div className="customers-privacy" role="status"><strong>DEMO MODU</strong> · Giriş gerekmez. TCKN değerleri örnek ve geçersizdir. Ekleme, düzenleme ve Excel'den aktarılan kişiler yalnızca bu açık sayfa oturumunun belleğindedir; sayfa yenilenirse silinir. Gerçek müşteri verisi kullanmayın. PostgreSQL verileri korunur ve erişime kapalıdır.</div>}
  <div className="customers-stats"><div><span>TOPLAM MÜŞTERİ</span><strong>{displayTotal}</strong></div><div><span>SAYFADAKİ KAYITLAR</span><strong>{displayRows.length}</strong></div><div><span>{demoMode?'VERİ MODU':'VERİTABANI'}</span><strong>{demoMode?'Bellekte Demo':'PostgreSQL'}</strong></div></div>
  <section className="customers-table-panel">
   <div className="customers-toolbar"><div><strong>Kaydedilen müşteriler</strong><span>{demoMode?'Örnek kayıtları ekleyin veya düzenleyin. Gerçek veritabanına yazılmaz.':'TCKN aynıysa tekrar kayıt açılmaz; mevcut kayıt elle güncellenebilir.'}</span></div><label className="customers-search"><span>⌕</span><input aria-label="Müşteri ara" value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Ad soyad veya TCKN ara..."/></label></div>
   {notice&&<p className="customers-success" role="status">{notice}</p>}
   {error&&!edit&&<p className="customers-error" role="alert">{error}</p>}
   <div className="customers-table-scroll">
    <table><thead><tr><th>AD SOYAD</th><th>TCKN</th><th>KAYNAK</th><th>SON GÜNCELLEME</th><th>İŞLEM</th></tr></thead>
    <tbody>{displayRows.map(row=><tr key={row.id}><td><strong>{row.fullName}</strong></td><td className="customers-tckn">{row.tckn}</td><td><span className="customers-source">{row.source==='ziraat_excel'?'Ziraat Excel':row.source==='demo_excel'?'Excel · Demo':demoMode?'Örnek veri':'Elle giriş'}</span></td><td>{displayTime(row.updatedAt)}</td><td><button className="customers-edit" type="button" aria-label={row.fullName+' düzenle'} onClick={()=>openEdit(row)}>Düzenle</button></td></tr>)}</tbody></table>
    {!displayRows.length&&!loading&&<div className="customers-empty">Kayıt bulunamadı. Aramayı değiştirebilir veya yeni müşteri ekleyebilirsiniz.</div>}
    {loading&&<p className="customers-help customers-loading">Müşteriler yükleniyor...</p>}
   </div>
   <footer className="customers-pagination"><span>{displayTotal} kayıt · Sayfa {page} / {Math.max(1,Math.ceil(displayTotal/perPage))}</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Önceki</button><button disabled={page>=Math.ceil(displayTotal/perPage)} onClick={()=>setPage(p=>p+1)}>Sonraki</button></div></footer>
  </section>
  {edit&&<div className="customers-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEdit(null)}}>
   <form className="customers-modal" role="dialog" aria-modal="true" aria-label={edit==='new'?'Yeni müşteri ekle':'Müşteri güncelle'} onSubmit={save}>
    <div className="customers-modal-head"><h2>{edit==='new'?'Yeni Müşteri':'Müşteri Bilgilerini Güncelle'}</h2><button type="button" aria-label="Pencereyi kapat" onClick={()=>{setEdit(null);setError('')}}>✕</button></div>
    <label>Ad Soyad<input required aria-label="Ad Soyad" maxLength={160} value={form.fullName} onChange={e=>setForm(v=>({...v,fullName:e.target.value}))} placeholder="Ad Soyad"/></label>
    <label>TCKN<input required aria-label="TCKN" inputMode="numeric" maxLength={11} value={form.tckn} onChange={e=>setForm(v=>({...v,tckn:e.target.value.replace(/\D/g,'').slice(0,11)}))} placeholder={demoMode?'11 haneli örnek sayı':'11 haneli TC kimlik numarası'}/></label>
    {error&&<p role="alert" className="customers-error">{error}</p>}
    <div className="customers-modal-actions"><button type="button" className="customers-secondary" onClick={()=>{setEdit(null);setError('')}}>Vazgeç</button><button type="submit" className="customers-primary" disabled={saving}>{saving?'Kaydediliyor...':'Kaydet'}</button></div>
   </form>
  </div>}
 </div>;
}
