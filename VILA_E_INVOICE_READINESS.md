# VILA e-Fatura / e-Arşiv hazırlık sınırı

Tarih: 4 Kasım 2026. **Hazırlık mimarisi teslimidir; canlı entegrasyon yoktur.** İç FinancialInvoice ve SI/PI/CN numaraları resmî e-belge değildir. İç POSTED durumu yalnız VILA muhasebe kesinleşmesidir; GİB'e gönderildi/onaylandı anlamına gelmez. PDF'in her sayfası bunu açıkça belirtir.

## Doğrulanan resmî kaynaklar

- [GİB e-Fatura teknik mimari sayfası](https://ebelge.gib.gov.tr/efaturamevzuat.html), inceleme tarihinde entegrasyon kılavuzu v1.10 ve UBL-TR 1.2.1 paket/kılavuz bağlantılarını yayımlar. İç fatura numarası, zarf, dış belge kimliği ve profil birbirinden ayrılmalıdır. Sayfa/paket bağlantısını görmek, VILA XML'inin doğrulandığı anlamına gelmez.
- [Doğrudan entegrasyon kılavuzu v1.10](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-FaturaUygulamasiEntegrasyonKilavuzu-v1.10.pdf): başvuru, mali sertifika, sistem/test bilgileri ve entegrasyon test süreci tanımlar. Bu sürümde bunlar gerçekleştirilmedi.
- [Özel entegrasyon kılavuzu v1.14](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-Fatura_Uygulamasi_Ozel_Entegrasyon_Kilavuzu_v1.14.pdf): seçilecek sağlayıcı ve yetkilendirme süreci ayrıca doğrulanmalıdır. VILA'nın özel entegratör olduğu iddia edilmez.
- [GİB e-Arşiv teknik mimari](https://ebelge.gib.gov.tr/earsivmevzuat.html) ve [teknik kılavuz v1.18](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-Arsiv_Teknik_Kilavuzu_V.1.18.pdf), bölüm 6.4/ilgili format hükümleri: elektronik belge, imza/mühür ve doğrulanabilir veri biçimi gerektirir. Özel izinle PDF kullanımında PAdES ve ekli UBL-TR XML için şartlar açıklanır. Sıradan VILA PDF çıktısı bu şartları karşılıyor sayılmaz.

Paket bağlantısı [UBL-TR 1.2.1](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/UBL-TR1.2.1_Paketi.zip) olarak doğrulandı; içerik/schema/şematron çalıştırılması bu sürümde yapılmadı. Canlı hazırlıkta yayımlanan güncel paket sürümü yeniden sabitlenmeli ve checksum kaydedilmelidir. Eski v1.9 doğrudan entegrasyon PDF'i güncel teknik sayfadaki v1.10 yerine temel alınmadı.

## Somut adaptör sözleşmesi

`src/lib/e-invoice-boundary.ts`, transport veya sahte başarı implementasyonu içermeyen tip sözleşmesidir. İç invoiceId, orgId, immutable snapshot SHA-256, zarf kimliği, dış idempotency anahtarı ve schema sürümü açıkça ayrılır. ProviderDocument ayrı externalDocumentId ve providerRequestId taşır. Webhook ancak imzası doğrulanmış AuthenticatedProviderEvent üretebilir. Hiçbir provider kayıtlı olmadığından gönderme/webhook endpoint'i veya credential ayarı etkin değildir.

Gerçek entegrasyon aşamasında ayrı ExternalDocument ve DeliveryAttempt tabloları gerekir: orgId, internalInvoiceId, provider, externalDocumentId, envelopeId, request/response referansları, payload hash, attempt, scheduledAt, authenticated eventId ve immutable durum olayları. Bu gelecek tablolar mevcutta varmış gibi sunulmaz. Dış servisin aynı dokümanı aldığı belirsizse yeniden göndermeden önce idempotency/status sorgusu yapılmalıdır; yeni VILA muhasebe fişi oluşturulmamalıdır.

## Eksik ön koşullar

1. Gerçek sağlayıcı, sandbox hesabı, sözleşme/yetki ve mali müşavirce onaylı kapsam.
2. UBL-TR eşlemesi: taraf vergi kimlikleri/adresleri, profil, tip, birimler, vergi/istisna kodları, sıra/numara ve zorunlu XML alanları. VILA'nın temel cari kartları resmî e-belge taraf bilgilerini henüz garanti etmez.
3. Sabitlenmiş XSD/şematron/kod listeleriyle pozitif/negatif validasyon ve sağlayıcı testleri; belge imza/mühür, saklama ve görüntüleme doğrulaması.
4. Credential kasası/KMS referansı; frontend, Git, audit ve loglarda credential veya tam hassas payload bulunmamalı. Döndürme/iptal yetkileri ayrı tutulmalı.
5. Sınırlı retry/backoff; kalıcı business retlerini kör tekrar etmemek; belirsiz ağ sonucunda dış request kimliğiyle uzlaştırmak.
6. Webhook için ham gövde imzası, timestamp toleransı, replay/eventId benzersizliği ve kimliği doğrulanmış org/provider eşlemesi. İstemci orgId'sine güvenilmemeli.
7. Gönderim, teslim, ret ve hukuki iptal/itiraz akışlarının provider doğrulaması. Teknik transport ACK'i hukuki kabul değildir.

## Muhasebe/vergi sınırı

TRY ve temel tarihli STANDARD/ZERO/EXEMPT sınıfları iç kayıt hesabı içindir. Sabit bir KDV oranı tüm işlemler için varsayılmadı. Testteki %20 yalnız matematik örneğidir. Hesap kodları ve indirim/istisna/gelir tanıma politikası şirket mali müşavirinin incelemesini gerektirir. Tevkifat, ÖTV, özel rejimler, kur değerleme, resmî e-Defter ve GİB canlı gönderimi etkin değildir. Tam mevzuat uyumu/onay iddiası yoktur.
