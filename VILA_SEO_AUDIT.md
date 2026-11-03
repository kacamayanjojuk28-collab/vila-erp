# VILA SEO denetimi

3 Kasım 2026. Bu çalışma izole 3100 sürümündedir; ana DB, migration ve canlı deployment değişmedi. Kullanıcı henüz domain bulunmadığını doğruladı.

## Keşif

Next.js 16.4.3 App Router, React 19, TypeScript, Prisma 7.10.1, PostgreSQL, GSAP ve yerel Urbanist kullanılıyor. `src/app/layout.tsx` yalnız genel title ve kısa description içeriyordu. Public klasörü, favicon, manifest, sitemap, robots, OG görseli ve analytics entegrasyonu yoktu. Route group yok; `/` client Workspace'i açıyor. Login/register aynı ekran içindeki durumlar; forgot/reset password sayfası yok. Onaylı marka, `workspace.tsx` ve `auth.tsx` içindeki büyük harf VILA yazısı; eski lime kutulu V kullanılmıyor.

## Rota envanteri

| Kategori | Gerçek rota | Politika |
|---|---|---|
| Public marketing | Yok | Sitemap'e öneri URL eklenmedi |
| Public authentication | `/` içindeki login/register | noindex, nofollow |
| Private ERP | `/#overview`, CRM/satış/finans/stok/proje/görev/rapor/ayar hash'leri | Aynı noindex shell; gerçek veri API oturum/üyelik/rol kontrolünde |
| API | `/api/[...path]` | noindex header, private no-store; mevcut auth korundu |
| Teknik varlıklar | `/brand/*`, manifest, robots, sitemap | Hassas veri yok; erişilebilir |
| Bilinmeyen URL | 404 | HTTP 404; root marka metadata'sı ve noindex |

Hash'ler bağımsız public sayfa değildir. Login ekranı tanıtım sayfasına dönüştürülmedi. SEO etiketleri veri güvenliği sağlamaz; RLS ve diğer önceki sağlamlaştırma borçları devam eder.

## Uygulananlar

- `src/lib/site.ts`: merkezi title/template/description, uygulama adı, OG/Twitter, ikonlar, manifest, formatDetection ve locale.
- Root layout: Türkçe dil korunarak metadata ve viewport tanımlandı. Tema renkleri mevcut CSS kaynaklarından alındı.
- Canonical/metadataBase/og:url ve mutlak OG görsel URL'si yalnız explicit production ortamı ve doğrulanmış HTTPS origin girilince üretilir. Şu an yok; localhost fallback üretilmez.
- Robots tüm shell'in noindex etiketini okuyabilmek için taramaya izin verir; `Disallow: /` ile noindex görünmez yapılmadı. [Google noindex kuralı](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- Sitemap boş URL setidir: şu an indekslenebilir gerçek public sayfa yok. Robots içinde boş sitemap ilan edilmez; Search Console'a gönderilmez.
- Tüm cevaplarda X-Robots-Tag, API'de private/no-store. Gelecekte public marketing eklenirse global header bilinçli olarak rota bazında ayrılmalıdır.

## Kalanlar

Domain/TLS ve dış crawler testleri yok; staging'e internette erişim açılacaksa reverse proxy erişim kontrolü gerekir. HSTS yerel HTTP'ye eklenmedi. CSP mevcut unsafe-inline politikasını koruyor; nonce dönüşümü bu görevde yapılmadı. JSON-LD eklenmedi: görünür public ürün/şirket içeriği, gerçek şirket bilgisi ve fiyat yok. Hayali Organization/FAQ/rating üretilmedi.

Public on-page içerik/H1/iç bağlantı optimizasyonu uygulanacak bir marketing sayfası yoktur. Mevcut form etiketleri ve modül başlıkları işlevsel regresyon kapsamındadır; geniş kapsamlı erişilebilirlik sertifikası verilmez. Marketing sayfaları gelecekte gerçek yollarla, ayrı layout ve tekil metadata ile planlanmalıdır.

Teknik referanslar: [Next metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images), [dosya kuralları](https://nextjs.org/docs/app/api-reference/file-conventions/metadata), [Google Search Central](https://developers.google.com/search/docs). Sonuç kanıtları VILA_SEO_VERIFICATION.md içindedir.
