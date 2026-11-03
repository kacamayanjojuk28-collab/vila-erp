# Uygulama durumu — 2026-11-02
**Geliştirme sürümü çalışıyor; talebin tamamı bitmiş veya üretime hazır ilan edilmedi.**

## Doğrulananlar
- Yerel Next.js üretim build'i başarılı; uygulama http://localhost:3000 üzerinde çalıştırıldı.
- PostgreSQL 18 port55432 bağlantısı, Prisma schema/client ve migration zinciri çalışıyor.
- 4 unit test ve 17 Playwright test (16 işlevsel + 8 görüntüyü karşılaştıran 1 görsel regresyon testi) son çalışmada geçti. Playwright gerçek Microsoft Edge kullanıyor; API ve tarayıcı akışları birlikte test ediliyor.
- Şirket izolasyonu (okuma/yazma/yabancı referans), RBAC, CSRF, HttpOnly cookie, parola değişince diğer oturumların iptali.
- CRUD kalıcılığı, stale update reddi, arama/filtre, arşiv, lead conversion ve müşteri geçmişi.
- Satın alma→mal kabul→teklif→sipariş→sevkiyat→tahsilat, tekrar işleme reddi ve exact Decimal tutar.
- Eşzamanlı stok çıkışı, başarısız transferin geri alınması, hizmet kalemlerinde stok yaratılmaması.
- Ödeme ters kaydı, çift reversal reddi, para birimi koruması ve DB negatif stok/append-only kontrolleri.
- 21 ekranın tarayıcıda hatasız render edilmesi; reduced-motion ve modal aç/kapat testi; 390px mobil ayarlar taşma kontrolü.
- Gerçek pg_dump yedeği ayrı veritabanına başarıyla geri yüklendi. Restore DB inceleme için bırakıldı.

## Tasarım karşılaştırması
Referans canlı siteden 1440x1000 ekranlar ve DOM/CSS ölçümleri alındı. VILA karşılıkları docs/verification altında. Ayarlar 320px profil kolonu, x103/y200 kart başlangıcı; 12 kolon dashboard; 62x507 yüzen dock; Urbanist, renk ve radius/spacing değerleri karşılaştırıldı. Finans, projeler ve takvim referans düzenlerine yeniden uyarlandı. Başlık .85s power4.out/22ms stagger, kart .9s power3.out, dock .9s, modal .45s back.out(1.5) / .22s power2.in; sekme .55s power3.inOut, manyetik düğme .5s ve 26s arka plan hareketi uygulandı.

**Görsel parite henüz tamamlandı işaretli değil.** Özel fotoğraf/logo taşınmadı; bağımsız arka plan ve VILA işareti var. Icon şekilleri Lucide eşdeğerleri. Türkçe metinler ve ERP verileri farklı olduğundan tüm ekranlar piksel düzeyinde aynı değildir. Referanstaki tüm popover, karakter/sekme klipleme ayrıntıları ve tüm responsive durumlar için birebir regresyon kanıtı yok. Ekran görüntüleri karşılaştırma kanıtıdır; 8 ekran/durum için otomatik golden-image testi kuruldu; sabit tarihli ayrı test şirketi kullanılır. Kart büyütme/küçültme, Escape ve odak yönetimi eklendi.

## Açık iş / üretime geçiş engelleri
- Referanstaki kalan etkileşimlerin tam görsel/hareket paritesi; aynı veri/durumla ayrıntılı görsel regresyon ve tüm mobil ekranların kontrolü.
- Büyük veri için sunucu aggregate raporları, aramalı/paginated lookup (şu an 2000 üst sınır), yük testleri; API DTO tiplerini sıkılaştırma ve alan tablolarını ayrıştırma.
- Per-permission özelleştirilebilir RBAC, modül etkinleştirme ayarları ve daha ayrıntılı audit diff.
- E-posta gönderimi, e-posta doğrulama, parola sıfırlama, bildirim teslimi, MFA. Mevcut davet URL'si gerçekten çalışır ancak e-posta gönderilmiş gibi gösterilmez.
- Rezervasyon, iade/iptal muhasebesi, stok lot/seri numarası ve gelişmiş raporlar.
- Üretim TLS/domain/secrets operasyonu, RLS, off-site yedekleme/retention, izleme ve bağımsız güvenlik incelemesi. Yedekleme komutu ve restore denemesi vardır; zamanlanmış politika kurulmadı.
- Bazı JSONB ilişki arşivleme kuralları servis doğrulamasına dayanıyor; tam ilişkisel bütünlük genişletilmeli. Görev değişiklikleri proje ilerlemesini aynı transaction içinde günceller ve test edilmiştir.

## Demo ayrımı
Normal şirket kaydı boş başlar. Seed ve otomasyon şirketleri Organization.demo=true taşır. Demo parolası yalnızca gitignore altındaki .local dosyasında; test parolaları çalışma anında rastgele üretilir. Test ve seed kayıtları gerçek PostgreSQL verileridir, üretim verisi olarak sunulmaz.

## Erişim yaşam döngüsü ve teslim modelleri
- Ekipte arama/sayfalama, rol değiştirme, erişimi askıya alma/açma, bekleyen davet iptali ve açık oturumları sonlandırma eklendi. Şirket sahibi ve kendi erişimi korunur; yönetici ataması yalnızca şirket sahibindedir. Askıya alınan üyeye yeni görev atanamaz.
- SaaS ve müşteri sunucusu için ortak Dockerfile, Compose, rastgele gizli değer üretimi, migration ve kısıtlı runtime DB rolü hazırlığı deploy/ altında. Compose config doğrulandı; Docker motoru kapalı olduğundan container çalıştırma testi henüz yapılmadı.

Son doğrulama: üretim build başarılı; 17/17 Playwright testi geçti. Ekip ve oturum ekranları 1440px/390px gerçek Edge ile kontrol edildi; yatay taşma yok. deploy/migrate.mjs boş ve ayrı PostgreSQL veritabanına dört migration uyguladı; runtime SELECT/INSERT izinleri ve Audit/Movement/Payment UPDATE/DELETE yasakları doğrulandı. Docker Engine kapalı olduğu için Docker imajının build/start denemesi bekliyor.

## Ürün geliştirmesi: kısmi teslimat — 2026-11-02
- Satış ve satın alma kalemlerinde sipariş / işlenen / kalan miktar takip edilir. Seçilen miktarlar aynı transaction içinde stok ve belgeye işlenir; belge PARTIAL veya FULFILLED durumuna geçer.
- Mobil uyumlu sevkiyat/mal kabulü penceresi ve tarih/miktar içeren işlem geçmişi eklendi. Eski tamamlanmış belge kalemleri migration ile geriye uyumlu taşındı.
- Fazla miktar, yabancı şirket veya belge kalemi, aynı kalemin tekrarı, eski sürüm, eşzamanlı tekrar ve stok yetersizliği kontrol edilir. Hizmet kalemleri stok hareketi üretmez.
- İlk doğrulamada 17 işlevsel Playwright testi geçti. Yeni test parçalı satın alma ve satış, kesin kalan stok, eşzamanlı tekrar, rollback ve gerçek tarayıcıda kalan miktarla tamamlama içerir.
- Kapsam sınırı: Sipariş tek depodan işlenir. Belgeye bağlı tahsilat/ödeme mevcut kural gereği yalnızca tamamen işlenmiş belgeler için açılır. Kısmi faturalama, avans, iade ve rezervasyon ayrı ürün işleri olarak açıktır.

## 2026-11-03 sistem denetimi
Kaynak ve izole 3100 sürümünde dokuz düzeltme grubu uygulandı. 25 işlevsel test, 4 unit test ve production build geçti. Eski görsel snapshot testi başarısız; mevcut çalışan UI ile aynı veri altında beş görünüm birebir eşit. Ana 3000 süreci/DB değiştirilmedi; yeni migration ana ortamda henüz uygulanmadı. Ayrıntı: VILA_SYSTEM_AUDIT.md, VILA_INTEGRATION_REPORT.md, VILA_PRODUCTION_READINESS.md.
