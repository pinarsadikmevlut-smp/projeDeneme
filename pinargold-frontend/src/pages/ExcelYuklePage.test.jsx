// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';

vi.mock('../services/ziraatStatement.service',async importOriginal=>{
 const real=await importOriginal();
 return {...real,loadZiraatFile:vi.fn()};
});
import {loadZiraatFile} from '../services/ziraatStatement.service';
import ExcelYuklePage from './ExcelYuklePage';
beforeEach(()=>loadZiraatFile.mockReset());
afterEach(cleanup);
describe('Ziraat upload preview',()=>{
 it('uploads file to local preview and shows separate name, surname and masked TCKN',async()=>{
  loadZiraatFile.mockResolvedValue({records:[{
   id:1,date:'01.11.2026',valueDate:'',reference:'A100',
   description:'Gönderen: Ayşe Kaya TCKN: 10000000146',
   firstName:'Ayşe',lastName:'Kaya',tckn:'10000000146',identityReview:false,
   debit:0,credit:100.5,amount:100.5,balance:500,direction:'in',rawFields:{Kanal:'FAST'}
  }],extraHeaders:['Kanal']});
  render(<ExcelYuklePage/>);
  fireEvent.change(screen.getByLabelText('Ziraat hesap hareketleri dosyası seç'),{target:{files:[new File(['mock'],'ziraat.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})]}});
  await waitFor(()=>expect(screen.getByText('A100')).toBeTruthy());
  expect(screen.getByLabelText('Ad Soyad 1').value).toBe('Ayşe Kaya');
  expect(screen.getByLabelText('TCKN 1').value).toBe('10000000146');
  expect(screen.queryByText('VALÖR')).toBeNull();
  expect(screen.queryByText('BORÇ (₺)')).toBeNull();
  expect(screen.queryByText('ALACAK (₺)')).toBeNull();
  expect(screen.getByText('↑ Gelen')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Ad Soyad 1'),{target:{value:'Ayşe Nur Kaya'}});
  expect(screen.getByLabelText('Ad Soyad 1').value).toBe('Ayşe Nur Kaya');
  expect(screen.getAllByText('FAST').length).toBeGreaterThan(0);
  expect(screen.getByRole('button',{name:/CSV İndir/}).disabled).toBe(false);
 });
});
