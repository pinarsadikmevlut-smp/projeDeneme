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

Gider Pusulası henüz resmî e-Belge değildir; `g-pusulasi` `documentType` değeri yalnızca korumalı PostgreSQL taslağında tutulur. Stopaj, tevkifat, KDV, hesap planı veya mali belge kuralları bu demo modülünde hesaplanmaz. Resmî GP veya fatura düzenlemeden önce yürürlükteki mevzuat ve profesyonel muhasebe onayı gereklidir.

**Uyumluluk notu:** Veritabanındaki mevcut `document_type` alanı VARCHAR(12) olduğu için gider pusulası yalnızca iç kod `g-pusulasi` (10 karakter) olarak saklanır; arayüzde açık adı gösterilir. Böylece mevcut tabloların şeması bu değişiklikle değiştirilmez.

## Güncel Banka Hareketleri → Toplu Taslak Aktarımı (13 Kasım 2026)

- Banka menüsünde Ziraat `.xlsx`/`.csv` dosyasını seçin. Dosya en çok 10 MB'tır, ExcelJS tarayıcıda ayrıştırır, yükleme anında tabloya yansıtılır; banka dosyası tamamıyla sunucuya gönderilmez. `Excel Yükle` eski modülü korunur.
- Sütun sırası: Seçim | Tarih/Saat | Banka/Yön | Ad Soyad/Açıklama | TCKN/VKN | İşlem Tutarı | Fatura Tipi | İşlem. TCKN/VKN listede maskeli; pozitif tutar yeşil, çıkış kırmızı. 25 kayıt/sayfa, arama, filtre, sıralama, toplu checkbox mevcuttur.
- `GET /api/invoices/templates` kullanıcıya özel oturumda hazır şablon listesini döndürür: **Altın Satışı (e-Arşiv/e-Fatura), Sarrafiye Satışı, Hurda Alımı (gider pusulası), Gelen/Giden Diğer**. UI seçenekleri bu API'den okunur.
- Tekil aktarım: Bir hareketin `Fatura Tipi` seçicisini doldurun → **↗ Hızlı taslak aktar**. 
- Toplu aktarım: Tablodan satırları seçin → **Seçilileri Taslağa Aktar** → aranabilir modalda iş şablonunu seçip onaylayın. İstemci 25'lik gruplar halinde `POST /api/invoices/bank-import` çağırır. Gelen/giden yönü farklı olan hareketler seçili şablonla eşleşmiyorsa satır bazında `direction_mismatch` döner, yanlış tipte kayıt oluşturulmaz.
- Önizlemede **Detay / Düzenle / Sil** işlemleri yalnızca tarayıcı belleğindeki bankayı etkiler; gerçek banka kayıtlarını veya PostgreSQL fatura taslaklarını silmez.
- Server geçerli TCKN ile **yalnızca oturum sahibinin** `user_customers` tablosunu arar. Sahip olunan cari bulunursa taslağı `user_invoice_drafts` tablosunda oluşturur. Cari yoksa `customer_not_found` hatasıyla o satır atlanır; yeni müşteri veya kurum kaydı otomatik üretilmez. 10 haneli VKN destekli önizleme vardır, **kurumsal cari kaydı için henüz backend modeli yoktur**; bu kayıtlar açıklayıcı hata ile atlanır.
- Banka tutarı, başlangıç taslak satırına **miktar tahmini yapılmadan** yazılır. Gramaj, milyem, ürün veya KDV otomatik tahmin edilmez. Oluşturulan satır `requiresReview` işaretlidir ve ürün/hizmet bilgisi Fatura Oluştur ekranında düzeltilene kadar **Kontrol Edildi / Hazırla** işlemi backend tarafından reddedilir.
- Yeni `user_bank_draft_import_keys` tablosunda kullanıcı+işlem SHA-256 digest benzersizliği, aynı bankacılık hareketinin tekrar aktarılmasını engeller. Transaction referansı olmayan kayıtlar manuel düzeltme için atlanır. Kısmi aktarım başarı/hata sonuçları satır bazında ekranda görülür.
- JWT/CSRF korumalı işlem; kullanıcı başka kişiye ait müşteri veya taslak üzerinden iş yapamaz. Sistem resmî fatura/gider pusulası üretmez, Mysoft/GİB'e göndermez.

Örnek veriyle test edin; gerçek hesap hareketleri, TCKN ve VKN içeren dosyalar için KVKK yükümlülüklerini değerlendirin. Yeni import-key tablosu, Compose backend başlangıcındaki `flask --app app init-db` komutuyla eksikse oluşturulur; var olan tablolar ve Docker volume korunur.
