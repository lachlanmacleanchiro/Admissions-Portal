import Link from "next/link";

/** Small in-page tabs (e.g. Active / Archived) driven by links, so the choice survives a refresh. */
export function SubTabs({
  tabs,
  label,
}: {
  tabs: { href: string; label: string; count: number; active: boolean }[];
  label: string;
}) {
  return (
    <nav className="flex gap-1 mb-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }} aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          scroll={false}
          aria-current={tab.active ? "page" : undefined}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm -mb-px transition-colors"
          style={{
            color: tab.active ? "#114E3B" : "#888",
            fontWeight: tab.active ? 600 : 500,
            borderBottom: `2px solid ${tab.active ? "#114E3B" : "transparent"}`,
          }}
        >
          {tab.label}
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums"
            style={tab.active ? { backgroundColor: "rgba(17,78,59,0.1)", color: "#114E3B" } : { backgroundColor: "rgba(0,0,0,0.06)", color: "#777" }}
          >
            {tab.count}
          </span>
        </Link>
      ))}
    </nav>
  );
}
