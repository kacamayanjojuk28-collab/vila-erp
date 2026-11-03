# VILA güvenli sürüm geçiş planı

Tarih: 3 Kasım 2026. **Plan uygulanmadı. Şu anda release kapıları eksik; ana ortama geçiş önerilmiyor.** Kullanıcı direktifinin §10 maddesi gereği ana ortam migration, deployment veya veri değiştiren işlemden önce açık onay gerekir. Bu belgede plan bulunması onay değildir.

## 1. Git ve sürüm paketi

Başlangıç: `ae2a388b5beb2fcadce3270e0310ac73c005f406` (pre-hardening baseline). Öncesine ait geçmiş yoktur. Bu tur diff: API ortak auth kotası kaldırma/Map, security atomik sayaç, idempotency zorunlu header, migrate receipt izinleri, Prisma orgId, yeni tenant-line migration, hardening testleri ve iki ölçüm/prototip script'i. Mevcut test istemcileri zorunlu key sözleşmesine uyarlandı; assertion gevşetilmedi. UI/CSS, package manifest ve lockfile değişmedi.

Release öncesi `git diff` ve untracked dosyalar ayrı incelenmeli; yalnız doğrulanmış kod/test/raporlar sürüm commit'ine alınmalı. `.local`, `.env`, dump ve kimlik bilgileri hariç kalmalı. Hash'i belli artifact, Node/PG sürümü ve migration listesi release kaydına eklenmeli. Çalışma ağacının tamamı körlemesine stage edilmemeli.

## 2. Ön koşullar ve migration preflight

1. 3000/55432 erişim sorununun nedeni read-only incelemeyle belirlenmeli; mevcut DB'nin yeri ve son sağlam build teyit edilmeli. Portu değiştirmek veya DB'yi sıfırlamak çözüm sayılmaz.
2. Kalite kapılarındaki açık RLS/performance/visual konuları kapatılmalı veya müşteriye kapsam kısıtı açıkça belirlenerek ayrıca kabul edilmelidir. Test başarısızlığı sessizce waive edilmez.
3. Ana `_prisma_migrations` durumu onaylı read-only kontrolde çıkarılmalı. Önceki raporda uygulanmamış `20261103010000_request_receipts` ve bu turun `20261103020000_tenant_line_integrity` migration'ları vardır; gerçek liste DB'den doğrulanmadan varsayılmamalıdır.
4. Backfill öncesi tüm DocumentLine document/product varlığı, d.orgId=r.orgId; Document contact/warehouse, Stock/Movement/Payment tenant ilişkileri denetlenmeli. Negatif stok, movement toplam farkı, paid sınırı, belge/satır toplamı ve source ilişki hatası sıfır olmalı. Hatalı gerçek kayıtlar otomatik silinmez.
5. Migration transaction'ının tablo kilidi/backfill/index süresi, gerçek hacimli kopyada ölçülmeli; disk ve WAL alanı yeterli olmalı. Lock timeout ve bakım süresi belirlenmeli. Yeni migration orgId NOT NULL ve composite FK ekler; büyük tabloda uzun kilit riski vardır.
6. Runtime ve migration rolleri ayrı olmalı; deploy/migrate.mjs kapsamındaki yeniden grant/revoke değişimleri incelenmeli. Trigger ve SQL constraint'leri Prisma diff aracılığıyla yanlışlıkla kaldırılmamalı; db push kullanılmamalı.

## 3. Yedekleme ve staging provası

Ana veriden yedek alma/geri yükleme çalışması onaylı işletim planında yapılmalı; şifreli erişim ve saklama süresi belirlenmeli. Yedek hash/byte/zaman/version kaydı tutulmalı. Yedek ayrı DB'ye geri yüklenmeli; tablo sayımları, finans/stok toplamları, constraint'ler, migration durumu, uygulama giriş/iş akışı ve runtime izinleri doğrulanmalı.

Bu tur yalnız izole DB yedeği geri yüklendi; ana DB yedeği alınmış değildir. Mevcut restore-check --no-owner/--no-acl kullanır; roller/izinler ayrıca deploy prosedürüyle kurulup test edilmelidir. Restore DB'sine ana sistemden trafik bağlanmamalıdır.

Staging'de migration öncesi sürüm verisiyle prova, migration sonrası 29 test, typecheck/build, negatif tenant/rol/idempotency testleri, görsel ve hedef hacimli yük testleri uygulanır. Fixture/seed ana ortama taşınmaz.

## 4. RLS uygulama planı — henüz uygulama tablolarına yapılmadı

[PostgreSQL RLS belgeleri](https://www.postgresql.org/docs/18/ddl-rowsecurity.html) ve [SET LOCAL](https://www.postgresql.org/docs/18/sql-set.html) temel alınır. İzole prototip current_setting('vila.tenant_id', true), USING/WITH CHECK, ENABLE/FORCE RLS ve havuz boyutu 1 ile transaction resetini doğruladı. Bu yalnız prototiptir.

1. Tablo matrisi hazırlanır: Record/Document/DocumentLine/Stock/Movement/Payment/Audit/MutationReceipt tenant-scope; Organization/Membership/Session/User/Invite/bootstrap akışları ayrı değerlendirilir. Global RateLimit'e kör tenant policy eklenmez.
2. Tenant GUC yalnız sunucu tarafından doğrulanmış üyelikten üretilir. Her tenant okuma/yazma aynı transaction bağlantısında `set_config(..., true)` sonrası yapılır; session düzeyinde SET kullanılmaz. Hata/rollback/commit sonrası havuz bağlantısında context kalmamalıdır.
3. Login/üyelik listeleme/switch için en az yetkili bootstrap erişimi tasarlanır; tenant olmadan bütün tablolara erişen genel bypass rolü yaratılmaz. Actor doğrulamasından önce istemcinin orgId'siyle GUC kurulmaz.
4. Runtime owner/superuser/BYPASSRLS olmamalı; owner davranışı için FORCE RLS ayrıca doğrulanmalı. GUC, DB şifresini ele geçiren saldırgana veya kontrolsüz raw SQL'e karşı kendi başına kimlik doğrulama değildir.
5. Her tabloda context yokken deny, A/B okuma/yazma, JOIN/nested create, background job, serializable retry, aynı pool'da tenant switch/rollback testleri yazılır. Root db çağrılarının transaction dışına kaçışı denetlenir.
6. Önce yalnız izole kopyada tablo tablo etkinleştirilir; planner/index/backup etkileri ölçülür. Bunlar geçmeden ana DB için onay istenmez. RLS rollback'i güvenlik etkisi nedeniyle otomatik DISABLE değildir; erişimi kapatmak gerekebilir.

## 5. Onay sonrası dağıtım sırası

Yukarıdaki işler tamamlanınca kullanıcıya tam commit/artifact, migration listesi, backup/restore kanıtı, süre/kesinti ve rollback tetikleri sunulur; ana ortam için açık onay alınır.

Onaydan sonra yazmalar bakım penceresinde durdurulur, son yedek doğrulanır, migration yalnız migration rolüyle çalıştırılır, runtime grant/revoke doğrulanır, yeni build ayrı süreçte health/smoke test edilir, ardından trafik aktarılır. Finance/stock istemcileri Idempotency-Key göndermelidir; eski API istemcileri yeni sürümde 400 alır. Karma frontend/backend sürüm penceresi önlenmeli; belirsiz yanıtla tekrar gönderimde aynı key korunmalıdır.

Başarı ölçütleri: health, login/switch, proje kaydı, satış/alış, kısmi teslim, stok/finans, yetki reddi, dashboard toplamları ve hata/latency izleme. Üretimde test finans kaydı oluşturmak ayrıca veri değiştiren kapsam olarak onaya dahil edilir.

## 6. Rollback

- Migration başarısızsa transaction sonucu ve migration kaydı incelenir; otomatik resolve/applied işaretlenmez. Trafik yeni sürüme geçirilmez.
- Yeni uygulama hata verirse yazmalar durdurulur, neden ve son güvenli commit seçilir. Additive orgId/constraint/trigger mümkünse korunur; sütun/receipt/audit silinmez. Eski writer trigger uyumu staging'de önceden doğrulanmalıdır.
- Receipt yetkileri eski kodla uyumlu doğrulanmalıdır; güvenlik kısıtları körlemesine geri açılmaz. API/client uyumluluğu kontrol edilmeden yalnız frontend rollback yapılmaz.
- Veri geri yükleme son çaredir: yeni yazmaları kaybettirebilir. Onaylı RPO/RTO ve yeni yazmaların uzlaştırılması olmadan ana DB üzerine restore yapılmaz. Önce ayrı restore DB doğrulanır, sonra ayrıca onaylı geçiş uygulanır.
- Tenant sızıntısı, negatif stok/finans tutarsızlığı, artan 5xx veya süre eşiği aşımı rollback/erişim kapatma tetikleridir; test raporu ve audit kayıtları korunur.

Mevcut durum: ana ortam için onay alınmadı ve dağıtım yapılmadı. İzole 3100 test sonucu ana ortamın sağlıklı olduğu anlamına gelmez.


## Yeni özet endpoint değişikliğinin release etkisi

Dashboard, finans, takvim, projeler ve rapor tüketicileri view=summary kullanır; monthlyPayments alanını bekler. Backend ve frontend aynı artifact ile dağıtılmalıdır. Yeni frontend/eski backend karışımı desteklenmez. Eski varsayılan endpoint korunmuştur; rollback için backend yeni kalırken eski frontend çalışabilir. Migration eklenmedi. Git incelemesine beş component'in yalnız veri çağrısı/alan değişiklikleri ve dashboard-summary.spec.ts dahil edilmelidir. Önceki ana ortam onay şartı ve açık release engelleri aynen geçerlidir.
