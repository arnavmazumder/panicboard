"use client";

import Link from "next/link";
import { daysUntil } from "@/lib/planning";
import { useBoardState } from "@/lib/useBoardState";

export default function CoursesPage() {
  const { courses, deleteCourse } = useBoardState();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <header className="rounded-lg border border-slate-200 bg-white/80 p-5">
        <p className="text-xs font-black uppercase text-teal-700">Courses</p>
        <h1 className="mt-2 text-3xl font-black">Class view</h1>
        <p className="mt-2 text-sm text-slate-600">See risk and upcoming work by class.</p>
      </header>

      {courses.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-6 text-center">
          <h2 className="text-xl font-black">No courses yet.</h2>
          <p className="mt-2 text-sm text-slate-600">Add a syllabus or LMS page to create your first class.</p>
          <Link className="mt-4 inline-block rounded-md bg-teal-700 px-4 py-2 font-black text-white" href="/">Go to board</Link>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {courses.map(({ name, tasks }) => {
            const incomplete = tasks.filter((task) => !task.completed);
            const dueSoon = incomplete.filter((task) => {
              const diff = daysUntil(task.dueDate);
              return diff !== null && diff <= 7;
            });
            const noDate = incomplete.filter((task) => !task.dueDate);
            const completed = tasks.length - incomplete.length;
            return (
              <article className="rounded-lg border border-slate-200 bg-white/80 p-4" key={name}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{tasks.length} tasks · {completed} done</p>
                  </div>
                  <button className="rounded-md border border-red-100 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50" onClick={() => deleteCourse(name)}>Delete</button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-slate-50 p-3"><p className="text-2xl font-black">{dueSoon.length}</p><p className="text-xs font-bold text-slate-500">due soon</p></div>
                  <div className="rounded-md bg-slate-50 p-3"><p className="text-2xl font-black">{noDate.length}</p><p className="text-xs font-bold text-slate-500">no date</p></div>
                  <div className="rounded-md bg-slate-50 p-3"><p className="text-2xl font-black">{incomplete.length}</p><p className="text-xs font-bold text-slate-500">open</p></div>
                </div>
                <div className="mt-4 space-y-2">
                  {incomplete.slice(0, 5).map((task) => (
                    <div className="rounded-md border border-slate-100 p-3" key={task.id}>
                      <p className="font-bold">{task.title}</p>
                      <p className="text-xs text-slate-500">{task.dueDate ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(task.dueDate)) : "No date"}</p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
