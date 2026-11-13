import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {apiRequest,clearAuthState,setCsrfToken,setBearerToken,setUnauthorizedHandler} from './apiClient';

const ok=(data={ok:true})=>({ok:true,json:async()=>data});
beforeEach(()=>{clearAuthState();globalThis.fetch=vi.fn().mockResolvedValue(ok());});
afterEach(()=>{clearAuthState();setUnauthorizedHandler(null);vi.restoreAllMocks();});

describe('fetch interceptor',()=>{
 it('uses HttpOnly cookies and automatically adds in-memory CSRF to mutations',async()=>{
  setCsrfToken('csrf-from-session');
  await apiRequest('/customers',{method:'POST',body:{fullName:'Örnek Kullanıcı',tckn:'00000000000'}});
  const [,options]=fetch.mock.calls[0];
  expect(options.credentials).toBe('same-origin');
  expect(options.headers['X-CSRF-Token']).toBe('csrf-from-session');
  expect(options.headers.Authorization).toBeUndefined();
  expect(options.cache).toBe('no-store');
 });
 it('adds Authorization bearer header when an in-memory token is provided',async()=>{
  setBearerToken('memory-token');
  await apiRequest('/customers');
  const [,options]=fetch.mock.calls[0];
  expect(options.headers.Authorization).toBe('Bearer memory-token');
 });
 it('clears session and invokes unauthorized handler on protected 401',async()=>{
  const unauthorized=vi.fn();
  setUnauthorizedHandler(unauthorized);
  setCsrfToken('csrf-value');
  fetch.mockResolvedValueOnce({ok:false,status:401,json:async()=>({error:'unauthorized'})});
  await expect(apiRequest('/customers')).rejects.toMatchObject({status:401});
  expect(unauthorized).toHaveBeenCalledTimes(1);
  await apiRequest('/customers',{method:'POST'});
  expect(fetch.mock.calls[1][1].headers['X-CSRF-Token']).toBeUndefined();
 });
 it('does not log user out on wrong password response',async()=>{
  const unauthorized=vi.fn();
  setUnauthorizedHandler(unauthorized);
  fetch.mockResolvedValueOnce({ok:false,status:401,json:async()=>({error:'invalid_credentials'})});
  await expect(apiRequest('/auth/login',{method:'POST',body:{username:'u',password:'bad'}})).rejects.toMatchObject({status:401});
  expect(unauthorized).not.toHaveBeenCalled();
 });
});
