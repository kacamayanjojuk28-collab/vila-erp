"use client";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
gsap.registerPlugin(Flip);
export default function CardExpand({ title }: { title: string }) {
  const button = useRef<HTMLButtonElement>(null),
    card = useRef<HTMLElement | null>(null),
    placeholder = useRef<HTMLElement | null>(null),
    scrim = useRef<HTMLDivElement>(null),
    overflow = useRef(""),
    closing = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function restore() {
    placeholder.current?.remove();
    placeholder.current = null;
    card.current?.classList.remove("is-focus");
    card.current?.removeAttribute("role");
    card.current?.removeAttribute("aria-modal");
    card.current?.removeAttribute("aria-label");
    document.body.style.overflow = overflow.current;
  }
  function close() {
    if (!card.current || closing.current) return;
    closing.current = true;
    const state = Flip.getState(card.current);
    restore();
    Flip.from(state, {
      duration: reduced() ? 0 : 0.5,
      ease: "power3.inOut",
      scale: true,
    });
    gsap.to(scrim.current, {
      opacity: 0,
      duration: reduced() ? 0 : 0.3,
      onComplete: () => {
        setExpanded(false);
        closing.current = false;
        button.current?.focus();
      },
    });
  }
  function open() {
    const el = button.current?.closest<HTMLElement>(".card");
    if (!el) return;
    card.current = el;
    const state = Flip.getState(el);
    const ph = document.createElement("div");
    ph.className = "card-placeholder";
    ph.style.gridArea = getComputedStyle(el).gridArea;
    ph.style.height = el.getBoundingClientRect().height + "px";
    el.before(ph);
    placeholder.current = ph;
    overflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.classList.add("is-focus");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", title);
    setExpanded(true);
    Flip.from(state, {
      duration: reduced() ? 0 : 0.6,
      ease: "power3.inOut",
      scale: true,
    });
    requestAnimationFrame(() =>
      gsap.fromTo(
        scrim.current,
        { opacity: 0 },
        { opacity: 1, duration: reduced() ? 0 : 0.35 },
      ),
    );
  }
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab" && card.current) {
        const items = [
          ...card.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length);
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !card.current.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !card.current.contains(document.activeElement))
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);
  useEffect(
    () => () => {
      if (placeholder.current) restore();
    },
    [],
  );
  return (
    <>
      <button
        ref={button}
        className="iconbtn"
        aria-label={expanded ? "Daralt " + title : "Genişlet " + title}
        aria-expanded={expanded}
        onClick={() => (expanded ? close() : open())}
      >
        {expanded ? <X /> : <ArrowUpRight />}
      </button>
      {expanded &&
        createPortal(
          <div ref={scrim} className="card-scrim" onClick={close} />,
          document.body,
        )}
    </>
  );
}
