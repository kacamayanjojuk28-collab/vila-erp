# VILA Intelligence ön koşul raporu

5 Kasım 2026 · İncelenen sürüm `feature/customizable-dashboard`, `d2c36a4`.

**Karar:** Phase 0 aşamasında duruldu. Gizli bir widget tekrar gösterildiğinde diğer widget’ların kayıtlı konumları değişiyor. Bu durum AI Overview için gerekli kişisel düzenin korunması kriterini engelliyor.

**Tekrar üretim:** İzole 3500 ortamında yeni bir test kullanıcısının geniş ve orta ekran düzenlerine ilk iki kart ters sırada kaydedildi. Masaüstünde Kritik stok takibi gizlenip kaydedildi. Widget katalogdan tekrar gösterildi ve Kaydet seçildi. Sayfa yenilendikten sonra tercihler API üzerinden okundu.

| Kayıt aşaması | Tahsil edilen tutar (x) | Açık alacak (x) |
|---|---:|---:|
| Kişisel düzen | 4 | 0 |
| Kritik stok gizlendikten sonra | 4 | 0 |
| Kritik stok tekrar gösterildikten sonra | 0 | 4 |

Sonuç geniş ve orta ekran düzenlerinde aynıydı. İşlem sırasında yalnız masaüstü görünümü açıktı. Göster işlemi dashboard-engine/index.tsx içinde her ekran genişliği için pack çağırıyor. dashboard-registry.ts içindeki pack önceki boyutları kullanıyor ancak konumları baştan hesaplıyor.

**Kapının açılma koşulu:** Gizlenen widget geri getirildiğinde diğer kartların kaydedilmiş konumları, özellikle kullanıcının düzenlemediği ekran genişliklerinde, korunmalı. Yukarıdaki senaryo kayıt ve yenileme sonrası geçmeli. Talimat gereği AI uygulaması bu noktada durduruldu.
