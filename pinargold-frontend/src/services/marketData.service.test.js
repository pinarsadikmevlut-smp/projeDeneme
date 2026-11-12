import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';

vi.mock('./apiClient',()=>({apiRequest:vi.fn()}));
import {apiRequest} from './apiClient';

const quote=(buy,sell)=>({id:'usd',name:'USD/TL',category:'Döviz',purity:'USD',
 buy,sell,sourceCode:'USD',sourceType:'currency',sourceUpdatedAt:'current',stale:false});
const packet=(buy=50,sell=51)=>({
 state:'live',source:'Altınkaynak',quotes:[quote(buy,sell)],
 quoteCount:1,staleCount:0,stale:false,checkedAt:'2026-11-12T16:30:00+00:00',
 fetchedAt:'2026-11-12T16:30:00+00:00',intervalSeconds:10
});
async function load(){vi.resetModules();return import('./marketData.service');}

beforeEach(()=>{
 vi.useFakeTimers();
 apiRequest.mockReset();
});
afterEach(()=>{vi.useRealTimers();});

describe('10-second market service',()=>{
 it('starts immediately, calls at 10, 20 seconds, and shares one call between subscribers',async()=>{
  apiRequest.mockResolvedValue(packet());
  const market=await load();
  const unsub1=market.subscribeMarketData(()=>{});
  const unsub2=market.subscribeMarketStatus(()=>{});
  await vi.advanceTimersByTimeAsync(0);
  expect(apiRequest).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(9999);
  expect(apiRequest).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(apiRequest).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(10000);
  expect(apiRequest).toHaveBeenCalledTimes(3);
  unsub1();unsub2();
  await vi.advanceTimersByTimeAsync(40000);
  expect(apiRequest).toHaveBeenCalledTimes(3);
 });
 it('never overlaps slow requests or emits a burst',async()=>{
  let resolveFirst;
  apiRequest.mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve;}))
   .mockResolvedValue(packet(60,61));
  const market=await load();
  const unsubscribe=market.subscribeMarketData(()=>{});
  await vi.advanceTimersByTimeAsync(25000);
  expect(apiRequest).toHaveBeenCalledTimes(1);
  resolveFirst(packet(50,51));
  await vi.advanceTimersByTimeAsync(0);
  expect(market.getMarketSnapshot()[0].sell).toBe(51);
  await vi.advanceTimersByTimeAsync(9999);
  expect(apiRequest).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(apiRequest).toHaveBeenCalledTimes(2);
  expect(market.getMarketSnapshot()[0].sell).toBe(61);
  unsubscribe();
 });
 it('updates all prices after each response and retains last known values on errors',async()=>{
  apiRequest.mockResolvedValueOnce(packet(50,51))
   .mockResolvedValueOnce(packet(52,55))
   .mockRejectedValueOnce(new Error('offline'));
  const market=await load();
  let notifications=0;
  const unsubscribe=market.subscribeMarketData(()=>{notifications++;});
  await vi.advanceTimersByTimeAsync(0);
  expect(market.getMarketSnapshot()[0].buy).toBe(50);
  await vi.advanceTimersByTimeAsync(10000);
  expect(market.getMarketSnapshot()[0].sell).toBe(55);
  expect(market.getMarketSnapshot()[0].sellRevision).toBe(1);
  await vi.advanceTimersByTimeAsync(10000);
  expect(market.getMarketSnapshot()[0].sell).toBe(55);
  expect(market.getMarketSnapshot()[0].stale).toBe(true);
  expect(market.getMarketStatus().state).toBe('error');
  expect(notifications).toBeGreaterThanOrEqual(3);
  unsubscribe();
 });
 it('discards late responses after unsubscribe and restarts cleanly',async()=>{
  let resolveOld;
  apiRequest.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;}))
   .mockResolvedValue(packet(77,78));
  const market=await load();
  const off=market.subscribeMarketData(()=>{});
  await vi.advanceTimersByTimeAsync(0);
  off();
  const off2=market.subscribeMarketData(()=>{});
  await vi.advanceTimersByTimeAsync(0);
  resolveOld(packet(1,2));
  await vi.advanceTimersByTimeAsync(0);
  expect(market.getMarketSnapshot()[0].sell).toBe(78);
  off2();
 });
});
