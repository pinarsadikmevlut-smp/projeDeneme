import {describe,it,expect} from 'vitest';
import {reconcileQuotes,deriveMarketStatus} from './marketState';

const quote=(id,buy,sell,extra={})=>({
 id,name:'Ürün '+id,category:'Döviz',purity:'—',buy,sell,
 sourceCode:id,sourceType:'currency',providerName:id,isMobile:true,
 sourceUpdatedAt:'12.11.2026 19:30:00',
 sourceTimestamp:'2026-11-12T16:30:00+00:00',stale:false,...extra
});

describe('reconcileQuotes',()=>{
 it('preserves ALL 67 valid source records and then updates every response value',()=>{
  const initial=Array.from({length:67},(_,i)=>quote('code-'+i,100+i,110+i));
  const first=reconcileQuotes([],initial);
  expect(first).toHaveLength(67);
  const second=reconcileQuotes(first,initial.map(q=>({...q,buy:q.buy+1,sell:q.sell+2,sourceUpdatedAt:'12.11.2026 19:30:10'})));
  expect(second).toHaveLength(67);
  for(let i=0;i<67;i++){
   expect(second[i].buy).toBe(initial[i].buy+1);
   expect(second[i].sell).toBe(initial[i].sell+2);
   expect(second[i].sourceUpdatedAt).toBe('12.11.2026 19:30:10');
   expect(second[i].buyRevision).toBe(1);
   expect(second[i].sellRevision).toBe(1);
   expect(second[i].direction).toBe('up');
  }
 });
 it('does not re-render identical items and never flashes unchanged prices',()=>{
  const first=reconcileQuotes([],[quote('usd',50,51)]);
  const second=reconcileQuotes(first,[quote('usd',50,51)]);
  expect(second).toBe(first);
  expect(second[0]).toBe(first[0]);
  const meta=reconcileQuotes(second,[quote('usd',50,51,{sourceUpdatedAt:'new'})]);
  expect(meta[0].revision).toBe(0);
  expect(meta[0].sellRevision).toBe(0);
 });
 it('tracks buy and sell independently and retains missing items as stale',()=>{
  const first=reconcileQuotes([],[quote('a',10,11),quote('b',20,21)]);
  const second=reconcileQuotes(first,[quote('a',11,11)]);
  expect(second).toHaveLength(2);
  expect(second[0].buyDirection).toBe('up');
  expect(second[0].buyRevision).toBe(1);
  expect(second[0].sellRevision).toBe(0);
  expect(second[1].stale).toBe(true);
 });
 it('rejects duplicates and invalid numeric quotes',()=>{
  const out=reconcileQuotes([],[quote('x',1,2),quote('x',3,4),quote('invalid',NaN,3)]);
  expect(out).toHaveLength(1);
 });
});
describe('market status',()=>{
 it('preserves the server source timestamps and partial freshness',()=>{
  const result=deriveMarketStatus({
   quotes:[quote('x',1,2,{stale:true})],quoteCount:1,staleCount:1,
   checkedAt:'2026-11-12T16:30:11+00:00',fetchedAt:'2026-11-12T16:30:10+00:00',
   state:'partial',feedStatus:{gold:{ok:true},currency:{ok:false}}
  },{fetchedAt:null});
  expect(result.state).toBe('partial');
  expect(result.checkedAt).toContain('16:30:11');
  expect(result.feedStatus.currency.ok).toBe(false);
 });
});
