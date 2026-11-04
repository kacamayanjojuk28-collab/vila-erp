"use client";
import { label, type Field } from "@/lib/modules";
import { gsap } from "gsap";
import { Package, X } from "lucide-react";
import { Children, useEffect, useRef } from "react";
export type Row = Record<string, any>;
export async function api(path: string, method = "GET", body?: unknown, requestKey?:string) {
  let res:Response;
  try {res=await fetch("/api/"+path,{method,headers:{...(body?{"Content-Type":"application/json"}:{}),...(requestKey?{"Idempotency-Key":requestKey}:{})},body:body?JSON.stringify(body):undefined});}
  catch {throw new Error("Sunucuya ulaşılamıyor. Formunuz korunuyor; bağlantı geldiğinde tekrar deneyin.");}
  const data=await res.json().catch(()=>({error:"Sunucudan geçerli yanıt alınamadı."}));
  if(!res.ok)throw Object.assign(new Error(res.status===401?"Oturumunuz sona ermiş. Bilgilerinizi koruyup yeniden giriş yapın.":data.error??"İşlem başarısız"),{status:res.status});
  return data;
}
export const initials = (s: string) =>
  s
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const docs = ["quotes", "sales", "purchases", "requests"];
export const roles = [
  "ADMIN",
  "SALES",
  "WAREHOUSE",
  "FINANCE",
  "MEMBER",
  "VIEWER",
];
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (["DONE", "FULFILLED", "WON", "ACTIVE"].includes(value)
          ? "good"
          : ["LOST", "CANCELLED"].includes(value)
            ? "bad"
            : "")
      }
    >
      {label(value)}
    </span>
  );
}
export function Empty({
  text = "Henüz kayıt yok",
  hint = "İlk kaydınızı oluşturmak için Yeni kayıt düğmesini kullanın.",
}: {
  text?: string;
  hint?: string;
}) {
  return (
    <div className="empty">
      <Package size={28} />
      <b>{text}</b>
      <span>{hint}</span>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    gsap.to(ref.current, {
      opacity: 0,
      y: 18,
      scale: 0.96,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 0.22,
      ease: "power2.in",
      onComplete: onClose,
    });
  };
  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 18, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 0.45,
        ease: "back.out(1.5)",
        clearProps: "transform",
      },
    );
    const d = ref.current;
    return () => {
      gsap.killTweensOf(d);
      d?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="cardhead">
        <h2>{title}</h2>
        <button
          type="button"
          className="iconbtn"
          aria-label="Kapat"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FieldInput({
  field,
  value,
  set,
  lookup,
  members,
}: {
  field: Field;
  value: any;
  set: (v: any) => void;
  lookup: Row[];
  members: Row[];
}) {
  return (
    <label className={"field " + (field.type === "textarea" ? "full" : "")}>
      <span>{field.label}</span>
      {field.ref ? (
        <select
          required={field.required}
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        >
          <option value="">Seçin</option>
          {(field.ref === "members"
            ? members.map((m) => m.user)
            : lookup.filter((x) => x.kind === field.ref)
          ).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      ) : field.options ? (
        <select
          value={value ?? field.options[0]}
          onChange={(e) => set(e.target.value)}
        >
          {field.options.map((x) => (
            <option key={x} value={x}>
              {label(x)}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          maxLength={500}
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        />
      ) : (
        <input
          required={field.required}
          type={field.type ?? "text"}
          min={field.type === "number" ? 0 : undefined}
          step={field.type === "number" ? "0.001" : undefined}
          maxLength={500}
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        />
      )}
    </label>
  );
}
export function Title({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children);
  const name = items.map((c) => (typeof c === "string" ? c : " ")).join("");
  return (
    <h1 aria-label={name} tabIndex={-1}>
      {items.map((item, i) =>
        typeof item === "string"
          ? item.split(/(\s+)/).map((word, j) =>
              /\s/.test(word) ? (
                <span key={i + "-" + j} aria-hidden="true">
                  {word}
                </span>
              ) : (
                <span
                  key={i + "-" + j}
                  className="title-word"
                  aria-hidden="true"
                >
                  {[...word].map((char, k) => (
                    <span key={k} className="title-char">
                      {char}
                    </span>
                  ))}
                </span>
              ),
            )
          : item,
      )}
    </h1>
  );
}
export function Stat({
  icon,
  value,
  caption,
}: {
  icon: React.ReactNode;
  value: string;
  caption: string;
}) {
  return (
    <div className="stat">
      <span className="circle">{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{caption}</small>
      </div>
    </div>
  );
}
