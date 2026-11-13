// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

const store=vi.hoisted(()=>({quotes:[],status:{state:'live'}}));
vi.mock('../hooks/useMarketData',()=>({useMarketData:()=>store.quotes}));
vi.mock('../hooks/useMarketStatus',()=>({useMarketStatus:()=>store.status}));
import SatisYapPage from './SatisYapPage';

const gram=(stale=false)=>({
 id:'gram',name:'Gram Altın 24k',category:'Has & Külçe',purity:'24k',
 buy:6548,sell:6685,stale
});
beforeEach(()=>{store.quotes=[gram()];store.status={state:'live'};});
afterEach(cleanup);

describe('Satış Yap — yalnızca demo',()=>{
 it('ürün araması ve sepet miktar/toplam hesabı çalışır',()=>{
  render(<MemoryRouter><SatisYapPage/></MemoryRouter>);
  expect(screen.getByText('PNR-GRM')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Gram Altın sepete ekle'}));
  expect(screen.getByRole('spinbutton',{name:'Gram Altın miktar'}).value).toBe('1');
  fireEvent.click(screen.getByRole('button',{name:'Gram Altın artır'}));
  expect(screen.getByRole('spinbutton',{name:'Gram Altın miktar'}).value).toBe('2');
  expect(screen.getAllByText('₺13.370,00').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByRole('textbox',{name:'Ürün ara'}),{target:{value:'olmayan-ürün'}});
  expect(screen.getByText('Aramanıza uygun ürün bulunamadı.')).toBeTruthy();
  expect(screen.getByRole('button',{name:/Satış Tamamla/}).disabled).toBe(true);
 });
 it('eski fiyat ve bağlantı sorunu sırasında sepete ekleme yapılamaz',()=>{
  store.quotes=[gram(true)];store.status={state:'stale'};
  render(<MemoryRouter><SatisYapPage/></MemoryRouter>);
  const button=screen.getByRole('button',{name:'Gram Altın sepete ekle'});
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(screen.getByText('Sepetiniz boş')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Veri eski');
 });
 it('servis henüz başlamadıysa açıklayıcı boş durum gösterir',()=>{
  store.quotes=[];store.status={state:'warming'};
  render(<MemoryRouter><SatisYapPage/></MemoryRouter>);
  expect(screen.getByText('Fiyatlar bekleniyor. Backend bağlantısını kontrol edin.')).toBeTruthy();
 });
 it('kısmi kaynak kesintisinde güncel ürün eklenebilir, eski ürün eklenemez',()=>{
  store.quotes=[gram(false),{...gram(true),id:'ceyrek',name:'Çeyrek Altın',sell:10893}];
  store.status={state:'partial'};
  render(<MemoryRouter><SatisYapPage/></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Gram Altın sepete ekle'}).disabled).toBe(false);
  expect(screen.getByRole('button',{name:'Çeyrek Altın sepete ekle'}).disabled).toBe(true);
 });
});
