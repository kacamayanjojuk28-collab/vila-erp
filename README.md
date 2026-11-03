# VILA ERP
Yerel, PostgreSQL üzerinde kalıcı çalışan Next.js ERP geliştirme sürümü. Solvik referansına göre bağımsız React/CSS/GSAP kaynak kodu. **Üretim onayı verilmiş değildir.** Eksikler ve doğrulanan kapsam IMPLEMENTATION_STATUS.md içinde.

## Açılış
Adres: http://localhost:3000
Proje: C:\Users\enesc\Projects\VILA

İlk ekranda **Şirketinizi oluşturun** ile kendi boş şirketinizi ve yönetici hesabınızı oluşturun. Parola en az 12 karakter. Normal kayıtlar demo verisi içermez. Önceden oluşturulmuş ayrı demo şirketinin rastgele üretilmiş giriş bilgileri yalnızca `.local/demo-credentials.json` içindedir. Bu dosyayı paylaşmayın veya Git'e eklemeyin. Uygulamada demo şirketi DEMO etiketi taşır.

```powershell
Set-Location C:\Users\enesc\Projects\VILA
.\scripts\start.ps1
```
Başlatıcı PostgreSQL kümesini kontrol eder; var olan uygulamayı çoğaltmaz. Gerekirse Next.js sunucusunu mevcut terminalde çalıştırır; Ctrl+C ile durdurabilirsiniz. PostgreSQL günlüğü `.local/postgres.log` içindedir.

## Geliştirme ve kontrol
Node 26.13.0 / npm 11.20.0, PostgreSQL 18. Next 16.4.3, React 19, Prisma 7.10.1. Tam sürümler package-lock.json içinde. Kurulumda iki eşzamanlı npm işleminin oluşturduğu eksik paketler temiz `npm ci` ile giderildi; son npm audit sıfır açık raporladı.

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run dev
npm run typecheck
npm test
npm run build
npm start
```
Üretim sunucusu çalışırken aynı `.next` klasöründe build yapmayın: önce sunucuyu durdurun, build alın, yeniden başlatın. Dev sunucusu Next geliştirme betikleri nedeniyle CSP'nin geliştirme ortamına uygun ayarını kullanır.

```powershell
npm run test:e2e
```
E2E, **çalışan yerel üretim sunucusuna** bağlanır ve Microsoft Edge kullanır. Testler kendi şirketlerini oluşturur, DEMO olarak işaretler, mevcut şirket verilerini değiştirmez. Test şirketleri denetim izi ve inceleme için korunur. Test kullanıcı parolaları süreç içinde rastgele üretilir. Sonuç: docs/verification/e2e-results.json. İzler hata halinde test-results içine yazılır. Unit testleri para hesabı, doğrulama, parola ve RBAC denetler.

## Temel iş akışları
1. Modüller menüsünden depo, ürün, müşteri ve tedarikçi oluşturun. Ctrl+K modül aramasını açar.
2. Satın alma talebini siparişe dönüştürün veya doğrudan satın alma siparişi oluşturun.
3. Siparişi onaylayın; mal kabulü stok girişini tek transaction içinde yapar.
4. Teklifi satış siparişine dönüştürün. Onay ve sevkiyat stok çıkışını işler; yetersiz stok işlemin tamamını geri alır. Hizmet/saat kalemleri stok oluşturmaz.
5. Finans ekranında işlenmiş belgeye tahsilat/ödeme bağlayın. Fazla ödeme reddedilir. Yanlış finans kaydı silinmez: **Ters kayıt** ile bakiye düzeltilir.
6. Müşteri kartındaki geçmiş düğmesi bağlı aktiviteleri, fırsatları ve belgeleri gösterir. Potansiyel müşteriyi müşteriye dönüştürmek kaynak kaydı arşivler ve audit bağlantısı oluşturur.
7. Görevleri kullanıcı/projeye bağlayın, Kanban'da sürükleyin veya düzenleyin. Tarihli görev ve aktiviteler takvimde görünür.
8. Ayarlar → Ekip üzerinden davet bağlantısı oluşturun. E-posta otomatik gönderilmez. Yeni kullanıcı kayıt sırasında, mevcut kullanıcı davet URL'sinden giriş yaparken daveti kabul eder.

## Veritabanı
Yerel küme `.local/postgres`, port **55432**, yalnızca 127.0.0.1. Mevcut 5432 kurulumuna dokunulmadı. `.env` içindeki DATABASE_URL sınırlı `vila_app` rolünü, MIGRATION_DATABASE_URL yalnızca bakım hesabını kullanır. Audit, Movement, Payment tablolarında uygulama rolüne UPDATE/DELETE verilmez. Uygulamanın PostgreSQL süper kullanıcı bağlantısı yoktur. Migration dosyaları kaynak kontrolüne uygundur; `.env`, küme, dökümler ve kimlik bilgileri hariç tutulur.

```powershell
node scripts/database.mjs backup
node scripts/database.mjs restore-check .local/backups/<dosya>.dump
```
Geri yükleme komutu **yeni** `vila_restore_<timestamp>` veritabanı oluşturur; çalışan VILA veritabanını değiştirmez. Bir geri yükleme başarıyla denendi. Retention ve işletme dışı şifreli kopya politikası dağıtım ortamında kurulmalıdır. `PG_BIN` ile farklı PostgreSQL kurulum yolu seçilebilir.

## Dağıtım öncesi
HTTPS reverse proxy, gerçek alan adına APP_ORIGIN, PostgreSQL TLS (`sslmode=require`), yedekleme zamanlaması/retention, log izleme, SMTP/kimlik doğrulama e-postası, yük testi ve bağımsız güvenlik incelemesi gerekir. HTTP yalnızca loopback geliştirme içindir. Her tenant sorgusu sunucu oturumundan şirket kapsamı alır; PostgreSQL RLS politikaları henüz kurulmadı. Açık internet ortamına bu haliyle dağıtılmış değildir.

## Tasarım kanıtı
DESIGN_SYSTEM.md tasarım sözleşmesidir. Referans dosyaları Downloads/VILA altında değiştirilmeden bırakılmıştır. docs/reference içinde SHA-256 envanteri, CSS analizi ve canlı referans ekran görüntüleri; docs/verification içinde VILA karşılıkları ve test çıktıları bulunur. Özel Solvik logosu, fotoğrafı ve derlenmiş uygulama JS/CSS'i ürüne kopyalanmadı. Urbanist OFL paketinden, ikonlar Lucide ISC lisansıyla kullanılır; GSAP lisansı node_modules/gsap/LICENSE içinde.

## SaaS ve müşteri sunucusu

Ortak Docker/Compose paketi ve kurulum, güncelleme, yedekleme prosedürleri: [deploy/README.md](deploy/README.md). Container motoru bu makinede kapalı; container build/start doğrulaması henüz yapılmadı.

## Görsel test verisi

Görsel testler kullanıcı demo hesabından ayrıdır. İlk kez PowerShell üzerinde `$env:VILA_VISUAL_SEED="1"; npm run db:seed; Remove-Item Env:VILA_VISUAL_SEED` çalıştırın. Bu işlem `.local/visual-credentials.json` üretir; mevcut demo girişini değiştirmez. `npm run test:e2e` normal görüntü regresyonunu çalıştırır. Golden dosyalar yalnızca incelenmiş, bilinçli tasarım değişikliklerinde güncellenmelidir.
