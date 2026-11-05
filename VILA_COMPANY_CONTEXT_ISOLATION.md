# MULTI-TENANT COMPANY CONTEXT ISOLATION — PASS

5 Kasım 2026 · feature/customizable-dashboard · izole 3500 ortamı

## Kök neden

Şirket değişimi ortak Session.orgId alanını güncelliyordu. Diğer sekmede başlık A olarak kalırken sonraki API sorgusu B adına çalışıyordu.

## Düzeltilen dosyalar ve davranışlar

company-context.ts, ui.tsx, workspace.tsx ve settings.tsx sekmenin şirket/kullanıcı seçimini sessionStorage üzerinden yönetiyor. Seçim değişince sunucudan üyelik onayı alınıyor ve mevcut sayfa yeni bağlamla tekrar yükleniyor. Dashboard veri servisi aynı taşıma katmanını kullanıyor. finance-core.tsx CSV ve PDF indirmelerine açık bağlam ekliyor. İlgili test istemcileri, görsel fixture ve dashboard doğrulama araçları yeni API sözleşmesine uyarlandı.

## Tenant izolasyonu mekanizması

security.ts ve API route.ts her istekte oturumu, istenen şirketteki aktif üyeliği ve ilgili rolü doğruluyor. Sorgular doğrulanan aktör ve mevcut RLS transaction bağlamıyla çalışıyor. İlk /me çağrısı oturumun başlangıç şirketini seçebiliyor. İş verisi isteklerinde açık şirket zorunlu. Yanıtlarda X-Vila-Company ve X-Vila-User taşınıyor ve veri istemcisi bunları görüntüleme öncesinde karşılaştırıyor. İstek sürerken sekme bağlamı değişmişse yanıt reddediliyor. Widget önbelleği şirket, kullanıcı, rol ve veri revizyonunu içeriyor.

## Test sonuçları

Mevcut 67 tarayıcı/API regresyonu tek tam koşuda geçti. Yeni iki sekmeli senaryo ayrıca geçti. Eşzamanlı yükleme, ayrı yenileme, widget ekleme ve saklama, yetkisiz okuma/yazma, eksik bağlam, yanlış şirket başlıklı yanıt ve A sekmesindeki gerçek görev formuyla yazma doğrulandı. Tam koşu önceki layout persistence, drag/resize, Finance ve görsel karşılaştırmaları içeriyor. Birim testleri 17/17 geçti; bunlara geç gelen eski şirket yanıtının reddi dahil. TypeScript ve production build başarılı.

## Kalan somut riskler

Eski özel API istemcilerinin şirket kapsamlı çağrılara X-Vila-Company eklemesi gerekiyor. Eksik bağlam HTTP 400 döndürüyor. Şirket değişiminde sayfa yeniden yüklendiğinden seçim sekmeye özgü olarak yenilemeden sonra da korunuyor. Pilot için dış istemciler bu sözleşmeyle çalıştırılmalı.
