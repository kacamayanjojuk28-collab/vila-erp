"use client";
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, Empty, Title, type Row } from "./ui";
export default function ReportsPage({ revision, money }: any) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  useEffect(() => {
    api("dashboard?from=" + from + "&to=" + to)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [revision, from, to]);
  const grouped = (kind: string): Row[] => data?.reports?.[kind] ?? [];
  return (
    <>
      <div className="head">
        <Title>
          İşletme
          <br />
          raporları
        </Title>
        <p className="muted">Seçili dönemin satış ve satın alma performansı</p>
      </div>
      <div className="toolbar">
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
      {error && <p className="error">{error}</p>}
      <div className="reportgrid">
        {[
          ["sales", "Müşteri bazında satış"],
          ["purchases", "Tedarikçi performansı"],
        ].map(([kind, title]) => (
          <section className="card" key={kind}>
            <div className="cardhead">
              <h3>{title}</h3>
              <BarChart3 size={18} />
            </div>
            {!data ? (
              <div className="skeleton" />
            ) : !grouped(kind).length ? (
              <Empty hint="Siparişler oluşturulduğunda raporlar otomatik hesaplanır." />
            ) : (
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Firma</th>
                      <th>Sipariş</th>
                      <th>İşlenen</th>
                      <th>Toplam</th>
                      <th>Ödenen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped(kind).map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{r.count}</td>
                        <td>{r.fulfilled}</td>
                        <td>{money(r.total)}</td>
                        <td>{money(r.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
