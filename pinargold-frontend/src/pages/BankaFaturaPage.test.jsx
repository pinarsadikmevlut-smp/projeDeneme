// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';

vi.mock('../services/ziraatStatement.service',async original=>{
 const actual=await original();
 return {...actual,loadZiraatFile:vi.fn()};
});
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn()}));
import {loadZiraatFile} from '../services/ziraatStatement.service';
import {apiRequest} from '../services/apiClient';
import BankaFaturaPage from './BankaFaturaPage';

const templates=[
 {id:'altin_satis_arsiv',label:'Altın Satışı',subtitle:'e-Arşiv taslağı',
  documentType:'e-arsiv',directions:['in'],category:'satis'},
 {id:'sarrafiye_satis',label:'Sarrafiye Satışı',subtitle:'e-Arşiv taslağı',
  documentType:'e-arsiv',directions:['in'],category:'satis'},
 {id:'hurda_alimi',label:'Hurda Alımı',subtitle:'Gider pusulası taslağı',
  documentType:'g-pusulasi',directions:['out'],category:'alim'}
];
const sampleRows=[
 {id:1,date:'13.11.2026 12:29',reference:'TEST-FAST-1',
  description:'Gönderen: Örnek Müşteri TCKN: 10000000146',
  fullName:'Örnek Müşteri',tckn:'10000000146',vkn:'',amount:676300,direction:'in',
  rawFields:{Kanal:'FAST'}},
 {id:2,date:'13.11.2026 12:27',reference:'TEST-EFT-2',
  description:'Kurum ödemesi VKN: 1234567890',
  fullName:'Örnek Şirket',tckn:'',vkn:'1234567890',amount:481100,direction:'out',
  rawFields:{Kanal:'EFT'}}
];
const apiResults=(options)=>{
 const records=options.body.records;
 return {created:records.filter(row=>row.direction==='in'&&options.body.templateId==='altin_satis_arsiv').length,
  skipped:records.filter(row=>row.direction!=='in'||options.body.templateId!=='altin_satis_arsiv').length,
  results:records.map(row=>row.direction==='in'&&options.body.templateId==='altin_satis_arsiv'
   ?{rowId:row.rowId,status:'created',invoiceId:9,reference:'PG-TAS-000009'}
   :{rowId:row.rowId,status:'skipped',reason:'corporate_customer_unavailable'})};
};
function renderPage(){
 return render(<MemoryRouter initialEntries={['/banka-fatura']}><Routes>
  <Route path="/banka-fatura" element={<BankaFaturaPage/>}/>
  <Route path="/fatura-olustur" element={<p>Fatura formu</p>}/>
  <Route path="/excel-yukle" element={<p>Excel</p>}/>
 </Routes></MemoryRouter>);
}
async function importFile(){
 fireEvent.change(screen.getByLabelText('Banka ekstresi seç'),{
  target:{files:[new File(['sample'],'ziraat.csv',{type:'text/csv'})]}
 });
 await waitFor(()=>expect(screen.getByText('TEST-FAST-1')).toBeTruthy());
}
beforeEach(()=>{
 loadZiraatFile.mockReset();
 loadZiraatFile.mockResolvedValue({records:sampleRows,extraHeaders:[]});
 apiRequest.mockReset();
 apiRequest.mockImplementation((path,options)=>{
  if(path==='/invoices/templates')return Promise.resolve({templates});
  if(path==='/invoices/bank-import')return Promise.resolve(apiResults(options));
  return Promise.resolve({});
 });
});
afterEach(cleanup);

describe('Banka Hareketleri önizlemesi ve taslak aktarımı',()=>{
 it('loads bank file immediately without page refresh or backend upload, paginated columns and masked identities',async()=>{
  renderPage();
  await importFile();
  for(const title of ['TARİH / SAAT','BANKA / YÖN','AD SOYAD / AÇIKLAMA','TCKN / VKN',
    'İŞLEM TUTARI','FATURA TİPİ','İŞLEMLER']){
   expect(screen.getByText(title)).toBeTruthy();
  }
  expect(screen.getByText('*******0146')).toBeTruthy();
  expect(screen.getByText('******7890')).toBeTruthy();
  expect(screen.queryByText(/10000000146/)).toBeNull();
  expect(screen.getByText('676.300,00 ₺')).toBeTruthy();
  expect(screen.getByText('481.100,00 ₺')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Hızlı taslak aktar 1'}).disabled).toBe(true);
  expect(apiRequest.mock.calls.filter(call=>call[0].includes('bank-import'))).toHaveLength(0);
  expect(apiRequest).toHaveBeenCalledWith('/invoices/templates');
 });
 it('single-row quick transfer uses selected API template and updates row status',async()=>{
  renderPage();await importFile();
  await waitFor(()=>expect(screen.getByLabelText('Fatura tipi 1').options.length).toBe(3));
  fireEvent.change(screen.getByLabelText('Fatura tipi 1'),{target:{value:'altin_satis_arsiv'}});
  fireEvent.click(screen.getByRole('button',{name:'Hızlı taslak aktar 1'}));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/invoices/bank-import',expect.objectContaining({
   method:'POST',body:expect.objectContaining({
    templateId:'altin_satis_arsiv',records:[expect.objectContaining({
     rowId:1,reference:'TEST-FAST-1',amount:676300,direction:'in',tckn:'10000000146'
    })]
   })
  })));
  expect(await screen.findByText(/PG-TAS-000009/)).toBeTruthy();
  expect(screen.getByRole('button',{name:'Hızlı taslak aktar 1'}).disabled).toBe(true);
 });
 it('opens searchable modal for bulk transfer and reports incompatible or unmatched rows',async()=>{
  renderPage();await importFile();
  fireEvent.click(screen.getByRole('button',{name:'Tüm filtrelenmişleri seç (2)'}));
  expect(screen.getByLabelText('Hareket seç 1').checked).toBe(true);
  expect(screen.getByLabelText('Hareket seç 2').checked).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:/Seçilileri Taslağa Aktar/}));
  expect(screen.getByRole('dialog',{name:'Toplu taslak aktarımı'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Şablon ara'),{target:{value:'altın'}});
  expect(screen.getAllByText('Altın Satışı').length).toBeGreaterThan(0);
  expect(screen.queryByText('Hurda Alımı')).toBeNull();
  fireEvent.click(screen.getAllByRole('radio',{name:/Altın Satışı/})[0]);
  expect(screen.getByText(/1 hareketin yönüyle uyumlu değil/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'1 hareketi taslağa aktar'}));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/invoices/bank-import',expect.objectContaining({
   body:expect.objectContaining({templateId:'altin_satis_arsiv',records:expect.arrayContaining([
    expect.objectContaining({rowId:1}),expect.objectContaining({rowId:2})
   ])})
  })));
  expect(await screen.findByText(/1 taslak kaydedildi; 1 hareket kontrol bekliyor/)).toBeTruthy();
  expect(screen.getByText(/VKN kaydı için kurumsal cari desteği henüz yok/)).toBeTruthy();
  expect(screen.queryByRole('dialog',{name:'Toplu taslak aktarımı'})).toBeNull();
 });
 it('selects all filtered items across pagination and chunks bulk requests to 25',async()=>{
  const thirty=Array.from({length:30},(_,i)=>({...sampleRows[0],id:i+1,reference:'TEST-FAST-'+(i+1)}));
  loadZiraatFile.mockResolvedValueOnce({records:thirty,extraHeaders:[]});
  renderPage();
  fireEvent.change(screen.getByLabelText('Banka ekstresi seç'),{
   target:{files:[new File(['batch'],'ziraat.csv',{type:'text/csv'})]}
  });
  await waitFor(()=>expect(screen.getByRole('button',{name:'Tüm filtrelenmişleri seç (30)'})).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'Tüm filtrelenmişleri seç (30)'}));
  expect(screen.getByText('30 hareket seçildi')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Seçilileri Taslağa Aktar/}));
  expect(screen.getByRole('dialog',{name:'Toplu taslak aktarımı'})).toBeTruthy();
  fireEvent.click(screen.getAllByRole('radio',{name:/Altın Satışı/})[0]);
  fireEvent.click(screen.getByRole('button',{name:'30 hareketi taslağa aktar'}));
  await waitFor(()=>expect(apiRequest.mock.calls.filter(call=>call[0]==='/invoices/bank-import').length).toBe(2));
  const sent=apiRequest.mock.calls.filter(call=>call[0]==='/invoices/bank-import').map(call=>call[1].body.records.length);
  expect(sent).toEqual([25,5]);
 });
 it('offers detail, local edit, local deletion, filter and sorting without backend mutations',async()=>{
  renderPage();await importFile();
  fireEvent.click(screen.getByRole('button',{name:'Giden hareketler'}));
  expect(screen.getByText('TEST-EFT-2')).toBeTruthy();
  expect(screen.queryByText('TEST-FAST-1')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Tümü 2'}));
  fireEvent.change(screen.getByLabelText('Banka hareketi ara'),{target:{value:'TEST-FAST-1'}});
  expect(screen.getByText('TEST-FAST-1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'↻ Filtreleri sıfırla'}));
  fireEvent.click(screen.getByRole('button',{name:'Hareket ayrıntısı 1'}));
  expect(screen.getByRole('dialog',{name:'Banka hareketi ayrıntıları'})).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Ayrıntıları kapat'));
  fireEvent.click(screen.getByRole('button',{name:'Hareket düzenle 1'}));
  expect(screen.getByRole('dialog',{name:'Banka hareketi düzenle'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Ad Soyad'),{target:{value:'Düzeltilen Kişi'}});
  fireEvent.click(screen.getByRole('button',{name:'Önizlemeyi güncelle'}));
  expect(screen.getByText('Düzeltilen Kişi')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Hareket sil 1'}));
  expect(screen.queryByText('TEST-FAST-1')).toBeNull();
  expect(apiRequest.mock.calls.filter(call=>call[0].includes('bank-import'))).toHaveLength(0);
 });
});
