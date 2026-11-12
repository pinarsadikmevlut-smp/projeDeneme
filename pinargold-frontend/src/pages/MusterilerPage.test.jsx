// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {DemoCustomersProvider} from '../context/DemoCustomersContext';

const auth=vi.hoisted(()=>({
 loading:false,authenticated:true,user:{username:'operator'},csrfToken:'token',
 login:async()=>{},logout:async()=>{},refresh:async()=>{}
}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn()}));
import {apiRequest} from '../services/apiClient';
import MusterilerPage from './MusterilerPage';
const renderPage=()=>render(<DemoCustomersProvider><MusterilerPage/></DemoCustomersProvider>);

beforeEach(()=>{
 apiRequest.mockReset();auth.authenticated=true;
 apiRequest.mockImplementation((path,options)=>{
  if(path.startsWith('/customers?'))return Promise.resolve({customers:[],total:0});
  if(path==='/customers'&&options?.method==='POST')return Promise.resolve({customer:{id:1,...options.body}});
  if(path==='/customers/1'&&options?.method==='PATCH')return Promise.resolve({customer:{id:1,...options.body}});
  return Promise.resolve({});
 });
});
afterEach(cleanup);

describe('Müşteri Listesi',()=>{
 it('keeps authenticated PostgreSQL CRUD behind CSRF checks',async()=>{
  renderPage();
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('/customers?'),expect.anything()));
  fireEvent.click(screen.getByText('+ Yeni Müşteri'));
  fireEvent.change(screen.getByLabelText('Ad Soyad'),{target:{value:'Ayşe Kaya'}});
  fireEvent.change(screen.getByLabelText('TCKN'),{target:{value:'10000000146'}});
  fireEvent.click(screen.getByText('Kaydet'));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/customers',{
   method:'POST',headers:{'X-CSRF-Token':'token'},
   body:{fullName:'Ayşe Kaya',tckn:'10000000146'}
  }));
 });
 it('opens a fictional customer list directly without login or private API calls',()=>{
  auth.authenticated=false;
  renderPage();
  expect(screen.getByRole('heading',{name:'Müşteri Listesi'})).toBeTruthy();
  expect(screen.getByText('Örnek Müşteri Bir')).toBeTruthy();
  expect(screen.getByText('00000000000')).toBeTruthy();
  expect(screen.queryByText('Müşteri yönetimi girişi')).toBeNull();
  expect(screen.getByRole('button',{name:'+ Yeni Müşteri'}).disabled).toBe(false);
  expect(apiRequest).not.toHaveBeenCalled();
 });
 it('supports in-memory demo add, edit and search; never calls PostgreSQL API',async()=>{
  auth.authenticated=false;
  renderPage();
  fireEvent.click(screen.getByRole('button',{name:'+ Yeni Müşteri'}));
  fireEvent.change(screen.getByLabelText('Ad Soyad'),{target:{value:'Örnek Müşteri Dört'}});
  fireEvent.change(screen.getByLabelText('TCKN'),{target:{value:'00000000003'}});
  fireEvent.click(screen.getByRole('button',{name:'Kaydet'}));
  expect(screen.getByText('Örnek Müşteri Dört')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Örnek Müşteri Dört düzenle'}));
  fireEvent.change(screen.getByLabelText('Ad Soyad'),{target:{value:'Örnek Müşteri Beş'}});
  fireEvent.click(screen.getByRole('button',{name:'Kaydet'}));
  expect(screen.getByText('Örnek Müşteri Beş')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox',{name:'Müşteri ara'}),{target:{value:'Beş'}});
  expect(screen.getByText('Örnek Müşteri Beş')).toBeTruthy();
  expect(screen.queryByText('Örnek Müşteri Bir')).toBeNull();
  expect(apiRequest).not.toHaveBeenCalled();
 });
});
