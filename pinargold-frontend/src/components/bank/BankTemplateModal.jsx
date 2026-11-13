import {useEffect,useMemo,useState} from 'react';

export default function BankTemplateModal({rows,templates,busy,onClose,onConfirm}){
 const [query,setQuery]=useState('');
 const [chosen,setChosen]=useState(rows.length===1?rows[0].templateId||'':'');
 const directionCount={in:rows.filter(r=>r.direction==='in').length,out:rows.filter(r=>r.direction==='out').length};
 const filtered=useMemo(()=>templates.filter(template=>
  [template.label,template.subtitle,template.documentType].join(' ')
   .toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))
 ),[templates,query]);
 const selected=templates.find(template=>template.id===chosen);
 const eligible=selected?rows.filter(row=>selected.directions.includes(row.direction)).length:0;
 useEffect(()=>{
  const onKey=event=>{if(event.key==='Escape'&&!busy)onClose();};
  document.addEventListener('keydown',onKey);
  return ()=>document.removeEventListener('keydown',onKey);
 },[busy,onClose]);
 function submit(event){
  event.preventDefault();
  if(!chosen||busy||eligible===0)return;
  onConfirm(chosen);
 }
 return <div className="bank-modal-overlay" onMouseDown={e=>{
  if(e.target===e.currentTarget&&!busy)onClose();
 }}>
  <section role="dialog" aria-modal="true" aria-label="Toplu taslak aktarımı" className="inv-card bank-transfer-modal">
   <div className="bank-modal-head"><div><span className="inv-overline">BELGE ŞABLONU</span><h2>Taslak aktarımı</h2>
    <p>{rows.length} hareket seçildi · {directionCount.in} gelen / {directionCount.out} giden</p></div>
    <button type="button" aria-label="Aktarımı kapat" disabled={busy} onClick={onClose}>✕</button>
   </div>
   <form onSubmit={submit}>
    <label className="inv-field">Şablon ara
     <input autoFocus value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="Altın satışı, hurda alımı, sarrafiye..." aria-label="Şablon ara"/>
    </label>
    <div className="bank-template-list" role="radiogroup" aria-label="Hazır fatura şablonları">
     {filtered.map(t=>{
      const match=rows.filter(row=>t.directions.includes(row.direction)).length;
      return <label key={t.id} className={'bank-template-option '+(chosen===t.id?'selected':'')}>
       <input type="radio" name="template" value={t.id} checked={chosen===t.id}
        disabled={!match||busy} onChange={()=>setChosen(t.id)}/>
       <span><strong>{t.label}</strong><small>{t.subtitle} · {match} uygun hareket</small></span>
       <span className="bank-template-direction">{t.directions.includes('in')?'↙ Gelen':'↗ Giden'}</span>
      </label>;
     })}
     {!filtered.length&&<p className="inv-hint">Aramanıza uygun şablon yok.</p>}
    </div>
    {selected&&eligible<rows.length&&<p className="bank-template-warning" role="status">
     Bu şablon {rows.length-eligible} hareketin yönüyle uyumlu değil. Uygun olmayanlar aktarılmayacak.
    </p>}
    <p className="inv-hint">Önce TCKN ile kendi müşteri listenizde eşleşme aranır. Ürün ve vergi bilgileri doğrulanmamış taslak oluşturulur. Resmî fatura kesilmez.</p>
    <div className="bank-modal-buttons">
     <button type="button" className="inv-outline" disabled={busy} onClick={onClose}>Vazgeç</button>
     <button className="inv-primary" type="submit" disabled={!chosen||!eligible||busy}>
      {busy?'Taslaklar kaydediliyor...':eligible+' hareketi taslağa aktar'}
     </button>
    </div>
   </form>
  </section>
 </div>;
}
