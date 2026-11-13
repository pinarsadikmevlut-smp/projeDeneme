import {describe,it,expect} from 'vitest';
import {csvToMatrix,recordsFromMatrix,parseIdentity,parseMoney,validTckn,enrichedCsv,maskTckn} from './ziraatStatement.service';

const columns=['Muh Tarih','Valör','İşlem No','İşlem Açıklaması','Borç','Alacak','Bakiye','Kanal'];
const ziraatRows=[
 ['Ziraat Bankası Hesap Hareketleri'],
 ['01.11.2026 - 10.11.2026'],
 columns,
 ['01.11.2026','01.11.2026','A100','Gönderen: Ayşe Kaya TCKN: 10000000146 FAST','','1.234,56','10.000,00','FAST'],
 ['02.11.2026','02.11.2026','A101','Alıcı: Mehmet Demir TCKN: 10000000146 EFT','200,25','','9.799,75','EFT']
];

describe('Ziraat Excel / CSV statement import',()=>{
 it('finds the header after bank summary rows and maps original fields without loss',()=>{
  const result=recordsFromMatrix(ziraatRows);
  expect(result.records).toHaveLength(2);
  expect(result.records[0]).toMatchObject({
   date:'01.11.2026',valueDate:'01.11.2026',reference:'A100',
   firstName:'Ayşe',lastName:'Kaya',fullName:'Ayşe Kaya',tckn:'10000000146',
   credit:1234.56,debit:0,balance:10000,direction:'in'
  });
  expect(result.records[1].debit).toBe(200.25);
  expect(result.records[1].direction).toBe('out');
  expect(result.extraHeaders).toContain('Kanal');
  expect(result.records[1].rawFields.Kanal).toBe('EFT');
 });
 it('separates first name, last name and labelled TCKN without making guesses from unrelated text',()=>{
  expect(parseIdentity('Gönderen: Ayşe Kaya TCKN: 10000000146 FAST')).toMatchObject({
   firstName:'Ayşe',lastName:'Kaya',tckn:'10000000146'
  });
  expect(parseIdentity('POS HİZMET BEDELİ')).toMatchObject({firstName:'',lastName:'',tckn:''});
  expect(parseIdentity('Açıklama','', 'Ali Can Yılmaz')).toMatchObject({firstName:'Ali Can',lastName:'Yılmaz'});
  expect(validTckn('10000000146')).toBe(true);
  expect(maskTckn('10000000146')).toBe('*******0146');
  expect(parseIdentity('FAST GELEN PARA HASAN ALİ ÖZTÜRK TCKN: 10000000146')).toMatchObject({firstName:'HASAN ALİ',lastName:'ÖZTÜRK',identityReview:true,identitySource:'Açıklama (BÜYÜK HARF)'});
  expect(parseIdentity('EFT HAVALE BANKA MASRAF ÜCRETİ')).toMatchObject({firstName:'',lastName:''});
 });
 it('recognises one-column signed amounts and numeric/date bank fields',()=>{
  const result=recordsFromMatrix([
   ['Tarih','Açıklama','Tutar','Bakiye'],
   ['01.11.2026','Banka masrafı','-12,50','1.000,00'],
   ['02.11.2026','FAST gelen','250,25','1.250,25']
  ]);
  expect(result.records.map(row=>row.direction)).toEqual(['out','in']);
  expect(result.records.map(row=>row.amount)).toEqual([12.5,250.25]);
  expect(parseMoney('1.234.567,89')).toBe(1234567.89);
  expect(parseMoney('6.259')).toBe(6259);
 });
 it('handles quoted semicolon CSV and produces a non-executable enriched CSV',()=>{
  const matrix=csvToMatrix('Muh Tarih;İşlem Açıklaması;Borç;Alacak\n01.11.2026;"Gönderen: Ayşe; Kaya TCKN: 10000000146";;100,50');
  expect(matrix[1][1]).toContain('Ayşe; Kaya');
  const result=recordsFromMatrix(matrix);
  expect(result.records[0].credit).toBe(100.5);
  const exported=enrichedCsv([{...result.records[0],fullName:'=HYPERLINK',firstName:'=HYPERLINK',lastName:'Kaya'}]);
  expect(exported).toContain("'=HYPERLINK");
  expect(exported).toContain('Ad Soyad');
  expect(exported).toContain('İşlem Tutarı');
  expect(exported).toContain('İşlem Yönü');
  expect(exported).not.toContain('Valör');
  expect(exported).not.toContain('Bakiye');
  expect(exported).not.toContain('Borç;');
  expect(exported).not.toContain('Alacak;');
 });
 it('detects uppercase names without explicit labels while excluding bank terms',()=>{
  const row=recordsFromMatrix([
   ['Tarih','Açıklama','Tutar'],
   ['01.11.2026','FAST GELEN PARA İSMAİL HAKKI ÇELİK 10000000146','250,00']
  ]).records[0];
  expect(row.fullName).toBe('İSMAİL HAKKI ÇELİK');
  expect(row.tckn).toBe('10000000146');
  expect(row.identityReview).toBe(true);
  expect(row.identitySource).toBe('Açıklama (BÜYÜK HARF)');
 });
 it('fails safely when required headers are missing',()=>{
  expect(()=>recordsFromMatrix([['Rapor Başlığı'],['01.11.2026','1.000']])).toThrow(/sütun başlıkları/i);
 });
});

describe('Excel işlem saati',()=>{
 it('preserves time from Excel Date values without changing date-only values',()=>{
  const rows=recordsFromMatrix([
   ['Muh Tarih','İşlem Açıklaması','Alacak'],
   [new Date(Date.UTC(2026,10,13,12,29)),'TEST FAST GELEN',500],
   [new Date(Date.UTC(2026,10,12)),'TEST GELEN',200]
  ]).records;
  expect(rows[0].date).toBe('13.11.2026 12:29');
  expect(rows[1].date).toBe('12.11.2026');
 });
});
