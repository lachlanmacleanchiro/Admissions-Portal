"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface StudentSidebarProps {
  firstName: string;
  lastName: string;
  pendingTaskCount: number;
  unreadMessageCount: number;
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v9H4v-9M2 7h20v5H2V7zm10 0v14M12 7C10.5 4 6 4 6 7s4 2 6 0zm0 0c1.5-3 6-3 6 0s-4 2-6 0z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function NavLink({ href, icon, children, badge, exact }: { href: string; icon: React.ReactNode; children: React.ReactNode; badge?: number; exact?: boolean }) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : (pathname === href || pathname.startsWith(href + "/"));

  return (
    <Link
      href={href}
      className={[
        "flex items-center justify-between gap-3 px-3 py-2 text-sm rounded-lg mx-2 transition-colors",
        isActive ? "font-semibold" : "hover:bg-white/10",
      ].join(" ")}
      style={
        isActive
          ? { backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff" }
          : { color: "rgba(255,255,255,0.75)" }
      }
    >
      <span className="flex items-center gap-2.5">
        <span style={{ opacity: isActive ? 1 : 0.7 }}>{icon}</span>
        {children}
      </span>
      {badge ? (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#C79A3B", color: "#fff" }}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 mb-1 mt-5 text-[10px] font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
      {children}
    </p>
  );
}

export function StudentSidebar({ firstName, lastName, pendingTaskCount, unreadMessageCount }: StudentSidebarProps) {
  const groups: NavGroup[] = [
    {
      title: "My Application",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: <GridIcon /> },
        { label: "My Tasks", href: "/tasks", icon: <CheckIcon />, badge: pendingTaskCount || undefined },
        { label: "Documents", href: "/documents", icon: <FolderIcon /> },
        { label: "Timeline", href: "/timeline", icon: <ClockIcon /> },
        { label: "My Offer", href: "/offer", icon: <GiftIcon /> },
      ],
    },
    {
      title: "Communication",
      items: [
        { label: "Messages", href: "/messages", icon: <MailIcon />, badge: unreadMessageCount || undefined },
      ],
    },
    {
      title: "My Details",
      items: [
        { label: "My Profile", href: "/profile", icon: <UserIcon /> },
      ],
    },
  ];

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full" style={{ backgroundColor: "#114E3B" }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Link href="/dashboard">
          <Image
            src="/nzcc-logo-white.png"
            alt="New Zealand College of Chiropractic"
            width={148}
            height={46}
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => (
          <div key={group.title}>
            <SectionLabel>{group.title}</SectionLabel>
            {group.items.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} badge={item.badge}>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="px-4 py-4 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>
          {firstName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{firstName} {lastName}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-[11px] transition-colors hover:text-white/80"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
