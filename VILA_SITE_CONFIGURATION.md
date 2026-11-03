# VILA site yapılandırması

3 Kasım 2026. Kullanıcının canlı domaini yok. Yapılandırma hazır, domain/hizmet aktivasyonu yapılmadı.

## Ortam ve metadata

`VILA_SITE_ENV=staging` varsayılan örnektir. Yalnız `production` ve dolu `VILA_PUBLIC_ORIGIN` birlikte olduğunda canonical/metadataBase/og:url/og:image/twitter:image üretilir. HTTPS origin olmalı; path/query/fragment/kimlik bilgisi/port ve yerel adresler reddedilir. Değerin gerçekten kullanıcıya ait olduğunu kod doğrulayamaz: DNS ve sahiplik kontrolü manuel ön koşuldur. `APP_ORIGIN` oturum/CSRF içindir; SEO origin'ine otomatik çevrilmez. Ortam değerleri build sırasında okunur; değişiklikten sonra build gerekir.

Tüm mevcut sayfalar production dahil noindex kalır. Canlı domain girmek özel ERP'yi indekslemeye açmaz. Public marketing gelecekte ayrı layout ve route politikası gerektirir. Canonical üretimi örnek domain ile birim testte doğrulandı; örnek adres uygulama çıktısına yazılmadı.

## Web dosyaları

- Layout metadata merkezi `src/lib/site.ts` kullanır; uygulama adı VILA ERP, Türkçe açıklama, tr_TR, title template, ikon/Apple linki.
- `/manifest.webmanifest`: VILA ERP / VILA, id/start/scope `/`, standalone, tr, koyu renkler; any/maskable ayrı PNG listesi.
- `/brand/og.png`: 1200×630, statik ve müşteri verisiz. Domain olmadığından crawler'lara mutlak OG URL henüz ilan edilmez.
- `/robots.txt`: Allow /, böylece noindex okunabilir. Boş sitemap gönderim önerisi yok.
- `/sitemap.xml`: yalnız boş urlset; özel URL yok. Gerçek public sayfalar çıkana kadar submit edilmez.

## Güvenlik ve cache

X-Content-Type-Options nosniff, X-Frame-Options DENY, same-origin referrer ve mevcut CSP korunur. Tüm cevaplarda X-Robots-Tag noindex/nofollow; API'de private, no-store, max-age=0. Auth/role/tenant iş kuralları değişmedi. Staging proxy/VPN erişim kontrolü henüz yok; yerel sunucu loopback'te. Internete açmadan ayrı erişim kontrolü gerekir.

HTTPS/HSTS hosting aşamasındadır; yerelde HSTS gönderilmez. CSP unsafe-inline borcu korunuyor, bu görevde gevşetilmedi veya nonce altyapısı yeniden yazılmadı. Service worker/offline cache eklenmedi. Hassas API yanıtları analytics'e gönderilmez. 404 durum kodu test edilir; zorlanmış 500/production felaket testi bu SEO işinin kapsamında çalıştırılmaz.

## Dış hesaplar için manuel adımlar

1. Domaini satın alıp sahipliği/DNS'i doğrula; apex/www tercihi ve tek HTTPS origin belirle. Diğer origin'den tek adımlı kalıcı redirect'i hosting'de kur ve test et.
2. HTTPS, erişim kontrolü, secrets, yedek ve release kapıları tamamlandıktan sonra SEO env değerlerini ayarla; build ile canonical/social URL'leri doğrula.
3. Search Console Domain property için yetkili hesapla DNS TXT doğrulaması yap. Token'ı uygulama deposuna yazma. Bing Webmaster için yetkili hesap/DNS veya doğrulanmış import kullan. Hiçbir hesap doğrulanmış gibi işaretlenmedi.
4. Yalnız gerçek public içerikler sonrası sitemap'i gönder; URL inspection, index coverage, duplicate/canonical ve noindex ERP testlerini takip et.
5. LinkedIn Post Inspector, uygun paylaşım debug araçları ve WhatsApp/X gerçek link paylaşımında OG önizlemesini kontrol et. Localhost dış botlardan erişilemez.
6. Analytics gerekiyorsa yalnız public marketing için ayrı karar ver: veri minimizasyonu, çerez/izin ve mevzuat incelemesi sonrası uygula. E-posta, şirket, müşteri, belge tutarı, iç arama ve özel route parametrelerini toplama.
7. Gerçek kullanıcı CWV p75 ölçümü domain/yeterli trafik sonrası; yerel test bir SLA değildir.

Next Metadata/dosya standardı: https://nextjs.org/docs/app/api-reference/file-conventions/metadata
