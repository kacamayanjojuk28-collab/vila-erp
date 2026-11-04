# VILA Dashboard Engine — Tamamlama Raporu

Tarih: 5 Kasım 2026. Durum: izole geliştirme kabul kriterleri karşılandı.
Çalışan önizleme: http://localhost:3500

## Kapsam ve mimari
Mevcut Genel Bakış ekranı merkezi registry, gerçek ERP verileri ve kullanıcıya özel PostgreSQL tercihleriyle yenilendi. React Grid Layout **2.3.0**, doğrudan v2 API ile kullanılıyor; ikinci bir sürükleme kütüphanesi veya yeni UI framework yok. Kaynak API: https://github.com/react-grid-layout/react-grid-layout

16 kayıtlı widget: tahsil edilen tutar, açık alacak, tamamlanan görevler, nakit akışı, öne çıkan fırsatlar, satış özeti, pipeline, finansal durum, cari bakiyeler, vadesi geçen alacaklar, kritik stok, satın alma özeti, ekip ilerlemesi, proje portföyü, yaklaşan görevler ve son aktiviteler.

Operasyonel Payment/sipariş bakiyeleri ile posted Finance Core fatura bakiyeleri ayrı etiketlenir; muhasebe hesaplama mantığı değişmedi. Liste sorguları en fazla 10 kayıt getirir; toplamlar sunucuda hesaplanır. Legacy dashboard summary API korunur. Aynı tip/ayar için istekler birleştirilir; değişmeyen widget verileri yeniden istenmez; konum değişimi veri isteği üretmez.

Düzenleme modunda sürükleme, boyutlandırma, klavyeyle taşıma, katalogdan ekleme, gizleme/kaldırma, widget ayarları, geri al/yinele, Kaydet/Vazgeç, onaylı sıfırlama çalışır. Kaydedilmemiş değişiklikler için gezinme ve sayfadan ayrılma koruması vardır. Başarısız kayıt taslağı korur. İki sekme çakışması 409 ile bildirilir.

## Kalıcı tercihler ve güvenlik
DashboardPreference anahtarı orgId + userId + dashboardKey(overview). Sunucu kimlikleri oturumdan alır; istemciden kimlik kabul etmez. schemaVersion=2, artan version ve reset tombstone ile eşzamanlı kayıt/ABA koruması uygulanır. Eski schema güvenli okuma migrasyonu bilinen widget/ayarları korur; bilinmeyen tipleri ayıklar.

FORCE RLS, transaction-local vila.tenant_id ve vila.user_id birlikte uygulanır. Runtime rolü superuser/BYPASSRLS değildir. Rol değişiminde yetkisiz kartlar ve veri istekleri gizlenir; API ayrıca 403 döndürür. Şirket/kullanıcı değişimi dashboard state'ini yeniden kurar. Strict Zod sınırları, en fazla 20 widget, tüm breakpointlerde sınır/çakışma kontrolü ve DB payload sınırı vardır.

Container genişliğine göre lg ≥1200/12 kolon, md ≥960/10, sm ≥600/6, xs/2. Her düzen ayrı saklanır. Geçici sıfır genişlik ölçümü son geçerli genişliği bozmaz. GSAP iç kartta, grid konumlandırması dış hücrededir. Mevcut Urbanist, wordmark, lime, header/sidebar ve tema kimliği korunmuştur. Önceki kullanıcı isteğindeki büyüteçli arama tetikleyicisi ve odak davranışı taşınmıştır.

## İzolasyon ve migration
Çalışma: work/vila-dashboard; branch feature/customizable-dashboard.
DB yalnız **127.0.0.1:9543/vila_dashboard_v1**, uygulama yalnız **3500**, build **.next-dashboard**. Ayrı DB, mevcut izole test PostgreSQL cluster'ında çalışır. Finance veya ana DB ile veri birleştirilmedi. Sentetik eski pilot yedeği yeni DB'ye restore edildi; mevcut DB/yedek/test ortamları silinmedi.

Yeni migration: 20261104070000_dashboard_preferences. Yalnız yeni tablo, constraints, RLS policy ve membership ilişkisi ekler. Bu DB'de 14 migration uygulanmış; kanıt dashboard-migrations.json. Ana DB'ye migration, production deployment, main merge veya yeni release tag yapılmadı. 3000/3100/3200 ve Finance 3400 ortamlarının yapılandırmaları değiştirilmedi. Ignored .local dosyaları ve credential'lar Git'e eklenmedi.

## Doğrulama
- Birim: **16/16**, hata/atlama yok.
- Tam Playwright: **64/64**, unexpected=0, skipped=0, flaky=0. Normal karşılaştırma; ignore/update snapshot bayrağı yok.
- Yeni dashboard E2E: **12/12**; gerçek drag/resize, kullanıcı/tenant ayrımı, server RBAC, migration, çakışma, başarısız kayıt, responsive yerleşim, kullanıcı/şirket/rol değişimi ve veri kaynağı karşılaştırması.
- Mevcut Finance Core: **15/15**, diğer ERP/RBAC/login/CSRF/navigation testleri tam koşuda geçti.
- Dokunmatik: Chromium CDP emülasyonunda 390px ekranda gerçek touch sürükleme ve PostgreSQL kayıt doğrulandı; fiziksel cihaz sertifikasyonu iddiası yok.
- RLS: 8 legacy + 11 Finance + 1 dashboard = **20 tablo**, toplam **300** havuzlu transaction kontrolü. Başka kullanıcı/tenant ve bağlamsız erişim reddedildi; context reset, immutable Finance kayıtları, dengesiz journal rollback doğrulandı.
- TypeScript **başarılı**; production build **başarılı**.

Görsel: **32 karşılaştırma** (27 mevcut, 5 yeni dashboard); desktop/mobile dark/light başarılı. Eski modül baseline dosyaları değişmedi. Yeni dashboard için ayrı isimler kullanıldı. İlk koşulardaki SQL alias, responsive ölçüm ve kart minimum yüksekliği hataları giderildi; başarısız koşu kanıtları saklandı. İlk tam koşu 62/64 idi. İncelemede bazı ilk dashboard referanslarının daralmış kartlar içerdiği görüldü; bunlar reddedildi. Ölçüm koruması ve görüntü öncesi genişlik assertion'ı eklendikten sonra incelenmiş doğru desktop dark/light görüntüleri referans alındı. Pixel toleransı 0.003 olarak korundu; assertion gevşetilmedi.

Performans: 15 widget, 15 ilk veri isteği, sürüklemede **0** ek istek. Yerel açılış 1244 ms; 49 frame örneği, p95 36.7 ms, maksimum 43.0 ms. Tek yerel ölçüm; sürekli 60 FPS veya production yük kapasitesi garantisi değildir.

Kanıtlar docs/verification/dashboard-*.json, dashboard-unit.txt ve dashboard ekran görüntülerindedir. Tekrar çalıştırma: scripts/dashboard-run.mjs üzerinden tsx --test tests/*.test.ts, tsc --noEmit, next build, Playwright test; ayrıca dashboard-rls.mjs, dashboard-inherited-security.mjs ve dashboard-touch.cjs. Visual fixture üreticisi dashboard-visual-fixtures.mjs yalnız izole ortamı kabul eder.

## Git ve değişen dosyalar
Private remote: https://github.com/kacamayanjojuk28-collab/vila-erp
Taban: 5851e3807aacbd5979099c7bc380386da2249070.
Test edilen kaynak commit: **3ece62356f25f5227981f2f78c8a68d78de0e613**.
Rapor/kanıtlar bunu izleyen ayrı commit ile kaydedilir; son branch SHA Git üzerinden izlenir.
Korunan main ve v0.9.0-pilot commit: eafdd3305dde03d23ff927ac1126b501a493e89b.
Bu görev yeni tag oluşturmaz.

Kaynak commit dosyaları:
- .gitignore
- next-env.d.ts
- package-lock.json
- package.json
- prisma/migrations/20261104070000_dashboard_preferences/migration.sql
- prisma/schema.prisma
- scripts/dashboard-inherited-security.mjs
- scripts/dashboard-rls.mjs
- scripts/dashboard-run.mjs
- scripts/dashboard-touch.cjs
- scripts/dashboard-visual-fixtures.mjs
- src/app/api/[...path]/route.ts
- src/components/dashboard-engine/dashboard.css
- src/components/dashboard-engine/data.ts
- src/components/dashboard-engine/index.tsx
- src/components/dashboard-engine/widgets.tsx
- src/components/ui.tsx
- src/components/workspace.tsx
- src/lib/dashboard-engine-api.ts
- src/lib/dashboard-registry.ts
- tests/dashboard-engine.test.ts
- tests/e2e/dashboard-engine.spec.ts
- tests/e2e/visual.spec.ts
- tests/e2e/visual.spec.ts-snapshots/overview-dashboard-dark-1440-win32.png
- tests/e2e/visual.spec.ts-snapshots/overview-dashboard-dark-390-win32.png
- tests/e2e/visual.spec.ts-snapshots/overview-dashboard-dark-win32.png
- tests/e2e/visual.spec.ts-snapshots/overview-dashboard-light-1440-win32.png
- tests/e2e/visual.spec.ts-snapshots/overview-dashboard-light-390-win32.png
- tests/isolated.ts
- tsconfig.json

## Kalan engeller ve operasyonel sınır
İzole geliştirme kabulü için kalan ölçülmüş engel yok. Production yayını yapılmadı; bu rapor production onayı değildir. WebSocket, marketplace, harici JavaScript widget'ları, şirket lisanslama veya yeni ERP modülü eklenmedi.

Pilot operasyonda sorumlu kişi bu feature commit'ini incelemeli, hedef ortam yedeğini doğrulamalı ve ortamına özel bağlantı/runtime role/14 migration zincirini planlamalıdır. Migration ve deployment bu görevin dışında, ayrı kontrollü operasyon olarak yapılmalıdır. Yerel inceleme 3500 adresinde yapılabilir; eski Finance başlatıcısı 3400 hedefini korur.
