## Girişsiz demo modu (güncel)

**Müşteri Listesi menüsü artık doğrudan açılır.** Backend oturumu yoksa tamamen
kurgusal örnek müşteriler gösterilir; TCKN sütunundaki `0000000000x` değerleri
geçersiz test numaralarıdır, gerçek kimlik numarası değildir.

- Demo liste içinde arama, yeni müşteri ekleme, düzenleme ve Excel'den toplu
  aktarma çalışır. Aynı TCKN tekrarlanmaz.
- Girişsiz demo modunda veriler yalnızca **React belleğinde** tutulur.
  PostgreSQL'e gönderilmez ve **tarayıcı sayfası yenilenince sıfırlanır**.
- Gerçek müşteri bilgilerini demo ortamına yüklemeyin. Excel önizlemesi
  tarayıcıda işlenir; API'ye aktarılmaz.
- Gerçek PostgreSQL müşteri API'si kimlik doğrulaması ve CSRF kontrolü
  gerektirmeyi sürdürür. İleride ortak kullanıcı yönetimi eklendiğinde
  demo modundan yetkili kalıcı kayda geçilebilecektir.
- Bu demo geliştirmesi veritabanındaki mevcut müşteri verilerini veya
  Docker volume'larını değiştirmez.

---

# pinarGold — Kalıcı Müşteri Listesi (PostgreSQL)

## Mimari kararı

Mevcut proje **Flask + SQLAlchemy + PostgreSQL 16 + Docker Compose** ile çalıştığı için ikinci bir SQLite dosyası açılmadı. **SQL Developer**, Oracle SQL Developer dahil olmak üzere, bir veritabanı sunucusu değil yönetim aracıdır. Aynı PostgreSQL kalıcı Docker hacmi (`postgres_data`) müşteri kayıtlarını da tutar.

- `customers`: kimlik, Ad Soyad, eşsiz TCKN, kayıt kaynağı, oluşturulma ve güncellenme tarihi.
- `audit_events`: müşteri oluşturma, güncelleme ve toplu aktarma metaverisi. **Ad Soyad ve TCKN audit detaylarına yazılmaz.**
- Başlangıçta `python -m flask --app app init-db` eksik tabloları oluşturur; mevcut verileri silmez. Bu komut **migrasyon aracı değildir**; sonraki şema değişiklikleri için Alembic önerilir.
- Tam banka ekstresi veritabanına yüklenmez. Yalnızca doğrulanmış **Ad Soyad / TCKN çiftleri** aktarılır. TCKN doğrulaması matematiksel biçim kontrolüdür, kişinin kimliğini doğrulamaz.

## İlk kurulum — Docker Compose

Proje kökünde, `.env.example` dosyasını `.env` olarak kopyalayın. Şu alanları **gerçek, güçlü ve benzersiz değerlerle** değiştirin:

```dotenv
POSTGRES_PASSWORD=<strong-local-db-password>
CUSTOMER_ADMIN_USERNAME=operator
CUSTOMER_ADMIN_PASSWORD=<strong-unique-admin-password-at-least-12-characters>
SECRET_KEY=<random-secret-at-least-24-characters>
# Yalnızca yerel HTTP (localhost:8088) için:
COOKIE_SECURE=false
```

`SECRET_KEY` üretmek için: `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

**Önemli:** `<...>` yer tutucularını gerçek değerle değiştirin. Örnek `replace-` değerleri ile giriş açılmaz. `.env` dosyasını Git'e göndermeyin; sunucuda güvenli saklayın.

Ardından:

```bash
docker compose up -d --build
docker compose ps
```

Backend Compose açılışında önce `init-db` komutunu çalıştırır; PostgreSQL sağlıklı olana kadar başlamaz. Yerel arayüz **http://localhost:8088/musteriler**. Codespaces'te yönlendirilen 8088 bağlantısını açabilirsiniz. HTTPS üzerinden erişimde `COOKIE_SECURE=true` kullanın.

### Ayrı Flask / Vite geliştirmesi (Codespaces)

Mevcut PostgreSQL servisi çalışırken backend ortam değişkenlerini tanımlayıp:

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m flask --app app init-db
python -m flask --app app run --host 0.0.0.0 --port 5001

# başka terminalde
cd pinargold-frontend
npm install
npm run dev -- --host 0.0.0.0
```

Vite `/api` isteklerini 5001 portundaki Flask'a yönlendirir. Yerel HTTP oturumu için `COOKIE_SECURE=false` gerekir; HTTPS üzerindeki Codespaces bağlantısında güvenli çerez kullanın.

## Kullanım akışı

1. **Girişsiz demo için** Müşteri Listesi menüsüne doğrudan girin; örnek müşteriler gösterilir. Kalıcı PostgreSQL işlemleri için mevcut backend yönetici oturumu ayrı olarak gereklidir.
2. **Excel Yükle** menüsünden Ziraat `.xlsx` / `.csv` ekstresini seçin.
3. İçerikten ayrıştırılan **geçerli Ad Soyad + TCKN** kayıtları otomatik olarak `POST /api/customers/import` üzerinden PostgreSQL'e kaydedilir. Eksik veya kontrol basamağı hatalı TCKN kaydedilmez.
4. Sonuçta yeni, mevcut ve geçersiz kayıt sayıları gösterilir. Aynı TCKN yeniden yüklenirse ikinci kayıt açılmaz; otomatik aktarım **mevcut ismi değiştirmez**.
5. **Müşteri Listesi** sayfasından arama yapabilir, **+ Yeni Müşteri** ile ekleyebilir, **Düzenle** ile Ad Soyad/TCKN değiştirebilirsiniz. Değişiklikler kalıcıdır.

Oturum yokken Excel'den ayrıştırılan müşteri bilgileri **yalnızca geçici demo listesine** kopyalanır. Kalıcı PostgreSQL aktarımı yapılmaz; sayfa yenilenince veriler sıfırlanır.

## Güvenlik ve sınırlar

- Yönetim API'leri kimliği doğrulanmış oturum gerektirir. Değişiklikler CSRF token ile korunur; oturum çerezi HttpOnly, SameSite=Strict ve HTTPS ortamında Secure'dur. Parola frontend koduna veya localStorage'a yazılmaz.
- Basit tek-operatör parola girişi **kurumsal SSO/MFA yerine geçmez**. Üretim ortamında kurumsal giriş, rol matrisi, güçlü rate limiting, HTTPS ve denetim süreçleri eklenmelidir.
- TCKN müşteri listesinde **açık olarak görünür**, PostgreSQL'de tutulur. KVKK kapsamında erişim sınırları, disk yedeklerinin güvenliği, saklama/silme politikaları ve gerekli şifreleme değerlendirilmelidir.
- İçe aktarılan adlar açıklamadaki büyük harfli metinden tahmin edilmiş olabilir. Otomatik eşleştirmeyi işlem öncesinde doğrulayın.
- PostgreSQL testi GitHub Actions'ta ayrılmış geçici Postgres 16 örneğinde koşar. Çalışan kullanıcı sunucusuna ChatGPT tarafından bağlanılıp veri aktarımı yapılmaz.

## Testler

```bash
cd backend
python -m pytest -q
cd ../pinargold-frontend
npm test
npm run build
```
