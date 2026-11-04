# VILA Finance Core v1.0 — test raporu

4 Kasım 2026. Başlangıç `v0.9.0-pilot`, dal `feature/finance-core-v1.0`. Kaynak commit: d8fc1ac5f0b2e6974f7102842a38b29f0694cb4d. Testler yalnız 3400 uygulaması ve 9543 üzerindeki izole Finance veritabanlarında çalıştırıldı. Gerçek müşteri verisi kullanılmadı.

## Son kalite kapısı

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| TypeScript | PASS, hata yok | `npx tsc --noEmit` |
| Production build | PASS | `.next-finance/BUILD_ID`, `finance-manifest.json` |
| Birim | 13/13, atlanan yok | `docs/verification/finance-unit.txt` |
| E2E | 52/52, atlanan/yeniden denenen yok | `docs/verification/finance-final-e2e.json` |
| Finance senaryoları | 15/15 | `tests/e2e/finance-core.spec.ts` |
| Mevcut ERP regresyonu | 37/37 | Aynı tam E2E koşusu |
| Görsel | Mevcut 32 snapshot karşılaştırması geçti; baseline güncellenmedi | `tests/e2e/visual.spec.ts`, son E2E |
| Yeni ekran | Desktop/mobil, açık/koyu tema; gerçek fatura ve ekstre | FC10, `docs/verification/finance-ui-*.png` |
| PDF / CSV | Yetki ve tenant negatifleri geçti | FC11; örnek PDF görsel ve metin kontrolü |

Komutlar: `node scripts/finance-run.mjs node_modules/next/dist/bin/next build`, `node scripts/finance-run.mjs node_modules/tsx/dist/cli.mjs --test tests/*.test.ts`, `node scripts/finance-run.mjs node_modules/@playwright/test/cli.js test`. Sunucu aynı runner ile yalnız `--hostname 127.0.0.1 --port 3400` üzerinde çalıştı. Runner'ın secrets dosyası Git dışında tutulur. Eski görsel fixture kimlikleri yerel, izole test dump'ından gelir; bu rapor kimlik doğrulama bilgisi içermez.

## Finansal doğruluk

FC01: 1.200 satış ve tam tahsilatta cari sıfır, mizan dengeli. FC02: 1.200−500=700; Ocak raporu Kasım tahsilatını geçmişe uygulamaz. FC03: 300 avans gelir değildir, bir kez mahsup edilir; bağlantılı ters kayıt korunur. FC04: dört birim mal kabulünden iki kısmi fatura, toplam 400 stok borcu; aynı maliyet ikinci kez yazılmaz. Kısmi tedarikçi ödemesi ve açık borç uzlaşır.

FC05: tek ödeme iki faturaya dağıtılır; paralel fazla tahsis reddedilir, başarısız işlem kaynak/ödeme/fiş/audit'i yarım bırakmaz. FC06: kısmi alacaklandırma ve ödeme ters kaydı orijinali korur; kesinleşmiş fiş değiştirilemez. FC07: tenant ve rol sınırları; yabancı hesap composite FK negatifi. FC08: aynı anahtarla altı paralel kesinleştirme tek fiş üretir; değişen içerik 409. FC09: dengesiz/kapalı dönem kaydı reddedilir; ters kayıt başka açık dönemde yapılır.

FC10: UI üzerinden gerçek taslak, onay, kesinleştirme ve aynı 960 cari bakiye. FC11: Türkçe PDF, CSV ve yetkisiz/yabancı tenant erişimi. FC12: bilgi kesim anı, süresi dolmuş orijinal verginin kredi belgesinde korunması, tedarikçi avansı ve geçmişe yönelik çift kullanım engeli. FC13: dört paralel farklı iç numara ve aynı ödemenin altı paralel tekrarında tek nakit/fiş etkisi. FC14: eski ödeme otomatik muhasebeleşmez, eski ters kayıt çalışır ve inceleme referansları görünür. FC15: 120.001 cari alt hesabı, otomatik cari bağlantısı, 100 bakiye ve mutabakat; geçmiş hiyerarşi değişikliği/arşivleme engeli.

## RLS ve transaction kanıtı

`finance-security.json`: 11 yeni tablonun tamamında ENABLE/FORCE RLS; bağlamsız ve yabancı tenant okuma/yazma reddi. Runtime superuser/BYPASSRLS değildir. 100 paralel havuz işlemi commit/rollback sonrası tenant ve UTC saat ayarını temizler. Doğrudan SQL ile 10 borç/9 alacak fişi commit'te 23514 ile reddedilir; hiçbir fiş kalmaz. Beş immutable tabloda UPDATE/DELETE ayrıcalıkları yoktur. Public şemada devre dışı trigger sayısı sıfırdır.

`finance-legacy-rls.json`: önceki sekiz tablonun RLS negatifleri ve ayrıca 100 havuz işlemi geçti. Toplam 19 tablo ve 200 işlem. Komutlar: `node scripts/finance-run.mjs scripts/finance-security.mjs` ve `... scripts/finance-legacy-rls.mjs`. Security fixture'ı FC11'in yerel oturumunu kullanır; oturum Git'e eklenmez.

## Migration ve veri koruma

`finance-upgrade.json`: önceki izole dump yeni isimli veritabanına geri yüklendi; 7 eski + 6 yeni migration uygulandı. 14 eski tabloda satır sayısı ve sıralı satır içerik özetleri birebir aynı; yeni finansal backfill sıfır. 19 RLS tablosu kuruldu. Ana DB'ye bağlanılmadı. Prova dump'ı, eski veritabanları ve test ortamları silinmedi. Tekrar komutu migration planındadır.

## Ölçülen performans

İki yeni sentetik şirkette şirket başına 2.500 kesinleşmiş fatura, 7.500 journal satırı; çalışma verisi toplam 5.000 fatura/15.000 satırdır. Önceki koşuların fixture'ları silinmedi; veritabanının toplam hacmi bu sayıdan büyüktür. Fixture'lar kısıtlı runtime rolüyle, bütün RLS/constraint/trigger'lar açıkken SQL üzerinden üretildi. İş akışı doğruluğu ayrıca HTTP testlerindedir.

Açık fatura, mizan, cari ekstre ve yaşlandırma karışımı; her eşzamanlılık düzeyinde 80 istek, toplam 240/240 doğru yanıt. Yalnız HTTP 200 değil, 2.500 açık belge ve 3.000.000/6.000.000 şirket bakiyeleri, yaşlandırma toplamı, eşit mizan ve 25 satırlık sayfa sınırı doğrulandı. İki şirketin mutabakatı MATCH.

| Eşzamanlılık | Başarılı | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|
| 1 | 80/80 | 45,31 | 67,99 | 261,98 |
| 4 | 80/80 | 56,14 | 89,36 | 229,20 |
| 20 | 80/80 | 216,25 | 388,41 | 503,71 |

Kanıt `finance-performance.json`: başlangıç EXPLAIN planı ile iki EXPLAIN ANALYZE/BUFFERS planı. Mizan aggregate'i MATERIALIZED CTE ile tek kez üretilir; Dashboard SQL'i değiştirilmedi. Plan örnekleri bütün raporların planı sayılmaz. Komut: `node scripts/finance-run.mjs scripts/finance-load.mjs`.

Aynı sunucu PID 18008'in çalışma belleği ölçüm öncesi 98.988.032, sonrası 198.877.184 bayt (yaklaşık 94,4→189,7 MiB). Runner PID 30988 yaklaşık 36,6 MiB kaldı. Kanıt `finance-memory-before/after.json`. Bunlar process working-set anlık ölçümleridir; JS heap, uzun süreli soak, bellek sızıntısı veya production kapasite kanıtı değildir. 80 örnekli her grupta p99 maksimuma yakındır.

## Bulunan ve düzeltilen hatalar

- İlk aşamada kaynak doğrulama SQL alias çakışması ve UI etiket seçicisi hatası bulundu; düzeltmelerden sonra testler geçti. İlk migration sözdizimi denemeleri izole DB'de rollback edildi; uygulanmış migration dosyaları değiştirilmedi.
- İlk tam paket 49/50 geçti; farklı eşzamanlı fatura taslakları serialization retry sınırına ulaşıyordu. Finans mutasyonlarına aynı anahtarı koruyan sınırlı gecikmeli retry eklendi. Son FC13 geçti.
- İlk yük ölçümünde 180 doğruluk assertion'ı başarısızdı: Finance timestamptz bağlama/okuma saatleri tutarsızdı. Yalnız Finance transaction'ına UTC getirildi; iş günü Istanbul olarak korundu ve sınır testi eklendi.
- Sonraki iki yük koşusunda birer ilk mizan sorgusu 30 saniyeyi aştı (239/240). Sorgu planına duyarlı tekrar hesaplama MATERIALIZED aggregate ile sınırlandı; taze şirketlerle son koşu 240/240 geçti. Bu önceki zaman aşımları son p95/p99 içine katılmadı; ayrı başarısız koşulardır. Eşikleri artırmak veya başarısız istekleri yeniden deneyip başarı saymak kullanılmadı.

İlk başarısız sonuçlar `finance-phase-first-failed.json`, `finance-ui-first-failed.json`, `finance-full-first-failed.json`, `finance-performance-first-failed.json`, `finance-performance-timeout.json`, `finance-performance-timeout-repeat.json` içinde korunur. Oturum çerezleri kanıtlardan çıkarıldı. Test assertion'ı gevşetilmedi, test atlanmadı, eski snapshot değiştirilmedi.

## Geçerlilik sınırı

Doğrulama iç TRY muhasebe çekirdeği içindir. Mali müşavir onayı, canlı GİB, e-Defter, stok değerleme/COGS, döviz/özel vergi rejimleri veya bütün şirket tarihinin otomatik backfill'i doğrulanmış değildir. `MATCH`, yalnız açıkça belirtilen POSTED_FINANCE_CORE_ONLY kapsamıdır. Bu sınırlar teknik test başarısıyla ortadan kalkmaz.
