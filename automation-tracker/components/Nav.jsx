"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/",                 label: "⊞ Automation Initiatives" },
    { href: "/manual-tasks",     label: "📋 Manual Tasks Register" },
    { href: "/sre-skill-matrix", label: "◈ SRE Skill Matrix" },
  ];

  return (
    <div style={{
      background: "#0f172a",
      borderBottom: "1px solid #1e293b",
      padding: "0 28px",
      display: "flex",
      alignItems: "center",
      gap: 0,
      height: 44,
      position: "sticky",
      top: 0,
      zIndex: 200,
    }}>
      {/* Brand */}
      <span style={{
        fontSize: 12,
        fontWeight: 800,
        color: "#94a3b8",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        marginRight: 24,
        whiteSpace: "nowrap",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        SRE · Card Payment
      </span>

      {/* Nav links */}
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "100%",
              padding: "0 16px",
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              color: active ? "#f8fafc" : "#64748b",
              textDecoration: "none",
              borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
              whiteSpace: "nowrap",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
