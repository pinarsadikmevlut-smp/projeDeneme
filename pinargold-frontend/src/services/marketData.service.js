// DEMO: Gerçek borsa kotasyonları değildir. API/WebSocket adaptörü yalnızca burada değiştirilebilir.
const seed = [
  ['gram','Gram Altın 24k','Has & Külçe','24k / 1.000',6548,6685],
  ['has995','Has Altın 0.995','Has & Külçe','0.995',6515,6652],
  ['has1000','Has Altın 1.000','Has & Külçe','1.000',6548,6685],
  ['ceyrek','Çeyrek Altın','Ziynet & Ata','22k',10569,10893],
  ['yarim','Yarım Altın','Ziynet & Ata','22k',21138,21786],
  ['tam','Tam Altın','Ziynet & Ata','22k',42276,43572],
  ['bilezik22','22 Ayar Bilezik','İşçilikli','22k / 0.916',6000,6275],
  ['altin18','18 Ayar Altın','İşçilikli','18k / 0.750',4911,5150],
  ['altin14','14 Ayar Altın','İşçilikli','14k / 0.585',3830,4040],
  ['usd','USD/TL','Döviz','USD',50.11,50.29],
  ['eur','EUR/TL','Döviz','EUR',58.02,58.26]
];
let prices = seed.map(([id,name,category,purity,buy,sell])=>({id,name,category,purity,buy,sell,change:0,direction:null,revision:0}));
const listeners = new Set();
let timer = null;
const emit = () => { const snapshot = prices.map(x=>({...x}));listeners.forEach(fn=>fn(snapshot)); };
function tick(){
  prices=prices.map(item=>{
    if(Math.random()>.48)return item;
    const delta=(Math.random()-.5)*(item.category==='Döviz'?.025:6);
    const buy=Math.max(.01,+(item.buy+delta).toFixed(2));
    const sell=Math.max(buy,+(item.sell+delta).toFixed(2));
    return {...item,buy,sell,change:+(delta/item.sell*100).toFixed(3),direction:delta>=0?'up':'down',revision:item.revision+1};
  });
  emit();
}
export function getMarketSnapshot(){return prices.map(x=>({...x}));}
export function subscribeMarketData(callback){
  listeners.add(callback);
  callback(getMarketSnapshot());
  if(!timer && typeof window!=='undefined')timer=window.setInterval(tick,2800);
  return ()=>{listeners.delete(callback);if(!listeners.size && timer){clearInterval(timer);timer=null;}};
}
export function refreshMarketData(){tick();}
export const MARKET_DATA_MODE='simulation';
