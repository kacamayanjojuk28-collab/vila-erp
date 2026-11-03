# VILA sağlamlaştırma raporu

Tarih: 3 Kasım 2026. Durum: **izole ortamda düzeltmeler doğrulandı; müşteri/üretim teslimi onaylanmış değildir**.

## Ortam ve korunan sınırlar

Bu çalışmanın başında localhost:3000 ve eski PostgreSQL 55432 erişilemiyordu. Eski PostgreSQL başlatma denemesi Windows socket izin hatası verdi. Bu durum düzelmiş olarak raporlanmıyor. Ana .env, ana DB kayıtları ve .next ana build değiştirilmedi; ana migration/deployment yapılmadı. Yeni cluster `.local/hardening-postgres`, port 6543 ve `vila_hardening` DB kullanıldı. İzole uygulama localhost:3100 / .next-audit ile çalışıyor. Test verileri gerçek müşteri verilerine karıştırılmadı.

## Değişiklikler

1. Genel auth-global kotasının tüm müşterileri engellemesi giderildi; hesap bazlı giriş limiti korundu.
2. RateLimit sayaç/pencere güncellemesi tek atomik PostgreSQL sorgusuna çevrildi.
3. Manuel stok ve finans yazmalarında Idempotency-Key zorunlu hale geldi. Runtime rolünün MutationReceipt güncelleme/silme yetkisi kaldırıldı.
4. DocumentLine'a tenant kimliği ve belge/ürün composite FK eklendi. Eski writer uyumu için orgId'yi belgeden alan insert trigger eklendi. Yeni migration yalnız izole DB'ye uygulandı.
5. Dashboard isim gruplamasındaki tekrarlanan find yerine bir Map kullanıldı; response sözleşmesi ve arayüz aynı kaldı.
6. Dört yeni hardening testi, yük ölçüm script'i ve yalnız ayrı tabloyu etkileyen RLS prototipi eklendi.
7. Git başlangıç commit'i oluşturuldu. Eski geliştirme geçmişi varmış gibi gösterilmedi; remote/push yok.

## Test kanıtları

| Kontrol | Sonuç / kanıt |
|---|---|
| Hata tekrarı | hardening-before.json: ortak kota ve eksik key için 2 başarısız test |
| İlk ortam hatası | hardening-environment-failure.json: DB erişilememe; ürün regresyonuyla karıştırılmadı |
| İşlevsel regresyon | hardening-functional.json: son tekrar 29 passed, 0 failed/skipped, yaklaşık 39,9 sn |
| Birim | 4 passed: Decimal, validation, password hash, RBAC |
| Typecheck/build | Son kaynakla tsc ve Next production build exit 0 |
| Eşzamanlı kota | 30 çağrı, limit 10: 10 kabul, 20 adet 429, DB count 30 |
| Tenant FK/izin | Yabancı şirket ürünü P2003; receipt DELETE reddedildi |
| RLS prototipi | hardening-rls-probe.json: bağlamsız okuma, tenant okuma, yabancı yazma ret, pool reset, tenant switch 5/5 |
| Görsel | hardening-visual.json: 1 failed; overview-dark 7.581 pixel fark (~%1). Test ilk ekran hatasında durdu |
| Yedek/restore | vila-1793702464389.dump, ayrı vila_restore_1793702650858 DB; 8 tablo sayımı kaynakla aynı |

Kanıtlar `docs/verification/` altında. Unit/typecheck/build konsol çıktısıyla doğrulandı; bunlar için ayrı makine raporu saklanmadı. Görsel toleransı/baseline değiştirilmedi. Önceki rapordaki beş ekran parity sonucu önceki koşuya aittir; 3000 erişilemediği için bu tur tekrar doğrulanmadı. Bu tur component/CSS/animasyon kaynaklarında diff yoktur; bu, tek başına tam piksel regresyon garantisi değildir.

## Bütünlük taraması

Orphan ürün, yabancı tenant satırı, negatif stok, stok-hareket farkı, fazla ödeme, orphan source, teslim miktarı sınırı, orphan session: **0**. `totals` kontrolü **2** döndü; sıfır olarak sunulmadı. İncelemede iki kayıt da negatif FK testinin doğrudan oluşturduğu `FK doc`, total=1, satır=0 fixture'ıdır. API iş akışı sonucu değildir; test, yabancı satır reddini doğrulamak için başlığı oluşturup satır yazmasını reddettirir. Fixture kurulumu artık total=0 kullanıyor; son 29 test bu düzeltmeyle geçti. Önceki iki fixture ve ölçüm kanıtı silinmedi. Gerçek veri üzerinde bu tür istisna kabul edilmez. Hardening testine ayrıca 6543/vila_hardening DB hedef kontrolü eklendi.

Restore sayımları: 20 Organization, 8.091 Record, 20.048 Document, 20.046 DocumentLine, 20.015 Payment, 20.021 Movement, 275 Audit, 10 MutationReceipt. `hardening-restore.json` iki DB'de eşit sayımı ve aynı iki fixture istisnasını kaydeder. Restore --no-owner/--no-acl kullanır: üretim rol/izin ve tam uygulama geri dönüş tatbikatı yerine geçmez.

## Yük ve kaynak ölçümü

2 tenant; her birinde 2.000 müşteri, 2.000 tedarikçi, 10.000 belge, ödeme ve stok hareketi. 12 dashboard isteği, eşzamanlılık 4. Toplamlar (expense=10000, net=-10000, payable=0) ve dönen kayıtların tenant'ı kontrol edildi; hata yok.

| Ölçüm | Map öncesi | Map sonrası |
|---|---:|---:|
| p50 | 1262,38 ms | 702,30 ms |
| p95 (12 örnekte maksimum) | 1892,27 ms | 1364,73 ms |
| En büyük JSON | 6.995.579 byte | 6.995.579 byte |

Bu tek yerel karşılaştırma genel hız garantisi değildir. Cache/ısınma/gürültü etkileri ayrıştırılmadı. Büyük payload ve sınırsız okuma devam ediyor. Sayfalı customer SQL'i `Record_orgId_kind_archived_createdAt_idx` Index Scan kullanıyor; önceki planda yaklaşık 0,036 ms / 3 buffer hit. Bu, tüm dashboard sorgularının optimize olduğu anlamına gelmez.

Anlık Node örneklemi: sunucu aday süreci RSS 132.194.304 byte, peak 213.643.264 byte; wrapper RSS 45.494.272 byte. `hardening-process-memory.json` PID/CPU bilgisi içerir. Önce/sonra bellek kıyası, heap profili ve leak/soak testi yapılmadı.

## Kalan teslim engelleri

- Uygulama tablolarında RLS yok; composite FK yetkilendirme yerine geçmez.
- Dashboard hacim/süre kapısı geçmedi; çok kullanıcı ve uzun süreli yük testleri eksik.
- Güncel onaylı görsel referans doğrulaması eksik; eski test başarısız.
- Ana ortam erişimi, migration preflight, sürüm uyumu ve üretim restore/izin tatbikatı tamamlanmadı.
- Global giriş engeli giderildi, ama farklı hesaplarla kaynak tüketimi ve proxy düzeyinde koruma açık.
- Diğer create uçları, sayfa yenilenmesi sonrası request key kurtarma, secret/izleme ve hesap kurtarma eksikleri sürüyor.

Yeni modül eklenmedi. Kalan maddeler kapatılmadan “satışa hazır”, “tüm testler geçti” veya “üretim güvenli” sonucu verilmez.


## Devam çalışması — dashboard özet sözleşmesi (3 Kasım 2026)

Ekranlar artık `dashboard?view=summary` kullanır. Ödemeler PostgreSQL'de ay/direction bazında Decimal SUM ile toplanır; tarih filtresi aggregation öncesi uygulanır. Belge sorgusu yalnız hesap için gerekli 7 alanı okur. Özet yanıtta ham documents/payments yoktur; monthlyPayments ve ekranların kullandığı record türleri vardır. Eski varsayılan API yanıtı uyumluluk için korundu. Takvim, projeler, raporlar ve finans dahil tüm tüketiciler incelendi; JSX/CSS/GSAP/grafik geometrisi değiştirilmedi, yalnız veri çağrıları değişti.

30 işlevsel test geçti (39,6 sn), 4 birim testi geçti. Son belge projection değişikliğinden sonra production build/typecheck ve iki tenant/üç tarih aralığında eski-yeni toplam, rapor, stok, activity, record ve aylık ödeme eşdeğerliği testi tekrar geçti. Kanıt: dashboard-summary-functional.json ve dashboard-summary-final.json. Görsel baseline bu tur güncellenmedi veya tekrar başarılı ilan edilmedi; eski başarısızlık açık.

Son kısa yük ölçümü (hardening-load-summary-final.json): 2 tenant, tenant başına 10 bin belge, 12 istek/concurrency 4; p50 331,36 ms, p95 446,95 ms; gövde 153.773 byte; hesap/tenant/HTTP hatası 0. Önceki tam yanıtta 6.995.579 byte idi: yaklaşık %97,8 azalma. İlk özet denemesi 1477,29 ms p95 idi; belge projection sonrası son ölçüm 446,95 ms. Kısa yerel tarama üretim SLA'sı değildir. Payload kapısı bu fixture için geçti; 200 istek/20 kullanıcı/soak kabul testi henüz yapılmadı.

Kalan borç: belgeler ve records sunucuda hâlâ tüm uygun satırlar olarak okunuyor, rapor grupları müşteri sayısıyla büyüyor. Varsayılan eski API hâlâ büyük yanıt döndürür. Tam ölçek çözümü değildir; sunucuda belge aggregation ve sayfalı rapor tasarımı ayrıca ele alınmalı. Ana ortam/migration değiştirilmedi; izole 3100 kullanıldı.

## Sayfa geçişi düzeltmesi — 3 Kasım 2026

Kullanıcının sayfa değişiminde parçalanma bildirimi üzerine: çıkış animasyonu sonunda eski main üzerindeki opacity'nin erken temizlenmesi kaldırıldı; hızlı tıklamalarda önceki çıkış tween'i iptal ediliyor. Sayfa giriş animasyonu useLayoutEffect ile boya öncesi kuruluyor; observer ve tween temizliği yakalanan eski main ve tween nesnelerine bağlandı. Başlık harf tween'leri de artık temizleniyor. Süre/easing/stagger, tasarım ve reduced-motion tercihi korunuyor.

İzole 3100 production build/typecheck geçti. navigation-motion.spec.ts hareket açıkken eski sayfanın tekrar parlamaması, hızlı üç tıklamada son hedefe ulaşılması, görünür içerik ve başlık transform temizliğini doğruladı (1 passed). Kanıt docs/verification/navigation-motion.json. Ana ortama deployment/migration yapılmadı. Bu hedefli test tüm cihazlarda görsel kusursuzluk kanıtı değildir.
