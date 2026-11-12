// Ziraat Bankası Excel / CSV hesap hareketleri: local-only, no server upload.
const FIELDS = {
 date:['Muh Tarih','Muhasebe Tarihi','İşlem Tarihi','Tarih','Hareket Tarihi','Date'],
 valueDate:['Valör','Valör Tarihi','Valor','Value Date'],
 reference:['İşlem No','İşlem Numarası','İşlem Referansı','Referans','Fiş No','Fiş Numarası','Dekont No','Sıra No','Belge No'],
 description:['İşlem Açıklaması','Açıklama','Hareket Açıklaması','İşlem Detayı','Description'],
 debit:['Borç','Borç Tutarı','Çıkış','Çıkan','Giden Tutar'],
 credit:['Alacak','Alacak Tutarı','Giriş','Giren','Gelen Tutar'],
 balance:['Bakiye','Kalan Bakiye','Hesap Bakiyesi','Balance'],
 amount:['Tutar','İşlem Tutarı','Tutar TL','TL Tutar','İşlem Tutarı (TL)'],
 direction:['İşlem Türü','İşlem Tipi','Yön','Giriş Çıkış'],
 tckn:['TCKN','TC Kimlik No','T.C. Kimlik No','Kimlik No'],
 fullName:['Ad Soyad','Adı Soyadı','İsim Soyisim','Gönderen Ad Soyad','Müşteri']
};
export const STANDARD_COLUMNS = [
 ['date','MUH. TARİH'],['reference','İŞLEM NO'],
 ['description','İŞLEM AÇIKLAMASI'],['fullName','AD SOYAD'],['tckn','TCKN'],
 ['amount','İŞLEM TUTARI']
];
export const cleanHeader = x => String(x??'').toLocaleLowerCase('tr-TR')
 .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
 .replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]+/g,' ').trim();
const FIELD_ALIASES=Object.fromEntries(Object.entries(FIELDS).map(([key,arr])=>[key,new Set(arr.map(cleanHeader))]));
const stringValue = value => value==null?'':String(value).trim();
const normText=value=>stringValue(value).replace(/\s+/g,' ').trim();

export function parseMoney(value){
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 let str=stringValue(value).replace(/\s|₺|TL|TRY/gi,'');
 if(!str || str==='-')return null;
 let negative=false;
 if(/^\(.*\)$/.test(str)){negative=true;str=str.slice(1,-1);}
 if(str.startsWith('-')){negative=true;str=str.slice(1);}
 if(str.endsWith('-')){negative=true;str=str.slice(0,-1);}
 if(!/^\d[\d.,]*$/.test(str))return null;
 const lastComma=str.lastIndexOf(','),lastDot=str.lastIndexOf('.');
 if(lastComma!==-1&&lastDot!==-1){
  const decimal=lastComma>lastDot?',':'.';
  str=str.split(decimal).join('#').replace(/[.,]/g,'').replace('#','.');
 }else if(lastComma!==-1){str=str.replace(/\./g,'').replace(',','.');}
 else if(lastDot!==-1){
  const parts=str.split('.');
  if(parts.length>2||parts.length===2&&parts[1].length===3)str=parts.join('');
 }
 const n=Number(str);
 return Number.isFinite(n)?(negative?-n:n):null;
}
function excelDate(value){
 if(value instanceof Date&&!Number.isNaN(+value)){
  return [String(value.getUTCDate()).padStart(2,'0'),String(value.getUTCMonth()+1).padStart(2,'0'),value.getUTCFullYear()].join('.');
 }
 if(typeof value==='number'&&value>20000&&value<100000){
  const date=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);
  return excelDate(date);
 }
 return normText(value);
}
export function validTckn(v){
 const s=String(v||'');
 if(!/^[1-9]\d{10}$/.test(s))return false;
 const a=[...s].map(Number);
 return ((a[0]+a[2]+a[4]+a[6]+a[8])*7-(a[1]+a[3]+a[5]+a[7]))%10===a[9]
  && a.slice(0,10).reduce((sum,n)=>sum+n,0)%10===a[10];
}
const LETTERS='A-Za-zÇĞİÖŞÜçğıöşü';
const NAME_RE=new RegExp('(?:G[ÖO]NDEREN|ALICI|AD[Iİ]?\\s+SOYAD[Iİ]?|ADI\\s+SOYADI|KARŞI\\s+TARAF|HESAP\\s+SAHİBİ|M[ÜU]ŞTERİ)(?:\\s+(?:AD[Iİ]?|SOYAD[Iİ]?)){0,2}\\s*[:=\\-]?\\s*(['+LETTERS+']+(?:\\s+['+LETTERS+']+){1,6})','i');
// Uppercase runs are only a HEURISTIC. Financial transaction words must not be treated as names.
const NON_NAME_TERMS=new Set((
 'FAST EFT HAVALE GELEN GIDEN GİDEN GÖNDEREN GONDEREN GÖNDERİCİ GONDERICI '+
 'ALICI ALICIYA GÖNDERİLEN GONDERILEN GÖNDERİM GONDERIM TARAFINDAN '+
 'PARA TRANSFER TRANSFERİ TRANSFERI İŞLEM ISLEM İŞLEMİ ISLEMI HAREKET '+
 'BANKA BANKASI ZİRAAT ZIRAAT TÜRKİYE TURKIYE TC TCKN IBAN HESAP '+
 'AÇIKLAMA ACIKLAMA REFERANS REF DEKONT NO NUMARASI KOD KODU '+
 'ÖDEME ODEME ÖDEMESİ ODEMESI TAHSİLAT TAHSILAT KREDİ KREDI KARTI '+
 'FATURA FATURASI FATURAÖDEMESİ MASRAF MASRAFI KOMİSYON KOMISYON '+
 'POS ATM SWIFT BSMV BAHŞİŞ KDV VİRMAN VIRMAN TUTAR BAKİYE BAKIYE '+
 'SAYIN HİZMET HIZMET BEDELİ BEDELI İADE IADE GELİŞ GELIS '+
 'TİCARET TICARET LİMİTED LIMITED ŞİRKET ŞIRKET ŞİRKETİ SIRKETI '+
 'ANONİM ANONIM AŞ AS LTD STI ŞTİ IBANLI SORGULAMA'
).split(/\s+/).map(cleanHeader));
const UPPER_WORD='[A-ZÇĞİÖŞÜ]{2,}(?:[\\x27’][A-ZÇĞİÖŞÜ]+)?';
const UPPER_RUN=new RegExp('(?<![A-Za-zÇĞİÖŞÜçğıöşü])'+UPPER_WORD+'(?:\\s+'+UPPER_WORD+'){1,15}','g');
const NAME_STOP=/\b(?:TCKN|IBAN|TC|FAST|EFT|HAVALE|AÇIKLAMA|REFERANS|GÖNDEREN|ALICI)\b/i;

export function splitFullName(text){
 const names=normText(text).split(' ').filter(Boolean);
 if(names.length<2||names.length>5||names.some(x=>
    !new RegExp('^['+LETTERS+']+$').test(x)||
    NON_NAME_TERMS.has(cleanHeader(x))||NAME_STOP.test(x)))return null;
 return {firstName:names.slice(0,-1).join(' '),lastName:names.at(-1)};
}
function labelledName(text){
 const match=text.match(NAME_RE);
 if(!match)return null;
 const valid=[];
 for(const word of match[1].split(/\s+/)){
  if(NON_NAME_TERMS.has(cleanHeader(word)))break;
  valid.push(word);
 }
 return splitFullName(valid.join(' '));
}
function uppercaseName(text){
 // Only contiguous Turkish uppercase words; split on known bank-operation keywords.
 // In ambiguous prose, show a review indicator so the operator can verify the result.
 let best=null;
 const cleaned=text.replace(/(?<!\d)[1-9]\d{10}(?!\d)/g,' ');
 for(const match of cleaned.matchAll(UPPER_RUN)){
  let words=[];
  const consider=()=>{
   const candidate=splitFullName(words.join(' '));
   if(candidate&&(!best||words.length>best.words))best={...candidate,words:words.length};
   words=[];
  };
  for(const word of match[0].split(/\s+/)){
   if(NON_NAME_TERMS.has(cleanHeader(word)))consider();
   else words.push(word);
  }
  consider();
 }
 return best?{firstName:best.firstName,lastName:best.lastName}:null;
}
export function parseIdentity(description, explicitTckn='', explicitName=''){
 const original=normText(description);
 const labelled=original.match(/(?:TCKN|T\.?\s*C\.?\s*K[İI]ML[İI]K\s*(?:NO|NUMARASI)?|TC\s*NO)\s*[:=./-]?\s*(\d{11})(?!\d)/i);
 const standalone=[...original.matchAll(/(?<!\d)([1-9]\d{10})(?!\d)/g)].map(x=>x[1]);
 const id=stringValue(explicitTckn).replace(/\D/g,'').slice(0,11);
 const tckn=(id.length===11?id:'')||labelled?.[1]||standalone.find(validTckn)||'';
 const explicit=splitFullName(explicitName);
 const tagged=explicit?null:labelledName(original);
 const upper=explicit||tagged?null:uppercaseName(original);
 const parsed=explicit||tagged||upper;
 const identitySource=explicit?'Sütun':tagged?'Açıklama':upper?'Açıklama (BÜYÜK HARF)':'Bulunamadı';
 return {
  firstName:parsed?.firstName||'',lastName:parsed?.lastName||'',tckn,
  identityReview:!!(tckn&&!validTckn(tckn))||!parsed||!!upper,
  identitySource
 };
}

const headerLookup=header=>{
 const h=cleanHeader(header);
 return Object.entries(FIELD_ALIASES).find(([,values])=>values.has(h))?.[0]||null;
};
function detectHeaderIndex(raw){
 let best={idx:-1,score:0};
 for(let i=0;i<Math.min(raw.length,60);i++){
  const mapped=raw[i].map(headerLookup);
  const score=new Set(mapped.filter(Boolean)).size;
  const hasDate=mapped.includes('date'),hasDescription=mapped.includes('description');
  const hasValue=mapped.some(x=>['debit','credit','amount'].includes(x));
  if(hasDate&&hasDescription&&hasValue&&score>best.score)best={idx:i,score};
 }
 return best.idx;
}
export function recordsFromMatrix(matrix){
 const raw=matrix.filter(row=>Array.isArray(row)&&row.some(x=>normText(x)!==''));
 const headerAt=detectHeaderIndex(raw);
 if(headerAt===-1)throw Error('Ziraat sütun başlıkları bulunamadı. Tarih, Açıklama ve Borç/Alacak veya Tutar alanları gerekli.');
 const headers=raw[headerAt].map((x,i)=>normText(x)||'Sütun '+(i+1));
 const mapped=headers.map(headerLookup);
 const get=(row,key)=>{const i=mapped.indexOf(key);return i<0?'':row[i]??'';};
 const records=[];
 for(const row of raw.slice(headerAt+1)){
  const date=excelDate(get(row,'date'));
  const description=normText(get(row,'description'));
  const debitValue=parseMoney(get(row,'debit')),creditValue=parseMoney(get(row,'credit'));
  const signed=parseMoney(get(row,'amount'));
  let debit=debitValue==null?0:Math.abs(debitValue),credit=creditValue==null?0:Math.abs(creditValue);
  const type=cleanHeader(get(row,'direction'));
  if(debitValue==null&&creditValue==null&&signed!==null){
   const out=signed<0||/cikis|giden|borc/.test(type);
   if(out)debit=Math.abs(signed);else credit=Math.abs(signed);
  }
  if(!date||/^(toplam|genel toplam|muh(?:asebe)? tarih|tarih)$/i.test(date)||!description&&debit===0&&credit===0)continue;
  const person=parseIdentity(description,get(row,'tckn'),get(row,'fullName'));
  const rowFields=Object.fromEntries(headers.map((h,i)=>[h,['date','valueDate'].includes(mapped[i])?excelDate(row[i]):normText(row[i])]));
  records.push({
   id:records.length+1,date,valueDate:excelDate(get(row,'valueDate')),
   reference:normText(get(row,'reference')),description,
   debit,credit,balance:parseMoney(get(row,'balance')),
   amount:credit>0?credit:debit,direction:credit>0?'in':debit>0?'out':'unknown',
   ...person,fullName:[person.firstName,person.lastName].filter(Boolean).join(' '),rawFields:rowFields
  });
 }
 if(!records.length)throw Error('Okunabilir hesap hareketi bulunamadı.');
 const extraHeaders=headers.filter((h,i)=>!mapped[i]);
 return {records,extraHeaders,headers};
}
export function csvToMatrix(content){
 const first=content.replace(/^\uFEFF/,'').split(/\r?\n/).find(line=>line.trim())||'';
 const candidates=[';','\t',','];
 const delimiter=candidates.map(d=>({d,n:first.split(d).length-1})).sort((a,b)=>b.n-a.n)[0].d;
 const rows=[];let row=[],cell='',quoted=false;
 const text=content.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&c===delimiter){row.push(cell);cell='';}
  else if(!quoted&&(c==='\r'||c==='\n')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 row.push(cell);if(row.some(s=>s.trim()))rows.push(row);
 return rows;
}
function valueOfCell(cell){
 const value=cell.value;
 if(value==null)return '';
 if(value instanceof Date)return value;
 if(typeof value==='object'){
  if('result' in value)return value.result;
  if('text' in value)return value.text;
  if(Array.isArray(value.richText))return value.richText.map(x=>x.text||'').join('');
 }
 return value;
}
export async function loadZiraatFile(file){
 if(!file||file.size>10*1024*1024)throw Error('En fazla 10 MB dosya yükleyebilirsiniz.');
 const name=file.name.toLowerCase();
 if(name.endsWith('.csv')){
  const bytes=await file.arrayBuffer();
  let content;
  try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{content=new TextDecoder('windows-1254').decode(bytes);}
  return recordsFromMatrix(csvToMatrix(content));
 }
 if(name.endsWith('.xls'))throw Error('Eski .xls biçimini Excel içinde .xlsx olarak kaydedip yeniden yükleyin.');
 if(!name.endsWith('.xlsx'))throw Error('Lütfen .xlsx veya .csv dosyası seçin.');
 const ExcelJS=(await import('exceljs')).default;
 const wb=new ExcelJS.Workbook();
 await wb.xlsx.load(await file.arrayBuffer());
 for(const ws of wb.worksheets){
  const matrix=[];
  ws.eachRow({includeEmpty:false},row=>{
   const vals=[];
   for(let n=1;n<=Math.min(row.cellCount,90);n++)vals.push(valueOfCell(row.getCell(n)));
   matrix.push(vals);
  });
  try{return recordsFromMatrix(matrix);}
  catch(e){if(ws===wb.worksheets.at(-1))throw e;}
 }
 throw Error('Excel içinde hesap hareketi sayfası bulunamadı.');
}
export function maskTckn(v){const s=String(v||'');return s.length===11?'*******'+s.slice(-4):'—';}
function safeCsvCell(v){
 let text=String(v??'');
 if(/^[\t\r\n =+\-@]/.test(text))text="'"+text; // prevent Excel formula injection
 return '"'+text.replace(/"/g,'""')+'"';
}
export function enrichedCsv(records,extraHeaders=[]){
 const headers=['Muh Tarih','İşlem No','İşlem Açıklaması','Ad Soyad','TCKN','İşlem Tutarı','İşlem Yönü',...extraHeaders];
 const rows=records.map(r=>[r.date,r.reference,r.description,
  r.fullName??[r.firstName,r.lastName].filter(Boolean).join(' '),
  r.tckn,r.amount,r.direction==='in'?'Gelen':r.direction==='out'?'Giden':'Belirsiz',
  ...extraHeaders.map(h=>r.rawFields[h])]);
 return '\uFEFF'+[headers,...rows].map(row=>row.map(safeCsvCell).join(';')).join('\r\n');
}
