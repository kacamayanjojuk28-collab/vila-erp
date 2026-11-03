"use client";
import { useState } from "react";
import CardExpand from "./card-expand";
import { type Row } from "./ui";
export default function FinanceOverview({
  data,
  money,
}: {
  data: Row | null;
  money: (n: any) => string;
}) {
  const [period, setPeriod] = useState(6);
  if (!data) return <div className="skeleton" />;
  const months = Array.from({ length: period }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - period + 1 + i);
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("tr-TR", { month: "short" }),
      income: 0,
      expense: 0,
    };
  });
  for (const p of data.monthlyPayments) {
    const m = months.find((m) => m.key === p.createdAt.slice(0, 7));
    if (m) m[p.direction === "IN" ? "income" : "expense"] += Number(p.amount);
  }
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const path = (field: "income" | "expense") => {
    const points = months.map((m, i) => ({
      x: 35 + (i * 610) / (period - 1),
      y: 220 - (m[field] / max) * 175,
    }));
    return points.reduce((d, p, i) => {
      if (!i) return `M${p.x},${p.y}`;
      const prev = points[i - 1],
        before = points[Math.max(i - 2, 0)],
        next = points[Math.min(i + 1, points.length - 1)];
      return (
        d +
        ` C${prev.x + (p.x - before.x) / 6},${prev.y + (p.y - before.y) / 6} ${p.x - (next.x - prev.x) / 6},${p.y - (next.y - prev.y) / 6} ${p.x},${p.y}`
      );
    }, "");
  };
  const maxAge = Math.max(1, ...data.aging.map((a: Row) => Number(a.amount)));
  return (
    <div className="finance-overview">
      <section className="card">
        <div className="cardhead">
          <h3>Nakit akışı</h3>
          <div className="actions">
            <CardExpand title="Finans grafiği" />
            <div className="seg">
              <button
                className={period === 6 ? "active" : ""}
                onClick={() => setPeriod(6)}
              >
                6A
              </button>
              <button
                className={period === 12 ? "active" : ""}
                onClick={() => setPeriod(12)}
              >
                12A
              </button>
            </div>
          </div>
        </div>
        <strong className="big">{money(data.income)}</strong>
        <small style={{ marginLeft: 12 }}>Toplam tahsilat</small>
        <svg
          className="finance-chart"
          viewBox="0 0 680 270"
          preserveAspectRatio="none"
          role="img"
          aria-label="Aylık tahsilat ve ödeme karşılaştırması"
        >
          {[45, 130, 220].map((y) => (
            <line key={y} x1="35" x2="645" y1={y} y2={y} />
          ))}
          <defs>
            <linearGradient id="finance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="var(--lime)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--lime)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={path("income") + " L645,220 L35,220 Z"}
            fill="url(#finance-fill)"
          />
          <path
            d={path("income")}
            fill="none"
            stroke="var(--lime)"
            strokeWidth="2.5"
          />
          <path
            d={path("expense")}
            fill="none"
            stroke="var(--text)"
            strokeWidth="2"
            strokeDasharray="5 6"
          />
          {months.map((m, i) => (
            <text
              key={m.key}
              x={35 + (i * 610) / (period - 1)}
              y="252"
              textAnchor="middle"
            >
              {m.label}
            </text>
          ))}
        </svg>
        <p className="muted">
          <span style={{ color: "var(--lime)" }}>●</span> Tahsilat　 ┄ Ödeme
        </p>
      </section>
      <section className="card">
        <div className="cardhead">
          <h3>Alacak yaşlandırma</h3>
          <CardExpand title="Alacak yaşlandırma" />
        </div>
        <p className="muted">
          Açık sipariş alacakları · belge tarihinden itibaren
        </p>
        <div className="aging-bars">
          {data.aging.map((a: Row, i: number) => (
            <div key={a.label}>
              <div className="aging-track">
                <span
                  style={{
                    height: (Number(a.amount) / maxAge) * 100 + "%",
                    background: i === 3 ? "var(--coral)" : "var(--text)",
                  }}
                />
              </div>
              <small>{a.label}</small>
            </div>
          ))}
        </div>
        {data.aging.map((a: Row) => (
          <div className="row" key={a.label}>
            <b className="grow">{a.label}</b>
            <small>{a.count} sipariş</small>
            <b>{money(a.amount)}</b>
          </div>
        ))}
      </section>
    </div>
  );
}
