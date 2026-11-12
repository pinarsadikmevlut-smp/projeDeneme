// Pure, deterministic reconciliation: all valid Altınkaynak quotes, not a fixed shortlist.
const FIELDS = ['id','name','category','purity','buy','sell','sourceCode','sourceType',
 'providerName','sourceUpdatedAt','sourceTimestamp','isMobile','stale'];

const valid = quote => quote && typeof quote.id==='string' && !!quote.id &&
 Number.isFinite(quote.buy) && Number.isFinite(quote.sell) &&
 quote.buy>0 && quote.sell>=quote.buy;

export function reconcileQuotes(previous,incoming){
 if(!Array.isArray(incoming))throw Error('Invalid quote list');
 const prior=new Map(previous.map(q=>[q.id,q])),seen=new Set();
 let changed=false;
 const next=[];
 for(const raw of incoming){
  if(!valid(raw)||seen.has(raw.id))continue;
  seen.add(raw.id);
  const old=prior.get(raw.id);
  const buyMoved=!!old && raw.buy!==old.buy;
  const sellMoved=!!old && raw.sell!==old.sell;
  const moved=buyMoved||sellMoved;
  const direction=moved?(sellMoved?(raw.sell>old.sell?'up':'down'):(raw.buy>old.buy?'up':'down')):null;
  const change=sellMoved?Number(((raw.sell-old.sell)/old.sell*100).toFixed(3)):0;
  const same=!!old&&FIELDS.every(k=>(old[k]??null)===(raw[k]??null));
  if(same && old.direction===direction && old.change===change){next.push(old);continue;}
  changed=true;
  next.push({...raw,
   revision:(old?.revision??0)+(moved?1:0),
   buyRevision:(old?.buyRevision??0)+(buyMoved?1:0),
   sellRevision:(old?.sellRevision??0)+(sellMoved?1:0),
   buyDirection:buyMoved?(raw.buy>old.buy?'up':'down'):null,
   sellDirection:sellMoved?(raw.sell>old.sell?'up':'down'):null,
   direction,change
  });
 }
 // Partial feeds must not silently remove previously displayed quotes.
 for(const old of previous){
  if(seen.has(old.id))continue;
  if(old.stale&&old.direction===null&&old.change===0){next.push(old);continue;}
  next.push({...old,stale:true,direction:null,change:0});
  changed=true;
 }
 return !changed&&next.length===previous.length&&next.every((q,i)=>q===previous[i])?previous:next;
}

export function deriveMarketStatus(payload,previous){
 const total=payload.quotes.length;
 const staleCount=Number.isFinite(payload.staleCount)?payload.staleCount:
  payload.quotes.filter(q=>q.stale).length;
 return {
  state:payload.state|| (payload.stale?'stale':'live'),
  source:payload.source||'Altınkaynak',
  stale:payload.stale===true||staleCount>0,
  staleCount,quoteCount:Number.isFinite(payload.quoteCount)?payload.quoteCount:total,
  fetchedAt:payload.fetchedAt||previous.fetchedAt||null,
  checkedAt:payload.checkedAt||null,
  intervalSeconds:payload.intervalSeconds||10,
  feedStatus:payload.feedStatus||{},
  error:payload.error||null
 };
}
