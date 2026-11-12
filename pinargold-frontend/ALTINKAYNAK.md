# Altınkaynak entegrasyonu

Resmî kamuya açık servisler:
- https://www.altinkaynak.com/Araclar/Servisler
- https://static.altinkaynak.com/public/Gold
- https://static.altinkaynak.com/public/Currency

Backend /api/market/prices iki servisi server-side çağırır. 10 saniyelik process-local TTL önbelleği aynı anda gelen istekleri tek kaynak sorgusuna indirger. Frontend aynı backend endpoint'ini her 10 saniyede sorgular. Flask tek worker ile çalıştırıldığında bir önbellek vardır; birden fazla worker/replica kullanılırsa Redis gibi paylaşımlı cache veya ayrı poller gerekir. Kaynak verisi güncellenmezse aynı fiyatlar kalır; kaynak erişilemezse stale=true ve son başarılı fiyatlar döner. İlk erişim başarısızsa boş liste döner.

Örnek kod eşlemeleri: PGA gram (perakende), HH_T has, C çeyrek, Y yarım, T teklik, PB 22 ayar bilezik, P18/P14 ayarlı altın, USD/EUR döviz. **Altınkaynak CH_T ürününün 0.995 saflığı doğrulanamadığından has995 ekranda gösterilmez; HH_T has ürününün saflık etiketi ticari işlem öncesinde doğrulanmalıdır.** Değerler sağlayıcının gişe/toptan varyantları arasında farklılık gösterebilir.

API yanıtındaki sourceUpdatedAt kaynağın yerel tarih metnidir; fetchedAt backend sorgu zamanıdır. 10 saniye kontrol, kaynağın her 10 saniyede yeni fiyat üreteceği garantisi değildir. Kullanım koşulları ve sorgu sıklığı sağlayıcı ile doğrulanmalıdır. Üretim için gözlemlenebilirlik, ortak cache, rate-limit, retry ve veri kalitesi uyarıları gerekir.

Local geliştirme: backend: `cd backend && pip install -r requirements-dev.txt && flask --app app run --port 5001`. Frontend: `cd pinargold-frontend && npm install && npm run dev`. Frontend /api proxy backend'e gider. Docker Compose nginx /api proxy backend:5000'e gider.

Testler: `cd backend && python -m pytest -q`; `cd pinargold-frontend && npm run build`; `POSTGRES_PASSWORD=test-only docker compose config --quiet`.
