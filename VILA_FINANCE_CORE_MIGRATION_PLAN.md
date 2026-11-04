# Finance Core migration ve geri dönüş planı

Başlangıç etiketi: v0.9.0-pilot / eafdd3305dde03d23ff927ac1126b501a493e89b. Yalnız feature/finance-core-v1.0. Ana DB'ye migration/backfill veya production deployment yapılmaz.

## Eklemeli şema

Pilotun yedi migration'ı korunur. Yeni zincir:

1. 20261104010000_finance_core: LedgerAccount, AccountingPeriod, FinanceCounter, TaxRule, JournalEntry/Line, FinancialInvoice/InvoiceLine, FinancePayment, PaymentAllocation, ReconciliationRecord; indeks, CHECK, composite FK, RLS ve fiş/immutability constraint trigger'ları.
2. 20261104020000_finance_source_guards: kaynak/ters kayıt eşlemesi, miktar sınırları ve kaynak yazma kilitleri; önceki sekiz iş tablosunda mevcut tenant politikası yoksa kurulur.
3. 20261104030000_finance_posting_validation: kaynak doğrulama fonksiyonundaki SQL alias çakışmasının ayrı düzeltmesi. Uygulanmış migration checksum'u değiştirilmedi.
4. 20261104040000_finance_temporal_integrity: tarihsel tahsis kapasitesi, kaynak tarih/fiş bağı, ters ödeme kronolojisi ve orijinal vergi snapshot'lı alacaklandırma.
5. 20261104050000_finance_business_date: UTC transaction saati içinde ileri tarih sınırını açık Europe/Istanbul iş tarihiyle karşılaştırır.
6. 20261104060000_finance_subaccounts: tenant filtreli üst hesap rolü çözümü, cari alt hesap doğrulaması ve geçmiş sınıflandırmayı koruyan hiyerarşi değişmezliği.

Eski Record, Payment, Document, DocumentLine veya Movement verisi dönüştürülmez. Üç eski tabloda composite referans için benzersiz orgId/id indeksleri eklenir. Eski UUID/CUID kimlikleri değiştirilmez. Yeni RLS ve CHECK/trigger'lar otomatik veri temizliği yapmaz; uyumsuz veri varsa migration veya işlem reddedilmelidir.

## İzole prova

Yeni cluster .local/finance-postgres, 127.0.0.1:9543; uygulama 3400/.next-finance; DB vila_finance_v1, admin finance_admin ve kısıtlı finance_app. scripts/finance-run.mjs bu hedefleri doğrular. Secrets yalnız .local/finance-env.json içindedir.

Şema önce boş DB'ye uygulandı. Mevcut görsel/ERP regresyon fixture'ları, önceki izole test dump'ının yalnız public veri bölümünden, migration metadata'sı hariç tek transaction'da içeri alındı. Restore sırasında FK sıralaması için adminin standart disable-triggers seçeneği yalnız bu yeni hedefte kullanıldı; sonrasında bütün public trigger'ların etkin olduğu ayrıca doğrulandı. Eski cluster, yedek veya müşteri kayıtlarına yazılmadı. Önceki iki sentetik FK doc fixture istisnası korundu; müşteri verisi sayılmadı.

İki ilk taslak migration denemesinde SQL sözdizimi hatası oldu. Transaction rollback'i doğrulandıktan sonra yalnız izole başarısız kayıt rolled-back işaretlendi ve düzeltilmiş, henüz uygulanmamış dosya tekrar çalıştırıldı. Uygulanmış dosyalar sonradan düzenlenmedi; başarısız test ve ölçüm kanıtları saklanır.

## Veri ön kontrolü ve gelecekteki onaylı geçiş

Gerçek hedefte önce salt okunur migration/checksum, orphan ve tenant ilişki denetimi; yedek ve ayrı restore; disk/kilit/WAL süresi ölçümü gerekir. Yeni composite indekslerin kilit etkisi büyük gerçek kopyada ölçülmelidir. Bu çalışmanın yerel test süresi production migration SLA'sı değildir.

RLS ile transaction-local tenant context aynı artifact/config ile etkinleşmelidir. VILA_RLS=1 olmadan yeni şemaya eski writer bağlanmamalıdır. UTC yalnız Finance Core transaction'ında SET LOCAL ile kurulur ve commit/rollback sonrası temizlenir; global DB/işletim sistemi veya legacy auth saat ayarı değiştirilmez.

## Eski ödeme ve API uyumluluğu

Eski /api/finance POST, documentId/Document.paid ve reversalOf davranışları korunur. Yeni /api/finance-core API'si ayrı sözleşmedir; bütün mutasyonlarda Idempotency-Key zorunludur. Yeni ödemeler mevcut Payment tablosuna da yazılır, ayrıca FinancePayment/Journal ilişkisi taşır; avanslar satış geliri değildir. Bu yeni kayıtların eski reversal endpoint'inden ters çevrilmesi 409 ile reddedilir ve doğru iş akışı gösterilir. Eski ödemelerin ters kaydı eskisi gibi çalışır.

Legacy ödemeler otomatik muhasebeleştirilmez. Mutabakatta legacyUnpostedPayments istisna sayısı görünür. Backfill için: belge/party/currency/tarih/audit doğruluğu, orijinal-ters ödeme eşlemesi, mükerrer kaynak kontrolü, mali müşavirce onaylı açılış tarihi ve hesap eşlemeleri gerekir. Eksik kayıt inceleme kuyruğuna ayrılmalı; ana veriye otomatik backfill bu sürümde yoktur.

## Rollback sınırları

Migration'lar eklemelidir; geri dönüş için yeni tabloları, fişleri veya tahsisleri silme komutu verilmez. Yeni finansal olaylar oluştuktan sonra v0.9 writer'ını aynı DB'ye döndürmek güvenli değildir: eski kod yeni ödeme/fiş bağını bilmeden ters ödeme oluşturabilir. Yazmalar durdurulmalı; uyumlu artifact korunmalı veya açıkça salt okunur moda geçilmelidir. RLS otomatik kapatılmaz. Veri restore'u yeni yazmaları kaybettirebileceğinden ayrı onay ve uzlaştırma gerektirir.

Bu dal main'e birleştirilmedi; yeni release tag veya production geçişi için kullanıcı onayı gerekir.

Son prova: 13 migration (7 pilot + 6 yeni), 19 RLS tablosu; 14 eski tablonun satır sayısı ve sıralı satır MD5 özeti birebir aynı. Kanıt: docs/verification/finance-upgrade.json. Tekrarlanabilir prova: node scripts/finance-upgrade.mjs <yalnız-sentetik-izole-dump-yolu>. Komut sadece 9543 cluster üzerinde yeni, benzersiz DB/rol oluşturur; eski DB veya yedekleri silmez. Bu veri özeti karşılaştırması bir bütünlük kontrolüdür, kriptografik saldırı kanıtı değildir.
