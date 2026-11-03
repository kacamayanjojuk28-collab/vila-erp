# VILA üretim hazırlığı

Tarih: 2026-11-03. **PARTIAL — mevcut kapsamla koşulsuz ticari müşteri teslimi önerilmez.** Kontrollü demo/pilot için çalışan temel vardır. Denetim, izole DB ve 3100 portunda yapılmıştır; 3000 portundaki kullanıcı sürümü eski build ile çalışmaya devam eder.

## Kanıt özeti

| Konu | Durum | Sonuç |
|---|---|---|
| Kimlik doğrulama | VERIFIED / PARTIAL | Scrypt, rastgele token hash, HttpOnly, SameSite, origin kontrolü, parola değişiminde diğer session iptali testli. Secure cookie yalnızca HTTPS APP_ORIGIN ile açılır; yerelde HTTPS test edilmedi |
| Hesap kurtarma / MFA | NOT IMPLEMENTED | Parola sıfırlama, e-posta doğrulama, MFA yok |
| Rol/tenant | VERIFIED / PARTIAL | API cross-tenant okuma/yazma, yabancı referans, şirket geçişi, viewer yazma reddi ve askıya alma testli. RLS yok, özel permission/okuma matrisi yok |
| SQL injection/XSS | PARTIAL | Prisma parametrik sorgular, React escaping, CSP mevcut. Bağımsız saldırı taraması yapılmadı; CSP script unsafe-inline içerir |
| Rate limit | PARTIAL | DB sayaçları mevcut. Ortak auth-global kotası tüm kullanıcıları etkileyebilir; saldırı/ölçek testi yok |
| Veri bütünlüğü | VERIFIED / PARTIAL | Decimal, CHECK, composite FK'ler, serializable transaction, stok/ödeme rollback; JSONB ve bazı kaynak ilişkileri servis kontrolünde |
| İstek tekrarı | FIXED / PARTIAL | Anahtarlı stock/finance istekleri atomik replay; eski anahtarsız istemciler ve diğer CRUD create işlemleri hâlâ riskli |
| Audit | VERIFIED / PARTIAL | Uygulama DB rolü audit/stock movement/payment üzerinde UPDATE/DELETE yapamaz. DB yöneticisi değişiklik yapabilir; dış immutable log zinciri yok |
| Yedek/restore | VERIFIED / PARTIAL | İzole DB gerçek pg_dump yedeği ayrı DB'ye geri yüklendi; 12 şirket/77 audit kayıt. Otomatik zamanlama, şifreli dış kopya/retention/RPO/RTO yok |
| Test | VERIFIED / FAILED | Son 25 işlevsel test ve 4 unit test geçti; legacy görsel snapshot testi başarısız. Güncel UI ile 5 ekran/durum aynı backend fixture altında birebir eşit |
| Build | VERIFIED | Next production build ve TypeScript geçti; ayrı .next-audit kullanıldı |
| Paket açıkları | VERIFIED | npm audit --omit=dev çıktısı bildirilen 0 açık. Dev bağımlılıkları/uygulama mantığı için güvenlik garantisi değil |
| Container/deployment | NOT TESTED | Docker/Compose hazırlanmış; Docker motoru çalışmadığından imaj build/start doğrulaması yok. Migration betiği ayrı DB'de çalıştı |
| Dış servisler | NOT TESTED | Gerçek ödeme/e-posta/fatura gönderimi yapılmadı |

## Ölçülen performans

VERIFIED: İzole demo tenant, yerel makine, sıralı 20 dashboard isteği: son koşuda p50 8,21 ms, p95 25,37 ms, yanıt 12.577 byte. Ölçüm scripti ve ham değerler `docs/verification/audit-integrity-metrics.json` içindedir. Ağ gecikmesi/gerçek müşteriler/eşzamanlı yük yoktur; bu sonuç üretim kapasitesi değildir.

VERIFIED: `.next-audit/static/chunks` toplamı 8 dosyada 779.055 byte (diskteki tüm chunk toplamı; gzip boyutu veya ilk sayfa indirme boyutu değildir).

PARTIAL: Dashboard records/documents/payments'i sınırsız okuyor, gruplamada records.find kullanıyor; dataset büyüdükçe bellek/sorgu/JSON maliyeti artar. Lookup 2000 üst sınırı, finans formunda tüm sayfaları yükleme, rate-limit tablosunda genel retention olmaması ölçek riskidir. Birkaç sorgu basitleştirildi diye performans iyileşmesi iddia edilmez.

NOT TESTED: gerçek yük, DB EXPLAIN büyük veri planları, uzun süreli bellek sızıntısı, browser heap profili, yatay ölçek, mobil gerçek cihaz ve tüm timezone senaryoları.

## Müşteri teslimini engelleyen somut noktalar

1. P1 / PARTIAL: Yeni düzeltmeler henüz ana 3000 sürümünde değil; ana DB migration ve release aktarımı planlı yapılmalı.
2. P1 / PARTIAL: Anahtarsız manuel stok/ödeme tekrarları hâlâ mümkün. Tüm entegrasyon istemcilerinde zorunlu idempotency sözleşmesi ve kalıcı request recovery gerekir.
3. P1 / PARTIAL: Tenant verisi DB RLS ile ayrılmıyor; API kapsamı testli ama tüm DB ilişkileri tenant composite FK taşımıyor. Bağımsız güvenlik incelemesi gerekli.
4. P1 / PARTIAL: Ortak auth-global kotası global giriş engeline dönüşebilir. Güvenilir proxy/client kimliği belirlenip rate-limit politikası ayrıştırılmalı.
5. P1 / NOT IMPLEMENTED: Sipariş/tahakkuk/avans/fatura/iade/reservasyon ayrımı tam değil. Tam kapsamlı ERP sözleşmesi için bunlar ürün geliştirmesidir, sunucu kurulumu işi değildir.
6. P2 / NOT IMPLEMENTED: Hesap kurtarma, doğrulama, teslim edilen e-posta/bildirim, abonelik/lisans ve detaylı onay akışları.
7. P2 / FAILED: Eski görsel referanslar önceki logo/veri durumu için güncel değil. Bu denetimde başarısız test saklanmadı veya toleransı artırılmadı.
8. P2 / PARTIAL: Üretim TLS, secrets, izleme, yedek retention, yük/restore tatbikatı ve müşteriye özel deployment henüz tamam değil.

## Güvenli release planı (uygulanmadı)

- Mevcut DB yedeği ve ayrı restore doğrulaması alın; migration öncesinde DocumentLine.productId orphan sayısını salt okunur kontrol edin. Orphan varsa gerçek kayıtları silmeyin; düzeltme planı çıkarın.
- Yeni migration MutationReceipt tablosu, productId index ve RESTRICT FK ekler; veri silme/reset içermez. Var olan ilişkilerle çelişirse migration başarısız olabilir, otomatik veri temizliği yapmayın. DDL kilit etkisini test edin.
- Yeni sürümü ayrı build/port üzerinde yeni şemayla doğrulayın. Proxy üzerinden kontrollü geçiş tasarlayın; çalışan 3000 sürecini geliştirme sırasında durdurmayın.
- Runtime DB izinlerini migration sonrası tekrar doğrulayın. Yeni MutationReceipt için salt ekleme/okuma ve retention politikasını netleştirin.
- Kabul testlerini yeni sürümde çalıştırın; kullanıcı verisine test seed eklemeyin. Eski build/yedekle geri dönüş planını saklayın.

## Talepteki on soruya yanıt

1. **PARTIAL:** Bağımsız ekranlar toplamından fazlası; gerçek teklif/sipariş/stok/ödeme/görev bağları var. Fırsat→teklif, rezervasyon, fatura, iade eksik.
2. **VERIFIED / PARTIAL:** Satış kaydı stok düşürmez; sevkiyat düşürür. Ödeme paid/nakit günceller. Alacak bir sipariş bakiyesidir, resmî muhasebe alacağı değildir.
3. **VERIFIED / PARTIAL:** Mal kabul stoğu artırır. 36 birim borca 10 ödeme sonrası payable 26, expense 10, net 2,34 testi geçti. Ayrı muhasebe defteri yok.
4. **VERIFIED:** Dashboard DB'den ve tenant scope ile geliyor. Demo şirketi ayrı işaretli. Dönem/tahakkuk sınırları entegrasyon raporunda açık.
5. **VERIFIED / PARTIAL:** Test edilen API izolasyon ve rol senaryoları geçiyor; RLS/özel okuma matrisi/pentest olmadan mutlak güvenlik iddiası yok.
6. **PARTIAL:** P0 gözlenmedi. Gerçek P1 duplicate ve API sözleşme kusurları bulundu; kaynakta iyileştirildi. Ana sürümde ve anahtarsız istemcilerde risk devam ediyor.
7. **VERIFIED:** 25 işlevsel Playwright, 4 unit; build/typecheck. **FAILED:** eski golden-image testi. 5 doğrudan güncel UI karşılaştırması eşit.
8. **FIXED / PARTIAL:** Dokuz bulgu grubu için düzeltme yapıldı; sınırlar sistem raporunda. Hepsi üretime aktarılmış değil.
9. **PARTIAL:** Bugün eksiksiz satışa hazır ERP olarak teslim edilmemeli; kapsamı belirli kontrollü demo/pilot mümkün.
10. **PARTIAL / NOT IMPLEMENTED:** Yukarıdaki P1/P2 listesi somut engellerdir; yalnızca hosting eksikliği değildir.

## Tekrar çalıştırma

İzole yapılandırma `.local/audit-env.json` içinde mevcutken:

```powershell
node scripts/audit-run.mjs node_modules/next/dist/bin/next build
node scripts/audit-run.mjs node_modules/@playwright/test/cli.js test tests/e2e/audit.spec.ts tests/e2e/flows.spec.ts tests/e2e/access.spec.ts
node scripts/audit-run.mjs scripts/audit-metrics.mjs
node scripts/audit-run.mjs scripts/audit-visual.mjs
npm test
```

Test sunucusu 3100'de çalışmalıdır. `scripts/audit-run.mjs init` yalnızca yeni, ayrı DB kurmak içindir; mevcut audit bağlantı dosyasını yeniler, test DB'lerini silmez. Gizli dosyayı paylaşmayın. Genel `test:e2e` komutu legacy görsel testi de çalıştırır ve eski snapshotlarla başarısız olabilir; başarısızlık göz ardı edilmemelidir.
