# pinarGold — Fiyat güncelleme mimarisi

## Veri kaynağı

Altınkaynak'ın resmî servis sayfası: https://altinkaynak.com/Araclar/Servisler

- Altın: https://static.altinkaynak.com/public/Gold
- Döviz: https://static.altinkaynak.com/public/Currency

Güncel örneklerde altın verisi yaklaşık 53, döviz verisi yaklaşık 14 ürün içerebilir. Ürün sayıları sağlayıcıda değişebilir. Kod ve miktar ayrıştırması kaynak şemasına göre yapılır: `6.259` = 6259 TL, `50,220` = 50,220 TL, `19.908,45` = 19908,45 TL.

## Veri akışı

```text
Altınkaynak Gold ----┐
                     ├-- iki paralel HTTPS GET (maksimum 4 sn timeout)
Altınkaynak Currency ┘          |
                                 v
                         Flask QuoteStore
               arka planda monotonic 10 sn poller
                    process-local atomik cache
                                 |
                                 v
                         GET /api/market/prices
                      (hiçbir zaman upstream beklemez)
                                 |
                                 v
                      React 10 sn istek döngüsü
                 tek timer + AbortController + cleanup
                                 |
                  değişen fiyatları reconcile et
                /       |        |        \
          Canlı tablo  Kartlar  Ticker  Satış demo
```

- İlk HTTP isteği arka plan poller'ını başlatır. İlk yanıt `warming` olabilir; frontend veri gelene kadar 1 saniyelik warm-up kontrolleri yapar. Normal fiyat akışı başladığında frontend sorguları 10 saniye arayla başlar.
- Backend ilk isteği bekletmez; son atomik snapshot'ı sunar.
- Backend Gold ve Currency isteklerini **aynı poll döngüsünde paralel** yapar. Bir kaynak kesilirse diğerinin yeni fiyatları gösterilebilir, kesilen kaynağın önceki fiyatları **ESKİ** etiketlenir.
- Sağlayıcı `GuncellenmeZamani` kaynak saati Türkiye saati kabul edilerek UTC'ye dönüştürülür. Beş dakikadan eski veya zaman açısından tutarsız kayıtlar ürün bazında `stale=true` olur. Kaynak saati olmayınca da `stale=true`.
- Tüm geçerli kodlar döner; yalnızca tanınan ürünlerin sabit uygulama ID'leri vardır. Diğer ürünlerin ID'si `gold:KOD` veya `currency:KOD` şeklindedir. Doğrulanmamış 0.995 saflık eşlemesi yapılmaz.
- Sunucu yanıtı `quotes`, `quoteCount`, `staleCount`, `state` (`warming`, `live`, `partial`, `stale`, `unavailable`, `error`), `checkedAt`, `fetchedAt`, `feedStatus` alanlarını içerir.
- Alış ve satış fiyatı değişimi **ayrı ayrı** takip edilir; ilgili hücrede animasyon tetiklenir. Fiyat değişmediğinde liste satırı nesnesi yeniden üretilmez.
- Birden çok React abonesi ortak timer/fetch kullanır. Ekran görünür olduğunda ya da internet bağlantısı geri geldiğinde ek sorgu yapılabilir; eski istek yanıtları unsubscribe sonrasında yok sayılır.
- Tarayıcılar arka plan sekmelerindeki timer'ları kısıtlayabilir. 10 saniye talep hedefidir; ağ gecikmesi, Altınkaynak kaynak güncellemeleri veya tarayıcı kısıtları nedeniyle mutlak zaman garantisi verilemez.
- Gunicorn varsayılanı **tek worker + 8 thread**. Process-local poller tek instance ile güvenlidir. Birden fazla backend worker/container için Redis/PostgreSQL tabanlı ortak cache ve leader election gerekir; bu mimari henüz o durumda otomatik tek sorgu sağlamaz.
- Hiçbir piyasa fiyatı rastgele üretilmez. Önbellek verileri resmi işlem/fatura fiyatı olarak kullanılmamalıdır. Sağlayıcının ticari kullanım ve sorgu sıklığı koşulları ayrıca doğrulanmalıdır.

## Testler

```bash
cd backend
python -m pytest -q
python scripts/smoke_altinkaynak.py  # İnternet bağlantısı gerekir, 10 sn aralıkla 2 gerçek kaynak sorgusu

cd ../pinargold-frontend
npm install
npm test
npm run build
```

- Backend: 67 farklı geçerli ürün işleme, sayı/tarih dönüşümü, ürün bazlı eskime, iki kaynaktan birinin kesilmesi, eşzamanlı HTTP okuma ve 10 sn zamanlayıcının kontrollü ölçekli testi.
- Frontend: fake timer ile 0/10/20 sn sorguları, birden fazla abone, yavaş yanıtta çakışmama, ağ hatasında eski veriyi işaretleme, 67 ürünün tabloda görüntülenmesi ve fiyat güncellemelerinin DOM'a yansıması.
- Gerçek canlı smoke testi kaynak erişilebilirliğini ve şemasını ölçer; **fiyatın her 10 saniyede değiştiğini garanti etmez.** Kaynağın kendi güncelleme sıklığı bağımsızdır.
- Tarayıcı Geliştirici Araçları → Ağ → `market/prices` filtresiyle istek başlangıçları arasındaki süreyi kontrol edin. Backend yanıtında `checkedAt` değişimini ve `staleCount` değerlerini izleyin.

## Codespaces

Frontend `http://localhost:5173`, Vite `/api` isteklerini Flask `http://127.0.0.1:5001` adresine proxy'ler. Her iki süreci çalıştırmak gerekir. Örnek komutlar:

```bash
cd /workspaces/projeDeneme/backend
python -m pip install -r requirements-dev.txt
python -m flask --app app run --host 0.0.0.0 --port 5001

# Ayrı terminal
cd /workspaces/projeDeneme/pinargold-frontend
npm install
npm run dev -- --host 0.0.0.0
```
