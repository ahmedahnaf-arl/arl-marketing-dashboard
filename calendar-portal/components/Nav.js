"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/entry", label: "+ Add Activity" },
    { href: "/calendar", label: "Calendar" },
  ];

  return (
    <div className="topnav">
      <div className="inner">
        <div className="brand">
          <div className="logo">AK</div>
          <div>
            <h1>Growth Activity Calendar</h1>
            <div className="sub">Marketing · Business Development · Growth — FY 2026-27</div>
          </div>
        </div>
        <nav className="nav-links">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "active" : ""}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
