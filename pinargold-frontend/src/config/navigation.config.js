import { faChartPie,faChartLine,faGem,faFileExcel,faFileInvoice,faPaperPlane,faUsers,faFileCirclePlus,faBuildingColumns } from '@fortawesome/free-solid-svg-icons';
export const navigation = [
  { id:'canli',label:'Canlı Pano',path:'/',icon:faChartLine,page:'CanliPanoPage' },
  { id:'dashboard',label:'Dashboard',path:'/dashboard',icon:faChartPie,page:'DashboardPage' },
  { id:'satis',label:'Satış Yap',path:'/satis-yap',icon:faGem,page:'SatisYapPage' },
  { id:'fatura',label:'Fatura Oluştur',path:'/fatura-olustur',icon:faFileCirclePlus,page:'FaturaOlusturPage' },
  { id:'banka-fatura',label:'Banka Hareketleri',path:'/banka-fatura',icon:faBuildingColumns,page:'BankaFaturaPage' },
  { id:'excel',label:'Excel Yükle',path:'/excel-yukle',icon:faFileExcel,page:'ExcelYuklePage' },
  { id:'taslak',label:'Taslak Faturalar',path:'/taslak-faturalar',icon:faFileInvoice,page:'TaslakFaturaPage',badge:0 },
  { id:'mysoft',label:'Mysoft Aktarım Kuyruğu',path:'/mysoft-aktarilanlar',icon:faPaperPlane,page:'MysoftAktarilanlarPage' },
  { id:'musteriler',label:'Müşteri Listesi',path:'/musteriler',icon:faUsers,page:'MusterilerPage' }
];
