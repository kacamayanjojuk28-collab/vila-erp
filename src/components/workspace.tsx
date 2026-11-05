"use client";
import { canRead, canWrite } from "@/lib/permissions";
import { modules } from "@/lib/modules";
import { gsap } from "gsap";
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Auth from "./auth";
import CalendarPage from "./calendar";
import Dashboard from "./dashboard-engine";
import FinanceCore from "./finance-core";
import Editor from "./editor";
import ModulePage from "./module-page";
import { useReferenceMotion } from "./motion";
import ReportsPage from "./reports";
import SettingsPage from "./settings";
import { api, Dialog, initials, type Row } from "./ui";
export default function Workspace() {
  const [me, setMe] = useState<Row | null>(null),
    [initial, setInitial] = useState(true),
    [view, setView] = useState("overview"),
    [theme, setTheme] = useState("dark"),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<{ type: string; row?: Row } | null>(null),
    [lookup, setLookup] = useState<Row[]>([]),
    [revision, setRevision] = useState(0),
    [globalError, setGlobalError] = useState(""),
    [navSearch, setNavSearch] = useState("");
  useReferenceMotion(view, !!me);
  const notify = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 5000);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const m = await api("me");
      const l = await api("lookup");
      setMe(m);
      setLookup(l);
      setGlobalError("");
    } catch (e: any) {
      if (e.status === 401) setMe(null);
      else setGlobalError(e.message);
    } finally {
      setInitial(false);
    }
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem("vila-theme") ?? "dark";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
    refresh();
    const update = () => {
      const h = location.hash.slice(1);
      if(h!=="overview"&&!window.dispatchEvent(new Event("vila:before-navigate",{cancelable:true}))){history.replaceState(null,"","#overview");return;}
      if (h === "settings" || h === "overview" || modules[h]) setView(h);
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [refresh]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && me) {
        e.preventDefault();
        setNavSearch("");
        setModal({ type: "navigation" });
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [me]);
  const changeTheme = (v: string) => {
    setTheme(v);
    localStorage.setItem("vila-theme", v);
    document.documentElement.dataset.theme = v;
  };
  const go = (v: string) => {
    if(v!==view&&!window.dispatchEvent(new Event("vila:before-navigate",{cancelable:true})))return;
    if (me && !canRead(me.role, v)) return;
    const done = () => {
      setView(v);
      location.hash = v;
      setModal(null);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLHeadingElement>("main h1")
          ?.focus({ preventScroll: true }),
      );
    };
    const outgoing = document.querySelector("main");
    if (outgoing) gsap.killTweensOf(outgoing);
    if (outgoing && v !== view && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      gsap.to(outgoing, {
        opacity: 0,
        y: -8,
        duration: 0.18,
        ease: "power2.in",
        onComplete: () => {
          done();
        },
      });
    else {
      if (outgoing) gsap.set(outgoing, { clearProps: "opacity,transform" });
      done();
    }
  };
  const changed = () => {
    setModal(null);
    setRevision((x) => x + 1);
    refresh();
    notify("İşlem başarıyla kaydedildi.");
  };
  const money = (n: any) =>
    new Intl.NumberFormat(me?.org.locale ?? "tr-TR", {
      style: "currency",
      currency: me?.org.currency ?? "TRY",
      maximumFractionDigits: 2,
    }).format(Number(n ?? 0));
  const can = (scope: string) => !!me && canWrite(me.role, scope);
  const readable = (scope: string) => !!me && canRead(me.role, scope);
  if (initial)
    return (
      <div className="auth card">
        <div className="brand">
          VILA
        </div>
        <div className="skeleton" aria-label="Yükleniyor" />
      </div>
    );
  if (!me)
    return (
      <Auth
        onLogin={() => {
          refresh();
          setRevision((x) => x + 1);
        }}
      />
    );
  const nav = [
    ["overview", "Genel bakış"],
    ["deals", "Pipeline"],
    ["customers", "Müşteriler"],
    ["sales", "Satış"],
    ["finance", "Finans"],
    ["products", "Envanter"],
    ["projects", "Projeler"],
  ];
  return (
    <>
      <a href="#main" className="skip">
        İçeriğe geç
      </a>
      <aside className="dock" aria-label="Hızlı menü">
        <button
          aria-label="Hızlı arama"
          onClick={() => setModal({ type: "navigation" })}
        >
          <Search />
          <span className="tip">Ara</span>
        </button>
        {[
          [LayoutDashboard, "overview", "Genel bakış"],
          [Users, "customers", "Müşteriler"],
          [Boxes, "products", "Envanter"],
          [ShoppingCart, "purchases", "Satın alma"],
          [Wallet, "finance", "Finans"],
          [FolderKanban, "projects", "Projeler"],
          [CalendarDays, "calendar", "Takvim"],
        ].filter(([, key]) => readable(String(key))).map(([Icon, key, title]: any) => (
          <button
            key={key}
            className={view === key ? "active" : ""}
            onClick={() => go(key)}
            aria-label={title}
          >
            <Icon />
            <span className="tip">{title}</span>
          </button>
        ))}
        <hr />
        <button
          onClick={() => go("settings")}
          className={view === "settings" ? "active" : ""}
          aria-label="Ayarlar"
        >
          <Settings />
          <span className="tip">Ayarlar</span>
        </button>
        <button
          onClick={() => changeTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Temayı değiştir"
        >
          {theme === "dark" ? <Sun /> : <Moon />}
          <span className="tip">Görünüm</span>
        </button>
      </aside>
      <div className="app">
        <header className="top">
          <button className="brand" onClick={() => go("overview")}>
            VILA
          </button>
          <nav className="tabs" aria-label="Ana menü">
            {nav.filter(([key]) => readable(key)).map(([key, title]) => (
              <button
                key={key}
                aria-current={view === key ? "page" : undefined}
                onClick={() => go(key)}
              >
                {title}
              </button>
            ))}
          </nav>
          <div className="toptools">
            <span
              className="orgname muted"
              title={
                me.org.demo
                  ? "Yalnızca örnek veriler içeren demo şirketi"
                  : me.org.name
              }
            >
              {me.org.demo ? "DEMO" : me.org.name}
            </span>
            <button
              className="iconbtn"
              aria-label="Çalışma alanında ara"
              title="Ara"
              aria-haspopup="dialog"
              onClick={() => setModal({ type: "navigation" })}
            >
              <Search aria-hidden="true" />
            </button>
            <button
              className="avatar"
              aria-label="Profil"
              onClick={() => go("settings")}
            >
              {initials(me.user.name)}
            </button>
          </div>
        </header>
        {globalError && (
          <p role="alert" className="error">
            {globalError}
          </p>
        )}
        <main id="main" className="view" data-view={view} key={view}>
          {!readable(view) ? (
            <p role="alert" className="error">Bu işlem için yetkiniz yok.</p>
          ) : view === "overview" ? (
            <Dashboard key={me.org.id+":"+me.user.id} revision={revision} money={money} go={go} role={me.role} />
          ) : view === "finance-core" ? (
            <FinanceCore me={me} money={money} notify={notify} />
          ) : view === "calendar" ? (
            <CalendarPage
              revision={revision}
              go={go}
              me={me}
              notify={notify}
              changed={changed}
              can={can}
            />
          ) : view === "reports" ? (
            <ReportsPage revision={revision} money={money} role={me.role} />
          ) : view === "settings" ? (
            <SettingsPage
              me={me}
              theme={theme}
              changeTheme={changeTheme}
              changed={changed}
              notify={notify}
              can={can}
            />
          ) : (
            <ModulePage
              key={view}
              kind={view}
              revision={revision}
              money={money}
              lookup={lookup}
              can={can}
              notify={notify}
              open={(row?: Row) => setModal({ type: "edit", row })}
              changed={changed}
              go={go}
            />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {modal?.type === "navigation" && (
        <Dialog title="Çalışma alanınız" onClose={() => setModal(null)}>
          <label className="search" style={{ width: "100%", marginBottom: 16 }}>
            <Search />
            <input
              autoFocus
              data-initial-focus
              aria-label="Modül ara"
              placeholder="Modül ara…"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
            />
          </label>
          <div className="fields">
            {Object.entries(modules)
              .filter(
                ([key, m]) =>
                  readable(key) &&
                  m.title
                    .toLocaleLowerCase("tr-TR")
                    .includes(navSearch.toLocaleLowerCase("tr-TR")),
              )
              .map(([key, m]) => (
                <button key={key} className="btn" onClick={() => go(key)}>
                  {m.title}
                  <ArrowRight size={16} />
                </button>
              ))}
          </div>
          <div className="formfoot">
            <button
              className="btn"
              onClick={async () => {
                if(!window.dispatchEvent(new Event("vila:before-navigate",{cancelable:true})))return;
                await api("auth/logout", "POST", {});
                setMe(null);
                setModal(null);
              }}
            >
              <LogOut />
              Oturumu kapat
            </button>
          </div>
        </Dialog>
      )}
      {modal?.type === "edit" && (
        <Editor
          kind={view}
          row={modal.row}
          lookup={lookup}
          members={me.members}
          onClose={() => setModal(null)}
          onSaved={changed}
          money={money}
        />
      )}
    </>
  );
}
