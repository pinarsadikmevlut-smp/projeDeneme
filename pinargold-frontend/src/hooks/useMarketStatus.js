import {useEffect,useState} from 'react';
import {getMarketStatus,subscribeMarketStatus} from '../services/marketData.service';
export function useMarketStatus(){
 const [status,setStatus]=useState(getMarketStatus);
 useEffect(()=>subscribeMarketStatus(setStatus),[]);
 return status;
}
