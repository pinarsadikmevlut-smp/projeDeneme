import { useEffect,useState } from 'react';
import {getMarketSnapshot,subscribeMarketData} from '../services/marketData.service';
export function useMarketData(){
 const [data,setData]=useState(getMarketSnapshot);
 useEffect(()=>subscribeMarketData(setData),[]);
 return data;
}
