"use client";
import { modules, type Field } from "@/lib/modules";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, Dialog, docs, FieldInput, type Row } from "./ui";
export default function Editor({
  kind,
  row,
  lookup,
  members,
  onClose,
  onSaved,
  money,
}: any) {
  const isDoc = docs.includes(kind);
  const [form, setForm] = useState<Row>(() =>
    row
      ? {
          ...row,
          dueDate: row.dueDate?.slice(0, 10) ?? "",
          data: { ...row.data },
          lines: row.lines?.map((l: Row) => ({ ...l })),
        }
      : {
          name: "",
          status: kind === "tasks" ? "OPEN" : "ACTIVE",
          data: Object.fromEntries(
            (modules[kind]?.fields ?? []).map((f) => [
              f.key,
              f.options?.[0] ?? (f.type === "number" ? "0" : ""),
            ]),
          ),
          contactId: "",
          warehouseId: "",
          productId: "",
          direction: "IN",
          quantity: "1",
          reason: "",
          amount: "0",
          documentId: "",
          lines: [
            { productId: "", quantity: "1", price: "0", discount: 0, tax: 20 },
          ],
        },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [documents, setDocuments] = useState<Row[]>([]);
  const request = useRef({body:"",key:""});
  useEffect(() => {
    let active=true;
    async function load(kind:string){const first=await api(kind+"?status=FULFILLED");const rows=[...first.rows];for(let page=2;page<=first.pages;page++){if(!active)return [];const next=await api(`${kind}?status=FULFILLED&page=${page}`);rows.push(...next.rows)}return rows}
    if(kind==="finance")Promise.all([load("sales"),load("purchases")]).then(([s,p])=>{if(active)setDocuments([...s,...p])}).catch(e=>{if(active)setError(e.message)});
    return()=>{active=false};
  },[kind]);
  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  const field = (f: Field) => (
    <FieldInput
      key={f.key}
      field={f}
      value={form[f.key]}
      set={(v) => set(f.key, v)}
      lookup={lookup}
      members={members}
    />
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload=JSON.stringify(form);
      if(request.current.body!==payload)request.current={body:payload,key:crypto.randomUUID()};
      await api(kind + (row ? "/" + row.id : ""), row ? "PATCH" : "POST", form, ["stock","finance"].includes(kind)?request.current.key:undefined);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={(row ? "Kaydı düzenle · " : "Yeni · ") + modules[kind].title}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="fields">
          {kind !== "stock" &&
            field({
              key: "name",
              label: kind === "finance" ? "Açıklama" : "Ad / başlık",
              required: true,
            })}
          {!isDoc &&
            !["stock", "finance"].includes(kind) &&
            field({
              key: "status",
              label: "Durum",
              options:
                kind === "tasks"
                  ? ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]
                  : ["ACTIVE", "OPEN", "IN_PROGRESS", "DONE", "CANCELLED"],
            })}
          {isDoc ? (
            <>
              {field({
                key: "contactId",
                label: ["purchases", "requests"].includes(kind)
                  ? "Tedarikçi"
                  : "Müşteri",
                ref: ["purchases", "requests"].includes(kind)
                  ? "suppliers"
                  : "customers",
                required: true,
              })}
              {field({ key: "dueDate", label: "Vade tarihi", type: "date" })}
              {field({
                key: "warehouseId",
                label: "Depo",
                ref: "warehouses",
                required: true,
              })}
            </>
          ) : kind === "stock" ? (
            <>
              {field({
                key: "productId",
                label: "Ürün",
                ref: "products",
                required: true,
              })}
              {field({
                key: "warehouseId",
                label: "Kaynak depo",
                ref: "warehouses",
                required: true,
              })}
              {field({
                key: "direction",
                label: "İşlem",
                options: ["IN", "OUT", "TRANSFER"],
              })}
              {field({
                key: "quantity",
                label: "Miktar",
                type: "number",
                required: true,
              })}
              {form.direction === "TRANSFER" &&
                field({
                  key: "targetWarehouseId",
                  label: "Hedef depo",
                  ref: "warehouses",
                  required: true,
                })}
              {field({ key: "reason", label: "İşlem nedeni", required: true })}
            </>
          ) : kind === "finance" ? (
            <>
              {field({
                key: "direction",
                label: "Yön",
                options: ["IN", "OUT"],
              })}
              {field({
                key: "amount",
                label: "Tutar",
                type: "number",
                required: true,
              })}
              <label className="field">
                İlgili işlenmiş belge
                <select
                  value={form.documentId}
                  onChange={(e) => set("documentId", e.target.value)}
                >
                  <option value="">Bağımsız gelir / gider</option>
                  {documents
                    .filter(
                      (d) =>
                        d.kind ===
                        (form.direction === "IN" ? "sales" : "purchases"),
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {money(Number(d.total) - Number(d.paid))}{" "}
                        kalan
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : (
            modules[kind].fields.map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={form.data[f.key]}
                set={(v) => set("data", { ...form.data, [f.key]: v })}
                lookup={lookup}
                members={members}
              />
            ))
          )}
        </div>
        {kind === "projects" && row?.data?.taskCount > 0 && (
          <p className="muted">
            İlerleme, bağlı görevlerin tamamlanma oranından otomatik hesaplanır.
          </p>
        )}
        {isDoc && (
          <div className="lines">
            <div className="cardhead">
              <h3>Ürün ve hizmet kalemleri</h3>
              <button
                className="btn sm"
                type="button"
                onClick={() =>
                  set("lines", [
                    ...form.lines,
                    {
                      productId: "",
                      quantity: "1",
                      price: "0",
                      discount: 0,
                      tax: 20,
                    },
                  ])
                }
              >
                <Plus />
                Kalem ekle
              </button>
            </div>
            {form.lines.map((l: Row, i: number) => (
              <div className="lineitem" key={i}>
                <div className="fields">
                  {[
                    {
                      key: "productId",
                      label: "Ürün",
                      ref: "products",
                      required: true,
                    },
                    {
                      key: "quantity",
                      label: "Miktar",
                      type: "number",
                      required: true,
                    },
                    {
                      key: "price",
                      label: "Birim fiyat",
                      type: "number",
                      required: true,
                    },
                    { key: "discount", label: "İndirim (%)", type: "number" },
                    { key: "tax", label: "Vergi (%)", type: "number" },
                  ].map((f) => (
                    <FieldInput
                      key={f.key}
                      field={f}
                      value={l[f.key]}
                      set={(v) => {
                        const lines = [...form.lines];
                        lines[i] = { ...l, [f.key]: v };
                        if (f.key === "productId") {
                          const product = lookup.find((r: Row) => r.id === v);
                          if (product) lines[i].price = product.data.price;
                        }
                        set("lines", lines);
                      }}
                      lookup={lookup}
                      members={members}
                    />
                  ))}
                  <button
                    className="btn"
                    type="button"
                    disabled={form.lines.length === 1}
                    onClick={() =>
                      set(
                        "lines",
                        form.lines.filter((_: Row, j: number) => i !== j),
                      )
                    }
                  >
                    <X />
                    Kaldır
                  </button>
                </div>
              </div>
            ))}
            <small>
              Vergi ve indirim sonrası tutar kaydedildiğinde hesaplanır. Bu
              belge resmî fatura değildir.
            </small>
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="formfoot">
          <button className="btn" type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
