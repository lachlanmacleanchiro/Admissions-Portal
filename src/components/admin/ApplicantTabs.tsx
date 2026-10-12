"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ApplicantTabsProps {
  applicationId: string;
  showDocuments: boolean;
  /** Optional actions shown at the right-hand end of the tab bar. */
  actions?: React.ReactNode;
}

export function ApplicantTabs({ applicationId, showDocuments, actions }: ApplicantTabsProps) {
  const pathname = usePathname();
  const base = `/admin/applicants/${applicationId}`;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/tasks`, label: "Tasks" },
    ...(showDocuments ? [{ href: `${base}/documents`, label: "Documents" }] : []),
    { href: `${base}/timeline`, label: "Audit Log" },
    { href: `${base}/consideration`, label: "Consideration Summary" },
  ];

  return (
    <div className="flex items-end justify-between gap-4 mb-6" style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
      <nav className="flex flex-wrap gap-1" aria-label="Applicant sections">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className="px-4 py-2.5 text-sm -mb-px whitespace-nowrap transition-colors"
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
      {actions && <div className="flex items-center gap-2 pb-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
