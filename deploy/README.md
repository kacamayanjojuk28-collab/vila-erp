# Dağıtım: SaaS ve müşteri sunucusu

İki teslim modeli aynı uygulama ve migration zincirini kullanır. SaaS'ta ortak kurulumda her şirket ayrı organization kimliğine sahiptir. Müşteri sunucusunda her müşteriye ayrı Compose projesi ve PostgreSQL volume ayrılır. Ticari abonelik/faturalama ve kurulum lisansı yönetimi henüz uygulanmadı.

## İlk kurulum

Docker Engine ve Compose v2 gerekir. Proje kökünde:

```sh
node deploy/init-env.mjs https://erp.example.com
# .env.deploy dosyasını güvenli saklayın; kaynak kontrolüne girmemelidir.
docker compose --env-file .env.deploy -f deploy/compose.yml up -d --build
```

Origin sonuna / eklemeyin. Uygulama portu yalnızca sunucunun loopback adresine açılır; TLS sonlandıran reverse proxy aynı sunucuda 127.0.0.1:3000'e yönlendirilmelidir. İlk incelemede `node deploy/init-env.mjs http://localhost:3000` kullanılabilir. Mevcut 3000 portu doluysa dosyada VILA_PORT ve APP_ORIGIN birlikte değişmelidir.

PostgreSQL dışarı port açmaz. Migration servisi şemayı günceller ve kısıtlı uygulama rolünü oluşturur. Audit, Movement ve Payment kayıtları uygulama rolü için yalnızca eklenebilir; migration tablosuna erişemez. Admin bağlantısı uygulama konteynerine verilmez. Migration tamamlanmadan uygulama başlamaz. Uygulama root kullanıcıyla çalışmaz.

## SaaS

Alan adı, TLS, izleme ve yedekleme işletmeciye aittir. Tek kurulum birçok şirketi mevcut tenant kapsamlı servisler üzerinden barındırır. Veritabanı RLS henüz yoktur; üretim öncesi tenant izolasyonu için ek güvenlik incelemesi gerekir. Yatay ölçekleme öncesi yük testi gerekir; oturumlar veritabanında tutulur.

## Müşteri sunucusu

Her müşteri için ayrı sunucu veya Compose proje adı kullanın (`docker compose -p musteri_a ...`). Gizli ortam dosyası ve yedekler müşteriye özgü olmalıdır. İlk hesap normal kayıt ekranında açılır; diğer çalışanlar Ayarlar > Ekip'teki davet bağlantısıyla katılır. Bu sürümde genel şirket kaydı açıktır; kapalı kurumsal erişim gerekiyorsa reverse proxy erişimini kurum ağı/VPN ile sınırlandırın.

## Güncelleme ve geri dönüş

1. Çalışan sürüm kimliğini ve ortam dosyasını güvenli kaydedin. Önce veritabanını yedekleyin ve ayrı veritabanında geri yükleme testi yapın.
2. Yeni kodu ayrı test kurulumunda doğrulayın. `VILA_VERSION` değerini sürüme özgü, değişmez bir etiket olarak ayarlayın.
3. `docker compose --env-file .env.deploy -f deploy/compose.yml build migrate` ile imajı oluşturun.
4. Kısa bakım aralığında `docker compose --env-file .env.deploy -f deploy/compose.yml stop app` çalıştırın.
5. `docker compose --env-file .env.deploy -f deploy/compose.yml run --rm migrate` başarılıysa `docker compose --env-file .env.deploy -f deploy/compose.yml up -d app` ile açın.
6. `/api/health`, giriş ve bir iş akışını doğrulayın. Başarısız migration sonrası uygulamayı eski şemayla uyumunu doğrulamadan başlatmayın.

Geri dönüş yalnızca eski imajı başlatmak değildir: şema uyumsuzsa doğrulanmış yedeği ayrı veritabanına yükleyin, uygun eski imajı bu veritabanıyla test edin ve bağlantıyı bakım aralığında değiştirin. Kaynak veritabanını silmeyin. `down -v` veri volume'unu sildiği için bakım komutu değildir.

## Yedekleme

Mevcut `npm run db:backup` ve `npm run db:restore-check` araçları, PG_BIN ve MIGRATION_DATABASE_URL üzerinden PostgreSQL istemcileriyle çalışır. Container veritabanını yalnızca yedekleme için internete açmayın; aynı özel ağda PostgreSQL istemcisi veya `docker compose exec db pg_dump` kullanın. Yedekleri sunucu dışına şifreli taşıma, retention ve zamanlama operasyon sahibince kurulmalıdır. Restore-check daima ayrı veritabanına uygulanır.

## Bu makinedeki doğrulama

Compose yapılandırması ve JavaScript sözdizimi doğrulandı. Migration betiği boş, ayrı bir PostgreSQL veritabanında çalıştırıldı; dört migration ve kısıtlı runtime rolünün izinleri doğrulandı. Docker Engine çalışmadığı için imaj oluşturma/çalıştırma burada henüz doğrulanmadı. Yerel Node/PostgreSQL üretim build'i ve uygulama testleri ayrıca doğrulandı. Bu paket üretim onayı değildir.
