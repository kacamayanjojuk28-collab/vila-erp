# VILA ERP — Stability Sprint 01

Tarih: **3 Kasım 2026, Europe/Istanbul**. Sonuç: **PARTIAL — doğrulanmış bir izole sürüm adayı oluştu; üretim geçişi yapılmadı.**

VILA_SYSTEM_AUDIT, VILA_STABILIZATION_REPORT, VILA_TECHNICAL_DEBT, VILA_QUALITY_GATES, VILA_SAFE_RELEASE_PLAN ve VILA_SEO_VERIFICATION başlangıç olarak incelendi. Eski raporlardaki zamanla değişmiş ortam bilgileri aşağıdaki ölçümlerle ayrıştırıldı.

## Hedeflerin durumu

| Hedef | Durum | Sonuç |
|---|---|---|
| 1. Ortam ve sürüm tutarlılığı | PARTIAL | Port sorunu ve build farkları doğrulandı; geçiş hazırlığı yapıldı. Ana ortam kapalı, müdahale edilmedi |
| 2. PostgreSQL tenant isolation | PARTIAL | Sekiz gerçek iş tablosunda RLS ve uygulama bağlamı doğrulandı. Kimlik/bootstrap tabloları için DB izolasyonu ayrı iş olarak açık |
| 3. Görsel regresyon | PARTIAL | Güncel 3100 ile beş görünüm birebir; eski snapshot testi FAILED olarak korundu |
| 4. Güvenilirlik doğrulaması | PARTIAL | 33 işlevsel + 6 birim, build/typecheck, 240 yük isteği geçti. 20 eşzamanlı istekte gecikme, iki tarihsel fixture istisnası ve uzun süreli test borcu açık |

Yeni modül, tasarım, ürün özelliği veya üretim migration'ı yok. Mevcut 3100 süreci durdurulmadı/yeniden başlatılmadı. 3000 zaten erişilemiyordu; başlatılmadı. Ana .env, PostgreSQL cluster'ı ve .next build değiştirilmedi. Bu sprint CSS, GSAP, motion veya workspace bileşenini değiştirmedi; Git diff'te görünen önceki tur değişiklikleri bu sprintin değişikliği değildir.

## 1. Ortam ve sürüm kanıtı

Yeni ortam: **http://localhost:3200**, `.next-sprint`, PostgreSQL **127.0.0.1:7543/vila_sprint_01**, `.local/sprint-postgres`. Kaynak veri, önceki izole hardening yedeği `vila-1793702464389.dump`; ana müşteri DB'sinden kopya alınmadı. Yeni roller sprint_admin ve kısıtlı sprint_app. Gizli bağlantılar yalnız ignore edilen `.local/sprint-env.json` içinde.

`scripts/sprint-run.mjs` hostname/port/DB/origin/build klasörünü kontrol ederek yanlışlıkla ana ortama komut göndermeyi reddeder. `.local/audit-env.json` ve mevcut 3100 ayarları değiştirilmedi.

| Ortam | Build ID | HTTP health | Belirlenen özellikler |
|---|---|---|---|
| 3000 / .next | YMuAsmDCWyZFK589uo5er | ECONNREFUSED | Disk artifact'ında summary, zorunlu key, SEO origin ve RLS işaretleri yok |
| 3100 / .next-audit | Cy-SlI9w12ldVWwEwUqam | 200, PostgreSQL ok | Summary, zorunlu key, SEO var; RLS bağlamı yok |
| 3200 / .next-sprint | GZVsXQPBh3L5MhyDC67VE | 200, PostgreSQL ok | Önceki özellikler + tenant context/RLS |

Kanıt `docs/verification/sprint-environment.json`: HTTP kontrolleri, build ID'leri, derlenmiş server dosyalarındaki özellik işaretleri ve kaynak SHA-256 değerleri. Derlenmiş metin işaretleri tüm kaynak geçmişini kanıtlamaz; bu tablo tam tarihsel commit eşlemesi değildir. Git geçmişi önceki ae2a388 başlangıç commit'inden öncesini kapsamıyor. İlk environment yardımcı script'inde fetch status özelliği yanlış yöntem gibi çağrıldı; bu tanı script'i hatası düzeltildi ve HTTP kontrolleri tekrar doğrulandı. PowerShell TCP envanteri eksik/kararsız döndüğü için ortam sağlığı HTTP testiyle doğrulandı.

### Eski PostgreSQL bağlantı sorunu — VERIFIED

`.local/postgres/postmaster.opts` eski cluster'ın `127.0.0.1:55432` ile başlatıldığını gösteriyor. `.local/postgres.log` 3 Kasım 13:34'te bind için **Permission denied**, ardından TCP socket oluşturulamadığı için kapanış kaydediyor. `netsh interface ipv4 show excludedportrange protocol=tcp` çıktısında **55424–55523** ayrılmış: **55432 bu aralıkta**. Kanıt `sprint-port-exclusions.txt`.

Bu bulgu parola/migration hatası değil, Windows port rezervasyonu ile uyumlu bind engelidir. Rezervasyonu hangi Windows bileşeninin oluşturduğu kesinleştirilmedi; Hyper-V/Docker varsayımı gerçekmiş gibi sunulmaz. Windows rezervasyonu kaldırılmadı, ana port değiştirilmedi, ana cluster tekrar başlatılmadı.

Onaylı çözüm önerisi: bakım penceresinde kullanılabilir bir ana DB portu seçip mevcut cluster'ı aynı veri diziniyle başlatmak, ilgili ortam bağlantılarını birlikte güncellemek. Önce mevcut cluster/yedek incelemesi ve restore tatbikatı gerekir. `initdb`, reset veya kayıt silme ana ortam çözümü değildir.

## 2. Gerçek iş tablolarında RLS

`deploy/sprint-rls.sql` yalnız korumalı sprint installer ile uygulandı; otomatik Prisma production migration zincirine eklenmedi. `Record`, `Document`, `DocumentLine`, `Stock`, `Movement`, `Payment`, `Audit`, `MutationReceipt`: ENABLE ve FORCE ROW LEVEL SECURITY, hem USING hem WITH CHECK içinde orgId/context eşitliği. Context yok/boşsa veri okunmaz, yazma reddedilir. Runtime rolü superuser/BYPASSRLS değildir; tablo sahibi migration rolüdür.

Uygulama değişikliği `src/lib/db.ts`: AsyncLocalStorage ile istek tenant'ı taşınır; her scoped sorgu aynı transaction bağlantısında transaction-local `set_config` sonrası çalışır. Business transaction callback'ine gerçek tx client verilir, iç sorgu başka pool bağlantısına taşınmaz. Mevcut serializable retry korunur. Tenant transaction'ında array biçimi desteklenmez; mevcut kod callback biçimini kullanıyor.

API'de `session()` mevcut aktif üyeliği doğruladıktan sonra `withTenant(a.orgId, ...)` çalışır. İstek body'sindeki orgId doğrudan context kaynağı değildir. Register sırasında yeni şirket/üyelik kurulduktan sonra aynı transaction içinde audit için context ayarlanır. Şirket değiştirmede hedef üyelik kontrolü korunur; yeni context sonraki istekte doğrulanan session'dan alınır. `VILA_RLS=1` yalnız sprint ayarında etkin. Flag tek başına politikaları yaratmaz; DB policy ile uygulama ayarı birlikte release edilmelidir.

### Doğrulama — VERIFIED, belirtilen kapsamda

`sprint-rls.json`:

- Sekiz tablonun tamamında A yalnız A, B yalnız B satırlarını görüyor; tenant'sız okuma 0.
- A context'inde B insert 42501; B update/delete sıfır etki veya mevcut immutable izin reddi.
- Başarılı COMMIT ve başarısız/geri alınan işlem sonrası context temizleniyor.
- Pool max=2 altında 100 eşzamanlı planlanmış transaction tamamlandı; max=1 ile tekrar kullanılan bağlantıda A/B geçişi ve reset doğrulandı.
- Runtime rolü rolsuper=false, rolbypassrls=false.

33 uygulama regresyonu RLS açıkken geçti: login/register/invite/membership/suspension/switch, tenant/rol, stok, ödeme, partial fulfillment ve idempotency dahil. Direct DB fixture/assertion işlemleri açık tenant context ile çalışacak şekilde uyarlandı; admin/bypass rolüne geçirilmedi, assertion gevşetilmedi.

### Açık güvenlik sınırı — PARTIAL

`User`, `Organization`, `Membership`, `Session`, `Invite`, global `RateLimit` bu politika setinde RLS kapsamına alınmadı. Kimlik ve davet bootstrap erişimi mevcut uygulama kontrollerinde; en az yetkili DB bootstrap erişiminin ayrı tasarım/testi gerekir. Bu nedenle “bütün veriler DB seviyesinde izole” denemez. İleride Organization.settings ve kullanıcı/üyelik bilgisi için de doğrudan DB sınırı kurulmalıdır.

GUC modeli güvenilir sunucu context'ine dayanır; runtime DB şifresini ele geçiren ve keyfi SET/SQL çalıştırabilen saldırganı tek başına durdurmaz. SQL injection/kimlik doğrulama yerine geçmez. Bağımsız güvenlik incelemesi, job/import context'leri ve ileri pool/çok instance koşulları açık. İş tablolarındaki policy sonuçları bu sınırlarla değerlendirilmelidir.

## 3. Görsel regresyon

Eski `visual.spec.ts` aynen çalıştırıldı: **FAILED**, overview-dark için **7.581 farklı pixel (~%1)**. `sprint-legacy-visual.json`, `sprint-legacy-diff.png` saklandı. Snapshot ve tolerans değiştirilmedi. İlk overview hatası nedeniyle senaryonun sonraki baseline adımları tamamlanmadı.

Önceki diff ve mevcut kaynak/snapshot karşılaştırması: eski yeşil V + küçük vila marka geometrisi, navigasyon yerleşimi ve seed/tarih bağımlı grafik/activity görünümü mevcut onaylı büyük VILA ve güncel veriyle aynı değil. Bu durum SEO veya RLS değişikliğini kendiliğinden görsel hata yapmaz. Veri/tarih farkı içeren screenshot bağımsız tasarım referansı olarak kullanılmamalıdır.

Güncel 3100 görünümü korunmuş referans olarak alındı; 3200 ile aynı izole GET yanıtları, aynı tarih, viewport ve reduced-motion ayarı kullanıldı. Görsel testte GET yanıtı sabitleme yalnız görüntü kıyası içindir; business testlerinde mock yok.

| Görünüm | Viewport | PNG eşitliği |
|---|---|---|
| Genel bakış | 1440×1000 | VERIFIED — birebir |
| Ayarlar | 1440×1000 | VERIFIED — birebir |
| Projeler | 1440×1000 | VERIFIED — birebir |
| Finans | 1440×1000 | VERIFIED — birebir |
| Ayarlar mobil | 390×844 | VERIFIED — birebir |

Kanıt `sprint-visual-parity.json`, `sprint-parity-*.png`. Gerçek hareket açıkken navigation-motion regresyonu ayrıca geçti. Bu sprintte yeni görünüm/geçiş hatası gösteren kanıt bulunmadı; tüm cihaz/animasyon kareleri için garanti değildir. Gelecekte baseline güncellemesi için sabit fixture + güncel tasarımın ayrı görsel kabul kaydı gerekir; eski dosya sessizce değiştirilmedi.

## 4. Güvenilirlik ve yük

| Kontrol | Sonuç |
|---|---|
| TypeScript | VERIFIED — tsc --noEmit exit 0 |
| Production build | VERIFIED — .next-sprint başarılı |
| Birim | VERIFIED — 6/6 |
| İşlevsel/SEO/hareket | VERIFIED — 33/33, 42,05 sn, skip/flaky 0 |
| Legacy görsel | FAILED — yukarıdaki 1 test |
| RLS direct DB | VERIFIED — 8 tablo + 100 pool transaction |
| Yük | VERIFIED — 240 istek tamamlandı, HTTP/hesap/tenant hatası 0 |

Yük fixture'ı iki şirkette **10.000'er belge** ve ilgili ödeme/hareketler. Her seviyede 80 istek; iki tenant session'ı, toplam 240 dashboard summary isteği. “20 farklı gerçek kullanıcı” değil, 20 eşzamanlı HTTP isteğidir.

| Eşzamanlı istek | İstek | p50 | p95 | p99 | Maksimum gövde | Hata |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 80 | 74,84 ms | 104,33 ms | 198,60 ms | 153.878 byte | 0 |
| 4 | 80 | 356,47 ms | 481,51 ms | 549,73 ms | 153.878 byte | 0 |
| 20 | 80 | 1568,45 ms | 2216,34 ms | 2749,02 ms | 153.878 byte | 0 |

Kanıt `sprint-load.json`. Her cevapta expense/net/payable, tenant ve summary sözleşmesi kontrol edildi; ham payments/documents geri gelmedi. Önceki ~154 KB optimizasyonu korunuyor. Concurrency 4 için aday 1 saniye/1 MiB eşiği karşılandı; 20'de 1 saniye hedefi karşılanmıyor. Bu koşu soak, gerçek ağ, gerçek kullanıcı p75 veya üretim kapasite sertifikası değildir. Dashboard server tarafında hâlâ uygun belge/kayıtları belleğe alır; SQL aggregation ve rapor sayfalaması borcu sürüyor.

### Veri bütünlüğü

`sprint-integrity.json`: negatif stok 0, stok/hareket farkı 0, yabancı tenant line 0, fazla ödeme 0, teslim miktarı sınır ihlali 0. **İki belge toplam istisnası** var: eski hardening yedeğinden gelen satırsız, total=1 `FK doc` test fixture'ları. Önceki raporda da kayıtlıdır; yeni test fixture'ı total=0 kullanır. İstisnalar silinmedi ve tarama “tümü sıfır” diye sunulmadı. Ana müşteri verisiyle ilgili sonuç değildir.

### Yedek ve geri dönüş provası

Sprint yedeği `vila-1793724577864.dump` ayrı `vila_restore_1793724605218` DB'sine 7543 cluster'ında geri yüklendi. Dokuz tablo sayımı ve sekiz RLS policy sayısı eşleşti; `sprint-restore.json` dump SHA-256 ve sayımları içerir. --no-owner/--no-acl nedeniyle bu, runtime rollerinin/izinlerinin veya tam uygulama failover'ının provası değildir. Ana DB yedeği alınmadı, ana DB restore edilmedi.

## Değiştirilen dosyalar

- Uygulama: `src/lib/db.ts`, `src/app/api/[...path]/route.ts` — tenant context ve register audit sınırı.
- İzole politika: `deploy/sprint-rls.sql`, `scripts/sprint-rls-install.mjs` — ana migration zinciri dışında.
- Koşum/kanıt: `scripts/sprint-run.mjs`, `sprint-rls-verify.mjs`, `sprint-load.mjs`, `sprint-visual.mjs`, `sprint-environment.mjs`, `sprint-integrity.mjs`.
- Testler: `tests/isolated.ts`; flows/audit/hardening direct DB scope; dashboard-summary/navigation-motion/seo named sprint ortam guard'ları. İş assertion'ları korunur.
- Build: `.gitignore` .next-sprint; Next'in ürettiği `next-env.d.ts` ve `tsconfig.json` sprint type yolları.
- Rapor: bu dosya ve `docs/verification/sprint-*` kanıtları. Secret/cluster/bootstrap araçları `.local` altında ignore edilir.

Önceki turların metadata, ikon, dashboard, idempotency ve motion değişiklikleri çalışma ağacında zaten vardı. Kör `git add .` yapılmadı; remote/push/deployment yok.

## Somut geçiş hazırlığı ve üretime geçiş engelleri

Hazır: build ID/özellik matrisi ve kaynak hash'leri; guarded runner; policy SQL; sınırlı runtime rolü; 33+6 regresyon; RLS/pool testi; 240 istekli ölçüm; görsel parity; izole backup/restore kanıtı.

Ana ortama geçmeden:

1. Ana port/cluster işletim planı ve explicit kullanıcı onayı: 55432 yerine seçilecek port, aynı veri dizini, bakım süresi, geri dönüş bağlantı değerleri somut olarak sunulmalı. Windows rezervasyonu rastgele kaldırılmamalı.
2. Onaylı ana backup ve ayrı restore; gerçek `_prisma_migrations`/orphan/tenant/finans/stok preflight yapılmalı. Ana DB bu sprintte açılmadığı için gerçek uygulanmamış migration listesi kesinleştirilmedi.
3. Kimlik/bootstrap DB erişim politikası ve independent security review tamamlanmalı. RLS aday SQL'i release migration'ına ancak bu inceleme ve açık onaydan sonra taşınmalı.
4. Artifact/hash, VILA_RLS ayarı ve DB policy birlikte staging'de tekrar doğrulanmalı. Policy açık, context kapalı eski build'e dönüş veri erişimini keser: rollback otomatik RLS DISABLE değildir. Yazmalar durdurulup onaylı uyumlu artifact'e dönülmelidir.
5. Yeni yazmaları kaybettirecek backup restore için RPO/RTO ve uzlaştırma planı olmadan ana DB üzerine yazılmamalı.
6. Güncel görsel baseline'ın sabit veriyle kabul kaydı, yüksek eşzamanlılık gecikmesi ve uzun süreli bellek/pool testi kapatılmalı.
7. Domain/HTTPS/izleme/hesap kurtarma ve önceki kalite kapıları hâlâ ayrı üretim engelleridir.

**Ana ortama etki eden hiçbir adım uygulanmadı.** Bu sprint sonucu ana ortamı otomatik olarak yükseltme onayı değildir. Yeni test sürümü 3200'de, mevcut 3100 yerinde bırakılmıştır.
