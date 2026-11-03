# Modüller ve iş akışları
| Modül | Çalışan davranış | Doğrulama / sınır |
|---|---|---|
| Kimlik | Kayıt, giriş, çıkış, parola değiştirme, oturum sonlandırma | API+tarayıcı; MFA/e-posta reset yok |
| Şirket/ekip | Şirket profili, döviz/yerelleştirme, davet, rol değiştirme, üyelikler arasında geçiş | Tenant/RBAC/CSRF testleri; şirket oluşturma ilk kayıt sırasında |
| CRM | Müşteri/potansiyel müşteri, segment, firma/iletişim/not, geçmiş | CRUD, arama, güvenli arşiv, sürüm çatışması; lead conversion testli |
| Fırsatlar | Müşteriye bağlı tutar/tarih/aşama, Kanban sürükleme, düzenleme | Sunucu yetki/validasyon; pipeline istatistikleri sayfadaki kayıtları kapsar |
| Satış | Teklif, satırlar, indirim/vergi, siparişe dönüşüm, onay/sevkiyat | Tam iş akışı + tekrar işlem/negatif stok testli |
| Ürün/stok | SKU, kategori metni, depo, giriş/çıkış/transfer, kritik stok, hareket geçmişi | Eşzamanlı çıkış ve transfer rollback testli; kategori sözlüğü ayrı tablo değil |
| Satın alma | Tedarikçi, talep→sipariş, onay, mal kabul | Gerçek stok bağlantısı; kısmi kabul yok |
| Finans | Gelir/gider, belgeye tahsilat/ödeme, ters kayıt, borç/alacak, yaşlandırma, nakit grafiği | Decimal, fazla ödeme/çift reversal/DB izin testleri; resmî muhasebe/e-fatura değil |
| Proje/görev | Proje, görev, sorumlu, öncelik, durum, Kanban, kart ilerlemesi | Görevli projede kart ilerlemesi gerçek görev oranından türetilir; görev yoksa manuel yüzde |
| Takvim | Ay/hafta, gün seçimi, kişi/tür filtresi, gecikmiş görev, tamamla | PostgreSQL görev/aktivite tarihleri; sürükleyerek tarih taşıma yok |
| Rapor | Dönem filtresi, müşteri satış ve tedarikçi performansı | Decimal toplamlar sunucuda; pivot/özel rapor tasarımcısı yok |
| Ayarlar | Profil, şirket, ekip/rol matrisi, güvenlik, tema, bildirim tercihi, veri bilgisi | Bildirim tercihi saklanır; SMTP ve bildirim teslim sistemi yok |
| Audit | Arama, sıralı sayfalar, mutation kayıtları | API yönetici erişimi; DB UPDATE/DELETE reddediliyor |

Normal kayıt modülleri liste/oluştur/düzenle/arşiv/arama/filtre/sıralama/sayfalama, loading/empty/error/success durumlarını ortak bileşenlerde kullanır. Stok hareketi, finans ve audit tarihçesi bilinçli olarak değiştirilemez; finans düzeltmesi ters kayıtla yapılır. CSV düğmesi açıkça **sayfayı** dışa aktarır. Her modülün her sınır durumu için otomasyon tamamlanmış değildir; ayrıntı IMPLEMENTATION_STATUS.md.

### Kısmi teslimat
Satış ve satın alma ekranlarında onaylanmış siparişler satır bazında kısmen işlenebilir. Teslimat penceresinde sipariş, işlenen ve kalan miktarlar ile işlem geçmişi gösterilir. Son parça tamamlanınca belge otomatik tamamlanır; stok ve miktarlar birlikte kaydedilir.
