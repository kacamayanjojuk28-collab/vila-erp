export type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  ref?: string;
  required?: boolean;
};
export type Module = { title: string; subtitle: string; fields: Field[] };
const email = { key: "email", label: "E-posta", type: "email" },
  phone = { key: "phone", label: "Telefon" },
  company = { key: "company", label: "Firma" },
  notes = { key: "notes", label: "Notlar", type: "textarea" },
  due = { key: "dueDate", label: "Hedef tarih", type: "date" },
  customer = {
    key: "customerId",
    label: "Müşteri",
    ref: "customers",
    required: true,
  };
export const modules: Record<string, Module> = {
  calendar: {
    title: "Ekip takvimi",
    subtitle: "Görev ve görüşme takvimi.",
    fields: [],
  },
  reports: {
    title: "Raporlar",
    subtitle: "Satış ve tedarikçi performansı.",
    fields: [],
  },
  requests: {
    title: "Satın alma talepleri",
    subtitle: "Talepten satın alma siparişine.",
    fields: [],
  },
  customers: {
    title: "Müşteri rehberi",
    subtitle: "İlişkilerinizin tamamı, tek bir yerde.",
    fields: [
      company,
      email,
      phone,
      {
        key: "segment",
        label: "Segment",
        options: ["SMB", "MID", "ENTERPRISE"],
      },
      notes,
    ],
  },
  leads: {
    title: "Potansiyel müşteriler",
    subtitle: "İlk temastan yeni bir ilişkiye.",
    fields: [company, email, phone, { key: "source", label: "Kaynak" }, notes],
  },
  deals: {
    title: "Satış fırsatları",
    subtitle: "Fırsatlarınızı bir sonraki aşamaya taşıyın.",
    fields: [
      customer,
      {
        key: "stage",
        label: "Aşama",
        options: ["QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"],
      },
      { key: "value", label: "Fırsat tutarı", type: "number" },
      due,
      notes,
    ],
  },
  products: {
    title: "Ürün kataloğu",
    subtitle: "Ürünler, hizmetler ve stok politikaları.",
    fields: [
      { key: "sku", label: "SKU", required: true },
      { key: "category", label: "Kategori" },
      {
        key: "unit",
        label: "Birim",
        options: ["ADET", "KG", "SAAT", "HIZMET"],
      },
      { key: "price", label: "Birim fiyat", type: "number" },
      { key: "minStock", label: "Kritik stok", type: "number" },
    ],
  },
  warehouses: {
    title: "Depolar",
    subtitle: "Envanterinizin bulunduğu yerler.",
    fields: [{ key: "address", label: "Adres", type: "textarea" }],
  },
  suppliers: {
    title: "Tedarikçiler",
    subtitle: "Tedarik ağınızı yönetin.",
    fields: [company, email, phone, notes],
  },
  projects: {
    title: "Projeler",
    subtitle: "Planlarınızı birlikte hayata geçirin.",
    fields: [
      { ...customer, required: false },
      due,
      { key: "progress", label: "İlerleme (%)", type: "number" },
      notes,
    ],
  },
  tasks: {
    title: "Görevler",
    subtitle: "Öncelikler, sorumluluklar ve teslim tarihleri.",
    fields: [
      { key: "projectId", label: "Proje", ref: "projects" },
      { key: "assigneeId", label: "Sorumlu", ref: "members" },
      { key: "priority", label: "Öncelik", options: ["LOW", "MEDIUM", "HIGH"] },
      due,
      notes,
    ],
  },
  activities: {
    title: "Müşteri aktiviteleri",
    subtitle: "Görüşmeler ve müşteri geçmişi.",
    fields: [
      customer,
      {
        key: "type",
        label: "Tür",
        options: ["NOTE", "CALL", "MEETING", "EMAIL"],
      },
      due,
      notes,
    ],
  },
  quotes: {
    title: "Teklifler",
    subtitle: "Doğru fiyat, açık koşullar, hızlı dönüşüm.",
    fields: [],
  },
  sales: {
    title: "Satış siparişleri",
    subtitle: "Tekliften sevkiyata tüm süreç.",
    fields: [],
  },
  purchases: {
    title: "Satın alma",
    subtitle: "Sipariş, mal kabulü ve tedarikçi takibi.",
    fields: [],
  },
  stock: {
    title: "Stok durumu",
    subtitle: "Depo bazında gerçek zamanlı envanter.",
    fields: [],
  },
  movements: {
    title: "Stok hareketleri",
    subtitle: "Her giriş ve çıkışın izlenebilir geçmişi.",
    fields: [],
  },
  finance: {
    title: "Finans",
    subtitle: "Tahsilatlar, ödemeler ve nakit akışı.",
    fields: [],
  },
  audit: {
    title: "İşlem geçmişi",
    subtitle: "Şirketinizin değiştirilemeyen işlem kaydı.",
    fields: [],
  },
};
export const labels: Record<string, string> = {
  ACTIVE: "Aktif",
  OPEN: "Açık",
  IN_PROGRESS: "Devam ediyor",
  DONE: "Tamamlandı",
  CANCELLED: "İptal",
  DRAFT: "Taslak",
  CONFIRMED: "Onaylandı",
  PARTIAL: "Kısmen işlendi",
  FULFILLED: "İşlendi",
  CONVERTED: "Siparişe dönüştü",
  QUALIFICATION: "Değerlendirme",
  PROPOSAL: "Teklif",
  NEGOTIATION: "Görüşme",
  WON: "Kazanıldı",
  LOST: "Kaybedildi",
  LOW: "Düşük",
  MEDIUM: "Normal",
  HIGH: "Yüksek",
  IN: "Tahsilat",
  OUT: "Ödeme",
  OWNER: "Şirket sahibi",
  ADMIN: "Yönetici",
  SALES: "Satış",
  WAREHOUSE: "Depo",
  FINANCE: "Finans",
  MEMBER: "Ekip üyesi",
  VIEWER: "Görüntüleyici",
  NOTE: "Not",
  CALL: "Arama",
  MEETING: "Toplantı",
  EMAIL: "E-posta",
  SMB: "Küçük işletme",
  MID: "Orta ölçek",
  ENTERPRISE: "Kurumsal",
};
export const label = (s: string) => labels[s] ?? s;
