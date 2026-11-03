# VILA teknik borç kaydı

Tarih: 3 Kasım 2026. Kapsam: mevcut ERP'nin sağlamlaştırılması; yeni modül veya tasarım çalışması değildir. Başlangıç kanıtları: VILA_SYSTEM_AUDIT.md, VILA_INTEGRATION_REPORT.md, VILA_PRODUCTION_READINESS.md. Bu belgelerdeki önceki ölçümler tarihsel sonuçlardır; aşağıdaki durum yalnızca izole hardening ortamında doğrulanmıştır.

## Öncelikli bulgular

| ID / önem | Kök neden ve etki alanı | Yapılan işlem / kalan iş | Durum |
|---|---|---|---|
| T01 / P1 | API orgId filtrelerine bağımlılık; runtime rolü farklı şirket satırlarına doğrudan erişebilir | RLS planı ve ayrı tabloda havuz/transaction prototipi hazır. Uygulama tablolarında RLS açılmadı | Açık |
| T02 / P1 | DocumentLine ürün ilişkisi yalnızca ID üzerinden; başka şirket ürünü DB seviyesinde bağlanabilir | orgId backfill, document/product composite FK, eski writer için insert trigger; doğrudan yabancı şirket ürün ekleme P2003 ile reddedildi | İzole ortamda düzeltildi |
| T03 / P1 | Stok/finans anahtarsız istekleri tekrar uygulanabilir | Idempotency-Key zorunlu, eksik anahtar 400; receipt UPDATE/DELETE runtime rolüne kapalı. Aynı anahtarın tekrar kullanımı korunur | Kısmen kapatıldı; diğer create uçları ve tarayıcı yenilemesi sonrası anahtar kurtarma açık |
| T04 / P1 | auth-global sayacı bütün müşterilerin girişlerini birlikte engeller | Ortak kota çağrısı kaldırıldı; hesap bazlı kota korundu. Tükenmiş ortak sayaçla ilgisiz giriş 401 döner | İzole düzeltildi; güvenilir edge bazlı saldırı koruması açık |
| T05 / P1 | RateLimit expire-delete ve increment ayrı işlemlerdi | Tek INSERT ON CONFLICT, DB saati ve atomik pencere yenileme; 30 eşzamanlı çağrıdan tam 10 kabul, 20 ret | İzole düzeltildi |
| T06 / P1 | Dashboard bütün kayıt/belge/ödemeleri okuyup JSON gönderiyor; gruplamada tekrar find | İsim arama Map ile doğrusal hazırlığa alındı. 7 MB yanıt devam ediyor; sunucuda aggregate ve sınırlı drill-down sözleşmesi gerekli | Açık |
| T07 / P1 | 3000/ana DB ile 3100/migration farkı | Kontrollü release planı hazır; ana ortama aktarım yapılmadı. Bu çalışmanın başında 3000 ve 55432 erişilemiyordu | Açık |
| T08 / P2 | Eski görsel referans, güncel logo/veri/tarih durumuyla aynı değil | Başarısız test korundu; assertion/baseline değiştirilmedi. Güncel onaylı referansla deterministik karşılaştırma gerekli | Açık |
| T09 / P2 | Catch-all API çok sorumluluk taşıyor; Record JSONB farklı modüllerin alanlarını birlikte tutuyor | Çalışan modüller yeniden yazılmadı. İşlem sınırları korunarak gelecekte validation/iş mantığı ayrıştırılmalı | Açık |
| T10 / P2 | Manuel SQL FK/trigger ve Prisma modelinin ifade gücü farklı | Migration kaynak kabul edilmeli; gölge DB introspection/diff kontrolü gerekir. db push kullanılmamalı | Açık |
| T11 / P1 | Sync scrypt ve farklı e-postalarla sınırsız yeni kota anahtarları kaynak tüketebilir | Hesap bazlı limit tam DoS koruması değildir; async/kapasiteli hashing ve güvenilir proxy sınırı ayrı doğrulanmalı | Açık |
| T12 / P2 | Lookup 2000 sınırı, finans seçeneklerinde tüm sayfaların çekilmesi, receipt/rate retention yok | Büyük veri seçicileri ve yetkili retention politikası gerekli; rastgele kayıt silme yapılmadı | Açık |
| T13 / P1 | Kurtarma/doğrulama akışları, operasyonel secret/TLS/izleme süreci eksik | Yeni özellik yasağı gereği uygulanmadı; ticari kabulde ayrıca karşılanmalı | Açık |
| T14 / P2 | Önceden Git geçmişi yoktu | ae2a388b5beb2fcadce3270e0310ac73c005f406 başlangıç commit'i oluşturuldu; bu geçmiş geliştirme geçmişi değildir. Secret ve test DB dosyaları hariç tutuldu | Başlangıç disiplini kuruldu |

P1 müşteri verisi/erişim/teslim için yüksek öncelik; P2 bakım, ölçek veya doğrulama borcudur. İzole düzeltildi ifadesi ana ortamda giderildi anlamına gelmez.

## Referans makalenin projeye uygulanması

[Pion Bilişim makalesi](https://pionbilisim.com/ai-ile-yazilim-gelistirirken-karsilasabileceginiz-teknik-sorunlar) HTTP 200 ile indirildi ve okundu. Makale kontrol listesi olarak kullanıldı, doğruluk kanıtı olarak kullanılmadı.

| Kontrol | VILA karşılığı ve kanıt |
|---|---|
| 1. Mimari tutarsızlık | Catch-all API/JSONB model korunarak küçük değişiklikler; T09 |
| 2. Regresyon | 29 işlevsel + 4 birim test; görsel test başarısızlığı ayrıca açık |
| 3. Farklı zamanların kod uyumu | Zorunlu request key API sözleşmesi değiştirir; eski istemcilerin uyumu release ön koşulu |
| 4. API/DB entegrasyonu | DocumentLine composite FK, trigger ve doğrudan DB negatif testi |
| 5. Güvenlik/erişim | RBAC/tenant API testleri, receipt izinleri; RLS yalnız prototip |
| 6. Karmaşıklık/borç | T09–T12; sırf biçim için kapsamlı refactor yapılmadı |
| 7. Tekrar/bağımlılıklar | transaction/idempotency helper'ları yeniden kullanıldı; lockfile sürümleri değiştirilmedi. Build geçmesi zafiyetsizlik kanıtı değildir |
| 8. Performans | 2 tenant, 20 bin belge/hareket/ödeme, 12 istek, concurrency 4; payload sorunu doğrulandı |
| 9. Test/üretim farkı | Yerel PG18/3100 test edildi; ana DB, TLS/proxy, çok instance ve gerçek kullanıcı yükü doğrulanmadı |
| 10. Geçici düzeltme riski | Rate counter atomik çözüldü; auth-global kaldırmanın kalan DoS riski açıkça kaydedildi |

## İnceleme sınırları

API method sözleşmesi, Decimal hesaplama, serializable transaction, stok negatif bakiye koruması, oturum üyelik kontrolü ve önceki hata mesajı düzeltmeleri korundu. Tüm modülleri parçalayacak refactor, otomatik bağımlılık yükseltmesi, kullanılmayan kod için kör silme yapılmadı. Her JSONB ilişki için DB constraint yoktur; composite FK tenant eşitliği sağlar, ürünün kind alanını veya kullanıcının erişim yetkisini tek başına garanti etmez. Tüm rollerin veri okuma kapsamı ayrıca ticari yetki matrisiyle onaylanmalıdır.


## T06 ilerleme — 3 Kasım devam çalışması

İlk tablodaki T06 tarihsel başlangıçtır. Yeni view=summary sözleşmesinde aylık ödeme aggregation PostgreSQL'e taşındı, gereksiz belge alanları okunmuyor, ham belge/ödeme verisi tarayıcıya gönderilmiyor. 6.995.579 → 153.773 byte, son kısa p95 446,95 ms. T06 kısmi: unbounded server record/document okuması, büyüyen rapor grupları ve legacy endpoint devam ediyor. Yeni karşılaştırma testi iki tenant ve üç tarih aralığında mevcut hesaplarla eşdeğerliği doğrular. UI tasarımı aynı; veri tüketimi değişti.
