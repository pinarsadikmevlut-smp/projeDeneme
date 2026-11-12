import {useConnection} from '../../hooks/useConnection';
export default function ConnectionStatus(){
 const {status,lastUpdated}=useConnection();
 const labels={idle:'Beklemede',simulation:'Simülasyon / Demo',connecting:'Bağlanıyor',connected:'Bağlı',reconnecting:'Yeniden bağlanıyor','invalid-config':'Geçersiz WSS ayarı'};
 return <span role="status" className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${status==='connected'?'bg-emerald-500':status==='simulation'?'bg-amber-500':'bg-red-500'}`}/>{labels[status]||status}{lastUpdated&&status==='connected'?' • Son mesaj '+new Date(lastUpdated).toLocaleTimeString('tr-TR'):''}</span>;
}
