"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { href: "/", label: "Pipeline CRM" },
  { href: "/kanban", label: "Team Board" },
];

export default function AppNav() {
  const path = usePathname();
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 40,
      background: "rgba(244,240,232,.92)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: 4,
      padding: "0 22px", height: 50,
    }}>
      <span style={{
        fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 17,
        color: "var(--ink)", marginRight: 18, letterSpacing: "-.01em",
      }}>
        Verido
      </span>
      {NAV.map(({ href, label }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} style={{
            padding: "5px 13px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            textDecoration: "none",
            background: active ? "var(--accentSoft)" : "transparent",
            color: active ? "var(--accent)" : "var(--muted)",
            transition: "background .15s, color .15s",
          }}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
