# VILA sistem denetimi

Tarih: 2026-11-03 (Europe/Istanbul). Kapsam: mevcut kaynak, gerçek PostgreSQL entegrasyonu, API ve Edge tarayıcı testleri. Bu belge bağımsız sızma testi veya üretim sertifikası değildir.

## Sonuç ve sürüm ayrımı

**PARTIAL — VILA, gerçek backend üzerinden birbirine bağlı temel ERP akışlarına sahiptir; eksiksiz ticari ERP değildir.**

**FIXED / VERIFIED** ifadeleri bu denetimdeki kaynak kodu ve izole `http://localhost:3100` sürümü için geçerlidir. Kullanıcının `http://localhost:3000` uygulaması durdurulmadı; ana `vila` veritabanına yeni migration uygulanmadı. Dolayısıyla düzeltmeler mevcut 3000 sürecine henüz aktarılmış değildir. Gerçek kullanıcı verileri silinmedi/değiştirilmedi. `.local/audit-env.json` yalnızca gitignore altında test bağlantılarını tutar; raporlar parola içermez.

## Gerçek mimari — VERIFIED

- Next.js 16.4.3 App Router, React 19, TypeScript; API tek `src/app/api/[...path]/route.ts` içinde. API server action yerine JSON HTTP kullanır.
- Prisma 7.10.1 / adapter-pg / PostgreSQL 18. Modül kayıtları `Record.kind` + doğrulanan JSONB data içinde; belgeler/kalemler, stok, hareket, ödeme, audit, üyelik ve oturumlar ayrı tablolarda.
- React state/effect ve `revision` ile yenileme; hash tabanlı modül navigasyonu. React Query veya merkezi cache yok. Lookup 2000 kayıtla sınırlı.
- GSAP/Flip, Urbanist, bağımsız CSS mevcut görünümü sağlar. Bu denetimde CSS, tipografi, navigasyon ve animasyon dosyaları değiştirilmedi.
- Scrypt ile tuzlu parola, hash'lenmiş rastgele session token, HttpOnly/SameSite=Lax cookie; HTTPS origin olduğunda Secure. Rol ve aktif üyelik her istekte sunucudan okunur.
- Sabit OWNER/ADMIN/SALES/WAREHOUSE/FINANCE/MEMBER/VIEWER rolleri. Roller esas olarak yazma iznini sınırlar; şirket içindeki operasyon verileri birçok role okunabilir. Audit tam endpoint'i yönetim yetkisi ister.
- Serializable transaction ve sınırlı retry; stok için koşullu UPDATE + negatif stok CHECK; finans için Decimal ve ödeme bakiye sınırı. Audit/Payment/Movement tablolarında uygulama rolünün UPDATE/DELETE izni yok.
- SQL migration zinciri: ilk beş migration + yeni `20261103010000_request_receipts`. İzole DB'de 14 tablo (Prisma migration tablosu dahil).
- Testler: node:test/tsx ve Playwright/Microsoft Edge. İş testlerinde mock yok. Görsel eşitlik karşılaştırmasında yalnızca aynı veri durumunu oluşturmak için izole backend GET yanıtları iki UI'ya aynı verildi.

## Modül envanteri

| Alan | Durum | Gerçek kapsam / sınır |
|---|---|---|
| Müşteriler, tedarikçiler, ürünler, depolar | VERIFIED | CRUD, arşiv, backend doğrulama, kalıcılık, yabancı tenant güncelleme reddi; ayrı iletişim kişisi modeli yok |
| Potansiyel müşteriler | VERIFIED | CRUD ve müşteri dönüşümü, audit |
| Fırsatlar | PARTIAL | CRUD ve müşteri bağlantısı; fırsat → teklif dönüşümü yok |
| Teklifler | PARTIAL | Satır hesabı ve sipariş dönüşümü var; ayrı teklif onay süreci yok |
| Satış | VERIFIED / PARTIAL | Onay, kısmi/tam sevkiyat, kalem kalan miktarı, tarihli işlem geçmişi; rezervasyon/fatura/iade yok |
| Satın alma talepleri | PARTIAL | CRUD ve satın alma dönüşümü; ayrı talep onayı/onaycı zinciri yok |
| Satın alma | VERIFIED / PARTIAL | Onay, mal kabulü, kısmi/tam stok girişi; tedarikçi ödeme ilişkisi var, ayrı muhasebe alt defteri yok |
| Stok ve hareket | VERIFIED | Giriş/çıkış/transfer, negatif stok ve transfer rollback; hizmet stok hareketi reddi |
| Kritik stok | PARTIAL | Gerçek ürün/stock verisi; büyük veri/çok depo politikası ayrıca ele alınmalı |
| Finans | VERIFIED / PARTIAL | Belge bağlantılı kısmi/tam ödeme, ters kayıt ve bakiye güncelleme; bağımsız gelir/gider de var. Resmî muhasebe/fatura değildir |
| Proje/görev | VERIFIED / PARTIAL | CRUD; görev ataması ve türetilmiş proje ilerlemesi; ayrı proje ekip üyeliği yok |
| Takvim | PARTIAL | Gerçek görev/aktivite tarihleri; ekran render testi var, tüm zaman dilimi etkileşimleri test edilmedi |
| Aktiviteler ve müşteri geçmişi | VERIFIED | Müşteri kimliğiyle aktiviteler, teklifler/siparişler/fırsatlar |
| Dashboard/rapor | VERIFIED / PARTIAL | Gerçek DB + tenant scope + Decimal özet; tüm kayıtları belleğe alır, dönem/bakiye anlamları aşağıda sınırlı |
| Kullanıcı/şirket/ayarlar | VERIFIED / PARTIAL | Profil, para birimi koruması, rol, davet iptali, askıya alma, session yönetimi; özel permission matrisi yok |
| Global arama | PARTIAL | Modül navigasyon aramasıdır; tüm iş kayıtlarını arayan global arama değildir |
| Bildirimler | NOT IMPLEMENTED / PARTIAL | Tercih saklanıyor; teslim kuyruğu/e-posta/push yok |
| Rezervasyon, iade, fatura, lisans | NOT IMPLEMENTED | UI varmış gibi kabul edilmedi |

## Bulgular ve düzeltmeler

P0: Bu sınırlı denetimde doğrulanmış P0 bulunmadı; güvenlik açığı yoktur anlamına gelmez.

| ID | Öncelik | Durum | Kanıt ve işlem |
|---|---|---|---|
| A01 | P1 | FIXED | PATCH /finance/fake önce 200 ile yeni ödeme yarattı. Endpoint/yöntem/segment sözleşmesi eklendi; yanlış yöntem 405, yanlış adres 404. Regresyon geçti |
| A02 | P1 | FIXED / PARTIAL | Aynı anahtarlı ödeme iki ayrı kayıt üretiyordu. `MutationReceipt` + ödeme aynı transaction içinde. Paralel tekrar aynı payment id döndürüyor, farklı payload 409. Eski anahtarsız API istemcileri uyumluluk için hâlâ kabul edilir |
| A03 | P1 | FIXED / PARTIAL | Aynı anahtarlı stok girişi 3 yerine 6 yaptı. Aynı mekanizma ile tek stok hareketi; form başarısız retry sırasında anahtarı korur. Anahtarsız dış istemci riski sürer |
| A04 | P2 | FIXED | Dashboard audit endpoint yetkisini dolaşarak detail/entityId/userId de döndürüyordu. Widget için yalnızca id/action/createdAt seçiliyor; regresyon geçti |
| A05 | P2 | FIXED | Tahsilat formu yalnızca ilk 12 tamamlanmış belgeyi yükledi. Bütün sayfaları okur; 13 belgeyle gerçek tarayıcı seçicisi testi geçti. Büyük veri için aramalı seçici hâlâ gerekli |
| A06 | P2 | FIXED | Ham Failed to fetch ve geçersiz JSON yanıt hataları. Anlaşılır bağlantı/oturum mesajı eklendi; form state'i resetlenmez. Kesintide otomatik güvenilir kuyruk/retry iddiası yok |
| A07 | P2 | FIXED | Satın alma talebi dönüşümü CONVERT QUOTE audit etiketi kullanıyordu; CONVERT REQUEST olarak düzeltildi. Satın alma–ödeme testinde etiket assert edildi |
| A08 | P2 | FIXED / PARTIAL | DocumentLine.productId FK yoktu. RESTRICT FK ve productId index migration eklendi, boş test DB'de uygulandı. Kalem ürününün tenant eşitliği hâlâ servis doğrulamasına bağlı |
| A09 | P2 | FIXED | Ters tarih aralığı sessiz boş rapor döndürüyordu; 400 doğrulaması eklendi ve test edildi |
| A10 | P2 | FAILED | Eski golden-image testi güncel logo/veri/tarih durumuyla uyuşmuyor. Referanslar otomatik değiştirilmedi; başarısız koşu saklandı |
| A11 | P1 | PARTIAL | Tüm hesaplar için paylaşılan auth-global 150/10 dakika sınırı bir kullanıcı tarafından doldurulabilir. Proxy/IP güven sınırı belirlenmeden gelişigüzel forwarded-header güveni eklenmedi |
| A12 | P1 | PARTIAL | RLS yok; DB runtime rolü tüm tenant satırlarına erişebilir. API scoping testleri başarılı, DB düzeyinde tenant sınırı tam değil |
| A13 | P2 | PARTIAL | Document.sourceId/reversalOf/session membership ve JSONB ilişkilerinin tamamında DB FK yok. Dokuz veri taraması test DB'de temiz; tüm gerçek veriler için garanti değil |
| A14 | P2 | PARTIAL | Dashboard sınırsız read + client aggregation; lookup 2000; finans seçici artık tüm sayfaları yükler ama ölçeklenmez |
| A15 | P2 | NOT TESTED | Uzun süreli session, bellek sızıntısı, yüksek eşzamanlı yük, tüm timezone/DST durumları |

9 somut düzeltme grubu (A01–A09) kaynakta tamamlandı. Bazılarının kapsam sınırı PARTIAL olarak korunmuştur; 9 tamamen kapatılmış üretim riski olarak yorumlanmamalı.

## Veri bütünlüğü ve demo ayrımı

VERIFIED: Testler yeni `vila_audit_1793653575818` DB'sinde, kısıtlı ayrı uygulama rolüyle çalıştı. Test şirketleri demo=true. Kullanıcının demo hesabı/test verileri karıştırılmadı. Normal kayıt boş şirket oluşturur.

VERIFIED: İzole DB'de orphan ürün, kalemde yabancı tenant, negatif stok, stok/hareket uyuşmazlığı, fazla ödeme, orphan source, kalem teslim sınırı, belge/kalem toplam farkı ve üyeliği olmayan session sayıları 0. Bu tarama ana DB üzerinde yapılmadı.

PARTIAL: MutationReceipt uygulama rolünde genel CRUD izni alır; append-only audit kadar sertleştirilmiş değildir. İstek anahtarlarının silinmesi eski tekrarları yeniden işletebilir; retention politikası yok. Business audit ve stok/ödeme kayıtları mevcut append-only izinleriyle korunur.

## Test geçmişi ve kanıt

- `docs/verification/audit-before.json`: düzeltme öncesi 4 test; 3 FAILED, 1 VERIFIED. Ödeme/stock duplicate ve yanlış HTTP yöntemi gerçek DB üzerinde üretildi.
- `docs/verification/audit-first-full-run.json`: 24 test; 22 geçti, 2 başarısız. Birinde yeni test yanlış düğme adı kullandı (Yeni kayıt yerine Yeni işlem); test düzeltildi. Diğeri eski görsel referans uyuşmazlığıdır.
- `docs/verification/e2e-results.json`: son işlevsel koşu 25/25 VERIFIED. 4 unit test VERIFIED. Typecheck ve üretim build VERIFIED.
- `docs/verification/audit-visual-parity.json`: mevcut çalışan UI ve audit UI, aynı veriyle 5 durumda birebir PNG eşitliği VERIFIED. Genel bakış/ayarlar/projeler/finans 1440x1000; ayarlar 390x844. Tüm ekranlar için piksel paritesi iddia edilmez.
- `docs/verification/audit-integrity-metrics.json`: bütünlük taramaları ve düşük hacimli ölçüm.
- `docs/verification/audit-dependencies.json`: npm audit --omit=dev mevcut taramada 0 bildirilmiş açık. Sıfır uygulama güvenlik riski anlamına gelmez.

NOT TESTED: bağımsız pentest, yüksek yük, gerçek e-posta/ödeme/fatura, dış dünya deployment. Harici mesaj veya finansal işlem yapılmadı.
