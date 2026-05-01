"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { googleCalendarUrl } from "@/lib/calendarLinks";
import { useBoardState } from "@/lib/useBoardState";
import type { BoardSource, ExtractedTask } from "@/lib/types";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function groupByDay(tasks: ExtractedTask[]) {
  const map = new Map<string, ExtractedTask[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const key = dateKey(new Date(task.dueDate));
    const items = map.get(key) ?? [];
    items.push(task);
    map.set(key, items);
  }
  return map;
}

function activeTasks(tasks: ExtractedTask[], sources: BoardSource[], hiddenCourses: string[]) {
  const activeSourceNames = new Set(sources.filter((source) => source.enabled).map((source) => source.sourceName));
  return tasks.filter((task) => !hiddenCourses.includes(task.courseName) && (task.sourceName === "Manual" || sources.length === 0 || activeSourceNames.has(task.sourceName)));
}

function buildMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export default function CalendarPage() {
  const { sources, tasks } = useBoardState();
  const [hiddenCourses, setHiddenCourses] = useState<string[]>([]);
  const courseNames = useMemo(() => Array.from(new Set(tasks.map((task) => task.courseName))).sort(), [tasks]);
  const calendarTasks = useMemo(() => activeTasks(tasks, sources, hiddenCourses), [hiddenCourses, sources, tasks]);
  const datedTasks = useMemo(
    () => calendarTasks
      .filter((task) => task.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [calendarTasks]
  );
  const tasksByDay = useMemo(() => groupByDay(datedTasks), [datedTasks]);
  const months = useMemo(() => Array.from(new Set(datedTasks.map((task) => monthKey(new Date(task.dueDate!))))).sort(), [datedTasks]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <header className="rounded-lg border border-slate-200 bg-white/80 p-5">
        <p className="text-xs font-black uppercase text-teal-700">Calendar</p>
        <h1 className="mt-2 text-3xl font-black">Deadline map</h1>
        <p className="mt-2 text-sm text-slate-600">A month-by-month calendar for tasks that have due dates.</p>
      </header>

      {courseNames.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white/80 p-3">
          <p className="mb-2 text-xs font-black uppercase text-slate-500">Classes on calendar</p>
          <div className="flex flex-wrap gap-2">
            {courseNames.map((courseName) => {
              const hidden = hiddenCourses.includes(courseName);
              return (
                <button
                  className={`rounded-md border px-3 py-1.5 text-sm font-bold ${hidden ? "border-slate-200 bg-slate-50 text-slate-400 line-through" : "border-teal-100 bg-teal-50 text-teal-800"}`}
                  key={courseName}
                  onClick={() => setHiddenCourses((current) => hidden ? current.filter((name) => name !== courseName) : [...current, courseName])}
                >
                  {courseName}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {months.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-6 text-center">
          <h2 className="text-xl font-black">No dated tasks yet.</h2>
          <p className="mt-2 text-sm text-slate-600">Build your board first, then come back here for a calendar scan.</p>
          <Link className="mt-4 inline-block rounded-md bg-teal-700 px-4 py-2 font-black text-white" href="/#add-sources">Add sources</Link>
        </section>
      ) : (
        months.map((month) => {
          const monthDate = new Date(`${month}-01T12:00:00`);
          const days = buildMonthDays(month);
          return (
          <section className="rounded-lg border border-slate-200 bg-white/80 p-4" key={month}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black">{monthLabel(monthDate)}</h2>
              <p className="text-xs font-bold uppercase text-slate-400">{datedTasks.filter((task) => monthKey(new Date(task.dueDate!)) === month).length} dated tasks</p>
            </div>
            <div className="mt-3 grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white text-[11px] sm:text-xs">
              {weekdays.map((day) => (
                <div className="border-b border-slate-200 bg-slate-50 px-2 py-2 font-black uppercase text-slate-500" key={day}>
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const key = dateKey(day);
                const dayTasks = tasksByDay.get(key) ?? [];
                const inMonth = monthKey(day) === month;
                return (
                  <div className={`min-h-24 border-b border-r border-slate-200 p-2 sm:min-h-32 ${inMonth ? "bg-white" : "bg-slate-50/70 text-slate-300"}`} key={key}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-black ${inMonth ? "text-slate-800" : "text-slate-300"}`}>{day.getDate()}</span>
                      {dayTasks.length > 0 && <span className="rounded-full bg-teal-50 px-1.5 py-0.5 font-black text-teal-700">{dayTasks.length}</span>}
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayTasks.slice(0, 2).map((task) => {
                        const url = googleCalendarUrl(task);
                        const content = (
                          <>
                            <span className="block truncate font-black">{task.title}</span>
                            <span className="block truncate text-slate-500">{task.courseName}</span>
                          </>
                        );
                        return url ? (
                          <a
                            className="block rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-left text-slate-700 hover:border-teal-200 hover:bg-teal-50"
                            href={url}
                            key={task.id}
                            rel="noreferrer"
                            target="_blank"
                            title="Open in Google Calendar"
                          >
                            {content}
                          </a>
                        ) : (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700" key={task.id}>
                            {content}
                          </div>
                        );
                      })}
                      {dayTasks.length > 2 && <p className="rounded-md bg-slate-100 px-2 py-1 font-black text-slate-500">+{dayTasks.length - 2} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-slate-500">
              <CalendarDays size={14} />
              Click a task to open a Google Calendar event draft.
            </p>
          </section>
          );
        })
      )}
    </main>
  );
}
