# pinarGold Frontend

React + Vite + Tailwind CSS. Tamamen modüler frontend.

## Yerel geliştirme
```bash
cd pinargold-frontend
npm install
npm run dev
```
Arayüz: http://localhost:5173

## Docker
Repo kök dizinindeki Compose servisi `frontend`, bu klasörü build eder. `cp .env.example .env && docker compose up --build -d` komutunu kullanın.

## Yeni sayfa ekleme
1. `src/pages/YeniPage.jsx` oluşturun.
2. `src/config/pageRegistry.jsx` dosyasına lazy import kaydı ekleyin.
3. `src/config/navigation.config.js` dosyasına menü öğesi ekleyin.

`App.jsx` değişmez. Teknik olarak dinamik lazy import haritası Vite bundler'ı için kayıt gerektirir; bu nedenle yalnızca pages + navigation dosyası yeterli değildir.

## Veri
`src/services/marketData.service.js` demo veri kaynağıdır. Gerçek API/WebSocket entegrasyonunda `getMarketSnapshot`, `subscribeMarketData` ve `refreshMarketData` sözleşmelerini koruyun. Fiyatlar **gerçek piyasa verisi değildir**. 539 müşteri sayısı örnektir. Marj modalı yalnızca yerel demo ayarını kaydeder.

## Uyarı
Bu sürümde kimlik doğrulama, fatura yükleme, satış ve gerçek piyasa bağlantısı yoktur. Canlı ticari kullanım için uygun değildir.
