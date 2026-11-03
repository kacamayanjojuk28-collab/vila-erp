# Veritabanı şeması
Asıl kaynak: prisma/schema.prisma ve prisma/migrations. Üç migration: başlangıç, finans ters kaydı + bütünlük kontrolleri, belge vade tarihi.

| Tablo | Amaç / önemli kısıt |
|---|---|
| User | Tekil e-posta, scrypt parola; açık parola yok |
| Organization | Şirket, currency, locale, demo etiketi, JSON tercihler |
| Membership | orgId+userId unique, sabit rol |
| Session | Tokenin SHA-256 özeti, userId/orgId/expiry |
| Invite | Token özeti unique, hedef e-posta/rol, expiry/acceptedAt |
| Record | orgId/kind/name/status/code/data/amount/version/archive; tenant+kind+SKU unique |
| Document | quote/sale/purchase/request, contact/warehouse, total/paid/dueDate; sourceId unique |
| DocumentLine | Ürün snapshot adı, qty/price/discount/tax/total; belge FK |
| Stock | tenant+ürün+depo birleşik PK; quantity>=0 |
| Movement | İmzalı miktar, sebep, belge referansı ve aktör; append-only |
| Payment | IN/OUT, pozitif Decimal, belge bağlantısı, reversalOf unique; append-only |
| Audit | Aktör, işlem, entity, detail, zaman; append-only |
| RateLimit | Hashlenmiş kullanıcı/e-posta anahtarı, sayaç ve son tarih |

Document/Stock/Movement bağlantıları tenant+record birleşik FK kullanır. Payment belge FK'sı tenant+document şeklindedir. Total>=0, paid>=0, paid<=total; satır quantity>0, fiyat>=0, tax/discount 0..100; ödeme amount>0 kontrolleri DB'dedir. Prisma'nın desteklemediği CHECK ifadeleri SQL migration içinde korunur. Şema introspection ile FK ilişkileri Prisma'ya alınmıştır; yeni migration hazırlarken SQL CHECK'leri silmeyin.

JSONB içindeki müşteri/proje/kullanıcı bağlantıları servis katmanında doğrulanır; bunların tümüne DB FK uygulanmış değildir. Veri erişiminde tenantId istemciden alınmaz: oturumun doğrulanmış üyeliği kullanılır. RLS henüz yoktur. Bakım hesabı tüm şemaya, uygulama hesabı iş tablolarına sınırlı izinle erişir.

Yedek: custom-format pg_dump. Restore kontrolü yeni ayrı veritabanına pg_restore ile yapıldı; orijinal veritabanı değiştirilmedi.
