import {lazy} from 'react';
// Yeni sayfa için bu kayıt tablosuna lazy import ekleyin; App.jsx değişmez.
export const pageRegistry={
 CanliPanoPage:lazy(()=>import('../pages/CanliPanoPage')),
 DashboardPage:lazy(()=>import('../pages/DashboardPage')),
 SatisYapPage:lazy(()=>import('../pages/SatisYapPage')),
 FaturaOlusturPage:lazy(()=>import('../pages/FaturaOlusturPage')),
 BankaFaturaPage:lazy(()=>import('../pages/BankaFaturaPage')),
 ExcelYuklePage:lazy(()=>import('../pages/ExcelYuklePage')),
 TaslakFaturaPage:lazy(()=>import('../pages/TaslakFaturaPage')),
 MysoftAktarilanlarPage:lazy(()=>import('../pages/MysoftAktarilanlarPage')),
 MusterilerPage:lazy(()=>import('../pages/MusterilerPage'))
};
