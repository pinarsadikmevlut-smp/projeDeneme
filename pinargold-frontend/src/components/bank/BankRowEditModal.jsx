import {useState} from 'react';
export default function BankRowEditModal({row,onClose,onSave}){
 const [form,setForm]=useState({
  fullName:row.fullName||'',tckn:row.tckn||'',vkn:row.vkn||'',
  reference:row.reference||'',amount:String(row.amount||''),date:row.date||''
 });
 const [error,setError]=useState('');
 const change=(field,value)=>setForm(old=>({...old,[field]:value}));
 function save(event){
  event.preventDefault();
  if(!form.reference.trim()||form.reference.length>80){
   setError('İşlem referansı zorunludur (en fazla 80 karakter).');return;
  }
  const amount=Number(form.amount);
  if(!Number.isFinite(amount)||amount<=0||amount>100000000||Math.abs(Math.round(amount*100)-amount*100)>1e-6){
   setError('Geçerli ve pozitif bir işlem tutarı girin.');return;
  }
  if(form.tckn&&!/^\d{11}$/.test(form.tckn)){
   setError('TCKN 11 hane olmalı.');return;
  }
  if(form.vkn&&!/^\d{10}$/.test(form.vkn)){
   setError('VKN 10 hane olmalı.');return;
  }
  onSave({...row,...form,reference:form.reference.trim(),amount,
   description:row.description,fullName:form.fullName.trim()});
 }
 return <div className="bank-modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <section role="dialog" aria-modal="true" aria-label="Banka hareketi düzenle" className="inv-card bank-modal">
   <div className="bank-modal-head"><h2>Önizleme kaydını düzenle</h2>
    <button aria-label="Düzenlemeyi kapat" onClick={onClose}>✕</button>
   </div>
   <form onSubmit={save} className="bank-edit-form">
    <label className="inv-field">Tarih / Saat<input required value={form.date} onChange={e=>change('date',e.target.value)}/></label>
    <label className="inv-field">İşlem referansı<input required maxLength={80} value={form.reference} onChange={e=>change('reference',e.target.value)}/></label>
    <label className="inv-field">Ad Soyad<input maxLength={160} value={form.fullName} onChange={e=>change('fullName',e.target.value)}/></label>
    <label className="inv-field">TCKN<input inputMode="numeric" maxLength={11} value={form.tckn} onChange={e=>change('tckn',e.target.value)}/></label>
    <label className="inv-field">VKN<input inputMode="numeric" maxLength={10} value={form.vkn} onChange={e=>change('vkn',e.target.value)}/></label>
    <label className="inv-field">Tutar (TL)<input required type="number" step="0.01" min="0.01" value={form.amount} onChange={e=>change('amount',e.target.value)}/></label>
    {error&&<p role="alert" className="inv-error">{error}</p>}
    <p className="inv-hint">Değişiklikler yalnızca tarayıcıdaki önizlemeyi düzenler. Gerçek banka kaydı veya müşteri kartı değiştirilmez.</p>
    <div className="bank-modal-buttons"><button type="button" className="inv-outline" onClick={onClose}>İptal</button>
     <button type="submit" className="inv-primary">Önizlemeyi güncelle</button></div>
   </form>
  </section>
 </div>;
}
