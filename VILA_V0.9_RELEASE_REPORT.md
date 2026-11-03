# VILA ERP — v0.9.0 Pilot Release Report

Tarih: **4 Kasım 2026 — Europe/Istanbul**

**Karar: Dondurulmuş kapsamın kontrollü pilot kaynak adayı doğrulandı. Production deployment ve ana DB migration'ı yapılmadı.**

## Git ve izlenebilirlik

- Private repository: https://github.com/kacamayanjojuk28-collab/vila-erp
- Doğrulanmış uygulama commit'i: `bd20cf3daef34150a3b3149b6b759d0db7372e46`.
- Başlangıç: `ae2a388b5beb2fcadce3270e0310ac73c005f406`; öncesine ait geçmiş varmış gibi gösterilmedi.
- Etiket: `v0.9.0-pilot`; uygulama commit'i üzerine yalnız rapor/kanıt ekleyen commit'i işaretler. Kesin hedef `git rev-parse v0.9.0-pilot^{commit}` ile alınır; açıklamalı etiket uygulama SHA'sını da içerir.
- Production build ID: `1ykbteY5W0SGPqPOaw6yz`; Node `v26.13.0`, PostgreSQL `18.6`, Next `16.4.3`.
- Dosya/blob manifesti: `docs/verification/rc-source-manifest.json`. Değişen dosyaların eksiksiz listesi: `docs/verification/rc-changed-files.txt`.
- `.local`, secret dosyaları, cluster/dump, oturumlar, visual API fixture cache'i, node_modules ve build klasörleri Git dışında. Credential taramasındaki tek bulgu `.env.example` içindeki açık placeholder bağlantılarıydı.

## B1 — Read-RBAC

API ve arayüz `src/lib/permissions.ts` matrisini paylaşır. Mevcut yazma rolleri korunur. Hassas modül GET ve teslimat alt yolları sunucuda denetlenir. Dashboard full/summary yanıtları, müşteri history belgeleri ve rapor grupları aynı kurallara bağlıdır. Yetkisiz rollere finansal özet alanları ve audit aktiviteleri gönderilmez. Menü/widget görünürlüğü ve doğrudan hash navigasyonu uyumludur.

| Rol | finance | audit | sales | quotes | purchases | requests |
|---|---|---|---|---|---|---|
| OWNER / ADMIN | Evet | Evet | Evet | Evet | Evet | Evet |
| SALES | Hayır | Hayır | Evet | Evet | Hayır | Hayır |
| WAREHOUSE | Hayır | Hayır | Hayır | Hayır | Evet | Evet |
| FINANCE | Evet | Hayır | Evet | Hayır | Evet | Hayır |
| MEMBER / VIEWER | Hayır | Hayır | Hayır | Hayır | Hayır | Hayır |

FINANCE, mevcut ödeme/belge seçimi akışı için satış ve satın alma belgelerini okuyabilir; bu belgelerde yazma yetkisi kazanmaz. Kapsam dışındaki ortak operasyonel okuma davranışı korunur.

## B2 — Async scrypt

`passwordHash` / `passwordCheck` async crypto.scrypt kullanır. Salt 16 byte hex, çıktı 64 byte hex, N=16384 ve `salt:hash` formatı değişmez; timingSafeEqual korunur. Kayıt, giriş, parola değişikliği ve seed await eder. Seed iş tabloları tenant bağlamında oluşturulur.

Tarihsel scryptSync hash'i birim testinde ve gerçek HTTP girişinde doğrulandı. Yanlış/bozuk hash reddedildi. Eşzamanlı türetme sırasında event loop'un çalıştığı test edildi. Boş DB'de migration + seed ve seed parolasının uygulamanın async kontrolüyle doğrulanması geçti.

## B3 — Login rate-limit

PostgreSQL atomik sayaçları ve 10 dakikalık pencere kullanılır. Doğrulanmış IP başına 120, doğrulanmamış ortak kaynak için 300 deneme bütçesi vardır. IP/hesap çifti başına 20 rezervasyon eşzamanlı denemeleri sınırlar. Başarı yalnız kendi rezervasyonunu düşürür; eşzamanlı başarısızlıkları silmez.

Hesap genelindeki 30 başarısız deneme bütçesi yalnız yanlış kimlik bilgilerine uygulanır. Uzaktan hesap sınırını tüketmek doğru parolayla girişi hesap genelinde kilitlemez. Aynı IP/hesap çiftinin sınırı geçerlidir ve pencere sonunda iyileşir.

Next Request socket peer adresini sunmadığından doğrulanmamış X-Forwarded-For kullanılmaz. Opsiyonel VILA_TRUSTED_PROXY_SECRET en az 32 karakter olmalıdır. Proxy dışarıdan gelen token/XFF başlıklarını silip kendi token'ını ve tek, geçerli istemci IP'sini enjekte etmelidir. Bu sınır doğrulanmadan secret etkinleştirilmemelidir. Varsayılan ortak `unverified` bütçesinde sahte XFF yeni kota yaratmaz.

22 başarılı giriş, 25 eşzamanlı başarısız giriş (20×401, 5×429), eşzamanlı 6 başarılı + 6 başarısız giriş, süre sonu, IP/hesap sınırı, parola değişikliği ve tarihsel hash test edildi.

## A2 — Görsel baseline

Korunmuş 3200 sürümü onaylı büyük **VILA** wordmark referansıdır. Aynı API yanıtları, sabit tarih, hazır fontlar ve reduced-motion ile altı sayfa × desktop/mobil × açık/koyu = **24 görünüm** karşılaştırıldı. Son referans koşusunda **24/24 PNG byte eşitliği** sağlandı. Mock'lar yalnız görsel kıyas içindir; ERP/güvenlik testleri gerçek backend/DB kullanır.

Eski snapshot testi önce aynen çalıştırıldı: **7.581 pixel farkıyla FAILED**. Eski yeşil V + küçük vila yerine güncel VILA wordmark, buna bağlı navigasyon konumu ve dönem/fixture farkları görsel olarak incelendi. Kanıt: `rc-legacy-visual-failed.json`, `rc-legacy-visual-diff.png`. Baseline ancak referans kıyasından sonra güncellendi; mevcut 0.003 toleransı ve geometrik assertion'lar korunur.

Bir tekrar koşusunda iki desktop overview görüntüsünde GPU gradient rasterizasyonundan kanal başına en fazla 3 ton farkı görüldü. İki hedefte aynı yazılımsal render ayarıyla katı byte eşitliği yeniden sağlandı; tolerans artırılmadı. Ardışık navigasyon testi, reduced-motion tercihinde menü vurgusunun gizlenme süresini yakaladı; yalnız bu tercihte süre sıfırlandı. Normal GSAP süreleri ve CSS korunur. Nihai geometri ve 24 görünüm regresyonları geçti.

## A1 / A3 — Ortam ve migration konsolidasyonu

Mevcut repository'nin önceki commit edilmemiş hardening/RLS/SEO/UI değişiklikleri izole kopyaya korundu. B4 SQL optimizasyonu, Paket D ve yeni ERP modülü eklenmedi. Migration SQL'leri orijinal çalışma ağacıyla SHA-256 bakımından aynıdır. Yeni migration yazılmadı; önceki tenant-line migration'ı Git kaydına alındı.

| Ortam | Build ID / klasör | DB | Güncel durum |
|---|---|---|---|
| 3000 | YMuAsmDCWyZFK589uo5er / .next | 55432 / vila | HTTP ve DB ECONNREFUSED; migration listesi okunamadı; başlatılmadı |
| 3100 | Cy-SlI9w12ldVWwEwUqam / .next-audit | 6543 / vila_hardening | Health 200; 7 migration; DB RLS ve tenant context kapalı |
| 3200 | GZVsXQPBh3L5MhyDC67VE / .next-sprint | 7543 / vila_sprint_01 | Health 200; 7 migration; 8 iş tablosunda RLS/context açık |
| RC 3300 | 1ykbteY5W0SGPqPOaw6yz / .next-rc | 8543 / vila_rc_090 | Yeni izole cluster; 7 migration; RLS açık; release testleri geçti |

3000 artifact'ında summary/zorunlu idempotency/SEO/RLS işaretleri yok; 3100'de summary/idempotency/SEO, 3200'de ayrıca RLS bağlamı var. Geçmiş artifact'ların tam kaynak commit eşlemesi mevcut geçmişten çıkarılamaz. Tek doğrulanmış kaynak yukarıdaki uygulama commit'idir. Sanitized config, migration checksum ve read-only DB ölçümleri `rc-environments.json` içindedir.

RC önceki izole test yedeğinden kuruldu. Ayrıca yeni cluster'da boş `vila_rc_migration_090` DB'sine yedi migration sıfırdan uygulandı ve seed geçti. Mevcut DB'ler birleştirilmedi, sıfırlanmadı, silinmedi. Yeni cluster'ın ilk 7543 başlatma denemesi port doluluğuyla başarısız oldu; mevcut sürece dokunulmadan 8543 kullanıldı.

RLS SQL'i mevcut ayrı `deploy/sprint-rls.sql` politika setidir; production migration zincirine eklenmedi. RC installer yalnız 127.0.0.1:8543/vila_rc_090 hedefini kabul eder. Pilot kurulumda DB politikası ve VILA_RLS=1 birlikte kurulmalıdır.

## Test sonuçları

| Kontrol | Sonuç / kanıt |
|---|---|
| Birim | **10/10**, fail/skip 0; hash, event loop, izin matrisi ve proxy sınırı dahil |
| Tam Playwright | **37/37**, fail/skip/flaky 0; `rc-functional-final.json` |
| TypeScript | tsc --noEmit exit 0; build TypeScript aşaması da geçti |
| Production build | Next build başarılı; yukarıdaki build ID |
| RLS | 8 tabloda ENABLE/FORCE; context yokken deny; A/B okuma/yazma reddi; `rc-rls.json` |
| Transaction/pool | 100 eşzamanlı transaction, tek bağlantı tekrar kullanımı ve commit/rollback context temizliği geçti |
| ERP güvenliği | Tenant/rol, CSRF, idempotency, oversell/rollback, ödeme/ters kayıt, kısmi teslim, davet/oturum/parola akışları geçti |
| Yeni boş DB | 7 migration + seed + async parola doğrulaması; negatif stok/fazla ödeme/belge toplam farkı 0; `rc-fresh-migration.json` |
| Görsel | Referans 24/24 byte eşitliği; eski geometri + 24 görünüm final regresyonu geçti |
| Koruma | Orijinal kaynak/konfigürasyon SHA'ları değişmedi; `rc-preservation.json` |

İlk yeni koşunun yanlış alert locator'ı ve Prisma/DB timestamp gösteriminden kaynaklanan fixture süre hatası düzeltildi; assertion gevşetilmedi. Sonraki görsel başarısızlık kayıtları da rc-*-failed.json dosyalarında korunur. Nihai başarı bu kayıtları gizlemez.

Eski izole yedekte iki satırsız `FK doc`, total=1 sentetik test fixture istisnası halen vardır (`rc-integrity.json`). Önceki sprintte de kayıtlıdır. Silinmedi ve bütün veriler temiz diye sunulmadı. Yeni boş migration/seed DB'sinde aynı hatalar yoktur. Bu eski test yedeği pilot müşteri verisi olarak aktarılmamalıdır.

## Değiştirilen dosyalar

Bu turun işlevsel dosyaları: src/lib/permissions.ts, login-limit.ts, security.ts; src/app/api/[...path]/route.ts; src/components/workspace.tsx, dashboard.tsx, reports.tsx, motion.ts; scripts/seed.ts; package.json/package-lock.json.

Test/koşum: tests/domain.test.ts, release.test.ts, tests/e2e/release.spec.ts, visual.spec.ts, tests/isolated.ts; 32 görsel baseline; scripts/rc-run.mjs, rc-rls-install.mjs, rc-rls-verify.mjs, rc-integrity.mjs, rc-visual.mjs; .env.example, .gitignore ve release kanıtları. Önceki değişikliklerin konsolidasyonu dahil tam liste rc-changed-files.txt içindedir. Bu turun CSS farkı yoktur.

## Kabul kriterleri ve gerçek engeller

1. B1/B2/B3: **Karşılandı**.
2. Güncel tasarımla görsel referans uyumu: **Karşılandı**.
3. Kapsamdaki zorunlu işlevsel/birim/RLS/güvenlik testleri: **Karşılandı**.
4. TypeScript/production build: **Karşılandı**.
5. Kod/migration/environment farklarının belgelenmesi: **Karşılandı**; erişilemeyen 3000 DB migration listesi bilinmiyor olarak kaydedildi.
6. Ana DB ve mevcut verilerin korunması: **Karşılandı**; mevcut DB'lerde sadece read-only kontrol yapıldı.
7. Tek izlenebilir kaynak adayı: **Karşılandı**; private repository, uygulama commit'i ve açıklamalı pilot etiketi.

**Dondurulmuş kapsamın izole pilot RC'sini engelleyen açık test/kod hatası yok.** Ana 3000 ortamı erişilemiyor; etiket ana ortama geçiş izni veya ana verinin doğrulandığı iddiası değildir. Kimlik/bootstrap tabloları mevcut uygulama doğrulamasına dayanır; DB RLS doğrulaması sekiz iş tablosunu kapsar. Tüm DB tablolarında RLS veya production güvenlik sertifikasyonu iddia edilmez. Kapsam yeni bir genel denetime genişletilmedi.

## Pilot deployment için operasyonel adımlar

1. Private repository'den v0.9.0-pilot etiketini alın; uygulama SHA/manifest ve yedi migration checksum'unu kontrol edin. Gerçek secret'ları işletim ortamında üretin.
2. Ayrı pilot DB/cluster seçin; 3000/3100/3200 bağlantılarını kullanmayın. Migration rolüyle yedi migration ve runtime izinlerini kurun. Sekiz tablo RLS SQL'ini ayrıca uygulayıp VILA_RLS=1'i etkinleştirin. Test yedeğini müşteri verisi olarak taşımayın.
3. Doğrulanan Node/PG sürümleriyle npm ci, Prisma generate ve production build alın. Docker/Node 24 seçilecekse aynı kapıları bu runtime'da tekrar çalıştırın; bu tur container deployment provası yapılmadı.
4. Onaylı pilot origin/HTTPS ve proxy sınırını ayarlayın. Strip/inject davranışı doğrulanmıyorsa proxy secret'ını tanımlamayın; unverified ortak kota geçerlidir.
5. Login, izin reddi, tenant switch, satış/alış, stok, ödeme, idempotency ve RLS/pool smoke testlerini pilot hedefte çalıştırın. Yedek/ayrı restore ve erişim kayıtlarını işletim ekibi doğrulasın.
6. Ana veri kullanılacaksa önce erişilemeyen ana DB'nin read-only migration/bütünlük kaydı, onaylı yedek ve ayrı restore provası tamamlanmalı; ana migration/deployment için ayrıca açık onay alınmalı. Bu çalışma bunları gerçekleştirmedi.
7. Uyumlu artifact/DB policy/tenant context birlikte geri alınabilir olmalı; otomatik RLS kapatma veya eski veri silme uygulanmamalı.

## Tekrar çalıştırma

Yerel `.local/rc-env.json`, yalnız 127.0.0.1:8543/vila_rc_090, http://localhost:3300 ve .next-rc için hazırlanır. Test/seed kimlikleri ve load-tenants.json aynı izole fixture ortamından sağlanır; paylaşılmaz. `node scripts/rc-run.mjs <node-entry> ...` hedefi doğrular.

Komutlar: runner ile node_modules/typescript/bin/tsc --noEmit; node_modules/tsx/dist/cli.mjs --test tests/*.test.ts; node_modules/next/dist/bin/next build; ayrı terminalde Next start --port 3300; node_modules/playwright/cli.js test; scripts/rc-rls-verify.mjs.

Görsel fixture cache'i, korunmuş 3200 referansı çalışırken runner üzerinden scripts/rc-visual.mjs ile üretilir. Script bütün kıyaslar geçmeden snapshot yazmaz. Cache yerel kalır; işlevsel testlerde kullanılmaz.
