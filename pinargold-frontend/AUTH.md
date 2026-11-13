# pinarGold — JWT / kullanıcı bazlı kayıtlar

## Akış
- `POST /api/auth/register` → benzersiz kullanıcı adı ve BCrypt (12 cost) parola hash'i.
- `POST /api/auth/login` → 30 dakikalık HS256 JWT; `pinargold_access` HttpOnly/Secure/SameSite=Strict cookie.
- `GET /api/auth/session` → aktif kullanıcı ve yazma işlemleri için CSRF değeri.
- `POST /api/auth/logout` → cookie silinir, `auth_version` artırılarak kullanıcının tüm mevcut JWT'leri geçersiz olur.
- `Authorization: Bearer <JWT>` ile doğrudan API çağrısı da desteklenir. Tarayıcı varsayılan olarak cookie kullanır; token localStorage'a yazılmaz.
- API isteğinde cookie kullanılıyorsa POST/PATCH/PUT/DELETE için `X-CSRF-Token` zorunludur. Frontend ortak `apiRequest` istemcisi bunu otomatik ekler.
- Backend her korumalı istekte JWT'yi doğrular, `g.current_user` atar; kullanıcı kimliği request body/query'den alınmaz.
- `AuthGuard` anonim erişimi `/login` sayfasına yönlendirir; herhangi bir korumalı API 401 yanıtı oturum bilgilerini temizler.

## İzolasyon ve eski veriler
- Yeni `app_users` ve `user_customers` tabloları `init-db` sırasında oluşturulur.
- `user_customers.owner_id` zorunlu; `UNIQUE(owner_id, tckn)`. Aynı TCKN farklı kullanıcılarca kendi alanlarında kaydedilebilir.
- ORM `do_orm_execute` filtrelemesi ve explicit scoped repository sorguları kullanıcı dışı okumaları engeller; `before_flush` ownership tutarsızlıklarını reddeder.
- **Mevcut `customers` tablosundaki kayıtlar değiştirilmez, yeni kullanıcılara taşınmaz ve yeni API tarafından okunmaz.** Geçiş öncesi sahiplik kanıtına dayalı ayrı bir migrasyon yapılmalıdır.
- ORM filtreleri ham SQL, doğrudan engine/connection.execute, bazı toplu mutasyon yolları veya başka yeni modeller için otomatik tam izolasyon garantisi değildir. Bunlar için ileride PostgreSQL Row Level Security ve ayrı kullanıcı kapsamı testleri gerekir.
- Global piyasa fiyatları ve backend denetim olayları müşteri tablosuyla aynı tenant modeli değildir.

## Ortam
`JWT_SECRET_KEY`: uzun, güçlü, rastgele ve gizli (en az 32 karakter). `COOKIE_SECURE=true` HTTPS için önerilir; yalnızca localhost HTTP'de false.
`JWT_SECRET_KEY` olmadan giriş ve korumalı endpoint'ler 503 verir. Backend, Redis/merkezi rate limiting ve kullanıcı silme/saklama süreçleri üretim öncesi güçlendirilmelidir.

## Başlatma
```bash
docker compose up -d --build
# Yeni tablolar backend açılışında flask init-db ile oluşturulur.
```
`http://localhost:8088/register` (yerel HTTP'de COOKIE_SECURE=false).
```bash
cd backend && python -m pytest -q
cd ../pinargold-frontend && npm test && npm run build
```
