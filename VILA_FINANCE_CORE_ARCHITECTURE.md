# Finance Core v1 — mimari ve olay sözleşmeleri

Başlangıç: değiştirilmeyen v0.9.0-pilot / eafdd3305dde03d23ff927ac1126b501a493e89b. Ayrı feature/finance-core-v1.0 dalı, 3400 uygulaması ve yalnız 9543/vila_finance_v1 veritabanı. Tarihsel raporların RLS/görsel/rate-limit açıkları pilot raporundaki doğrulanmış sonuçlarla ayrıştırılmıştır; sekiz istenen rapor repository'de bulundu.

## Finansal gerçek

Sipariş ve sevkiyat operasyoneldir; fatura kesinleşmesi muhasebe olayıdır. Legacy Payment/Document.paid anlamı değişmez. Eski ödemeler muhasebe defterine kendiliğinden aktarılmaz. Yeni FinancePayment, mevcut immutable Payment kaydını ve tek JournalEntry'yi ilişkisel olarak bağlar. Yeni kaynakların eski ters-kayıt endpoint'inden değiştirilmesi reddedilir; eski kayıtların API davranışı korunur.

INVOICE, PAYMENT, ALLOCATION, OPENING/MANUAL ve bağlantılı REVERSAL ayrı kaynak olaylarıdır. orgId/sourceType/sourceId benzersizdir. MutationReceipt, kaynak kayıt, audit ve JournalEntry/JournalLine aynı serializable transaction'dadır. Finans yazmaları tenant'ın Organization satırını kilitleyerek numaralandırma, tahsis ve dönem kapanışı yarışlarını sıralar. Veritabanı ayrıca fiş dengesi ve kesinleşmiş kayıt değişmezliğini denetler.

## İlişkisel model

LedgerAccount: şirket hesabı, hiyerarşi, rol eşlemesi. AccountingPeriod: açık/kapalı tarih aralığı. TaxRule: tarihli oran/sınıflandırma. FinancialInvoice/InvoiceLine: cari ve tutar snapshot'ları, sipariş/satır/hareket ve düzeltme bağlantıları. FinancePayment: Payment ile birebir; PaymentAllocation: çoktan çoğa dağıtım ve negatif bağlantılı ters kayıt. ReconciliationRecord: tarih ve bilgi kesim anıyla kontrol sonuçları. Finansal tutarlar JSONB'ye gömülmez; JSON yalnız mevcut audit/idempotency kanıtı içindir.

Tüm yeni tablolarda orgId, FORCE/ENABLE RLS ve uygun composite foreign key vardır. JournalLine cari bağlantısı 120/320/340/159 kontrol hesapları ile alt defteri uzlaştırır. İsteğe bağlı cari alt hesaplar aynı kontrol rolünü üst hesaplarından devralır; cari satıra otomatik bağlanır, uyumsuz cari reddedilir. Hesap hiyerarşisi/rolü geçmiş sınıflandırmayı değiştirecek biçimde düzenlenemez. Alt hesaplar mizan ve cari mutabakatına dahildir. Finans rolü kayıt/post/mahsup/rapor yapabilir; OWNER/ADMIN hesap ve vergi yapılandırır ve dönem kapatır. SALES/WAREHOUSE mevcut operasyonlarını sürdürür, yeni defter verisini okuyamaz.

## Kayıt politikası

Satış: 120 borç; gelir ve hesaplanan vergi alacak. Alış: doğrulanan satır sınıfına göre stok/gider ve indirilecek vergi borç; 320 alacak. Müşteri tahsilatı önce banka/kasa borç, 340 alacak; faturaya tahsis 340 borç, 120 alacak. Tedarikçi ödemesi 159 borç, banka/kasa alacak; tahsis 320 borç, 159 alacak. Böylece dağıtılmamış/fazla ödeme gelir olmaz. Ters kayıtlar orijinali korur. Alacaklandırma yalnız açık kalan tutara ve orijinal kalemlere bağlıdır.

Mal kabulü mevcut sürümde muhasebe üretmez; bu çekirdekte mal alışı yalnız faturada muhasebeleşir. Çift stok maliyeti kaydı üretilmez. FIFO/ağırlıklı ortalama ve güvenilir maliyet altyapısı yoktur; COGS, stok değerleme ve eksiksiz bilanço iddiası yapılmaz. Alınmamış/faturalanmamış mal için muhasebe tahakkuku bu kapsamda etkin değildir.

## Hesaplama ve zaman

TRY tek para birimidir. Miktar 3, para 2 ondalıktır; Decimal ROUND_HALF_UP. Satır brütü 2 haneye, iskonto 2 haneye, iskonto sonrası matrah üzerinden vergi 2 haneye yuvarlanır; belge satır toplamlarından oluşur. Vergi oranı sabit varsayılmaz; tarihli TaxRule açıkça yapılandırılır. ÖTV/tevkifat/döviz ve doğrulanmamış istisnalar etkin değildir.

Ekstre, açık bakiye, yaşlandırma, mizan ve mutabakat sunucuda hesaplanır. effectiveOn/issuedOn finansal tarih; JournalEntry.createdAt ve knownAt bilgi kesim anıdır. Tarihsel tahsis ve ters kayıtlar yalnız kesim tarihine kadar uygulanır. Açık dönemde geri tarihli kayda gerekçe gerekir; kapalı döneme kayıt ve ileri tarihli kesinleştirme reddedilir.

## E-belge sınırı

PDF yalnız iç kayıt/taslaktır ve resmî e-belge değildir. Provider hesabı, UBL-TR paket/schema/şematron doğrulaması, imza/mühür, credential kasası, dış idempotency, webhook doğrulama ve sandbox kanıtı olmadan gönderme adaptörü etkinleştirilmez. Ayrıntılar VILA_E_INVOICE_READINESS.md içindedir.

Finans transaction saat dilimi UTC; iş günü açıkça Europe/Istanbul kullanır. SET LOCAL commit/rollback sonrası temizlenir. knownAt, kaydedilmiş olay zamanını filtreler; PostgreSQL commit sırasının değişmez denetim kaydı veya yasal zaman damgası değildir. Aynı raporu tekrar üretmek için from/asOf/knownAt birlikte saklanmalıdır.

Serializable çakışma/deadlock durumunda aynı idempotency anahtarıyla sınırlı, gecikmeli yeniden deneme uygulanır; iş kuralı hatası yeniden denenmez. Limit aşımında 503 görünür; istemci aynı anahtarla güvenle tekrar deneyebilir.

Mutabakat bağımsız kaynak olaylarından beklenen cari bakiye, kontrol hesapları, fatura/fiş eşitliği ve her fişin dengesini sorgular. Farklar entityId, beklenen/gerçek/fark ve neden ile sayfalanır. Eski muhasebeleştirilmemiş ödemeler ayrı inceleme listesidir; MATCH yalnız POSTED_FINANCE_CORE_ONLY kapsamını belirtir. Eski ödemeleri içeren şirketin bütün tarihinin uzlaştığı anlamına gelmez.
