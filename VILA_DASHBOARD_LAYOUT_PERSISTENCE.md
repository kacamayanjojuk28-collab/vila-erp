# Dashboard Layout Persistence — PASS

5 Kasım 2026 · feature/customizable-dashboard · İzole uygulama 3500

Göster işlemi her ekran düzenini baştan paketliyordu. Artık her ekran için yalnız geri getirilen kartın kayıtlı dikdörtgeni kontrol ediliyor. Konum doluysa aynı boyutlarla ilk boş yere yerleşiyor. Grid geçerli yerleşimlerde kullanıcının bıraktığı boşlukları koruyor ve sürükleme veya boyutlandırma sırasında çakışma olduğunda mevcut çözümleyiciyi kullanıyor.

İki yeni tarayıcı testi ters sıralanmış, yeniden boyutlandırılmış ve ekran boyutuna göre farklı kaydedilmiş düzenleri kapsıyor. Gizleme sonrasında ve yeniden gösterip kaydetme, ardından sayfayı yenileme sonrasında API üzerinden koordinatlar ve boyutlar karşılaştırıldı. Eski konumu başka kartın kapladığı senaryoda bu kart yerinde kaldı, geri dönen kart çakışmasız yerleşti.

Son tam koşu 67/67, birim testleri 16/16 geçti. TypeScript ve production build başarılı. Mevcut sürükleme, boyutlandırma, katalog, kullanıcı izolasyonu, finans ve mobil/masaüstü görsel kontrolleri geçti.

Önceki tam koşuda 66/67 sonuçlandı. Nakit akışı testi açılış animasyonu bitmeden kartı büyütebiliyordu. Test başlangıçtaki kartın yerleşmesini bekliyor ve mevcut büyütme kontrollerini aynen uyguluyor. Son koşuda görsel karşılaştırmalar mevcut referanslarla yapıldı. Eski test parolası geçersiz olduğu için görsel girişler ayrı bir sentetik demo şirketiyle doğrulandı. Yük testi şirketlerine verilen geçici test üyelikleri koşu sonunda kaldırıldı.
