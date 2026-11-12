// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';

const auth=vi.hoisted(()=>({
 loading:false,authenticated:true,user:{username:'operator'},csrfToken:'token',
 login:async()=>{},logout:async()=>{},refresh:async()=>{}
}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn()}));
import {apiRequest} from '../services/apiClient';
import MusterilerPage from './MusterilerPage';

beforeEach(()=>{
 apiRequest.mockReset();
 auth.authenticated=true;
 apiRequest.mockImplementation((path,options)=>{
  if(path.startsWith('/customers?'))return Promise.resolve({customers:[],total:0});
  if(path==='/customers'&&options?.method==='POST')
   return Promise.resolve({customer:{id:1,...options.body}});
  if(path==='/customers/1'&&options?.method==='PATCH')
   return Promise.resolve({customer:{id:1,...options.body}});
  return Promise.resolve({});
 });
});
afterEach(cleanup);

describe('Müşteri Listesi',()=>{
 it('shows authorized table and supports adding a record with CSRF',async()=>{
  render(<MusterilerPage/>);
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith(
   expect.stringContaining('/customers?'),expect.anything()));
  fireEvent.click(screen.getByText('+ Yeni Müşteri'));
  fireEvent.change(screen.getByLabelText('Ad Soyad'),{target:{value:'Ayşe Kaya'}});
  fireEvent.change(screen.getByLabelText('TCKN'),{target:{value:'10000000146'}});
  fireEvent.click(screen.getByText('Kaydet'));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/customers',{
   method:'POST',headers:{'X-CSRF-Token':'token'},
   body:{fullName:'Ayşe Kaya',tckn:'10000000146'}
  }));
 });
 it('opens direct customer list without a login form or exposing private records',()=>{
  auth.authenticated=false;
  render(<MusterilerPage/>);
  expect(screen.getByText('Müşteri Listesi')).toBeTruthy();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(screen.queryByText('Müşteri yönetimi girişi')).toBeNull();
  expect(screen.getByRole('button',{name:'+JSON.stringify('+ Yeni Müşteri')+'}).disabled).toBe(true);
 });
});
