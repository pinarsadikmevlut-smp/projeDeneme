# pinarGold Fatura İş Akışı (ön belge)

## İnceleme ve tasarım
EksenGOLD: kuyumculuğa özgü has gram/milyem/işçilik, özel matrah, banka eşleştirme ve belge aşamalarını tek akışta sunar.
Milyem Plus: banka hareketlerini cari ve belgeyle eşleştirmeye odaklanır; stok ve gider pusulası modülleri de bulunur.
Mysoft: resmî e-Belge özel entegratörü olup API üzerinden oluşturma, gönderme ve durum sorgulama aşamalarına sahiptir.
Bu projede yalnızca sektörün **genel iş akışı fikirleri** örnek alınmıştır; ekran, marka, logo veya kod kopyalanmamıştır.
Kaynaklar (13 Kasım 2026):
- https://eksengold.com/kuyumcu-fatura-sistemi
- https://milyemplus.com/
- https://mysoft.com.tr/e-fatura-api-entegrasyonu

## Ekranlar ve iş akışı
1. **Fatura Oluştur** (`/fatura-olustur`): sahip olunan müşteri kartını seç; belge tipi, ödeme, gram/ayar/milyem, birim fiyat ve işçilik ekle.
2. **Taslak Faturalar** (`/taslak-faturalar`): PostgreSQL üzerinde kişisel taslaklar. Taslaklar düzenlenir, kontrol edilmişse 'Hazır' durumuna geçer. Hazır belge, tekrar taslağa alınabilir.
3. **Mysoft Aktarım Kuyruğu** (`/mysoft-aktarilanlar`): hazır taslakları sadece *simüle* aktarır. Gerçek servis çağrısı, UBL veya GİB iletimi yoktur.
4. **Banka → Fatura** (`/banka-fatura`): Ziraat Excel/CSV dosyasından gelen havaleyi tarayıcıda ayrıştırır, yalnızca referans ve tutarı taslak formuna taşır. Kaydetmeden önce gerçek ürün adı ve müşteri doğrulanmalıdır.
5. **Satış Yap**: demo sepeti yeni taslağa aktarılabilir; gramaj varsayımları kullanıcı tarafından kontrol edilmelidir. Resmî satış tamamla butonu hâlâ kapalıdır.

## API
JWT oturumu + HttpOnly cookie + CSRF / Bearer:
- GET /api/invoices?status=all|draft|ready|simulated
- POST /api/invoices
- GET/PATCH /api/invoices/{id}
- POST /api/invoices/{id}/review
- POST /api/invoices/{id}/reopen
- POST /api/invoices/{id}/simulate-transfer

Sadece oturum sahibi `owner_id` filtreli kayıtlarına ulaşabilir; `customer_id` aynı kullanıcıya ait olmak zorundadır. SQLAlchemy global ownership filtresi/flush koruması ayrıca uygulanır. Kullanıcı kimliği request body/query'den asla alınmaz. Denetim kayıtlarında müşteri kimlik numarası bulunmaz.

## Hesaplama sınırı
Satır tutarı = `(gramlı ürünse gram × gram fiyatı, adetliyse adet fiyatı + birim işçilik) × miktar`.
Has karşılığı = `gram × milyem × miktar`. Bunlar **yalnızca ticari önizleme** değerleridir; KDV, özel matrah veya GİB uyumu için mali müşavir onayı ve ilgili e-belge entegrasyonu gereklidir.
`PG-TAS-XXXXXX` kimlikleri yalnızca **iç taslak referansıdır**, resmî fatura numarası değildir.
Bu sürümde gerçek müşteri ekstresi, mali uyum taraması, e-Fatura oluşturma/gönderme, Mysoft entegrasyonu, stok muhasebesi ve ödeme tahsilatı yoktur.

## Kurulum ve güvenlik
Mevcut Docker PostgreSQL birimine yeni `user_invoice_drafts` tablosu `flask --app app init-db` ile **eksikse** eklenir. Mevcut tablolar silinmez.
Uygulama: `docker compose up -d --build`, `JWT_SECRET_KEY` zorunludur.
`db.create_all()` ileride şema değişiklikleri için migrasyon aracı değildir: Alembic gerekecektir.
Üretim öncesi RLS, kaynak bazlı hız sınırlama, rol/işletme tanımları, vergi hesaplama testleri, stok/ödeme entegrasyonları ve Mysoft sandbox anahtarları ile gerçek entegrasyon değerlendirilmelidir.

## Banka hareketlerinde belge şablonu seçimi
Ekstre yüklenince tüm gelen/giden işlemler orijinal işlem yönüyle listelenir: seçim kutusu, tarih/saat, kaynak banka/yön, karşı taraf/açıklama, renkli tutar, **BELGE**, işlem. Belge alanında üç taslak şablonu bulunur: **Fatura · e-Arşiv**, **Fatura · e-Fatura**, **G.P. · Gider Pusulası**. Satırdaki **İlerle** düğmesi ancak belge türü seçildikten sonra açılır. Seçimle yalnızca belge tipi, banka işlem numarası, yön ve tutar fatura/gider pusulası *taslak* formuna taşınır; bankadaki TCKN ve tüm açıklama otomatik olarak backend'e gönderilmez. Taslak formunda cari, ürün ve tutarlar doğrulanmadan kayıt yapılamaz. Seçim kutuları/toplu şablon uygulaması, gelen-giden filtreleri, tarih aralığı, arama ve satır detayları sağlanır. 

Gider Pusulası henüz resmî e-Belge değildir; `gider-pusulasi` `documentType` değeri yalnızca korumalı PostgreSQL taslağında tutulur. Stopaj, tevkifat, KDV, hesap planı veya mali belge kuralları bu demo modülünde hesaplanmaz. Resmî GP veya fatura düzenlemeden önce yürürlükteki mevzuat ve profesyonel muhasebe onayı gereklidir.
