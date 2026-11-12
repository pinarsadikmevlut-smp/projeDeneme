import {useEffect,useState} from 'react';import {formatPrice} from '../../utils/format';
export default function PriceCell({value,direction,revision,highlight=false}){
 const [flash,setFlash]=useState(null);
 useEffect(()=>{if(!revision)return;setFlash(direction);const id=setTimeout(()=>setFlash(null),1200);return()=>clearTimeout(id)},[revision,direction]);
 return <span className={`inline-block rounded-md px-1.5 py-1 font-mono text-xs font-bold tabular-nums ${highlight?'text-gold-600 dark:text-gold-400':''} ${flash==='up'?'animate-flashUp':flash==='down'?'animate-flashDown':''}`}>{formatPrice(value)}</span>;
}
