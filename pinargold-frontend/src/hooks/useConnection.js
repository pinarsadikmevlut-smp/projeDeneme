import {useEffect,useState} from 'react';
import {getConnectionSnapshot,subscribeConnection} from '../services/connection.service';
export function useConnection(){const [state,setState]=useState(getConnectionSnapshot);useEffect(()=>subscribeConnection(setState),[]);return state;}
