# VILA Intelligence — uygulama ve pilot doğrulama

5 Kasım 2026. İzole geliştirme kabulü geçti. Canlı Anthropic bağlantısı henüz doğrulanmadı.

## Uygulama ve kaynaklar

Genel Bakış kataloğuna VILA Intelligence / AI Executive Overview eklendi. Mevcut kullanıcı/şirket tercihleri, taşıma, boyutlandırma, saklama ve geri gösterme kullanılıyor. Şirketin satış okuma yetkisi bulunan kullanıcılar KPI’ları görebiliyor. Harici analizi OWNER ve ADMIN başlatabiliyor.

Tek kaynak aktif satış siparişleridir. Tüm dönem için açık sipariş sayısı CONFIRMED + PARTIAL, kısmi sipariş sayısı PARTIAL, karşılanmış sipariş sayısı FULFILLED üzerinden hesaplanır. Kısmi siparişler açık sayısına dahildir. Arşivdekiler ve diğer durumlar dışarıda kalır. Uygun kayıt yoksa değer unavailable olur. Para tutarı, büyüme karşılaştırması veya gecikme eşiği kullanılmaz. Her KPI kaynak, dönem, birim, sorgulama zamanı ve satış ekranına erişim bilgisi taşır.

Sunucu Anthropic Messages API ve JSON şeması kullanır. Model yalnız doğrulanmış Türkçe bulguları bölüm ve öncelik sırasına göre seçer. Sunucu her seçimi kaynak KPI ve izinli bölümle eşleştirir. Böylece kullanıcıya gösterilen sayılar ve bulgular ERP’den gelir. Ham kayıt metni, kimlik veya şirket adı model girdisine eklenmez. Sağlayıcıya araç tanımı verilmez. [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

## İşletim

Dış işleme varsayılan olarak kapalıdır. Operatör veri işleme koşullarını ve yönetici onayını doğruladıktan sonra pilot şirketi sunucuda izin listesine alır. Analizi isteyen şirket yöneticisi widget üzerinden aktarımı ayrıca onaylar. Anahtar ve yapılandırma sunucuda kalır.

| Değişken | Anlam |
|---|---|
| VILA_AI_APPROVED_TENANTS | Virgülle ayrılan onaylı şirket kimlikleri |
| VILA_AI_KEY | Anthropic API anahtarı |
| VILA_AI_MODEL | Hesapta kullanılabilen yapılandırılmış çıktı destekli model |
| VILA_AI_INPUT_USD_PER_MTOK | Modelin bir milyon girdi tokenı için USD fiyatı |
| VILA_AI_OUTPUT_USD_PER_MTOK | Modelin bir milyon çıktı tokenı için USD fiyatı |
| VILA_AI_DAILY_USD | Şirket başına UTC günlük rezervasyon limiti |

Her deneme için mevcut PostgreSQL RateLimit tablosunda atomik ve ihtiyatlı bir bütçe rezervasyonu yapılır (8192 girdi, 384 çıktı tokenı üzerinden). Rezervasyonlar gün sonuna kadar tüketilmiş sayılır. Başarılı sağlayıcı yanıtında bildirilen tokenlar ve yapılandırılmış fiyatlardan hesaplanan tahmini maliyet sunucu loguna yazılır. Bunlar fatura mutabakatı değildir. On dakikada kullanıcı başına 4, şirket başına 12 üretim sınırı uygulanır. Zaman aşımı 12 saniye; 429/503 için en fazla bir tekrar. Uygulama süreci başına en fazla 8 üretim eşzamanlı çalışır.

Sunucu, okumada KPI’ları tekrar hesaplar. Beş dakikalık analiz önbelleği şirket, kullanıcı, rol, model ve geçerli bulgu içeriğine bağlıdır. Aynı kapsamdaki eşzamanlı istekler süreç içinde birleşir. Birden fazla sunucuda hız ve bütçe sayaçları ortaktır; sonuç önbelleği ve iş birleştirme süreç başınadır. Sayfa açılması harici çağrıyı başlatmaz.

## Dosyalar ve doğrulama

- src/lib/intelligence-metrics.ts, intelligence-provider.ts, intelligence.ts — doğrulanmış metrikler, sağlayıcı ve analiz kontrolü.
- src/lib/dashboard-registry.ts, dashboard-engine-api.ts — katalog, yetkili okuma ve açık onaylı yenileme uçları.
- src/components/dashboard-engine/intelligence-widget.tsx ve widgets.tsx — KPI, kaynaklar, yorum ve güvenli durumların gösterimi.
- tests/intelligence.test.ts, tests/dashboard-engine.test.ts, tests/e2e/intelligence.spec.ts, tests/intelligence-provider-mock.cjs, scripts/verify-intelligence.ts — doğrulama.

70/70 tarayıcı ve API regresyonu, 19/19 birim testi, TypeScript ve production build geçti. İzole tarayıcı kontrolü ayrıca gerçek bir test satış siparişini veritabanından okuyup yönetici onayı, HTTP sağlayıcı adaptörü, şema doğrulaması ve widget gösterimini uçtan uca çalıştırdı. Bu kontrolde sağlayıcı HTTP cevabı test dublöründen geldi. Ön denemelerde test siparişinin zorunlu depo/tutar alanları tamamlandı ve katalog sayısı yeni widget ile 17 olarak güncellendi. Son koşularda atlanan veya başarısız test yok.

## Pilot

Onaylı test şirketini, model erişimini, fiyatları ve limiti sunucuda tanımlayın. Yetkili kullanıcıyla kataloğa widget’ı ekleyin. Sayıları satış siparişleriyle karşılaştırın. Yönetici hesabında Analizi yenile ile aktarımı onaylayın; kaynakları, son analiz zamanını ve kullanım logunu doğrulayın. Canlı pilot kabulündeki açık adım, gerçek anahtarla bu çağrının başarıyla tamamlanmasıdır. Mevcut 3500 ortamında varsayılan kapalı çalışma kullanılır.
