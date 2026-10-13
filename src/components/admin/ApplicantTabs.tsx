"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ApplicantTabsProps {
  applicationId: string;
  showDocuments: boolean;
  showCommunications: boolean;
  /** Unread messages from the student, shown on the Communications tab. */
  unreadMessages?: number;
  /** Optional actions shown at the right-hand end of the tab bar. */
  actions?: React.ReactNode;
}

export function ApplicantTabs({ applicationId, showDocuments, showCommunications, unreadMessages = 0, actions }: ApplicantTabsProps) {
  const pathname = usePathname();
  const base = `/admin/applicants/${applicationId}`;

  const tabs: { href: string; label: string; badge?: number }[] = [
    { href: base, label: "Overview" },
    { href: `${base}/tasks`, label: "Tasks" },
    ...(showDocuments ? [{ href: `${base}/documents`, label: "Documents" }] : []),
    ...(showCommunications ? [{ href: `${base}/communications`, label: "Communications", badge: unreadMessages }] : []),
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
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm -mb-px whitespace-nowrap transition-colors"
              style={{
                color: isActive ? "#114E3B" : "#888",
                fontWeight: isActive ? 600 : 500,
                borderBottom: `2px solid ${isActive ? "#114E3B" : "transparent"}`,
              }}
            >
              {tab.label}
              {tab.badge ? (
                <span
                  className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: "#C79A3B", color: "#fff" }}
                  aria-label={`${tab.badge} unread`}
                >
                  {tab.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      {actions && <div className="flex items-center gap-2 pb-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
