# pinarGold — Ziraat Bankası Hesap Hareketleri İçe Aktarma

## Kaynak formatlar

Uygulama, Ziraat İnternet Bankacılığı hesap hareketleri için basılı örneklerde ve üçüncü taraf muhasebe entegrasyonlarında belgelenen farklı başlıkları otomatik tanır:

- Yeni örnek: `Muh Tarih`, `Borç`, `Alacak`, `Bakiye`, `İşlem Açıklaması`, varsa `Valör` ve `İşlem No`.
- Alternatif/eski örnek: `Tarih`, `Tutar`, `Açıklama`, `İşlem No`, `Bakiye`.
- Dosya içindeki tablo başlığı ilk 60 dolu satırda aranır; üzerinde rapor/hesap özeti satırları bulunabilir.
- Değişken ek kaynak sütunları gizlenmeden saklanır ve isteğe bağlı tabloda gösterilir.
- `.xlsx` ve UTF-8 / Windows-1254 `.csv` okunur. Eski `.xls` dosyası Excel içinde `.xlsx` olarak kaydedilmelidir.

Kaynaklar:
- https://ekstre.emonse.com/ziraat-banka-ekstresi-excel
- https://www.mukellefportal.com/araclar/banka-ekstresi-cevirici/ziraat-bankasi
- https://www.ziraatbank.com.tr/tr/sss/kredi-mevduat-yatirimci-iliskileri/mevduat

## Kimlik ayrıştırma

`İşlem Açıklaması` içinde `Gönderen:`, `Alıcı:`, `Adı Soyadı:` gibi **etiketli** kişi bilgilerini ve `TCKN:` / `TC Kimlik No:` sonrası 11 haneli değeri ayırır.
Ad ve soyad ayrı tablo sütunlarıdır. Sonda yer alan tek kelime varsayılan soyad kabul edilir; çoklu soyad veya kurum adı otomatik kesin tespit edilemez.
Etiketsiz 11 haneli değer yalnızca TCKN doğrulama kuralına uyuyorsa alınır; etiketli ancak doğrulaması geçersiz değerler kontrol işaretiyle gösterilir.
Yanlış eşleştirme riskinden dolayı rastgele transfer açıklamasından kişi adı **uydurulmaz**; bulunamayan alanlar boş kalır.
Kullanıcı önizlemede Ad / Soyad / TCKN hücrelerini elle düzeltebilir. TCKN varsayılan maskeli görünür.

## Güvenlik ve uyumluluk

Excel ve CSV **tarayıcıda** okunur; sunucuya dosya gönderilmez, otomatik muhasebe veya müşteri kaydı oluşturulmaz.
Çıktı yerel CSV dosyası olarak indirilebilir; içinde TCKN'nin tam değeri bulunabileceği için yalnızca yetkili kullanıcılarca güvenli şekilde saklanmalıdır.
CSV formül enjeksiyonuna karşı şüpheli hücre başlangıçları Excel için metin olarak kaçışlanır.
Üretimde kimlik verilerinin KVKK kapsamında saklanması, erişim yetkilendirmesi, saklama süresi ve denetim kayıtları ayrıca tasarlanmalıdır.

## Geliştirici testleri

```bash
cd pinargold-frontend
npm install
npm test
npm run build
```

Bu çalışma, kullanıcıya ait gerçek bir Ziraat export dosyası olmadan yayımlanmış sütun örneklerine göre geliştirildi. Gerçek dosyada başlık ve açıklama düzenleri farklıysa kimlik ayrıştırma kuralları doğrulanmış satır örneklerine göre genişletilmelidir.
