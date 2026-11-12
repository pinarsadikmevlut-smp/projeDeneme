// DOM integration test: every mapped quote appears in the live table, not just the featured cards.
// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {render,cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

const state=vi.hoisted(()=>({quotes:[]}));
vi.mock('../hooks/useMarketData',()=>({useMarketData:()=>state.quotes}));
vi.mock('../hooks/useMarketStatus',()=>({useMarketStatus:()=>({
 state:'live',stale:false,staleCount:0,fetchedAt:'2026-11-12T16:30:00+00:00',
 checkedAt:'2026-11-12T16:30:00+00:00'
})}));
import CanliPanoPage from './CanliPanoPage';
afterEach(cleanup);

describe('live dashboard rendering',()=>{
 it('renders each of 67 values from the API and updates changed prices',()=>{
  state.quotes=Array.from({length:67},(_,i)=>({
   id:'gold:K'+i,name:'Gold '+i,category:'Diğer Altın',purity:'—',
   buy:1000+i,sell:2000+i,stale:false,sourceCode:'K'+i,sourceType:'gold',
   revision:0,buyRevision:0,sellRevision:0,direction:null,change:0
  }));
  const view=render(<CanliPanoPage/>);
  expect(view.container.querySelectorAll('tr[data-quote-id]')).toHaveLength(67);
  const row=view.container.querySelector('[data-quote-id="gold:K66"]');
  expect(row.textContent).toContain('2.066,00');
  state.quotes=state.quotes.map(item=>({
   ...item,buy:item.buy+7,sell:item.sell+11,
   revision:1,buyRevision:1,sellRevision:1,sellDirection:'up',buyDirection:'up',change:0.5
  }));
  view.rerender(<CanliPanoPage/>);
  const updated=view.container.querySelector('[data-quote-id="gold:K66"]');
  expect(updated.textContent).toContain('2.077,00');
  expect(updated.textContent).toContain('1.073,00');
 });
});
