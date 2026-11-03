# VILA kalite kapıları

Tarih: 3 Kasım 2026. Sonuç: **ana ortama release için tüm kapılar açık değildir**. Geçen testler sınırlı doğrulama kapsamıdır, sıfır hata garantisi değildir.

## Zorunlu kontroller ve mevcut sonuç

| Kapı | Kabul kriteri | Bu çalışmanın sonucu |
|---|---|---|
| Typecheck | tsc --noEmit çıkış 0 | Geçti |
| Production build | İzole .next-audit build çıkış 0 | Geçti |
| Birim | Para/validation/hash/RBAC, 0 fail | 4/4 geçti |
| İşlevsel | flows/access/audit/hardening; 0 fail, 0 skip | 29/29 geçti |
| DB sınırları | Yabancı şirket ürün FK ret; receipt silme reddi; stok/ödeme tutarlılığı | Negatif testler geçti; toplu taramada test fixture kaynaklı 2 toplam uyuşmazlığı ayrıca sınıflandı |
| RLS | Tüm tenant tablolarında runtime çapraz okuma/yazma kapalı, havuz reset testli | Uygulama için geçmedi; yalnız prototip 5/5 |
| Görsel | Onaylı sabit veri/tarih/referansla desktop/light/mobile eşleşmesi | Eski test overview'da başarısız; sonraki ekranlar bu koşuda tamamlanmadı |
| Performans | Aşağıdaki aday eşikler | Dashboard süre/payload kapısı geçmedi |
| Restore | İzole restore, sayım ve ilişkisel kontrol; üretim rol/izin tatbikatı | İzole restore ve 8 tablo sayımı geçti; üretim izin/geri dönüş tatbikatı yapılmadı |
| Sürüm uyumu | Main migration ön kontrolü, client sözleşmesi, health ve smoke | Uygulanmadı; onay gerekli |

## Tekrarlanabilir komutlar

Proje kökünde çalıştırılır. Önce `.local/audit-env.json` hedeflerinin localhost:3100, .next-audit ve ayrı vila_hardening/6543 veritabanı olduğunu doğrula. Bu dosya secret içerir, paylaşma. `audit-run` ayar dosyasına güvenir; tek başına güvenlik sınırı değildir. `init`, `db:seed`, doğrudan `db:migrate` komutlarını ana .env ile çalıştırma.

```text
node scripts/audit-run.mjs node_modules/typescript/bin/tsc --noEmit
npm test
node scripts/audit-run.mjs node_modules/next/dist/bin/next build
node scripts/audit-run.mjs node_modules/@playwright/test/cli.js test tests/e2e/flows.spec.ts tests/e2e/access.spec.ts tests/e2e/audit.spec.ts tests/e2e/hardening.spec.ts
node scripts/audit-run.mjs node_modules/@playwright/test/cli.js test tests/e2e/visual.spec.ts
node scripts/audit-run.mjs scripts/hardening-load.mjs measure after
node scripts/audit-run.mjs scripts/hardening-rls-probe.mjs
```

Build sırasında yalnız 3100 test sunucusu durdurulur, ardından aynı build ile başlatılır. Her Playwright koşusu ortak JSON raporunu değiştirebilir; işlevsel ve görsel sonuç ayrı dosyalara arşivlenmelidir. Yeni testler kayıt üretir; yalnız izole veritabanı kullanılmalıdır. Yük fixture'ı doğrudan SQL üretir: bu kayıtların sayısı 20 bin iş akışının API üzerinden test edildiği anlamına gelmez.

## Güvenlik ve regresyon kontrol listesi

- Oturumsuz erişim, rol dışı yazma, şirket değiştirme ve başka şirkete ait ID denemeleri reddedilmeli.
- Satış/alış dönüşümü, kısmi teslim, tekrar teslim, yetersiz stok ve eşzamanlı işlem sonuçları atomik kalmalı.
- Finance/stock POST eksik key için 400; aynı key/aynı içerik tek etki; aynı key/farklı içerik 409. İstemciler belirsiz yanıt sonrası aynı key'i korumalı.
- Para hesabı Decimal ile; hatalı tutar/tarih/giriş reddi; audit/receipt iş transaction'ına dahil olmalı.
- Runtime rolü schema owner/superuser/BYPASSRLS olmamalı; audit/movement/payment/receipt UPDATE/DELETE reddedilmeli.
- Yeni migration boş DB'de ve eski sürüm verisi olan kopyada denenmeli. Ana veri preflight hatası otomatik silme veya NULL ile giderilmemeli.
- Gizli bilgiler Git, log, test raporu ve build çıktısına sızmamalı; dependency lock korunmalı. Ayrı dependency vulnerability incelemesi halen gerekli.
- UI kaynakları, Urbanist/logo/renkler/GSAP/responsive davranışları korunmalı; geçmiş baseline otomatik güncellenmemeli.

## Performans kabul yöntemi

Aşağıdakiler **önerilen ilk release eşikleridir**, ölçülmüş üretim SLA'sı değildir. Aynı donanım/build/DB hacmiyle sabit fixture, ısınma sonrası en az 200 istek ve 1/4/20 eşzamanlı kullanıcı basamakları; 30 dakikalık soak, süreç RSS/heap/DB bağlantıları, sorgu planı ve p50/p95/p99 kaydedilmelidir. Bu tur yalnız 12 istek/concurrency 4 taraması yapıldı; 20 kullanıcı/soak test edilmedi.

| Metrik | Aday eşik | Ölçüm |
|---|---|---|
| Dashboard p95, 10 bin belge/tenant | < 1000 ms | Son tarama 1364,73 ms: geçmedi |
| Dashboard gövde | < 1 MiB | 6.995.579 byte: geçmedi |
| HTTP/hesap/tenant hatası | 0 | 12 istekte 0 |
| Sayfalı customer sorgusu | Plan indeks kullanmalı; p95 API < 500 ms | DB Index Scan görüldü; API p95 bu yükte ölçülmedi |
| Bellek | Isınma sonrası plato; soak boyunca sürekli artış olmamalı | Tek anlık ölçüm var; karar verilemez |

Önce/sonra tek kısa koşu performans garantisi veya nedensellik kanıtı değildir. UI animasyonları kapatılarak kullanıcı performansı ölçülmez; görsel testin deterministik screenshot seçeneği bunun dışında yalnız test içindir.


## Dashboard devam çalışması sonucu

Önceki tablo önceki turun sonucudur. Yeni özet modu: 30 işlevsel + 4 birim geçti; son belge projection sonrası build/typecheck ve hedefli summary karşılaştırması tekrar geçti. `tests/e2e/dashboard-summary.spec.ts` yalnız 6543/vila_hardening üzerinde, seed edilmiş iki load tenant'ını kullanır; normal müşteri DB'sinde çalıştırılmaz.

Son 12 istek/concurrency 4 taramasında 153.773 byte ve p95 446,95 ms: aday payload/süre eşiği bu kısa fixture koşusunda karşılandı. Uzun süre/200 istek/20 kullanıcı kapısı henüz geçilmiş değildir. Büyük eski endpoint ve sunucudaki sınırsız belge okuması açık kalır. Sonuçlar docs/verification/hardening-load-summary-final.json dosyasında; ölçmek için VILA_LOAD_SUMMARY=1 ile mevcut hardening-load script'i kullanılır. RLS, onaylı görsel referans ve ana release kapıları değişmedi.
