# VILA Finance Core v1.0 — kabul kaydı

4 Kasım 2026. Dal: `feature/finance-core-v1.0`. Kaynak commit: d8fc1ac5f0b2e6974f7102842a38b29f0694cb4d. Teknik iç muhasebe kapsamı aşağıdaki kanıtlarla doğrulandı. Production veya tam mevzuat uyumu onayı değildir.

| Kriter | Durum | Somut kanıt / sınır |
|---|---|---|
| FC-01 cari bakiye/ekstre/açılış/açık/yaşlandırma | VERIFIED | FC01/02/10/15, kontrol hesapları ve alt hesaplar, tarih kesimi |
| FC-02 tahsilat/ödeme/avans/çoklu tahsis | VERIFIED | FC01–06/12/13; kaynak Payment korunur, ters kayıt ve kapasite kontrolü |
| FC-03 satış/alış/kredi, kısmi fatura, vergi, PDF | VERIFIED | FC04/06/10/11/12; ilişkisel satırlar, Decimal, tarihli kural; PDF iç kayıttır |
| FC-04 dengeli çift taraflı defter/hesap planı/dönem | VERIFIED | FC09/15, doğrudan SQL unbalanced commit rollback ve immutable privilege testleri |
| FC-05 DB raporları ve mutabakat | VERIFIED | FC01–15; kaynak/cari/fatura/fiş farkları ID ve nedenle görünür; CSV sınırlı sayfa |
| Tenant/RBAC/API/export | VERIFIED | FC07/11, pilot Read-RBAC regresyonu; 19 RLS tablosu ve 200 havuz işlemi |
| Atomiklik/idempotency/race | VERIFIED | FC05/08/13, 23514 rollback, paralel farklı numara ve aynı ödeme |
| Geçmiş rapor yeniden üretimi | VERIFIED | FC02/12; from/asOf/knownAt birlikte kullanılır; commit-time/yasal zaman damgası garantisi değildir |
| Mevcut ERP / tasarım | VERIFIED | 37 eski E2E; 32 mevcut görsel snapshot; yeni ekranın dört tema/viewport görüntüsü |
| TypeScript/build/unit/E2E | VERIFIED | 13/13 unit, 52/52 E2E; tsc ve production build PASS, skip yok |
| Performans ölçümü | VERIFIED | 5.000 fatura/15.000 satırlık yeni fixture, 240/240; p95/p99/plan/bellek kanıtı; önceki hatalar saklı |
| Migration / eski veriyi koruma | VERIFIED | Yeni DB'de 13 migration; 14 eski tablo sayım ve içerik özetleri aynı; otomatik backfill yok |
| İzlenebilir feature teslimi | VERIFIED | Kaynak commit ve test manifesti; yalnız feature dalı push; main/pilot ref'leri değişmedi |
| Stok muhasebesi/değerleme | PARTIAL | Mal kabulü operasyonel, stok borcu yalnız alış faturasında; tekrar maliyet yok. COGS/FIFO/ağırlıklı ortalama etkin değil |
| Mevzuata tam muhasebe/vergi uyumu | BLOCKED | Şirket mali müşaviri onayı yok; temel TRY/tarihli vergi sınıfları dışında iddia yok |
| Gerçek e-Fatura/e-Arşiv | BLOCKED | Yalnız hazırlık sözleşmesi. Provider/sandbox, UBL doğrulama, imza/mühür ve yetki yok; canlı gönderim yok |
| Main merge / yeni tag / production migration | BLOCKED | Kullanıcının ayrı onayı gerekir; bu görev kapsamında yapılmadı |

## Karar

Finance Core v1.0'ın tanımlanan iç TRY çekirdeği feature dalında uygulanmış ve test kapısı geçmiştir. Açık teknik test hatası yoktur. Yukarıdaki PARTIAL/BLOCKED sınırlar korunur: resmî belge veya eksiksiz yasal muhasebe ürünü olarak kullanıma hazır ilan edilmez. Canlı entegrasyonun bu sürümde yalnız hazırlık mimarisiyle teslim edilmesi kullanıcı kapsamıyla uyumludur.

## Korunan sürüm

- `main` ve `v0.9.0-pilot^{commit}`: `eafdd3305dde03d23ff927ac1126b501a493e89b`.
- Pilot annotated tag nesnesi: `1e2bf7fa7164c93f8e693e3b5589f146f37387ac`.
- Ana veritabanına migration, veri dönüşümü, silme, yeni release tag veya production deployment yapılmadı.
- Credentials, oturumlar, dump'lar, `.local` ve build çıktıları commit edilmedi. Kod/tax/account yapılandırması gerçek veriye otomatik uygulanmadı.

## Onaylı geçiş öncesi operasyonel adımlar

1. Bu feature commit'inin incelemesi ve ayrı merge/geçiş onayı.
2. Şirket mali müşavirinin hesap eşlemesi, dönem, başlangıç bakiyesi, vergi ve stok tanıma politikasını onaylaması.
3. Gerçek hedefin ayrı restore kopyasında migration kilit/süre ve veri uyumluluğu provası; eski ödemeler için açık inceleme/açılış planı. Belirsiz kayda otomatik backfill yok.
4. Onaylı yedek/restore, yazma durdurma, aynı artifact ve kısıtlı runtime rolü/RLS konfigürasyonu; migration planındaki rollback sınırları. Yeni finans olayından sonra eski writer aynı DB'ye döndürülmez.
5. E-belge gerekiyorsa hazırlık belgesindeki gerçek sağlayıcı/test ve hukuki ön koşullar ayrıca tamamlanır. Bu adımlar yapılmış gibi işaretlenmedi.

İlgili beş rapor bu repository'nin kökündedir. Ayrıntılı test/başarısız koşu kanıtları `docs/verification/finance-*` altındadır. Bu kabul kaydı yeni genel denetim veya kapsam dışı geliştirme başlatmaz.
