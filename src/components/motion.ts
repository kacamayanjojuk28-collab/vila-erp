"use client";
import { gsap } from "gsap";
import { useEffect } from "react";
export function useReferenceMotion(view: string, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const move = (event: PointerEvent) => {
      if (
        media.matches ||
        !matchMedia("(hover:hover) and (pointer:fine)").matches
      )
        return;
      const el = (event.target as Element).closest<HTMLElement>(
        ".btn.primary,.iconbtn",
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (event.clientX - r.left - r.width / 2) * 0.12,
        y: (event.clientY - r.top - r.height / 2) * 0.12,
        duration: 0.5,
        ease: "power3.out",
        overwrite: "auto",
      });
    };
    const leave = (event: PointerEvent) => {
      const el = (event.target as Element).closest<HTMLElement>(
        ".btn.primary,.iconbtn",
      );
      if (!el || el.contains(event.relatedTarget as Node)) return;
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: media.matches ? 0 : 0.5,
        ease: "power3.out",
        clearProps: "transform",
      });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerout", leave);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
    };
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const nav = document.querySelector<HTMLElement>(".tabs");
    const active = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (!nav) return;
    let pill = nav.querySelector<HTMLElement>(".nav-pill");
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "nav-pill";
      pill.setAttribute("aria-hidden", "true");
      nav.appendChild(pill);
    }
    if (!active) {
      gsap.to(pill, { opacity: 0, duration: 0.16 });
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.to(pill, {
      x: active.offsetLeft,
      width: active.offsetWidth,
      opacity: 1,
      duration: reduced ? 0 : 0.55,
      ease: "power3.inOut",
    });
    return () => {
      gsap.killTweensOf(pill);
    };
  }, [view, ready]);
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    const animate = () => {
      if (media.matches) return;
      const cards = [
        ...document.querySelectorAll("main .card,main .tile"),
      ].filter((e) => !seen.has(e));
      cards.forEach((e) => seen.add(e));
      if (cards.length)
        gsap.fromTo(
          cards,
          { opacity: 0, y: 34, scale: 0.985 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.055,
            clearProps: "transform,opacity",
          },
        );
      const title = document.querySelector("main h1");
      if (title && !seen.has(title)) {
        seen.add(title);
        gsap.fromTo(
          title.querySelectorAll(".title-char"),
          { yPercent: 115, rotation: 6 },
          {
            yPercent: 0,
            rotation: 0,
            duration: 0.85,
            ease: "power4.out",
            stagger: 0.022,
            clearProps: "transform",
          },
        );
      }
    };
    const observer = new MutationObserver(animate);
    observer.observe(document.querySelector("main") ?? document.body, {
      childList: true,
      subtree: true,
    });
    animate();
    return () => {
      observer.disconnect();
      gsap.killTweensOf("main .card,main .tile,main h1");
    };
  }, [view, ready]);
  useEffect(() => {
    if (!ready || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".dock",
        { x: -90, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          clearProps: "transform,opacity",
        },
      );
      gsap.fromTo(
        ".brand,.tabs,.toptools>*",
        { y: -14, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.06,
          clearProps: "transform,opacity",
        },
      );
    });
    return () => ctx.revert();
  }, [ready]);
}
