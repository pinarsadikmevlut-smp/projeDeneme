# goldenSoft

Modern, iki katmanlı web uygulaması başlangıç projesi.

## Teknolojiler
- **Frontend:** React + Vite (TypeScript)
- **Backend:** Python Flask REST API
- **Veritabanı:** PostgreSQL (kalıcı yerel Docker volume)
- **Çalıştırma:** Docker Compose
- **Test:** pytest ve GitHub Actions

## Başlatma
Docker ve Docker Compose yüklü bilgisayarınızda:

```bash
cp .env.example .env
docker compose up --build -d
```

- Web arayüzü: http://localhost:8088
- Backend sağlık kontrolü: http://localhost:5001/api/health

Bu portlar yerel makinenizde başka servislerce kullanılıyorsa, `.env` içindeki `FRONTEND_PORT` ve `BACKEND_PORT` değerlerini değiştirin.

## Geliştirme
```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
python -m app

# Frontend (ayrı terminal)
cd frontend
npm install
npm run dev
```

Vite geliştirme sunucusu http://localhost:5173 üzerinde çalışır ve `/api` isteklerini yerel backend'e yönlendirir.

## Proje yapısı
```text
goldenSoft/
├── backend/
│   ├── app/__init__.py
│   ├── tests/test_health.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/App.tsx
│   ├── src/main.tsx
│   ├── src/style.css
│   └── Dockerfile
├── compose.yaml
└── .github/workflows/ci.yml
```

> Bu ilk sürüm bir başlangıç iskeletidir. Henüz kimlik doğrulama, kullanıcı/rol yönetimi ve uygulamaya özel iş süreçleri eklenmemiştir. Üretime açmadan önce güvenlik ve dağıtım yapılandırmasını gözden geçirin.
