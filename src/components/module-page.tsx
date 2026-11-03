"use client";
import { label, modules } from "@/lib/modules";
import {
  Activity,
  Archive,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import FulfillmentDialog from "./fulfillment-dialog";
import FinanceOverview from "./finance-overview";
import {
  api,
  Badge,
  Dialog,
  docs,
  Empty,
  initials,
  Stat,
  Title,
  type Row,
} from "./ui";
export default function ModulePage({
  kind,
  revision,
  money,
  lookup,
  can,
  notify,
  open,
  changed,
  go,
}: any) {
  const [result, setResult] = useState<Row>({ rows: [], total: 0, pages: 0 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("createdAt"),
    [order, setOrder] = useState("desc"),
    [mode, setMode] = useState(
      ["customers", "projects"].includes(kind)
        ? "grid"
        : ["deals", "tasks"].includes(kind)
          ? "board"
          : "table",
    ),
    [pending, setPending] = useState(false),
    [fulfillmentRow, setFulfillmentRow] = useState<Row | null>(null),
    [archiveRow, setArchiveRow] = useState<Row | null>(null),
    [reverseRow, setReverseRow] = useState<Row | null>(null),
    [reason, setReason] = useState(""),
    [detailRow, setDetailRow] = useState<Row | null>(null),
    [summary, setSummary] = useState<Row | null>(null);
  useEffect(() => {
    if (["finance", "projects"].includes(kind))
      api("dashboard")
        .then(setSummary)
        .catch((e) => setError(e.message));
  }, [kind, revision]);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api(
        `${kind}?q=${encodeURIComponent(q)}&status=${status}&page=${page}&sort=${sort}&order=${order}`,
      )
        .then((r) => {
          if (!c.signal.aborted) {
            setResult(r);
            setError("");
          }
        })
        .catch((e) => !c.signal.aborted && setError(e.message))
        .finally(() => !c.signal.aborted && setLoading(false));
    }, 180);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [kind, revision, q, status, page, sort, order]);
  const m = modules[kind];
  const nameOf = (id: string) =>
    lookup.find((r: Row) => r.id === id)?.name ?? id;
  const isDoc = docs.includes(kind);
  const readOnly = ["audit", "movements"].includes(kind);
  const extra: Record<string, string[]> = {
    customers: ["leads", "activities", "deals"],
    products: ["stock", "movements", "warehouses"],
    stock: ["products", "warehouses", "movements"],
    purchases: ["suppliers", "requests"],
    sales: ["quotes", "reports"],
    projects: ["tasks", "calendar"],
  };
  async function act(row: Row, action: string) {
    setPending(true);
    try {
      await api(kind + "/" + row.id + "/" + action, "POST", {});
      changed();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setPending(false);
    }
  }
  const rowActions = (row: Row) => (
    <div className="actions">
      {kind === "customers" && (
        <button
          className="iconbtn"
          aria-label={"Geçmiş " + row.name}
          onClick={() => setDetailRow(row)}
        >
          <Activity size={16} />
        </button>
      )}
      {kind === "leads" && can(kind) && (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => act(row, "convert")}
        >
          Müşteriye dönüştür
        </button>
      )}
      {kind === "finance" && can(kind) && !row.reversalOf && (
        <button
          className="btn sm"
          onClick={() => {
            setReverseRow(row);
            setReason("");
          }}
        >
          Ters kayıt
        </button>
      )}
      {can(kind) &&
        !["stock", "finance", "audit", "movements"].includes(kind) && (
          <>
            {(!isDoc || row.status === "DRAFT") && (
              <>
                <button
                  className="iconbtn"
                  aria-label={"Düzenle " + row.name}
                  onClick={() => open(row)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="iconbtn"
                  aria-label={"Arşivle " + row.name}
                  onClick={() => setArchiveRow(row)}
                >
                  <Archive size={16} />
                </button>
              </>
            )}
            {isDoc && row.status === "DRAFT" && (
              <button
                className="btn sm"
                disabled={pending}
                onClick={() =>
                  act(
                    row,
                    ["quotes", "requests"].includes(kind)
                      ? "convert"
                      : "confirm",
                  )
                }
              >
                {["quotes", "requests"].includes(kind)
                  ? "Siparişe dönüştür"
                  : "Onayla"}
              </button>
            )}
            {isDoc &&
              ["CONFIRMED", "PARTIAL", "FULFILLED"].includes(row.status) && (
                <button
                  className="btn sm primary"
                  disabled={pending}
                  onClick={() => setFulfillmentRow(row)}
                >
                  {row.status === "FULFILLED"
                    ? "Teslimat detayı"
                    : kind === "purchases"
                      ? "Mal kabulü"
                      : "Sevk et"}
                </button>
              )}
          </>
        )}
    </div>
  );
  const detail = (r: Row) => {
    if (isDoc) return nameOf(r.contactId);
    if (kind === "stock" || kind === "movements") return nameOf(r.warehouseId);
    return (
      r.data?.company ?? r.data?.sku ?? r.data?.dueDate ?? r.entityId ?? ""
    );
  };
  const exportCsv = () => {
    const lines = [
      ["Ad", "Durum", "Tutar", "Tarih"],
      ...result.rows.map((r: Row) => [
        r.name ?? r.action ?? nameOf(r.productId),
        r.status ?? r.direction ?? "",
        r.total ?? r.amount ?? r.quantity ?? "",
        r.createdAt ?? "",
      ]),
    ];
    const csv =
      "\uFEFF" +
      lines
        .map((row) =>
          row
            .map(
              (v: any) =>
                '"' +
                String(v)
                  .replace(/^[=+@-]/, "'$&")
                  .replace(/"/g, '""') +
                '"',
            )
            .join(";"),
        )
        .join("\r\n");
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.href = url;
    a.download = "vila-" + kind + "-sayfa-" + page + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("Görüntülenen sayfa dışa aktarıldı.");
  };
  const statuses = isDoc
    ? ["DRAFT", "CONFIRMED", "PARTIAL", "FULFILLED", "CONVERTED"]
    : ["ACTIVE", "OPEN", "IN_PROGRESS", "DONE", "CANCELLED"];
  const columns =
    kind === "deals"
      ? ["QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]
      : ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"];
  return (
    <>
      <div className="head">
        {kind === "finance" ? (
          <Title>
            Gelir ve
            <br />
            giderler
          </Title>
        ) : (
          <Title>{m.title}</Title>
        )}
        <div className="stats">
          {kind === "finance" && summary ? (
            <>
              <Stat
                icon={<Users />}
                value={money(summary.income)}
                caption="Toplam tahsilat"
              />
              <Stat
                icon={<Activity />}
                value={money(summary.receivable)}
                caption="Açık alacak"
              />
              <Stat
                icon={<Activity />}
                value={money(summary.overdue)}
                caption="Vadesi geçen"
              />
            </>
          ) : (
            <Stat
              icon={<Users />}
              value={String(result.total)}
              caption="Toplam kayıt"
            />
          )}
        </div>
        <div className="actions">
          {extra[kind]?.map((k) => (
            <button className="btn sm" key={k} onClick={() => go(k)}>
              {modules[k].title}
            </button>
          ))}
        </div>
      </div>
      {kind === "finance" && <FinanceOverview data={summary} money={money} />}
      <div className="toolbar">
        {
          <label className="search">
            <Search />
            <input
              aria-label="Kayıtlarda ara"
              placeholder="Ad veya kayıt ara…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
        }
        {!["stock", "movements", "finance", "audit"].includes(kind) && (
          <select
            className="filter"
            aria-label="Durum filtresi"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tüm durumlar</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        )}
        <span className="spacer" />
        {["customers", "projects", "deals", "tasks"].includes(kind) && (
          <div className="seg">
            <button
              className={mode === "table" ? "active" : ""}
              onClick={() => setMode("table")}
            >
              Tablo
            </button>
            <button
              className={mode !== "table" ? "active" : ""}
              onClick={() =>
                setMode(["deals", "tasks"].includes(kind) ? "board" : "grid")
              }
            >
              {["deals", "tasks"].includes(kind) ? "Kanban" : "Kartlar"}
            </button>
          </div>
        )}
        <button
          className="btn"
          onClick={exportCsv}
          disabled={!result.rows.length}
        >
          <Download />
          Sayfayı dışa aktar
        </button>
        {!readOnly && can(kind) && (
          <button className="btn primary" onClick={() => open()}>
            <Plus />
            {kind === "stock"
              ? "Stok hareketi"
              : kind === "finance"
                ? "Yeni işlem"
                : "Yeni kayıt"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <div className="skeleton" aria-label="Kayıtlar yükleniyor" />
      ) : !result.rows.length ? (
        <section className="card">
          <Empty
            text={q ? "Sonuç bulunamadı" : "Henüz kayıt yok"}
            hint={q ? "Arama veya filtreyi değiştirin." : m.subtitle}
          />
        </section>
      ) : mode === "board" ? (
        <div className="board">
          {columns.map((stage) => (
            <section
              key={stage}
              className="boardcolumn"
              onDragOver={(e) => {
                if (can(kind)) e.preventDefault();
              }}
              onDrop={async (e) => {
                e.preventDefault();
                if (!can(kind)) return;
                const id = e.dataTransfer.getData("text/plain");
                const r = result.rows.find((r: Row) => r.id === id);
                if (!r) return;
                try {
                  await api(kind + "/" + id, "PATCH", {
                    ...r,
                    ...(kind === "deals"
                      ? { data: { ...r.data, stage } }
                      : { status: stage }),
                  });
                  changed();
                } catch (err: any) {
                  notify(err.message);
                }
              }}
            >
              <h3>
                {label(stage)} ·{" "}
                {
                  result.rows.filter(
                    (r: Row) =>
                      (kind === "deals" ? r.data.stage : r.status) === stage,
                  ).length
                }
              </h3>
              {result.rows
                .filter(
                  (r: Row) =>
                    (kind === "deals" ? r.data.stage : r.status) === stage,
                )
                .map((r: Row) => (
                  <article
                    className="card"
                    key={r.id}
                    draggable={!!can(kind)}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", r.id)
                    }
                  >
                    <h3>{r.name}</h3>
                    <p className="muted">
                      {kind === "deals"
                        ? nameOf(r.data.customerId)
                        : r.data.dueDate || "Tarih belirtilmedi"}
                    </p>
                    {kind === "deals" && <b>{money(r.amount)}</b>}
                    {rowActions(r)}
                  </article>
                ))}
            </section>
          ))}
        </div>
      ) : mode === "grid" ? (
        <div className="customergrid">
          {result.rows.map((r: Row) =>
            kind === "projects" ? (
              <ProjectTile
                key={r.id}
                row={r}
                nameOf={nameOf}
                actions={rowActions(r)}
                summary={summary}
              />
            ) : (
              <article className="card customer" key={r.id}>
                <div className="avatar">{initials(r.name)}</div>
                <h3>{r.name}</h3>
                <small>{detail(r) || m.subtitle}</small>
                <div className="well">
                  {kind === "projects" ? (
                    <>
                      <b>{r.data.progress}% tamamlandı</b>
                      <div className="meter">
                        <span style={{ width: r.data.progress + "%" }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <small>E-posta</small>
                      <p>{r.data.email || "Belirtilmedi"}</p>
                    </>
                  )}
                </div>
                <footer>
                  <Badge value={r.data.segment ?? r.status} />
                  {rowActions(r)}
                </footer>
              </article>
            ),
          )}
        </div>
      ) : (
        <section className="card">
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button
                      onClick={() => {
                        setSort("name");
                        setOrder(order === "asc" ? "desc" : "asc");
                      }}
                    >
                      Kayıt ↕
                    </button>
                  </th>
                  <th>Detay</th>
                  <th>
                    {["stock", "movements"].includes(kind) ? "Miktar" : "Durum"}
                  </th>
                  <th>
                    {isDoc ||
                    kind === "finance" ||
                    kind === "products" ||
                    kind === "deals"
                      ? "Tutar"
                      : "Tarih"}
                  </th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r: Row, i: number) => (
                  <tr key={r.id ?? i}>
                    <td>
                      <b>{r.name ?? r.action ?? nameOf(r.productId)}</b>
                      {r.data?.sku && <small>{r.data.sku}</small>}
                    </td>
                    <td>
                      {detail(r)}
                      {isDoc && (
                        <small>
                          {r.lines.length} kalem · {nameOf(r.warehouseId)}
                        </small>
                      )}
                    </td>
                    <td>
                      {r.quantity !== undefined ? (
                        String(r.quantity)
                      ) : (
                        <Badge value={r.status ?? r.direction ?? "DONE"} />
                      )}
                    </td>
                    <td>
                      {isDoc ? (
                        <>
                          <b>{money(r.total)}</b>
                          <small>Ödenen: {money(r.paid)}</small>
                        </>
                      ) : ["finance", "products", "deals"].includes(kind) ? (
                        money(r.amount)
                      ) : r.createdAt ? (
                        new Date(r.createdAt).toLocaleDateString("tr-TR")
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{rowActions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="pagination">
        <span className="muted">
          {result.total} kayıt · Sayfa {page} / {Math.max(1, result.pages)}
        </span>
        <div className="actions">
          <button
            className="iconbtn"
            aria-label="Önceki sayfa"
            disabled={page === 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
          </button>
          <button
            className="iconbtn"
            aria-label="Sonraki sayfa"
            disabled={page >= result.pages || loading}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      {fulfillmentRow && (
        <FulfillmentDialog
          row={fulfillmentRow}
          kind={kind}
          onClose={() => setFulfillmentRow(null)}
          onSaved={changed}
        />
      )}
      {detailRow && (
        <CustomerHistory
          row={detailRow}
          money={money}
          onClose={() => setDetailRow(null)}
        />
      )}
      {reverseRow && (
        <Dialog
          title="Finansal işlemi düzelt"
          onClose={() => setReverseRow(null)}
        >
          <p>
            Orijinal kayıt korunur; zıt yönde yeni bir kayıt oluşturulur ve
            belge bakiyesi güncellenir.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              try {
                await api("finance/" + reverseRow.id + "/reverse", "POST", {
                  reason,
                });
                setReverseRow(null);
                changed();
              } catch (err: any) {
                notify(err.message);
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="field" style={{ marginTop: 16 }}>
              Düzeltme nedeni
              <input
                required
                minLength={3}
                maxLength={160}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="formfoot">
              <button className="btn primary" disabled={pending}>
                Ters kaydı oluştur
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {archiveRow && (
        <Dialog title="Kaydı arşivle" onClose={() => setArchiveRow(null)}>
          <p>
            {archiveRow.name} aktif listeden kaldırılacak. İşlem geçmişi
            korunur.
          </p>
          <div className="formfoot">
            <button className="btn" onClick={() => setArchiveRow(null)}>
              Vazgeç
            </button>
            <button
              className="btn danger"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await api(kind + "/" + archiveRow.id, "DELETE");
                  setArchiveRow(null);
                  changed();
                } catch (e: any) {
                  notify(e.message);
                } finally {
                  setPending(false);
                }
              }}
            >
              Arşivle
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function CustomerHistory({ row, money, onClose }: any) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("history/" + row.id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [row.id]);
  return (
    <Dialog title={row.name + " · Müşteri geçmişi"} onClose={onClose}>
      {error ? (
        <p className="error">{error}</p>
      ) : !data ? (
        <div className="skeleton" />
      ) : (
        <>
          <p className="muted">
            {data.contact.data.email} · {data.contact.data.phone}
          </p>
          <p style={{ margin: "16px 0" }}>
            {data.contact.data.notes || "Not eklenmemiş."}
          </p>
          <h3>Görüşmeler ve notlar</h3>
          {data.activities.length ? (
            data.activities.map((r: Row) => (
              <div className="row" key={r.id}>
                <Badge value={r.data.type} />
                <div>
                  <b>{r.name}</b>
                  <p>{r.data.notes}</p>
                  <small>{r.data.dueDate}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty
              text="Aktivite yok"
              hint="Müşteri aktiviteleri ekranından bu müşteriye görüşme veya not ekleyin."
            />
          )}
          <h3>Teklifler ve siparişler</h3>
          {data.documents.map((r: Row) => (
            <div className="row" key={r.id}>
              <div className="grow">
                <b>{r.name}</b>
                <small>{modules[r.kind]?.title}</small>
              </div>
              <Badge value={r.status} />
              <b>{money(r.total)}</b>
            </div>
          ))}
          <h3 style={{ marginTop: 20 }}>Satış fırsatları</h3>
          {data.deals.map((r: Row) => (
            <div className="row" key={r.id}>
              <span className="grow">{r.name}</span>
              <Badge value={r.data.stage} />
              <b>{money(r.amount)}</b>
            </div>
          ))}
        </>
      )}
    </Dialog>
  );
}

function ProjectTile({ row, nameOf, actions, summary }: any) {
  const tasks =
      summary?.records.filter(
        (t: Row) => t.kind === "tasks" && t.data.projectId === row.id,
      ) ?? [],
    done = tasks.filter((t: Row) => t.status === "DONE").length;
  const progress = tasks.length
    ? Math.round((done / tasks.length) * 100)
    : row.data.progress;
  return (
    <article className="card project-card">
      <div className="project-top">
        <span className="avatar">
          {initials(
            row.data.customerId ? nameOf(row.data.customerId) : row.name,
          )}
        </span>
        <div className="grow">
          <b>
            {row.data.customerId ? nameOf(row.data.customerId) : "İç proje"}
          </b>
          <small>{row.data.dueDate || "Tarih belirtilmedi"}</small>
        </div>
        <Badge value={row.status} />
      </div>
      <h3>{row.name}</h3>
      <div className="project-progress">
        <div className="mini-ring">
          <svg viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="28" />
            <circle
              cx="36"
              cy="36"
              r="28"
              strokeDasharray={`${(progress / 100) * 176} 176`}
            />
          </svg>
          <b>{progress}%</b>
        </div>
        <div className="grow">
          <b>
            {tasks.length
              ? `${done} / ${tasks.length} görev`
              : "Proje ilerlemesi"}
          </b>
          <small>
            {progress === 100 ? "Tamamlandı" : "Çalışmalar devam ediyor"}
          </small>
          <div className="meter">
            <span style={{ width: progress + "%", background: "var(--sky)" }} />
          </div>
        </div>
      </div>
      <footer>
        <small>{row.data.dueDate || "Teslim tarihi yok"}</small>
        {actions}
      </footer>
    </article>
  );
}
