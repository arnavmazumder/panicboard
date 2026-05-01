import Link from "next/link";
import type { ReactNode } from "react";

type RoutePageShellProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
};

export function RoutePageShell({ title, eyebrow, children }: RoutePageShellProps) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4.25rem)] w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white/80 p-5 sm:p-6">
        <p className="text-xs font-black uppercase text-teal-700">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">{title}</h1>
        <div className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{children}</div>
        <Link className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-2 font-bold text-white hover:bg-slate-800" href="/">
          Back to board
        </Link>
      </section>
    </main>
  );
}
