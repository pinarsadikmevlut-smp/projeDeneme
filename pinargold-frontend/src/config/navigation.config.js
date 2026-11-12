import { faChartPie,faChartLine,faGem,faFileExcel,faFileInvoice,faPaperPlane,faUsers } from '@fortawesome/free-solid-svg-icons';
export const navigation = [
  { id:'canli',label:'Canlı Pano',path:'/',icon:faChartLine,page:'CanliPanoPage' },
  { id:'dashboard',label:'Dashboard',path:'/dashboard',icon:faChartPie,page:'DashboardPage' },
  { id:'satis',label:'Satış Yap',path:'/satis-yap',icon:faGem,page:'SatisYapPage' },
  { id:'excel',label:'Excel Yükle',path:'/excel-yukle',icon:faFileExcel,page:'ExcelYuklePage' },
  { id:'taslak',label:'Taslak Faturalar',path:'/taslak-faturalar',icon:faFileInvoice,page:'TaslakFaturaPage',badge:0 },
  { id:'mysoft',label:'Mysoft Aktarılanlar',path:'/mysoft-aktarilanlar',icon:faPaperPlane,page:'MysoftAktarilanlarPage' },
  { id:'musteriler',label:'Müşteri Listesi',path:'/musteriler',icon:faUsers,page:'MusterilerPage' }
];
