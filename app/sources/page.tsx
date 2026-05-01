"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Database, Plus, Trash2 } from "lucide-react";
import { loadBoardState, saveBoardState } from "@/lib/storage";
import type { BoardSource, ExtractedTask } from "@/lib/types";

type SourceStatus = "built" | "pending";

function statusFor(source: BoardSource): SourceStatus {
  return source.extractedAt ? "built" : "pending";
}

function formatDate(value: string | null) {
  if (!value) return "Not built yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function SourceBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "warn" | "neutral" }) {
  const className = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warn: "bg-amber-50 text-amber-700 ring-amber-100",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200"
  }[tone];

  return <span className={`rounded px-2 py-1 text-xs font-black uppercase ring-1 ${className}`}>{children}</span>;
}

function EmptyState() {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white/75 p-8 text-center">
      <Database className="mx-auto text-teal-700" size={28} />
      <h2 className="mt-4 text-2xl font-black text-slate-950">No sources yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        Add a syllabus, PDF, pasted text, or course URL from the board. Sources you add will show up here for quick cleanup.
      </p>
      <Link className="mt-5 inline-flex items-center rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800" href="/#add-sources">
        Add sources
      </Link>
    </section>
  );
}

function SourceRow({
  source,
  taskCount,
  onToggle,
  onDelete
}: {
  source: BoardSource;
  taskCount: number;
  onToggle: (id: string) => void;
  onDelete: (source: BoardSource) => void;
}) {
  const status = statusFor(source);

  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-white/80 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-black text-slate-950">{source.sourceName}</h2>
          <SourceBadge>{source.kind}</SourceBadge>
          <SourceBadge tone={source.enabled ? "good" : "neutral"}>{source.enabled ? "enabled" : "disabled"}</SourceBadge>
          <SourceBadge tone={status === "built" ? "good" : "warn"}>{status}</SourceBadge>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {taskCount} task{taskCount === 1 ? "" : "s"} · {formatDate(source.extractedAt)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50">
          <input
            checked={source.enabled}
            className="h-4 w-4 accent-teal-700"
            onChange={() => onToggle(source.id)}
            type="checkbox"
          />
          Enabled
        </label>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-red-100 bg-white px-3 text-sm font-bold text-red-700 hover:bg-red-50"
          onClick={() => onDelete(source)}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>
    </article>
  );
}

export default function SourcesPage() {
  const [hydrated, setHydrated] = useState(false);
  const [sources, setSources] = useState<BoardSource[]>([]);
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);

  useEffect(() => {
    const state = loadBoardState();
    setSources(state.sources);
    setTasks(state.tasks);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveBoardState(tasks, sources);
  }, [hydrated, sources, tasks]);

  const taskCountBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) counts.set(task.sourceName, (counts.get(task.sourceName) ?? 0) + 1);
    return counts;
  }, [tasks]);

  const totals = useMemo(() => {
    const enabled = sources.filter((source) => source.enabled).length;
    const built = sources.filter((source) => source.extractedAt).length;
    const pending = sources.length - built;
    return { enabled, built, pending };
  }, [sources]);

  function toggleSource(id: string) {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, enabled: !source.enabled } : source)));
  }

  function deleteSource(source: BoardSource) {
    const taskCount = taskCountBySource.get(source.sourceName) ?? 0;
    const confirmed = window.confirm(
      `Delete "${source.sourceName}" and ${taskCount} task${taskCount === 1 ? "" : "s"} from this source?`
    );
    if (!confirmed) return;
    setSources((current) => current.filter((item) => item.id !== source.id));
    setTasks((current) => current.filter((task) => task.sourceName !== source.sourceName));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950" href="/#board">
            <ArrowLeft size={15} />
            Board
          </Link>
          <h1 className="mt-3 text-4xl font-black text-slate-950">Sources</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Manage the course material feeding your board.</p>
        </div>
        {sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Link className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-black text-white hover:bg-slate-800" href="/#add-sources">
              <Plus size={15} />
              Add sources
            </Link>
            <SourceBadge tone="good">{totals.enabled} enabled</SourceBadge>
            <SourceBadge tone="good">{totals.built} built</SourceBadge>
            <SourceBadge tone={totals.pending ? "warn" : "neutral"}>{totals.pending} pending</SourceBadge>
          </div>
        )}
      </header>

      {!hydrated ? (
        <section className="rounded-lg border border-slate-200 bg-white/75 p-5">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-16 animate-pulse rounded bg-slate-100" />
        </section>
      ) : sources.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="grid gap-3">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              taskCount={taskCountBySource.get(source.sourceName) ?? 0}
              onDelete={deleteSource}
              onToggle={toggleSource}
            />
          ))}
        </section>
      )}
    </main>
  );
}
