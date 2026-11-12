// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

const session=vi.hoisted(()=>({authenticated:false,csrfToken:null}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>session}));
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn()}));
vi.mock('../services/ziraatStatement.service',async importOriginal=>{
 const real=await importOriginal();
 return {...real,loadZiraatFile:vi.fn()};
});
import {loadZiraatFile} from '../services/ziraatStatement.service';
import {apiRequest} from '../services/apiClient';
import ExcelYuklePage from './ExcelYuklePage';
beforeEach(()=>{loadZiraatFile.mockReset();apiRequest.mockReset();session.authenticated=false;session.csrfToken=null;});
afterEach(cleanup);
describe('Ziraat upload preview',()=>{
 it('uploads file with merged name and visible TCKN, without balance or confidence labels',async()=>{
  loadZiraatFile.mockResolvedValue({records:[{
   id:1,date:'01.11.2026',valueDate:'',reference:'A100',
   description:'Gönderen: Ayşe Kaya TCKN: 10000000146',
   firstName:'Ayşe',lastName:'Kaya',tckn:'10000000146',identityReview:true,identitySource:'Açıklama (BÜYÜK HARF)',
   debit:0,credit:100.5,amount:100.5,balance:500,direction:'in',rawFields:{Kanal:'FAST'}
  }],extraHeaders:['Kanal']});
  render(<MemoryRouter><ExcelYuklePage/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Ziraat hesap hareketleri dosyası seç'),{target:{files:[new File(['mock'],'ziraat.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})]}});
  await waitFor(()=>expect(screen.getByText('A100')).toBeTruthy());
  expect(screen.getByLabelText('Ad Soyad 1').value).toBe('Ayşe Kaya');
  expect(screen.getByLabelText('TCKN 1').value).toBe('10000000146');
  expect(screen.queryByText('VALÖR')).toBeNull();
  expect(screen.queryByText('BORÇ (₺)')).toBeNull();
  expect(screen.queryByText('ALACAK (₺)')).toBeNull();
  expect(screen.queryByText('BAKİYE (₺)')).toBeNull();
  expect(screen.queryByText('Tahmini')).toBeNull();
  expect(screen.queryByText('Kontrol')).toBeNull();
  expect(screen.getByText('↑ Gelen')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Ad Soyad 1'),{target:{value:'Ayşe Nur Kaya'}});
  expect(screen.getByLabelText('Ad Soyad 1').value).toBe('Ayşe Nur Kaya');
  expect(screen.getAllByText('FAST').length).toBeGreaterThan(0);
  expect(screen.getByRole('button',{name:/CSV İndir/}).disabled).toBe(false);
 });

 it('persists extracted Ad Soyad and TCKN to customer API automatically when signed in',async()=>{
  session.authenticated=true;
  session.csrfToken='example-csrf-token';
  const person={id:1,date:'01.11.2026',reference:'A100',description:'Gönderen: Ayşe Kaya TCKN: 10000000146',
   fullName:'Ayşe Kaya',firstName:'Ayşe',lastName:'Kaya',tckn:'10000000146',
   amount:500,debit:0,credit:500,direction:'in',rawFields:{}};
  loadZiraatFile.mockResolvedValue({records:[person],extraHeaders:[]});
  apiRequest.mockResolvedValue({created:1,existing:0,invalid:0});
  render(<MemoryRouter><ExcelYuklePage/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Ziraat hesap hareketleri dosyası seç'),{
   target:{files:[new File(['test'],'ziraat.xlsx')]}});
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/customers/import',{
   method:'POST',headers:{'X-CSRF-Token':'example-csrf-token'},
   body:{customers:[{fullName:'Ayşe Kaya',tckn:'10000000146'}]}
  }));
  expect(await screen.findByText(/PostgreSQL kaydı tamamlandı/)).toBeTruthy();
 });
});
