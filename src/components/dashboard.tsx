"use client";
import { canRead } from "@/lib/permissions";
import { label } from "@/lib/modules";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import CardExpand from "./card-expand";
import {
  api,
  Badge,
  Dialog,
  Empty,
  initials,
  Stat,
  Title,
  type Row,
} from "./ui";
export default function Dashboard({
  revision,
  money,
  go,
  role,
}: {
  role: string;
  revision: number;
  money: (n: any) => string;
  go: (v: string) => void;
}) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [filters, setFilters] = useState(false),
    [monthCount, setMonthCount] = useState(12);
  useEffect(() => {
    let active = true;
    api("dashboard?view=summary&from=" + from + "&to=" + to)
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [revision, from, to]);
  if (error)
    return (
      <p role="alert" className="error">
        {error}
      </p>
    );
  if (!data) return <div className="skeleton" />;
  const deals = data.records.filter((r: Row) => r.kind === "deals"),
    tasks = data.records.filter((r: Row) => r.kind === "tasks"),
    projects = data.records.filter((r: Row) => r.kind === "projects");
  const done = tasks.filter((r: Row) => r.status === "DONE").length;
  const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const receivable = data.receivable,
    payable = data.payable;
  const months = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - monthCount + 1 + i);
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("tr-TR", { month: "short" }),
      value: 0,
    };
  });
  (data.monthlyPayments ?? [])
    .filter((p: Row) => p.direction === "IN")
    .forEach((p: Row) => {
      const m = months.find((m) => m.key === p.createdAt.slice(0, 7));
      if (m) m.value += Number(p.amount);
    });
  const max = Math.max(1, ...months.map((m) => m.value));
  const coordinates = months.map((m, i) => ({
    x: 45 + i * (510 / (monthCount - 1)),
    y: 190 - (m.value / max) * 140,
  }));
  const curve = coordinates.reduce((path, p, i) => {
    if (!i) return `M${p.x},${p.y}`;
    const prev = coordinates[i - 1],
      before = coordinates[Math.max(0, i - 2)],
      after = coordinates[Math.min(coordinates.length - 1, i + 1)];
    return (
      path +
      ` C${prev.x + (p.x - before.x) / 6},${prev.y + (p.y - before.y) / 6} ${p.x - (after.x - prev.x) / 6},${p.y - (after.y - prev.y) / 6} ${p.x},${p.y}`
    );
  }, "");
  const low = data.records.filter(
    (r: Row) =>
      r.kind === "products" &&
      !["HIZMET", "SAAT"].includes(r.data.unit) &&
      data.stocks
        .filter((s: Row) => s.productId === r.id)
        .reduce((n: number, s: Row) => n + Number(s.quantity), 0) <=
        Number(r.data.minStock),
  );
  return (
    <>
      <div className="head">
        <Title>
          İşletme
          <br />
          genel bakışı
        </Title>
        <div className="stats">
          {canRead(role, "finance") && <><Stat
            icon={<TrendingUp />}
            value={money(data.income)}
            caption="Tahsil edilen"
          />
          <Stat
            icon={<BarChart3 />}
            value={money(receivable)}
            caption="Açık alacak"
          /></>}
          <Stat
            icon={<Activity />}
            value={rate + "%"}
            caption="Tamamlanan görevler"
          />
        </div>
      </div>
      {filters && (
        <Dialog title="Rapor dönemi" onClose={() => setFilters(false)}>
          <div className="fields">
            <label className="field">
              Başlangıç
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="field">
              Bitiş
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
          <div className="formfoot">
            <button className="btn primary" onClick={() => setFilters(false)}>
              Uygula
            </button>
          </div>
        </Dialog>
      )}
      <div className="overview">
        {canRead(role, "finance") && <section className="card revenue">
          <div className="cardhead">
            <h3>Nakit akışı</h3>
            <div className="actions">
              <div className="seg">
                <button
                  className={monthCount === 6 ? "active" : ""}
                  onClick={() => setMonthCount(6)}
                >
                  6A
                </button>
                <button
                  className={monthCount === 12 ? "active" : ""}
                  onClick={() => setMonthCount(12)}
                >
                  12A
                </button>
              </div>
              <button className="btn sm" onClick={() => setFilters(true)}>
                <CalendarDays />
                {from || to ? "Seçili dönem" : "Tüm dönem"}
              </button>
              <CardExpand title="Nakit akışı" />
            </div>
          </div>
          <div className="big">{money(data.income)}</div>
          <p className="muted">Tahsilat · Gider: {money(data.expense)}</p>
          <svg
            className="chart"
            viewBox="0 0 600 230"
            preserveAspectRatio="none"
            role="img"
            aria-label="Son altı ay tahsilat grafiği"
          >
            {[50, 120, 190].map((y) => (
              <line key={y} x1="40" x2="560" y1={y} y2={y} />
            ))}
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--coral)" stopOpacity=".22" />
                <stop offset="100%" stopColor="var(--coral)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={curve + " L555,190 L45,190 Z"} fill="url(#revenue-fill)" />
            <path
              d={curve}
              fill="none"
              stroke="var(--coral)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {months.map((m, i) => (
              <g key={m.key}>
                <circle
                  cx={45 + i * (510 / (monthCount - 1))}
                  cy={190 - (m.value / max) * 140}
                  r="2"
                  fill="var(--coral)"
                >
                  <title>
                    {m.label}: {money(m.value)}
                  </title>
                </circle>
                <text
                  x={45 + i * (510 / (monthCount - 1))}
                  y="220"
                  textAnchor="middle"
                >
                  {m.label}
                </text>
              </g>
            ))}
          </svg>
        </section>}
        <section className="card hot">
          <div className="cardhead">
            <h3>Öne çıkan fırsatlar</h3>
            <CardExpand title="Fırsatlar" />
          </div>
          {deals.length ? (
            <div className="tiles">
              {deals
                .filter((d: Row) => !["WON", "LOST"].includes(d.data.stage))
                .sort((a: Row, b: Row) => Number(b.amount) - Number(a.amount))
                .slice(0, 6)
                .map((d: Row) => (
                  <button
                    className="tile tile-ink"
                    key={d.id}
                    onClick={() => go("deals")}
                  >
                    <small>{d.data.dueDate || "Tarih belirtilmedi"}</small>
                    <h3>{d.name}</h3>
                    <small>{label(d.data.stage)}</small>
                    <strong>{money(d.amount)}</strong>
                  </button>
                ))}
            </div>
          ) : (
            <Empty
              text="Yeni fırsatlara yer var"
              hint="Müşterilerinize bağlı satış fırsatlarını Pipeline ekranında oluşturun."
            />
          )}
        </section>
        <section className="card quota">
          <div className="cardhead">
            <h3>Ekip ilerlemesi</h3>
            <Check size={18} />
          </div>
          <div className="ring">
            <svg viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="74" />
              <circle
                cx="90"
                cy="90"
                r="74"
                strokeDasharray={`${(rate / 100) * 465} 465`}
              />
            </svg>
            <div>
              <strong>{rate}%</strong>
              <small>Görev tamamlama</small>
            </div>
          </div>
          <p style={{ textAlign: "center" }}>
            {done} / {tasks.length} görev tamamlandı
          </p>
        </section>
        {canRead(role, "finance") && <section className="card mix">
          <div className="cardhead">
            <h3>Finansal durum</h3>
            <Wallet size={18} />
          </div>
          {[
            ["Açık alacak", receivable],
            ["Açık borç", payable],
            ["Net nakit", data.net],
          ].map(([t, n]) => (
            <div className="row" key={String(t)}>
              <span className="grow">{t}</span>
              <strong>{money(n)}</strong>
            </div>
          ))}
          <p className="muted" style={{ marginTop: 14 }}>
            Resmî fatura veya muhasebe beyannamesi değildir.
          </p>
        </section>}
        <section className="card team">
          <div className="cardhead">
            <h3>Proje portföyü</h3>
            <CardExpand title="Projeler" />
          </div>
          {projects.length ? (
            projects.slice(0, 5).map((p: Row) => (
              <div className="row" key={p.id}>
                <span className="avatar">{initials(p.name)}</span>
                <div className="grow">
                  <b>{p.name}</b>
                  <div className="meter">
                    <span style={{ width: p.data.progress + "%" }} />
                  </div>
                </div>
                <b>{p.data.progress}%</b>
              </div>
            ))
          ) : (
            <Empty hint="Proje oluşturduğunuzda ilerleme burada görünür." />
          )}
        </section>
        <section className="card today">
          <div className="cardhead">
            <h3>Stok takibi</h3>
            <CardExpand title="Stok" />
          </div>
          <p className="muted">{low.length} ürün kritik stok seviyesinde</p>
          {low.slice(0, 5).map((r: Row) => (
            <div className="row" key={r.id}>
              <Package size={18} />
              <div className="grow">
                <b>{r.name}</b>
                <small>{r.data.sku}</small>
              </div>
              <Badge value="LOW" />
            </div>
          ))}
          {!low.length && (
            <Empty
              text="Kritik stok uyarısı yok"
              hint="Ürünlerin minimum stok seviyelerini katalogdan belirleyin."
            />
          )}
        </section>
        {canRead(role, "audit") && <section className="card activity">
          <div className="cardhead">
            <h3>Son aktiviteler</h3>
            <Activity size={18} />
          </div>
          <div className="feed">
            {data.activities.map((a: Row) => (
              <div className="row" key={a.id}>
                <span className="avatar">V</span>
                <div>
                  <b>{a.action}</b>
                  <small>{new Date(a.createdAt).toLocaleString("tr-TR")}</small>
                </div>
              </div>
            ))}
          </div>
        </section>}
      </div>
    </>
  );
}
