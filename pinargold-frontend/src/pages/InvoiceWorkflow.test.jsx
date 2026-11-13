// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';

vi.mock('../services/apiClient',()=>({apiRequest:vi.fn()}));
import {apiRequest} from '../services/apiClient';
import FaturaOlusturPage from './FaturaOlusturPage';
import InvoiceQueuePage from './InvoiceQueuePage';

afterEach(()=>{cleanup();vi.resetAllMocks()});
beforeEach(()=>{apiRequest.mockReset()});

const customer={id:7,fullName:'Örnek Müşteri',tckn:'00000000000'};
function renderBuilder(initialEntries=['/fatura-olustur']){
 return render(<MemoryRouter initialEntries={initialEntries}><Routes>
  <Route path="/fatura-olustur" element={<FaturaOlusturPage/>}/>
  <Route path="/taslak-faturalar" element={<p>Taslak ekranı</p>}/>
  <Route path="/musteriler" element={<p>Müşteri kartları</p>}/>
 </Routes></MemoryRouter>);
}
function renderQueue(mode='drafts'){
 return render(<MemoryRouter><InvoiceQueuePage mode={mode}/></MemoryRouter>);
}

describe('Fatura oluşturma',()=>{
 it('loads customer selector and saves a draft without sending official invoice',async()=>{
  apiRequest.mockImplementation(path=>{
   if(path.startsWith('/customers'))return Promise.resolve({customers:[customer]});
   if(path==='/invoices')return Promise.resolve({invoice:{reference:'PG-TAS-000001'}});
   return Promise.resolve({});
  });
  renderBuilder();
  expect(await screen.findByText('Örnek Müşteri')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Müşteri / Cari'),{target:{value:'7'}});
  fireEvent.change(screen.getByLabelText('Birim fiyat (₺/gr)'),{target:{value:'2500'}});
  fireEvent.click(screen.getByRole('button',{name:/Taslağı PostgreSQL’e kaydet/}));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/invoices',expect.objectContaining({
   method:'POST',body:expect.objectContaining({
    customerId:7,documentType:'e-arsiv',paymentMethod:'Nakit',
    lines:[expect.objectContaining({name:'22 Ayar Bilezik',karat:'22',fineness:'0.916'})]
   })
  })));
  expect(await screen.findByText('Taslak ekranı')).toBeTruthy();
 });
 it('requires manual product identification for imported bank statements',async()=>{
  apiRequest.mockResolvedValue({customers:[customer]});
  renderBuilder([{pathname:'/fatura-olustur',state:{bank:{reference:'BANK-123',amount:4000}}}]);
  expect(await screen.findByText('Örnek Müşteri')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Müşteri / Cari'),{target:{value:'7'}});
  fireEvent.click(screen.getByRole('button',{name:/Taslağı PostgreSQL’e kaydet/}));
  expect(screen.getByRole('alert').textContent).toContain('Ürün adını doğrulayarak değiştirin');
  expect(apiRequest).not.toHaveBeenCalledWith('/invoices',expect.anything());
 });
});

describe('Taslak kontrol ve Mysoft kuyruğu',()=>{
 const row={id:10,reference:'PG-TAS-000010',customerName:'Örnek Müşteri',
  documentType:'e-arsiv',source:'manual',status:'draft',total:'1250.00',
  createdAt:'2026-11-13T08:00:00+00:00'};
 it('shows draft and moves it into review-ready status',async()=>{
  apiRequest.mockImplementation((path,opts)=>{
   if(path==='/invoices')return Promise.resolve({invoices:[row],total:1});
   if(path==='/invoices/10/review')return Promise.resolve({invoice:{...row,status:'ready'}});
   return Promise.resolve({});
  });
  renderQueue();
  expect(await screen.findByText('PG-TAS-000010')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Kontrol edildi · Hazırla'}));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/invoices/10/review',{method:'POST'}));
 });
 it('simulates transfer without calling Mysoft or GIB service',async()=>{
  const ready={...row,status:'ready'};
  apiRequest.mockImplementation((path,opts)=>{
   if(path==='/invoices')return Promise.resolve({invoices:[ready],total:1});
   if(path==='/invoices/10/simulate-transfer')return Promise.resolve({
    invoice:{...ready,status:'simulated'},message:'DEMO'});
   return Promise.resolve({});
  });
  renderQueue('transfer');
  expect(await screen.findByText('PG-TAS-000010')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Aktarımı simüle et'}));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/invoices/10/simulate-transfer',{method:'POST'}));
  expect(await screen.findByText(/Mysoft veya GİB sistemine aktarım yapılmadı/)).toBeTruthy();
  expect(apiRequest.mock.calls.every(call=>call[0].startsWith('/invoices'))).toBe(true);
 });
});

describe('Banka belge şablonu aktarımı',()=>{
 it('prefills G.P. from the selected outgoing bank transaction and keeps required product review',async()=>{
  apiRequest.mockResolvedValue({customers:[customer]});
  renderBuilder([{pathname:'/fatura-olustur',state:{bank:{
   reference:'GP-DEMO-01',amount:1500,direction:'out',documentType:'g-pusulasi'
  }}}]);
  expect(await screen.findByText('Örnek Müşteri')).toBeTruthy();
  expect(screen.getByRole('heading',{name:'Yeni gider pusulası taslağı'})).toBeTruthy();
  expect(screen.getByLabelText('Belge tipi').value).toBe('g-pusulasi');
  fireEvent.change(screen.getByLabelText('Müşteri / Cari'),{target:{value:'7'}});
  fireEvent.click(screen.getByRole('button',{name:/Taslağı PostgreSQL’e kaydet/}));
  expect(screen.getByRole('alert').textContent).toContain('Ürün adını doğrulayarak değiştirin');
  expect(apiRequest).not.toHaveBeenCalledWith('/invoices',expect.anything());
 });
});
