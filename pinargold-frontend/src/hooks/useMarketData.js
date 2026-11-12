import {useSyncExternalStore} from 'react';
import {getMarketSnapshot,subscribeMarketData} from '../services/marketData.service';
export function useMarketData(){
 return useSyncExternalStore(subscribeMarketData,getMarketSnapshot,getMarketSnapshot);
}
