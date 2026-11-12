# projeDeneme

Flask web uygulaması; PostgreSQL, SQLAlchemy, Docker Compose ve pytest CI altyapısı.

## Docker Compose ile çalıştırma

```bash
cp .env.example .env
# .env dosyasında POSTGRES_PASSWORD değerini güçlü bir yerel parola ile değiştirin.
docker compose up -d --build
docker compose ps
```

Uygulama: http://localhost:5000 (APP_PORT ile değiştirilebilir).
Mevcut `/` ve `/api/health` endpoint'leri korunur. `/api/health/db` veritabanı bağlantısını denetler.

Veritabanı verileri `postgres_data` adlı kalıcı Docker volume'ünde saklanır.
Veritabanı portu host'a açılmaz. Compose servisleri yerel Docker ağı kullanır.

**Tabloları ilk kez oluşturmak için (geliştirme ortamı):**
```bash
docker compose exec web python -c "from app import app, db; ctx=app.app_context(); ctx.push(); db.create_all(); ctx.pop()"
```
Üretimde şema değişiklikleri için migration (Alembic/Flask-Migrate) ekleyin; `create_all` migration yerine geçmez.

## Yerel test

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -v
```

Testler izole, bellek içi SQLite veritabanı kullanır; PostgreSQL entegrasyon testi değildir.
GitHub Actions testleri, Compose yapılandırmasını ve Docker image build işlemini kontrol eder.
