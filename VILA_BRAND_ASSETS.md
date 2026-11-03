# VILA marka varlıkları

3 Kasım 2026. Kaynak: mevcut `.brand` VILA metni, Urbanist Variable 700, -0.02em harf aralığı. Bağımsız SVG logo dosyası bulunmadı; mevcut yazı markası fontun gerçek glif konturlarına dönüştürüldü. Yeni amblem icat edilmedi; eski yeşil V simgesi geri eklenmedi. UI logo bileşeni değiştirilmedi.

## Dosyalar

Tümü `public/brand/` altında tek kopyadır; App Router layout metadata üzerinden bağlanır.

| Dosya | Format / boyut |
|---|---|
| favicon.ico | Gerçek ICO dizini; PNG içeren 16/32/48 |
| icon.svg | Harici font istemeyen vektör path; 512 viewBox |
| icon-16.png, icon-32.png, icon-48.png | PNG 16/32/48 kare |
| apple-touch-icon.png | PNG 180 kare |
| pwa-192.png, pwa-512.png | PNG 192/512 kare, purpose any |
| pwa-maskable-192.png, pwa-maskable-512.png | PNG 192/512 kare, purpose maskable |
| og.png | PNG 1200×630 |

Koyu zemin #111513 ve açık VILA #f2f4f0; OG'de mevcut lime #c4ef4f vurgusu. Maskable yazı genişliği 512'de 340; glif yüksekliğiyle birlikte merkezde %40 yarıçaplı güvenli daireye sığar. Normal ikon genişliği 450. Wordmark 16 px'te doğası gereği küçük harf gövdesine sahiptir; ayrı küçük-boyut amblemi kullanıcı onayı olmadan üretilmedi.

Üretim: `.local/brand-tools` içindeki fontTools/brotli ile `scripts/brand-source.py`, mevcut transitive Sharp ile `scripts/brand-assets.mjs`. Uygulama package/lock bağımlılığı değişmedi. Yerel araç ortamında Pillow da kuruldu ancak üretim script'i kullanmıyor. Font kaynak ve lisansı @fontsource-variable/urbanist paketinde korunur. Tekrar üretim için aynı font paket sürümü kullanılmalıdır.

Programatik boyut/format ve ICO gömülü frame kontrolü: `docs/verification/seo-brand-assets.json`; HTTP erişim ve MIME kontrolleri seo.spec.ts. OG görseli doğrudan incelendi. Apple/iOS ve Windows gerçek cihaz kurulumları henüz test edilmedi. SVG/PNG'nin doğrulanması fiziksel cihaz keskinliği garantisi değildir. Manifest mevcut olsa da offline PWA yok; service worker ve hassas veri cache'i eklenmedi.
