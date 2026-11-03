"use client";
import { ArrowRight, UserRound, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "./ui";
export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [invite, setInvite] = useState("");
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("invite");
    if (token) {
      setInvite(token);
      setRegister(true);
    }
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("auth/" + (register ? "register" : "login"), "POST", {
        ...data,
        invite: invite || undefined,
      });
      onLogin();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <aside className="login-story" aria-label="VILA ERP">
        <span className="login-eyebrow">İŞİNİZİN YENİ ÇALIŞMA ALANI</span>
        <h2>Her şey bir arada.<br /><span>Kontrol sizde.</span></h2>
        <p>Müşterilerinizden stoklarınıza, satıştan finansa.<br />İşletmenizin tüm süreçleri VILA’da buluşur.</p>
        <div className="login-orbit" aria-hidden="true"><div className="orbit-ring"/><div className="orbit-ring second"/><span className="orbit-center">VILA</span><span className="orbit-tag tag-sales">Satış</span><span className="orbit-tag tag-stock">Stok</span><span className="orbit-tag tag-finance">Finans</span></div>
        <span className="login-story-foot">Daha net bir bakış. Daha güçlü bir işletme.</span>
      </aside>
      <section className="login-panel" aria-label={register ? "Hesap oluştur" : "Giriş"}>
        <header className="login-cap">
          <svg className="login-wave" viewBox="0 0 480 300" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H480V135C425 165 445 240 352 254C288 266 292 245 231 273C123 324 87 250 0 228Z"/></svg>
          <div className="login-top"><span className="brand">VILA</span><button type="button" className="login-switch" onClick={()=>{setRegister(!register);setError("");}}><UserRound size={19}/>{register ? "Giriş yap" : "Kayıt ol"}</button></div>
          <h1>{register ? "Birlikte, daha ileri." : "Tekrar merhaba."}</h1>
          <p>{invite ? "Ekibinize katılmak için hesabınızı oluşturun." : register ? "İşletmeniz için yeni bir başlangıç." : "Çalışma alanınıza giriş yapın."}</p>
        </header>
        <div className="login-content">
      <form onSubmit={submit} className="login-form">
        <div className="fields">
          {register && (
            <>
              <label className="field">
                Ad soyad
                <input name="name" required minLength={2} autoComplete="name" />
              </label>
              {!invite && (
                <label className="field">
                  Şirket adı
                  <input name="company" required minLength={2} />
                </label>
              )}
            </>
          )}
          <label className="field">
            E-posta
            <input name="email" type="email" required autoComplete="email" placeholder="isim@sirketiniz.com" />
          </label>
          <label className="field">
            Parola
            <input
              aria-label="Parola"
              name="password"
              placeholder="••••••••••••"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
            />
            {register && <small>En az 12 karakter.</small>}
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="login-submit">
          {busy
            ? "İşleniyor…"
            : register
              ? "Çalışma alanını oluştur"
              : "Giriş yap"}
          <ArrowRight />
        </button>
      </form>
      <div className="login-footer"><ShieldCheck size={17}/><span>Size özel çalışma alanı. Güvenli erişim.</span></div>
      <p className="login-signature">VILA ERP <span>·</span> İşinizi bir adım ileri taşıyın.</p>
        </div>
      </section>
    </main>
  );
}
