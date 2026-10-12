"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/task-templates", label: "Stage Task Templates" },
  { href: "/admin/settings/document-templates", label: "Document Templates" },
  { href: "/admin/settings/email", label: "Email" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 mb-8" style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }} aria-label="Settings sections">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className="px-4 py-2.5 text-sm -mb-px transition-colors"
            style={{
              color: isActive ? "#114E3B" : "#888",
              fontWeight: isActive ? 600 : 500,
              borderBottom: `2px solid ${isActive ? "#114E3B" : "transparent"}`,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
