"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Music, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useFocusMusic } from "@/app/components/FocusMusicProvider";
import { daysUntil, refreshPriorities } from "@/lib/planning";
import { loadBoardState, saveBoardState } from "@/lib/storage";
import type { BoardSource, ExtractedTask } from "@/lib/types";

const defaultFocusMinutes = 25;

function activeTasks(tasks: ExtractedTask[], sources: BoardSource[]) {
  const activeSourceNames = new Set(sources.filter((source) => source.enabled).map((source) => source.sourceName));
  return tasks.filter((task) => task.sourceName === "Manual" || sources.length === 0 || activeSourceNames.has(task.sourceName));
}

function sortByPriority(tasks: ExtractedTask[]) {
  return [...tasks].sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.dueDate ?? "9999-12-31").getTime() - new Date(b.dueDate ?? "9999-12-31").getTime());
}

function dueText(task: ExtractedTask) {
  const diff = daysUntil(task.dueDate);
  if (diff === null) return task.dueDateText ?? "No due date";
  if (diff < 0) return `${Math.abs(diff)} day${diff === -1 ? "" : "s"} overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function Timer({
  focusMinutes,
  isRunning,
  onDurationChange,
  secondsLeft,
  onReset,
  onToggle
}: {
  focusMinutes: number;
  isRunning: boolean;
  onDurationChange: (minutes: number) => void;
  secondsLeft: number;
  onReset: () => void;
  onToggle: () => void;
}) {
  const durationOptions = [10, 15, 25, 45, 60];

  return (
    <section className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Study timer</p>
          <p className="mt-1 font-mono text-5xl font-black tabular-nums text-slate-950">{formatTime(secondsLeft)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
            {durationOptions.map((minutes) => (
              <button
                className={`rounded px-2.5 py-1.5 text-sm font-black ${focusMinutes === minutes ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                key={minutes}
                onClick={() => onDurationChange(minutes)}
              >
                {minutes}
              </button>
            ))}
            <input
              aria-label="Custom timer minutes"
              className="h-8 w-16 rounded border border-slate-200 px-2 text-center text-sm font-black"
              max={180}
              min={1}
              type="number"
              value={focusMinutes}
              onChange={(event) => onDurationChange(Number(event.target.value))}
            />
          </div>
          <div className="flex gap-2">
            <button
              aria-label={isRunning ? "Pause timer" : "Start timer"}
              className="grid h-11 w-11 place-items-center rounded-md bg-slate-950 text-white hover:bg-slate-800"
              onClick={onToggle}
            >
              {isRunning ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              aria-label="Reset timer"
              className="grid h-11 w-11 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={onReset}
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LofiPlayer() {
  const { isPlaying, muted, setMuted, setVolume, togglePlayback, volume } = useFocusMusic();

  return (
    <section className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase text-slate-500">
            <Music size={14} />
            Focus sound
          </p>
          <p className="mt-1 text-sm font-bold text-slate-800">Lofi chill loop</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-label={isPlaying ? "Pause focus sound" : "Play focus sound"}
            className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-black text-white hover:bg-slate-800"
            onClick={() => void togglePlayback()}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            aria-label={muted ? "Unmute focus sound" : "Mute focus sound"}
            className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => setMuted(!muted)}
          >
            {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <input
            aria-label="Focus sound volume"
            className="w-28 accent-teal-700"
            max={100}
            min={0}
            type="range"
            value={muted ? 0 : volume}
            onChange={(event) => {
              setMuted(false);
              setVolume(Number(event.target.value));
            }}
          />
        </div>
      </div>
    </section>
  );
}

function TaskFocus({
  task,
  remainingCount,
  onDone,
  onPrevious,
  onSkip
}: {
  task: ExtractedTask;
  remainingCount: number;
  onDone: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white/85 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase">
        <span className="rounded bg-teal-50 px-2 py-1 text-teal-800 ring-1 ring-teal-100">Priority {task.priorityScore}</span>
        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{dueText(task)}</span>
        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{task.estimatedEffort} effort</span>
      </div>
      <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">{task.title}</h1>
      <p className="mt-2 text-sm font-bold text-slate-500">{task.courseName}</p>
      <div className="mt-6 border-l-2 border-teal-700 pl-4">
        <p className="text-xs font-black uppercase text-teal-800">First step</p>
        <p className="mt-1 text-lg font-bold leading-7 text-slate-900">{task.suggestedFirstStep}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-3 font-black text-white hover:bg-teal-800" onClick={onDone}>
          <Check size={17} />
          Done
        </button>
        <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50" onClick={onPrevious}>
          <SkipBack size={17} />
          Previous
        </button>
        <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50" onClick={onSkip}>
          <SkipForward size={17} />
          Skip
        </button>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        {remainingCount === 1 ? "This is the last incomplete active task." : `${remainingCount - 1} more incomplete active tasks after this.`}
      </p>
    </section>
  );
}

export default function TodayPage() {
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [sources, setSources] = useState<BoardSource[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [focusMinutes, setFocusMinutes] = useState(defaultFocusMinutes);
  const [secondsLeft, setSecondsLeft] = useState(defaultFocusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [hiddenCourses, setHiddenCourses] = useState<string[]>([]);

  useEffect(() => {
    const state = loadBoardState();
    setTasks(refreshPriorities(state.tasks));
    setSources(state.sources);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setIsRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const courseNames = useMemo(() => Array.from(new Set(tasks.map((task) => task.courseName))).sort(), [tasks]);
  const incompleteTasks = useMemo(
    () => sortByPriority(activeTasks(refreshPriorities(tasks), sources).filter((task) => !task.completed && !hiddenCourses.includes(task.courseName))),
    [hiddenCourses, sources, tasks]
  );
  const visibleTasks = useMemo(() => incompleteTasks.filter((task) => !skippedIds.includes(task.id)), [incompleteTasks, skippedIds]);
  const currentTask = visibleTasks[0] ?? incompleteTasks[0] ?? null;

  function resetTimer() {
    setIsRunning(false);
    setSecondsLeft(focusMinutes * 60);
  }

  function changeDuration(minutes: number) {
    const nextMinutes = Math.max(1, Math.min(180, Number.isFinite(minutes) ? Math.round(minutes) : defaultFocusMinutes));
    setFocusMinutes(nextMinutes);
    setIsRunning(false);
    setSecondsLeft(nextMinutes * 60);
  }

  function markDone() {
    if (!currentTask) return;
    const nextTasks = refreshPriorities(tasks.map((task) => (task.id === currentTask.id ? { ...task, completed: true } : task)));
    setTasks(nextTasks);
    setSkippedIds((current) => current.filter((id) => id !== currentTask.id));
    saveBoardState(nextTasks, sources);
    resetTimer();
  }

  function skipTask() {
    if (!currentTask) return;
    resetTimer();
    if (incompleteTasks.length <= 1) return;
    const nextSkipped = [...skippedIds, currentTask.id];
    const remaining = incompleteTasks.filter((task) => !nextSkipped.includes(task.id));
    setSkippedIds(remaining.length > 0 ? nextSkipped : [currentTask.id]);
  }

  function previousTask() {
    resetTimer();
    setSkippedIds((current) => current.slice(0, -1));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-teal-700">Today mode</p>
          <p className="mt-1 text-sm text-slate-500">One task, one first step.</p>
        </div>
        <Link className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" href="/#panic-board">
          Board
        </Link>
      </header>

      {courseNames.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white/80 p-3">
          <p className="mb-2 text-xs font-black uppercase text-slate-500">Classes today</p>
          <div className="flex flex-wrap gap-2">
            {courseNames.map((courseName) => {
              const hidden = hiddenCourses.includes(courseName);
              return (
                <button
                  className={`rounded-md border px-3 py-1.5 text-sm font-bold ${hidden ? "border-slate-200 bg-slate-50 text-slate-400 line-through" : "border-teal-100 bg-teal-50 text-teal-800"}`}
                  key={courseName}
                  onClick={() => {
                    setSkippedIds([]);
                    setHiddenCourses((current) => hidden ? current.filter((name) => name !== courseName) : [...current, courseName]);
                  }}
                >
                  {courseName}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!hydrated ? (
        <section className="rounded-lg border border-slate-200 bg-white/80 p-6">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-10 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="mt-6 h-20 animate-pulse rounded bg-slate-100" />
        </section>
      ) : currentTask ? (
        <>
          <TaskFocus task={currentTask} remainingCount={incompleteTasks.length} onDone={markDone} onPrevious={previousTask} onSkip={skipTask} />
          <Timer focusMinutes={focusMinutes} isRunning={isRunning} secondsLeft={secondsLeft} onDurationChange={changeDuration} onReset={resetTimer} onToggle={() => setIsRunning((current) => !current)} />
          <LofiPlayer />
        </>
      ) : (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white/75 p-8 text-center">
          <h1 className="text-3xl font-black text-slate-950">Nothing active left.</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Incomplete tasks from enabled sources will show up here. Add tasks or re-enable sources on the board.</p>
          <Link className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-3 font-black text-white hover:bg-slate-800" href="/#panic-board">
            Open board
          </Link>
        </section>
      )}
    </main>
  );
}
