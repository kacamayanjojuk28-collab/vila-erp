# VILA modüller arası entegrasyon raporu

Tarih: 2026-11-03. Durumlar izole PostgreSQL + 3100 audit sürümü içindir; ana DB/3000 sürümü değiştirilmedi.

## A — Satıştan tahsilata

| Adım | Durum | Gerçek davranış |
|---|---|---|
| Müşteri ve fırsat oluşturma | VERIFIED | İki modül gerçek CRUD ve customerId ilişkisi kullanır |
| Fırsattan teklif | NOT IMPLEMENTED | Fırsat kaydı teklif kaynağı olarak tutulmuyor; otomatik dönüşüm yok |
| Teklif onayı | NOT IMPLEMENTED | Ayrı teklif onay durumu/iş akışı yok |
| Teklif → satış | VERIFIED | Kalem snapshot'ı, Decimal total, sourceId; tekrar dönüşüm reddediliyor |
| Sipariş kalemleri | VERIFIED | Ürün/depoya bağlı taslak; onay sonrası düzenleme kilitli |
| Rezervasyon | NOT IMPLEMENTED | Stok yalnızca sevkiyatta düşer, diğer açık siparişlere ayrılmaz |
| Sevkiyat | VERIFIED | Tam/kısmi; satır fulfilledQuantity ve stok aynı transaction içinde; eski version/fazla miktar reddi |
| Fatura | NOT IMPLEMENTED | Document bir sipariştir; fatura veya resmî muhasebe kaydı değildir |
| Müşteri alacağı | PARTIAL | sales.total-paid üzerinden hesaplanır. CONFIRMED/PARTIAL de tam sipariş tutarıyla açık bakiye sayılır; kısmi faturalandırma/tahakkuk yok |
| Tahsilat | VERIFIED | Tamamlanmış belgeye kısmi veya tam ödeme bağlanır; fazla ödeme reddedilir; paid ve Payment aynı transaction içinde |
| Dashboard ve audit | VERIFIED / PARTIAL | Gerçek DB net nakit/bakiye ve işlem kayıtları; dönem politikası aşağıda belirtilir |

Mevcut testte 10 adet alım 121,20; yüzde 10 indirimli 3 adet satış yüzde 20 vergiyle 32,72 oluşturur. Sipariş/tahsilat sonucu ve fazla ödeme reddi kontrol edilir. Ters kayıt, orijinal ödemeyi silmeden zıt nakit hareketi ve belge paid azaltımı üretir; ikinci ters kayıt reddedilir.

## B — Satın almadan stoka/ödemeye

VERIFIED: supplier → request → purchase → confirm → receipt aynı kaynak ve tenant ilişkilerini kullanır. Talep dönüşümü ikinci kez yapılamaz. Satın alma mal kabulü stoğu artırır; hizmet/SAAT kalemi yapay stok üretmez. OUT ödeme yalnızca uygun tamamlanmış purchases belgesine bağlanabilir; mali kaydın açık bakiyesi azalır.

PARTIAL: Ayrı talep onaycı matrisi ve talep APPROVED aşaması yok. Onay satın alma siparişinde uygulanır. Tedarikçi borcu bağımsız çift taraflı muhasebe defterinde tutulmaz; belge total-paid özetidir. Ayrı tedarikçi hesap ekranı yerine rapor/finans bağlantısı vardır. VERIFIED: Talep → satın alma → mal kabul → 10 birim kısmi ödeme testi 36 toplam borcun 26 bakiyeye, expense değerinin 10’a ve net nakdin 2,34’e geldiğini doğruladı. CONVERT REQUEST audit etiketi ve ürün FK ihlali reddi de test edildi.

## Kısmi teslimat ve atomiklik

VERIFIED: 10,5 birim alım 4,25 + 6,25 olarak kabul edildi. 8 birim satış 2,25 + 5,75 olarak tamamlandı; son stok 2,5. Eski sürümle paralel tekrarın biri 200 diğeri 409. Yetersiz stok, yabancı şirket, yabancı kalem, aynı kalemin tekrarı, fazla miktar kontrolleri başarılı. İşlem geçmişi iki parçanın miktarını taşır. Transferin ikinci deposu geçersizse ilk stok çıkışı da rollback olur.

FIXED: Manuel stok ve finans POST işlemleri Idempotency-Key ile tekrar edildiğinde tek business kayıt oluşur. Aynı anahtar farklı payload ile 409. Receipt ve business kayıt aynı transaction içindedir. Anahtarsız eski istemcilerde genel replay koruması yok; tüm oluşturma CRUD işlemleri idempotent değildir. Tarayıcıdaki stok/finans formu aynı payload retry anahtarını korur; form kapatılıp yeni form açılırsa yeni işlem kabul edilir.

## C — Proje/görev

VERIFIED: Proje/görev CRUD, görev assigneeId için aktif üyelik doğrulaması; görev tamamlanınca proje progress aynı transaction içinde değişir. Görev başka projeye taşınırsa önceki ve yeni proje yeniden hesaplanır. Görev arşivlenince ilerleme yeniden hesaplanır. Bağlı aktif görev varken proje arşivlenemez.

PARTIAL: Projeye ayrı ekip atama tablosu yok; kişi görev üzerinden atanır. Görevsiz projede manuel ilerleme kullanılabilir, görev bulunan projede görevlerden türetilir. CANCELLED görevlerin paydadan çıkarılması gibi işletme politikaları kesinleştirilmelidir. Widget toplam görevlerden hesaplanır; ayrı ekip hedef/kapasite modeli yok.

## D — CRM bütünlüğü

VERIFIED: customerId/contactId üzerinden fırsat, aktivite ve belge bağları; müşteri geçmişi gerçek sorgular. Foreign tenant referansları reddedilir. Bağlı kayıtları olan müşteri arşivlenemez. Kalem adı/fiyatı belge snapshot'ıdır; katalog değişince geçmiş belgeyi değiştirmemesi bilinçlidir. İşlem görmüş ürünün birimi değiştirilemez.

PARTIAL: Müşteri geçmişi ayrı payment listesi döndürmez; finans bağlantısı documentId üzerinden izlenir. Ayrı iletişim kişisi ve doğrudan müşteri hesap defteri yok.

## Dashboard ve rapor anlamları

VERIFIED: Veri kaynağı PostgreSQL; orgId ile filtrelenir. income=IN toplamı, expense=OUT toplamı, net=income-expense; exact Decimal kullanılır. Test edilen 12,34 tek ödeme replay sonrası hâlâ 12,34 income/net, diğer şirket 0 gösterir. Ters kayıt nakit toplamını zıt hareketle düzeltir.

PARTIAL: Açık alacak/borç henüz teslim edilmemiş onaylı siparişleri de içerir; ödeme endpoint'i yalnızca FULFILLED kabul eder. Dolayısıyla bunlar resmî muhasebe tahakkuku değil sipariş bakiyeleridir. Rapor grupları taslak siparişleri de sayar. Tarih filtresi belge createdAt ve ödeme createdAt'a ayrı uygulanır; tarihsel kapanış bakiyesi hesaplanmaz. Yaşlandırma belge oluşturulma tarihine göre; overdue dueDate kullanır. UTC filtre sınırlarıyla yerel gösterim farkı ve aylık grafik timezone kenarları tam test edilmedi. Client grafiklerinde Number kullanımı görsel çizim içindir; muhasebe kaynağı Decimal backend'dir.

## Sonraki ürün işleri

1. PARTIAL — Sipariş bakiyesi, tahakkuk, avans ve kısmi faturalama politikasını belirleyip ortak finans modeli kurmak.
2. NOT IMPLEMENTED — Rezervasyon, iade/iptal ve bunların stok/ödeme ters hareketleri.
3. NOT IMPLEMENTED — Fırsat → teklif ilişkisi ve teklif/talep onay aşamaları.
4. PARTIAL — Tenant kapsamlı DB ilişkileri ve özel okuma/yazma izinleri; tüm kritik API istemcilerinde zorunlu işlem anahtarı.
5. NOT IMPLEMENTED — Fatura, ayrı muhasebe defteri, lot/seri, lisans/abonelik.

Bu eksiklerin hiçbiri varmış veya test edilmiş gibi kabul edilmemiştir.
