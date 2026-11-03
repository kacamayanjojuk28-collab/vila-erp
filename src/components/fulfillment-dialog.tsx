"use client";
import { useEffect, useState } from "react";
import { api, Dialog, type Row } from "./ui";
const remaining = (l: Row) =>
  (Number(l.quantity) - Number(l.fulfilledQuantity ?? 0))
    .toFixed(3)
    .replace(/\.?0+$/, "") || "0";
export default function FulfillmentDialog({
  row,
  kind,
  onClose,
  onSaved,
}: {
  row: Row;
  kind: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
      Object.fromEntries(row.lines.map((l: Row) => [l.id, remaining(l)])),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [history, setHistory] = useState<Row[]>([]);
  useEffect(() => {
    let active = true;
    api(`${kind}/${row.id}/deliveries`)
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [kind, row.id]);
  const complete = row.status === "FULFILLED";
  return (
    <Dialog
      title={kind === "purchases" ? "Mal kabulü" : "Sevkiyat"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">
        {row.name} ·{" "}
        {complete
          ? "Tüm kalemler tamamlandı."
          : "Bu işlemde teslim edilen miktarları girin. İşlenmeyecek kalemleri 0 bırakın."}
      </p>
      {history.length > 0 && (
        <details className="delivery-history">
          <summary>İşlem geçmişi ({history.length})</summary>
          {history.map((h) => (
            <div className="row" key={h.id}>
              <div>
                <b>{new Date(h.createdAt).toLocaleString("tr-TR")}</b>
                {h.detail.lines?.length ? (
                  h.detail.lines.map((l: Row) => (
                    <small key={l.lineId}>
                      {l.name} · {l.quantity}
                    </small>
                  ))
                ) : (
                  <small>Tüm kalemler işlendi.</small>
                )}
              </div>
            </div>
          ))}
        </details>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const lines = row.lines
              .filter((l: Row) => Number(amounts[l.id]) > 0)
              .map((l: Row) => ({ lineId: l.id, quantity: amounts[l.id] }));
            if (!lines.length)
              throw Error("En az bir kalem için miktar girin.");
            await api(`${kind}/${row.id}/fulfill`, "POST", {
              version: row.version,
              lines,
            });
            onSaved();
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fulfillment-lines">
          {row.lines.map((l: Row) => (
            <div className="fulfillment-line" key={l.id}>
              <div>
                <b>{l.name}</b>
                <small>
                  Sipariş: {l.quantity} · İşlenen: {l.fulfilledQuantity ?? "0"}{" "}
                  · Kalan: {remaining(l)}
                </small>
              </div>
              {!complete && (
                <label className="field">
                  Bu işlemde
                  <input
                    aria-label={"İşlenecek miktar " + l.name}
                    type="number"
                    min="0"
                    max={remaining(l)}
                    step="0.001"
                    required
                    disabled={busy || Number(remaining(l)) === 0}
                    value={amounts[l.id]}
                    onChange={(e) =>
                      setAmounts({ ...amounts, [l.id]: e.target.value })
                    }
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="formactions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Kapat
          </button>
          {!complete && (
            <button className="btn primary" disabled={busy}>
              {busy
                ? "Kaydediliyor…"
                : kind === "purchases"
                  ? "Mal kabulünü kaydet"
                  : "Sevkiyatı kaydet"}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
