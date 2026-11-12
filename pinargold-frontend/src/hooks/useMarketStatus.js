import {useSyncExternalStore} from 'react';
import {getMarketStatus,subscribeMarketStatus} from '../services/marketData.service';
export function useMarketStatus(){
 return useSyncExternalStore(subscribeMarketStatus,getMarketStatus,getMarketStatus);
}
