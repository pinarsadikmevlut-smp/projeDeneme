import {useEffect,useState} from 'react';
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
 const {loading:authLoading,authenticated,user,csrfToken,login,logout,refresh}=useAuth();
 const [username,setUsername]=useState('');
 const [password,setPassword]=useState('');
 const [loginError,setLoginError]=useState('');
 const [loginBusy,setLoginBusy]=useState(false);
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

 const onLogin=async e=>{
  e.preventDefault();setLoginBusy(true);setLoginError('');
  try{await login(username.trim(),password);setPassword('');setReload(n=>n+1);}
  catch(e){setLoginError(e.message||'Giriş başarısız.');}
  finally{setLoginBusy(false);}
 };
 const openCreate=()=>{setEdit('new');setForm(INITIAL);setError('');};
 const openEdit=row=>{setEdit(row);setForm({fullName:row.fullName,tckn:row.tckn});setError('');};
 const save=async e=>{
  e.preventDefault();
  if(!validTckn(form.tckn)){setError('TCKN 11 haneli ve doğrulama kurallarına uygun olmalıdır.');return;}
  if(form.fullName.trim().split(/\s+/).length<2){setError('En az ad ve soyad girin.');return;}
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
 if(!authenticated)return <div className="customers-page">
   <div className="customers-login-layout">
    <div className="customers-intro">
     <span className="customers-eyebrow">PINARGOLD · KALICI KAYITLAR</span>
     <h1>Müşteri Listesi</h1>
     <p>Ziraat Bankası Excel hareketlerinden aktarılan müşterileri güvenli biçimde yönetin. Müşteriler mevcut PostgreSQL veritabanında tutulur.</p>
     <div className="customers-privacy">TCKN içeren müşteri kayıtları yalnızca yetkili yönetici oturumunda görüntülenir. Excel sayfasındaki veriler oturum açmadan veritabanına yazılmaz.</div>
    </div>
    <form className="customers-login-card" onSubmit={onLogin}>
     <div className="customers-card-title">Müşteri yönetimi girişi</div>
     <label>Kullanıcı adı<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Yönetici kullanıcı adı"/></label>
     <label>Parola<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Yönetici parolası"/></label>
     {loginError&&<p role="alert" className="customers-error">{loginError}</p>}
     <button className="customers-primary" type="submit" disabled={loginBusy}>{loginBusy?'Giriş yapılıyor...':'Giriş Yap'}</button>
     <p className="customers-help">Hesap bilgileri sunucunun <code>.env</code> ayarlarından tanımlanır. Tarayıcıda parola saklanmaz.</p>
    </form>
   </div>
  </div>;
 return <div className="customers-page">
  <div className="customers-heading">
   <div><span className="customers-eyebrow">PINARGOLD · MÜŞTERİ YÖNETİMİ</span>
    <h1>Müşteri Listesi</h1>
    <p>Excel’den aktarılan ve elle oluşturulan kayıtlar PostgreSQL’de kalıcı tutulur.</p></div>
   <div className="customers-heading-actions">
    <span className="customers-user">● {user?.username||'Yetkili'}</span>
    <button className="customers-secondary" onClick={()=>{logout().catch(()=>{});}}>Çıkış</button>
    <button className="customers-primary" onClick={openCreate}>+ Yeni Müşteri</button>
   </div>
  </div>
  <div className="customers-stats"><div><span>TOPLAM MÜŞTERİ</span><strong>{total}</strong></div><div><span>SAYFADAKİ KAYITLAR</span><strong>{rows.length}</strong></div><div><span>VERİTABANI</span><strong>PostgreSQL</strong></div></div>
  <section className="customers-table-panel">
   <div className="customers-toolbar"><div><strong>Kaydedilen müşteriler</strong><span>TCKN aynıysa tekrar kayıt açılmaz; mevcut kayıt elle güncellenebilir.</span></div><label className="customers-search"><span>⌕</span><input aria-label="Müşteri ara" value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Ad soyad veya TCKN ara..."/></label></div>
   {notice&&<p className="customers-success" role="status">{notice}</p>}
   {error&&!edit&&<p className="customers-error" role="alert">{error}</p>}
   <div className="customers-table-scroll">
    <table><thead><tr><th>AD SOYAD</th><th>TCKN</th><th>KAYNAK</th><th>SON GÜNCELLEME</th><th>İŞLEM</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.fullName}</strong></td><td className="customers-tckn">{row.tckn}</td><td><span className="customers-source">{row.source==='ziraat_excel'?'Ziraat Excel':'Elle giriş'}</span></td><td>{displayTime(row.updatedAt)}</td><td><button className="customers-edit" type="button" aria-label={row.fullName+' düzenle'} onClick={()=>openEdit(row)}>Düzenle</button></td></tr>)}</tbody></table>
    {!rows.length&&!loading&&<div className="customers-empty">Henüz kayıt bulunmuyor. Excel Yükle ekranından dosya yükleyebilir veya yeni müşteri ekleyebilirsiniz.</div>}
    {loading&&<p className="customers-help customers-loading">Müşteriler yükleniyor...</p>}
   </div>
   <footer className="customers-pagination"><span>{total} kayıt · Sayfa {page} / {Math.max(1,Math.ceil(total/perPage))}</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Önceki</button><button disabled={page>=Math.ceil(total/perPage)} onClick={()=>setPage(p=>p+1)}>Sonraki</button></div></footer>
  </section>
  {edit&&<div className="customers-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEdit(null)}}>
   <form className="customers-modal" role="dialog" aria-modal="true" aria-label={edit==='new'?'Yeni müşteri ekle':'Müşteri güncelle'} onSubmit={save}>
    <div className="customers-modal-head"><h2>{edit==='new'?'Yeni Müşteri':'Müşteri Bilgilerini Güncelle'}</h2><button type="button" aria-label="Pencereyi kapat" onClick={()=>{setEdit(null);setError('')}}>✕</button></div>
    <label>Ad Soyad<input required aria-label="Ad Soyad" maxLength={160} value={form.fullName} onChange={e=>setForm(v=>({...v,fullName:e.target.value}))} placeholder="Ad Soyad"/></label>
    <label>TCKN<input required aria-label="TCKN" inputMode="numeric" maxLength={11} value={form.tckn} onChange={e=>setForm(v=>({...v,tckn:e.target.value.replace(/\D/g,'').slice(0,11)}))} placeholder="11 haneli TC kimlik numarası"/></label>
    {error&&<p role="alert" className="customers-error">{error}</p>}
    <div className="customers-modal-actions"><button type="button" className="customers-secondary" onClick={()=>{setEdit(null);setError('')}}>Vazgeç</button><button type="submit" className="customers-primary" disabled={saving}>{saving?'Kaydediliyor...':'Kaydet'}</button></div>
   </form>
  </div>}
 </div>;
}
