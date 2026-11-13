// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';

vi.mock('../services/ziraatStatement.service',async original=>{
 const actual=await original();
 return {...actual,loadZiraatFile:vi.fn()};
});
import {loadZiraatFile} from '../services/ziraatStatement.service';
import BankaFaturaPage from './BankaFaturaPage';

const records=[
 {id:1,date:'13.11.2026 12:29',reference:'TEST-FAST-1',
  description:'Gönderen: Örnek Müşteri TC 10000000146',
  fullName:'Örnek Müşteri',tckn:'10000000146',amount:676300,direction:'in',rawFields:{Kanal:'FAST'}},
 {id:2,date:'13.11.2026 12:27',reference:'TEST-EFT-2',
  description:'Alıcı: Demo Müşteri TCKN: 10000000146',
  fullName:'Demo Müşteri',tckn:'10000000146',amount:481100,direction:'out',rawFields:{Kanal:'EFT'}}
];
function Target(){
 const location=useLocation();
 return <pre data-testid="draft-navigation">{JSON.stringify(location.state?.bank||{})}</pre>;
}
function renderPage(){
 return render(<MemoryRouter initialEntries={['/banka-fatura']}><Routes>
  <Route path="/banka-fatura" element={<BankaFaturaPage/>}/>
  <Route path="/fatura-olustur" element={<Target/>}/>
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
 loadZiraatFile.mockResolvedValue({records,extraHeaders:[]});
});
afterEach(cleanup);

describe('Banka → Belge düzeni',()=>{
 it('renders all incoming/outgoing rows in the requested table structure and masks TCKNs',async()=>{
  renderPage();await importFile();
  for(const label of ['TARİH / SAAT','BANKA / YÖN','KARŞI TARAF / AÇIKLAMA','TUTAR','BELGE','İŞLEM']){
   expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.getByText('676.300,00 ₺').textContent).toBe('676.300,00 ₺');
  expect(screen.getByText('481.100,00 ₺').textContent).toBe('481.100,00 ₺');
  expect(screen.getAllByText('*******0146').length).toBe(2);
  expect(screen.queryByText(/10000000146/)).toBeNull();
  expect(screen.getAllByText('Ziraat').length).toBe(2);
  expect(screen.getByRole('button',{name:'Belge sürecine ilerle 1'}).disabled).toBe(true);
  expect(screen.getByRole('button',{name:'Belge sürecine ilerle 2'}).disabled).toBe(true);
 });
 it('requires a template selection and carries the chosen G.P. into the draft flow',async()=>{
  renderPage();await importFile();
  fireEvent.change(screen.getByLabelText('Belge şablonu 2'),{
   target:{value:'gider-pusulasi'}
  });
  expect(screen.getByRole('button',{name:'Belge sürecine ilerle 2'}).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Belge sürecine ilerle 2'}));
  const data=JSON.parse(screen.getByTestId('draft-navigation').textContent);
  expect(data).toMatchObject({
   reference:'TEST-EFT-2',direction:'out',amount:481100,
   documentType:'gider-pusulasi',bankName:'Ziraat Bankası'
  });
  expect(data.tckn).toBeUndefined();
  expect(data.description).toBeUndefined();
 });
 it('allows e-Arşiv template on incoming transfers',async()=>{
  renderPage();await importFile();
  fireEvent.change(screen.getByLabelText('Belge şablonu 1'),{target:{value:'e-arsiv'}});
  fireEvent.click(screen.getByRole('button',{name:'Belge sürecine ilerle 1'}));
  expect(JSON.parse(screen.getByTestId('draft-navigation').textContent).documentType).toBe('e-arsiv');
 });
 it('applies a template to multiple selected rows without creating a document automatically',async()=>{
  renderPage();await importFile();
  fireEvent.click(screen.getByLabelText('Sayfadaki tüm hareketleri seç'));
  expect(screen.getByLabelText('Hareket seç 1').checked).toBe(true);
  expect(screen.getByLabelText('Hareket seç 2').checked).toBe(true);
  fireEvent.change(screen.getByLabelText('Seçililer için belge şablonu'),{
   target:{value:'e-fatura'}
  });
  fireEvent.click(screen.getByRole('button',{name:'Şablonu uygula'}));
  expect(screen.getByLabelText('Belge şablonu 1').value).toBe('e-fatura');
  expect(screen.getByLabelText('Belge şablonu 2').value).toBe('e-fatura');
  expect(screen.getByRole('button',{name:'Belge sürecine ilerle 1'}).disabled).toBe(false);
  expect(screen.queryByTestId('draft-navigation')).toBeNull();
 });
 it('filters dates and direction and allows inspection without sending records',async()=>{
  renderPage();await importFile();
  fireEvent.click(screen.getByRole('button',{name:'Giden hareketler'}));
  expect(screen.getByText('TEST-EFT-2')).toBeTruthy();
  expect(screen.queryByText('TEST-FAST-1')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Tümü 2'}));
  fireEvent.change(screen.getByLabelText('Banka hareketi ara'),{target:{value:'TEST-FAST-1'}});
  expect(screen.getByText('TEST-FAST-1')).toBeTruthy();
  expect(screen.queryByText('TEST-EFT-2')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'↻ Filtreleri sıfırla'}));
  fireEvent.click(screen.getByRole('button',{name:'Hareket ayrıntısı 1'}));
  expect(screen.getByRole('dialog',{name:'Banka hareketi ayrıntıları'})).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Ayrıntıları kapat'));
  expect(screen.queryByRole('dialog')).toBeNull();
 });
});
