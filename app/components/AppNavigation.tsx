"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Columns3, ListTodo, Newspaper } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { href: "/", label: "Board", icon: Columns3 },
  { href: "/sources", label: "Sources", icon: Newspaper },
  { href: "/today", label: "Today", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/courses", label: "Courses", icon: BookOpen }
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="inline-flex items-center gap-2 font-black text-slate-950" href="/">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-700 text-sm text-white">P</span>
          PanicBoard
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex max-w-full gap-1 overflow-x-auto no-scrollbar">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;

              return (
                <Link
                  className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${
                    active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  href={href}
                  key={href}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
