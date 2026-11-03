"use client";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { api, Dialog, initials, roles, type Row } from "./ui";
import { label } from "@/lib/modules";
export default function TeamSettings({ me, can, changed, notify }: any) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [inviteUrl, setInviteUrl] = useState(""),
    [confirm, setConfirm] = useState<{
      type: "member" | "invite";
      row: Row;
    } | null>(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const editable = (m: Row) =>
    can("settings") &&
    m.role !== "OWNER" &&
    m.userId !== me.user.id &&
    (me.role === "OWNER" || m.role !== "ADMIN");
  const members = me.members
    .filter((m: Row) =>
      (m.user.name + " " + m.user.email)
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
    )
    .sort((a: Row, b: Row) => a.user.name.localeCompare(b.user.name, "tr"));
  const pages = Math.max(1, Math.ceil(members.length / 12));
  const current = Math.min(page, pages);
  async function act() {
    if (!confirm) return;
    setBusy(true);
    setError("");
    try {
      if (confirm.type === "member")
        await api("members/" + confirm.row.id, "PATCH", {
          active: !confirm.row.active,
        });
      else await api("invites/" + confirm.row.id, "DELETE");
      setConfirm(null);
      changed();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <label className="search" style={{ marginBottom: 16 }}>
        <Search />
        <input
          aria-label="Ekipte ara"
          placeholder="Ad veya e-posta ara…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {members.slice((current - 1) * 12, current * 12).map((m: Row) => (
        <div className="row team-member" key={m.id}>
          <span className="avatar">{initials(m.user.name)}</span>
          <div className="grow">
            <b>{m.user.name}</b>
            <small>
              {m.user.email} {!m.active && "· Erişim askıda"}
            </small>
          </div>
          <select
            className="filter"
            aria-label={"Rol " + m.user.name}
            value={m.role}
            disabled={!editable(m) || busy}
            onChange={async (e) => {
              setBusy(true);
              try {
                await api("members/" + m.id, "PATCH", { role: e.target.value });
                changed();
              } catch (err: any) {
                notify(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {[...(m.role === "OWNER" ? ["OWNER"] : []), ...roles]
              .filter(
                (r) =>
                  me.role === "OWNER" || r !== "ADMIN" || m.role === "ADMIN",
              )
              .map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
          </select>
          {editable(m) && (
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => setConfirm({ type: "member", row: m })}
            >
              {m.active ? "Erişimi askıya al" : "Erişimi aç"}
            </button>
          )}
        </div>
      ))}
      {pages > 1 && (
        <div className="pagination">
          <span>
            {current} / {pages}
          </span>
          <div className="actions">
            <button
              className="btn sm"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Önceki
            </button>
            <button
              className="btn sm"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
      {can("settings") && (
        <>
          <h3 style={{ marginTop: 24 }}>Yeni ekip üyesi</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const values = Object.fromEntries(new FormData(e.currentTarget));
              try {
                const result = await api("invites", "POST", values);
                setInviteUrl(result.url);
                changed();
              } catch (err: any) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="fields" style={{ marginTop: 14 }}>
              <label className="field">
                Davet edilecek e-posta
                <input name="email" type="email" required />
              </label>
              <label className="field">
                Erişim rolü
                <select name="role" defaultValue="MEMBER">
                  {roles
                    .filter((r) => r !== "ADMIN" || me.role === "OWNER")
                    .map((r) => (
                      <option key={r} value={r}>
                        {label(r)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="formfoot">
              <button className="btn primary" disabled={busy}>
                <Plus />
                Davet bağlantısı oluştur
              </button>
            </div>
          </form>
          {inviteUrl && (
            <div className="banner" style={{ marginTop: 16 }}>
              <p>Bağlantı 7 gün geçerlidir. E-posta gönderilmedi.</p>
              <input
                aria-label="Davet bağlantısı"
                readOnly
                value={inviteUrl}
                style={{ width: "100%", margin: "10px 0" }}
                onFocus={(e) => e.target.select()}
              />
              <button
                className="btn sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    notify("Bağlantı kopyalandı.");
                  } catch {
                    notify("Bağlantıyı seçerek elle kopyalayabilirsiniz.");
                  }
                }}
              >
                Kopyala
              </button>
            </div>
          )}
          <h3 style={{ marginTop: 24 }}>Bekleyen davetler</h3>
          {me.pendingInvites?.length ? (
            me.pendingInvites.map((i: Row) => (
              <div className="row" key={i.id}>
                <div className="grow">
                  <b>{i.email}</b>
                  <small>
                    {label(i.role)} · Son tarih{" "}
                    {new Date(i.expiresAt).toLocaleDateString("tr-TR")}
                  </small>
                </div>
                <button
                  className="btn sm"
                  disabled={busy}
                  onClick={() => setConfirm({ type: "invite", row: i })}
                >
                  Daveti iptal et
                </button>
              </div>
            ))
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              Bekleyen davet yok.
            </p>
          )}
        </>
      )}
      {error && !confirm && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <h3 style={{ marginTop: 24 }}>Yetki matrisi</h3>
      <div className="tablewrap">
        <table className="table">
          <tbody>
            {[
              ["OWNER", "Tüm modüller ve yönetici yetkilendirmesi"],
              ["ADMIN", "Operasyon modülleri ve alt rollerin yönetimi"],
              ["SALES", "CRM, teklif, satış ve aktiviteler"],
              ["WAREHOUSE", "Ürün, depo, stok ve satın alma"],
              ["FINANCE", "Tahsilat ve ödeme"],
              ["MEMBER", "Proje, görev ve aktiviteler"],
              ["VIEWER", "Operasyon kayıtlarını görüntüleme"],
            ].map(([r, description]) => (
              <tr key={r}>
                <td>{label(r)}</td>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirm && (
        <Dialog
          title={
            confirm.type === "invite"
              ? "Daveti iptal et"
              : confirm.row.active
                ? "Erişimi askıya al"
                : "Erişimi yeniden aç"
          }
          onClose={() => {
            setConfirm(null);
            setError("");
          }}
        >
          <p>
            {confirm.type === "invite"
              ? `${confirm.row.email} için oluşturulan bağlantı artık kullanılamayacak.`
              : confirm.row.active
                ? `${confirm.row.user.name} bu şirkete erişemeyecek ve açık oturumları kapatılacak. İşlem geçmişi korunur.`
                : `${confirm.row.user.name} yeniden giriş yaparak şirket verilerine erişebilecek.`}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="formfoot">
            <button className="btn" onClick={() => setConfirm(null)}>
              Vazgeç
            </button>
            <button className="btn primary" disabled={busy} onClick={act}>
              {busy ? "İşleniyor…" : "Onayla"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
