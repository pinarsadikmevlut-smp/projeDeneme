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
Ad Soyad tek tabloda gösterilir; ayrıştırma sırasında ilk ad(lar) ve son sözcük soyad olarak ele alınır. Çoklu soyad veya kurum adı otomatik kesin tespit edilemez.
Etiketsiz 11 haneli değer yalnızca TCKN doğrulama kuralına uyuyorsa alınır; kimlik doğrulama sonucu kod tarafında tutulur ancak tabloda durum etiketi gösterilmez.
Etiket bulunmadığında açıklamadaki **tamamı büyük harfli, iki veya daha fazla sözcüklü kişi adı adayları** ayrıca aranır; FAST, EFT, HAVALE, BANKA gibi işlem ifadeleri dışlanır. Bu yöntemin sonucu **tahmini** olduğundan operatörün gözden geçirmesi gerekir. Güvenilir aday bulunamazsa alan boş kalır.
Kullanıcı önizlemede Ad Soyad / TCKN hücrelerini elle düzeltebilir. Kullanıcı isteği üzerine **TCKN maskelenmeden** gösterilir.

## Ekran sütunları

Görüntülenen sütunlar: Muh Tarih, İşlem No, İşlem Açıklaması, Ad Soyad, TCKN, İşlem Tutarı. **Valör ve Bakiye sütunları kaldırılmıştır**; dosyadan okunan değerler ayrıştırıcıda korunur. Borç ve Alacak tek **İşlem Tutarı** sütununda birleştirilir. **Gelen** tutar yeşil, **Giden** tutar kırmızı etiketle gösterilir. CSV dışa aktarımında da Bakiye bulunmaz, `İşlem Yönü` bilgisi bulunur. Ad Soyad ve TCKN hücrelerinin altındaki `Tahmini` ve `Kontrol` etiketleri gösterilmez.

## Güvenlik ve uyumluluk

Excel ve CSV **tarayıcıda** okunur; sunucuya tam banka ekstresi gönderilmez. Ancak **müşteri yönetimi için yetkili oturum açıkken** geçerli Ad Soyad/TCKN çiftleri `/api/customers/import` üzerinden PostgreSQL'e **kalıcı kaydedilir**. Oturum açık değilken yalnızca yerel önizleme yapılır. Otomatik muhasebe/fatura kaydı oluşturulmaz.
Önizleme ve indirilen yerel CSV dosyası TCKN'nin tam değerini içerir; ekranın üçüncü kişilerce görülmesi ve dosyanın paylaşılması konusunda özel dikkat gereklidir. Yalnızca yetkili kullanıcılarca güvenli şekilde saklanmalıdır.
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
