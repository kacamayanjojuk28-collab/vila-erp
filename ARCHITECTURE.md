# Mimari
## Modüler monolit
Next.js App Router → route handler → kimlik/yetki/validasyon → domain servisleri → Prisma adapter-pg → PostgreSQL. React istemcisindeki formlar HTTP üzerinden kalıcı servisleri çağırır; localStorage yalnızca görünüm tercihi içindir. İş kayıtları için sahte API, bellek içi veri tabanı veya tarayıcı deposu kullanılmaz.

- src/lib/security.ts: scrypt, SHA-256 ile saklanan rastgele oturum tokeni, HttpOnly/SameSite cookie, 7 günlük sona erme, origin doğrulama, DB tabanlı rate limit, sabit RBAC.
- src/lib/domain.ts: modüle özgü Zod şemaları ve Decimal satır hesabı. Kullanıcıdan gelen toplamlar kabul edilmez; sunucu yeniden hesaplar.
- src/lib/service.ts: tenant referans doğrulama, optimistic version kontrolü, serializable transaction retry, stok ve belge durum geçişleri, audit.
- src/app/api/[...path]/route.ts: HTTP uyarlayıcı; oturum/organizasyon, generic kayıt kaynakları ve özel finans/davet/dashboard akışları. Alan servisleri bağımsızlaştırılarak sonradan ayrı servislere taşınabilir.
- src/components: çalışma alanı shell, bağımsız modül ekranları, form editörü, ortak UI ve referans animasyonları.

## Veri modeli kararı
Müşteri, tedarikçi, ürün, depo, fırsat, proje, görev ve aktivite özellikleri türle doğrulanan Record.data JSONB içinde; kimlik/tenant/tür/kod/durum/tutar/sürüm ayrı kolonlarda. Bu model hızla değişen ERP alanları için başlangıç modüler monolit tercihidir; ürünleşme sırasında modüle özgü typed tablolar ve JSON bağlantıları için ek FK/RLS önerilir. Belgeler, satırlar, stok, hareket ve finans kayıtları ayrı ilişkisel tablolardır. Finans ve stok invariants DB CHECK/FK'larla desteklenir.

## İşlem garantileri
Satış/satın alma belgesi ve satırlar atomik kaydedilir. Teklif/talep yalnızca bir kez dönüşür (unique sourceId). Onay → fulfilment geçişleri tekrar işletilemez. Stok çıkışı `quantity >= requested` koşullu güncelleme yapar; transferin iki ayağı aynı transaction içindedir. Serializable çatışmaları üç denemeye kadar yeniden çalıştırılır. Parasal tutarlar Decimal(18,2), miktarlar Decimal(18,3), satır sonunda iki ondalık yuvarlama. Ters kayıt orijinal finans hareketini korur, bağlı belgenin paid tutarını azaltır; unique reversalOf tekrarını engeller.

## Sınırlar
Tek para birimi/şirket; finansal kayıt oluşunca şirket para birimi kilitlenir. Kısmi sevkiyat/mal kabulü, rezervasyon, parti/seri numarası, çoklu döviz kuru, resmî muhasebe defteri ve e-fatura yoktur. Raporlar uygulama sunucusunda hesaplanır; büyük tenantlar için SQL aggregate, indeks/JSONB planı ve arka plan raporlama gerekir. Lookup şu an 2000 kayıtla sınırlı; ana listeler 12'li sayfalanır. Sabit roller tüm operasyon verilerini okuyabilir; yalnızca audit yöneticilere açıktır. Daha dar okuma izinleri ürün politikası olarak ayrıca tasarlanmalıdır.
