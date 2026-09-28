"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.dataset.reveal = "visible";
      observer.disconnect();
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });

    if (element.getBoundingClientRect().top > window.innerHeight * 0.92) {
      element.dataset.reveal = "hidden";
    }
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={elementRef} className={className} data-reveal="pending">{children}</div>;
}
