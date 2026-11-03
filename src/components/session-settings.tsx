"use client";
import { useEffect, useState } from "react";
import { api, type Row } from "./ui";
export default function SessionSettings({
  notify,
}: {
  notify: (s: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("sessions")
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <section style={{ marginTop: 28 }}>
      <h3>Açık oturumlar</h3>
      <p className="muted" style={{ margin: "6px 0 14px" }}>
        Tanımadığınız oturumları kapatabilirsiniz.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {rows.map((r) => (
        <div className="row" key={r.id}>
          <div className="grow">
            <b>
              {r.current
                ? "Bu oturum"
                : r.userAgent.includes("Edg")
                  ? "Microsoft Edge"
                  : r.userAgent.includes("Chrome")
                    ? "Chrome"
                    : r.userAgent.includes("Firefox")
                      ? "Firefox"
                      : "Diğer istemci"}
            </b>
            <small>
              Başlangıç: {new Date(r.createdAt).toLocaleString("tr-TR")} ·
              Bitiş: {new Date(r.expiresAt).toLocaleString("tr-TR")}
            </small>
          </div>
          {!r.current && (
            <button
              className="btn sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("sessions/" + r.id, "DELETE");
                  await load();
                  notify("Oturum kapatıldı.");
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Oturumu sonlandır
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
