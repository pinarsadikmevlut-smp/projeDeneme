// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
const auth=vi.hoisted(()=>({loading:false,authenticated:false}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>auth}));
import AuthGuard from './AuthGuard';
afterEach(cleanup);
function renderRoute(){
 render(<MemoryRouter initialEntries={['/customers']}><Routes>
  <Route path="/login" element={<p>Giriş formu</p>}/>
  <Route element={<AuthGuard/>}><Route path="/customers" element={<p>Gizli müşteri listesi</p>}/></Route>
 </Routes></MemoryRouter>);
}
describe('AuthGuard',()=>{
 it('redirects an anonymous visit to login',()=>{
  auth.loading=false;auth.authenticated=false;renderRoute();
  expect(screen.getByText('Giriş formu')).toBeTruthy();
  expect(screen.queryByText('Gizli müşteri listesi')).toBeNull();
 });
 it('allows authenticated users to enter protected routes',()=>{
  auth.loading=false;auth.authenticated=true;renderRoute();
  expect(screen.getByText('Gizli müşteri listesi')).toBeTruthy();
 });
 it('waits for the backend session check',()=>{
  auth.loading=true;auth.authenticated=false;renderRoute();
  expect(screen.getByText('Oturum doğrulanıyor...')).toBeTruthy();
  expect(screen.queryByText('Gizli müşteri listesi')).toBeNull();
 });
});
