import {createContext,useCallback,useContext,useMemo,useState} from 'react';

// Synthetic examples only. Deliberately invalid TCKNs: never represent real people.
const EXAMPLES=[
 {id:'demo-1',fullName:'Örnek Müşteri Bir',tckn:'00000000000',source:'demo',updatedAt:null},
 {id:'demo-2',fullName:'Örnek Müşteri İki',tckn:'00000000001',source:'demo',updatedAt:null},
 {id:'demo-3',fullName:'Örnek Müşteri Üç',tckn:'00000000002',source:'demo',updatedAt:null}
];
const DemoContext=createContext(null);
const normalized=value=>String(value??'').trim();
const isCandidate=row=>normalized(row?.fullName).split(/\s+/).length>=2 && /^\d{11}$/.test(normalized(row?.tckn));

export function DemoCustomersProvider({children}){
 // Only RAM: no localStorage, remote API, sessionStorage or persistent database.
 const [customers,setCustomers]=useState(EXAMPLES);
 const upsert=useCallback((value,id)=>{
  const fullName=normalized(value.fullName).replace(/\s+/g,' ');
  const tckn=normalized(value.tckn);
  if(!isCandidate({fullName,tckn}))return {ok:false,message:'Ad Soyad ve 11 rakamdan oluşan örnek TCKN girin.'};
  const conflict=customers.some(row=>row.tckn===tckn&&row.id!==id);
  if(conflict)return {ok:false,message:'Bu TCKN zaten demo listesinde bulunuyor.'};
  if(id!=null && !customers.some(row=>row.id===id))return {ok:false,message:'Kayıt bulunamadı.'};
  const nextRow={id:id??'demo-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
   fullName,tckn,source:'demo',updatedAt:new Date().toISOString()};
  setCustomers(prev=>id==null?[nextRow,...prev]:prev.map(row=>row.id===id?{...nextRow,source:row.source}:row));
  return {ok:true};
 },[customers]);
 const importCustomers=useCallback(rows=>{
  const current=new Set(customers.map(row=>row.tckn));
  const newlySeen=new Set();
  const additions=[];
  let existing=0,invalid=0;
  for(const row of rows){
   if(!isCandidate(row)){invalid++;continue;}
   const tckn=normalized(row.tckn);
   if(current.has(tckn)||newlySeen.has(tckn)){existing++;continue;}
   newlySeen.add(tckn);
   additions.push({id:'demo-import-'+Date.now()+'-'+additions.length,
    fullName:normalized(row.fullName).replace(/\s+/g,' '),tckn,
    source:'demo_excel',updatedAt:new Date().toISOString()});
  }
  if(additions.length)setCustomers(prev=>[...additions,...prev]);
  return {created:additions.length,existing,invalid};
 },[customers]);
 const value=useMemo(()=>({customers,upsert,importCustomers}),[customers,upsert,importCustomers]);
 return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
export function useDemoCustomers(){
 const value=useContext(DemoContext);
 if(!value)throw Error('useDemoCustomers requires DemoCustomersProvider');
 return value;
}
