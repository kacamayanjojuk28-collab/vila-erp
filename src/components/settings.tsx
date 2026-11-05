"use client";
import { switchCompany } from "./company-context";
import TeamSettings from "./team-settings";
import SessionSettings from "./session-settings";
import { label } from "@/lib/modules";
import {
  Bell,
  Building2,
  Database,
  Mail,
  Plus,
  Shield,
  Sun,
  User,
  Users,
} from "lucide-react";
import { useState, useEffect, type FormEvent } from "react";
import { api, FieldInput, initials, roles, Stat, Title, type Row } from "./ui";
export default function SettingsPage({
  me,
  theme,
  changeTheme,
  changed,
  notify,
  can,
}: any) {
  const [tab, setTab] = useState("profile"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [inviteUrl, setInviteUrl] = useState(""),
    [form, setForm] = useState({
      name: me.user.name,
      orgName: me.org.name,
      currency: me.org.currency,
      locale: me.org.locale,
      notifications: me.org.settings.notifications ?? true,
    });
  useEffect(() => {
    setForm({
      name: me.user.name,
      orgName: me.org.name,
      currency: me.org.currency,
      locale: me.org.locale,
      notifications: me.org.settings.notifications ?? true,
    });
  }, [
    me.org.id,
    me.org.name,
    me.org.currency,
    me.org.locale,
    me.org.settings.notifications,
    me.user.name,
  ]);
  const tabs = [
    ["profile", "Profil", User],
    ["organization", "Şirket", Building2],
    ["team", "Ekip", Users],
    ["security", "Güvenlik", Shield],
    ["notifications", "Bildirimler", Bell],
    ["appearance", "Görünüm", Sun],
    ["data", "Veri", Database],
  ] as const;
  const update = (key: string, v: any) => setForm((f) => ({ ...f, [key]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        tab === "profile" ? "profile" : "organization",
        "POST",
        tab === "profile"
          ? { name: form.name }
          : {
              name: form.orgName,
              currency: form.currency,
              locale: form.locale,
              notifications: form.notifications,
            },
      );
      changed();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="head">
        <Title>
          Çalışma alanı
          <br />
          ayarları
        </Title>
        <div className="stats">
          <Stat
            icon={<Users />}
            value={String(me.members.length)}
            caption="Ekip üyesi"
          />
          <Stat
            icon={<Shield />}
            value={label(me.role)}
            caption="Erişim rolünüz"
          />
          <Stat
            icon={<Database />}
            value="PostgreSQL"
            caption="Kalıcı veri deposu"
          />
        </div>
      </div>
      <div className="settingsgrid">
        <aside className="card profilecard">
          <span className="avatar large">{initials(me.user.name)}</span>
          <h2>{me.user.name}</h2>
          <p className="muted">{label(me.role)}</p>
          <span className="badge">
            <Mail size={14} />
            {me.user.email}
          </span>
          <div className="well">
            <b>{me.org.name}</b>
            <p className="muted" style={{ marginTop: 8 }}>
              {me.org.currency} · {me.org.locale}
            </p>
            <small>Şirket verileri yalnızca yetkili ekibinize açıktır.</small>
          </div>
          <div className="row">
            <span className="grow">Çalışma alanı</span>
            <select
              className="filter"
              aria-label="Şirket değiştir"
              value={me.org.id}
              onChange={async (e) => {
                try {
                  await switchCompany(e.target.value);
                } catch (err: any) {
                  notify(err.message);
                }
              }}
            >
              {me.orgs.map((m: Row) => (
                <option key={m.orgId} value={m.orgId}>
                  {m.org.name}
                </option>
              ))}
            </select>
          </div>
        </aside>
        <section className="card settingsmain">
          <div className="settingtabs">
            {tabs.map(([key, title, Icon]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => {
                  setTab(key);
                  setError("");
                }}
              >
                <Icon />
                {title}
              </button>
            ))}
          </div>
          <div className="settingsbody">
            <h2>{tabs.find((t) => t[0] === tab)?.[1]}</h2>
            <p>Ekibinizin çalışma biçimini ve şirket tercihlerini yönetin.</p>
            {["profile", "organization", "notifications"].includes(tab) && (
              <form onSubmit={submit}>
                {tab === "profile" ? (
                  <div className="fields">
                    <FieldInput
                      field={{ key: "name", label: "Ad soyad", required: true }}
                      value={form.name}
                      set={(v) => update("name", v)}
                      lookup={[]}
                      members={[]}
                    />
                    <label className="field">
                      E-posta
                      <input value={me.user.email} disabled />
                    </label>
                    <label className="field">
                      Rol
                      <input value={label(me.role)} disabled />
                    </label>
                  </div>
                ) : tab === "organization" ? (
                  <div className="fields">
                    <FieldInput
                      field={{
                        key: "orgName",
                        label: "Şirket adı",
                        required: true,
                      }}
                      value={form.orgName}
                      set={(v) => update("orgName", v)}
                      lookup={[]}
                      members={[]}
                    />
                    <FieldInput
                      field={{
                        key: "currency",
                        label: "Para birimi",
                        options: ["TRY", "USD", "EUR"],
                      }}
                      value={form.currency}
                      set={(v) => update("currency", v)}
                      lookup={[]}
                      members={[]}
                    />
                    <FieldInput
                      field={{
                        key: "locale",
                        label: "Yerelleştirme",
                        options: ["tr-TR", "en-US"],
                      }}
                      value={form.locale}
                      set={(v) => update("locale", v)}
                      lookup={[]}
                      members={[]}
                    />
                  </div>
                ) : (
                  <div className="row">
                    <div className="grow">
                      <b>İşlem bildirimleri</b>
                      <small>
                        Şirket bildirimi tercihini kaydedin. E-posta gönderimi
                        henüz entegre değil.
                      </small>
                    </div>
                    <button
                      type="button"
                      className="switch"
                      role="switch"
                      aria-label="İşlem bildirimleri"
                      aria-checked={form.notifications}
                      onClick={() =>
                        update("notifications", !form.notifications)
                      }
                    />
                  </div>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <div className="formfoot">
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setForm({
                        name: me.user.name,
                        orgName: me.org.name,
                        currency: me.org.currency,
                        locale: me.org.locale,
                        notifications: me.org.settings.notifications ?? true,
                      })
                    }
                  >
                    Vazgeç
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy || (tab !== "profile" && !can("settings"))}
                  >
                    {busy ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
                  </button>
                </div>
              </form>
            )}
            {tab === "team" && (
              <TeamSettings
                me={me}
                can={can}
                changed={changed}
                notify={notify}
              />
            )}
            {tab === "appearance" && (
              <>
                <div className="row">
                  <div className="grow">
                    <b>Koyu görünüm</b>
                    <small>Tercihiniz bu tarayıcıda saklanır.</small>
                  </div>
                  <button
                    className="switch"
                    role="switch"
                    aria-label="Koyu görünüm"
                    aria-checked={theme === "dark"}
                    onClick={() =>
                      changeTheme(theme === "dark" ? "light" : "dark")
                    }
                  />
                </div>
                <div className="swatches">
                  {[
                    ["Gökyüzü", "var(--sky)"],
                    ["Limon", "var(--lime)"],
                    ["Mercan", "var(--coral)"],
                    ["Mürekkep", "var(--text)"],
                  ].map(([n, c]) => (
                    <div
                      key={n}
                      style={{
                        background: c,
                        color: n === "Mürekkep" ? "var(--bg)" : undefined,
                      }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ marginTop: 16 }}>
                  Sisteminizin hareket azaltma tercihi otomatik uygulanır.
                </p>
              </>
            )}
            {tab === "security" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  const formElement = e.currentTarget;
                  try {
                    await api(
                      "password",
                      "POST",
                      Object.fromEntries(new FormData(formElement)),
                    );
                    formElement.reset();
                    notify("Parola değiştirildi. Diğer oturumlar kapatıldı.");
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="fields">
                  <label className="field">
                    Mevcut parola
                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <label className="field">
                    Yeni parola
                    <input
                      name="newPassword"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                </div>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <div className="formfoot">
                  <button className="btn primary" disabled={busy}>
                    Parolayı değiştir
                  </button>
                </div>
              </form>
            )}
            {tab === "security" && <SessionSettings notify={notify} />}
            {tab === "data" && (
              <>
                <div className="row">
                  <Database />
                  <div className="grow">
                    <b>Kalıcı ve şirket bazında izole kayıtlar</b>
                    <small>
                      İşlemler PostgreSQL üzerinde saklanır. Finans ve stok
                      geçmişi değiştirilemez.
                    </small>
                  </div>
                </div>
                <div className="row">
                  <Shield />
                  <div>
                    <b>Yedekleme</b>
                    <small>
                      Projedeki yedekleme ve geri yükleme komutları README
                      belgesinde açıklanmıştır.
                    </small>
                  </div>
                </div>
                <p className="muted">
                  E-Fatura / e-Arşiv entegrasyonu yoktur. VILA resmî fatura
                  düzenlemez.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
