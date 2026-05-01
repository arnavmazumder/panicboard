"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, Check, ClipboardList, FileText, Loader2, Pencil, Plus, RotateCcw, Sparkles, UploadCloud } from "lucide-react";
import { googleCalendarUrl } from "@/lib/calendarLinks";
import { buildPlanBuckets, isOverdue, normalizeExtractedTask, refreshPriorities } from "@/lib/planning";
import { cse452CalendarSampleText, cse452CalendarUrl, sampleSyllabusText } from "@/lib/sampleData";
import { loadBoardState, saveBoardState } from "@/lib/storage";
import type { BoardSource, BucketId, EstimatedEffort, ExtractApiResponse, ExtractedTask, PlanBucket, SourceKind, TaskType } from "@/lib/types";

type SourceItem = BoardSource;
type EditableTask = ExtractedTask;
type ApiErrorShape = { error?: string };

const taskTypes: TaskType[] = ["assignment", "exam", "quiz", "reading", "project", "discussion", "other"];
const efforts: EstimatedEffort[] = ["low", "medium", "high"];
const collapsedTaskLimit = 3;

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function badgeClass(kind: "urgent" | "soon" | "later" | "review") {
  return {
    urgent: "bg-red-50 text-red-700 ring-red-100",
    soon: "bg-amber-50 text-amber-700 ring-amber-100",
    later: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    review: "bg-slate-100 text-slate-600 ring-slate-200"
  }[kind];
}

function priorityLabel(task: ExtractedTask) {
  if (!task.dueDate) return "review" as const;
  if (task.priorityScore >= 78) return "urgent" as const;
  if (task.priorityScore >= 55) return "soon" as const;
  return "later" as const;
}

function priorityText(task: ExtractedTask) {
  const label = priorityLabel(task);
  if (label === "urgent") return "High";
  if (label === "soon") return "Medium";
  if (label === "review") return "No date";
  return "Low";
}

function confidenceText(task: ExtractedTask) {
  if (task.confidence >= 0.8) return "High confidence";
  if (task.confidence >= 0.6) return "Medium confidence";
  return "Check date";
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function sourceSignature(rawText: string) {
  const normalized = normalizeText(rawText).slice(0, 20_000);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = Math.imul(31, hash) + normalized.charCodeAt(index) | 0;
  }
  return `${normalized.length}:${hash.toString(16)}`;
}

function makeSource(sourceName: string, rawText: string, kind: SourceKind): SourceItem {
  const signature = sourceSignature(rawText);
  return {
    id: `${kind}-${signature}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceName,
    rawText,
    kind,
    enabled: true,
    signature,
    extractedAt: null
  };
}

function pastedSourceName(rawText: string) {
  const firstLine = rawText.split(/\n+/).map((line) => line.trim()).find(Boolean);
  return firstLine ? `Pasted: ${firstLine.slice(0, 42)}` : "Pasted course text";
}

async function readApiJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === "object" && body && "error" in body ? String((body as ApiErrorShape).error) : fallbackMessage;
    throw new Error(message);
  }
  if (typeof body === "string") throw new Error(fallbackMessage);
  return body as T;
}

function taskFingerprint(task: Pick<ExtractedTask, "title" | "dueDate" | "taskType">) {
  return normalizeText(`${task.title}|${task.dueDate ?? "unknown"}|${task.taskType}`);
}

function courseKey(courseName: string | null | undefined) {
  if (!courseName) return "";
  const normalized = courseName.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  const code = normalized.match(/\b[A-Z]{2,6}\s*\d{2,4}[A-Z]?\b/);
  return code ? code[0].replace(/\s+/g, "") : normalized;
}

function canonicalCourseName(incoming: string | null | undefined, existingTasks: ExtractedTask[]) {
  const incomingKey = courseKey(incoming);
  if (!incomingKey) return incoming ?? null;
  const match = existingTasks.find((task) => courseKey(task.courseName) === incomingKey);
  return match?.courseName ?? incoming ?? null;
}

function canonicalizeApiTaskCourse(task: ExtractApiResponse["tasks"][number], extractedCourseName: string | null, existingTasks: ExtractedTask[]) {
  const canonical = canonicalCourseName(task.courseName ?? extractedCourseName, existingTasks);
  return {
    ...task,
    courseName: canonical
  };
}

function uniqueTasks(existing: ExtractedTask[], incoming: ExtractedTask[]) {
  const seen = new Set(existing.map(taskFingerprint));
  const accepted: ExtractedTask[] = [];
  for (const task of incoming) {
    const key = taskFingerprint(task);
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push(task);
  }
  return accepted;
}

async function extractPdfText(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is too large. Use a PDF under 8 MB.`);
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error(`${file.name} is not a PDF.`);
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  const text = pages.join("\n").trim();
  if (!text) throw new Error(`${file.name} did not contain readable text.`);
  return text.slice(0, 70_000);
}

function TaskModal({ task, onClose, onSave, onDelete }: { task: EditableTask; onClose: () => void; onSave: (task: ExtractedTask) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState(task);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <div className="glass w-full max-w-2xl rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Task detail</p>
            <h2 className="mt-1 text-2xl font-black">{draft.title}</h2>
          </div>
          <button className="rounded-md border px-3 py-2 text-sm font-bold hover:bg-white" onClick={onClose}>Close</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">Title<input className="mt-1 w-full rounded-md border bg-white px-3 py-2 font-normal" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="text-sm font-bold">Course<input className="mt-1 w-full rounded-md border bg-white px-3 py-2 font-normal" value={draft.courseName} onChange={(event) => setDraft({ ...draft, courseName: event.target.value })} /></label>
          <label className="text-sm font-bold">Due date<input type="date" className="mt-1 w-full rounded-md border bg-white px-3 py-2 font-normal" value={draft.dueDate ? draft.dueDate.slice(0, 10) : ""} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null })} /></label>
          <label className="text-sm font-bold">Type<select className="mt-1 w-full rounded-md border bg-white px-3 py-2 font-normal" value={draft.taskType} onChange={(event) => setDraft({ ...draft, taskType: event.target.value as TaskType })}>{taskTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="text-sm font-bold">Effort<select className="mt-1 w-full rounded-md border bg-white px-3 py-2 font-normal" value={draft.estimatedEffort} onChange={(event) => setDraft({ ...draft, estimatedEffort: event.target.value as EstimatedEffort })}>{efforts.map((effort) => <option key={effort}>{effort}</option>)}</select></label>
          <label className="text-sm font-bold">Confidence<input type="number" min="0" max="1" step="0.05" className="mt-1 w-full rounded-md border bg-white px-3 py-2 font-normal" value={draft.confidence} onChange={(event) => setDraft({ ...draft, confidence: Number(event.target.value) })} /></label>
        </div>
        <label className="mt-3 block text-sm font-bold">Suggested first step<textarea className="mt-1 min-h-24 w-full rounded-md border bg-white px-3 py-2 font-normal" value={draft.suggestedFirstStep} onChange={(event) => setDraft({ ...draft, suggestedFirstStep: event.target.value })} /></label>
        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <button className="rounded-md border border-red-200 bg-red-50 px-4 py-2 font-bold text-red-700 hover:bg-red-100" onClick={() => { onDelete(draft.id); onClose(); }}>Delete</button>
          <button className="rounded-md bg-slate-950 px-4 py-2 font-bold text-white hover:bg-slate-800" onClick={() => onSave(refreshPriorities([draft])[0])}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onToggle, onEdit, onAddToCalendar }: { task: ExtractedTask; onToggle: (id: string) => void; onEdit: (task: ExtractedTask) => void; onAddToCalendar: (task: ExtractedTask) => void }) {
  const label = priorityLabel(task);
  const overdue = isOverdue(task);
  return (
    <article className={`rounded-md border bg-white p-3 transition hover:border-slate-300 ${task.completed ? "opacity-55" : ""} ${overdue ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex items-start gap-3">
        <button aria-label="Toggle complete" className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border ${task.completed ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`} onClick={() => onToggle(task.id)}>{task.completed && <Check size={14} />}</button>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase">
            <span className={`rounded px-1.5 py-0.5 ring-1 ${badgeClass(label)}`}>{overdue ? "Overdue" : priorityText(task)}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{formatDate(task.dueDate)}</span>
          </div>
          <h3 className="text-sm font-black leading-snug text-slate-950">{task.title}</h3>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{task.courseName}</p>
        </div>
        <button aria-label="Edit task" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={() => onEdit(task)}><Pencil size={15} /></button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-500">
        <span>{task.estimatedEffort} effort</span>
        <span>·</span>
        <span>{task.taskType}</span>
        <span>·</span>
        <span>{confidenceText(task)}</span>
      </div>
      <div className="mt-2 border-l-2 border-teal-600 pl-3">
        <p className="text-xs font-black uppercase text-teal-700">Start</p>
        <p className="mt-0.5 text-sm leading-snug text-slate-700">{task.suggestedFirstStep}</p>
      </div>
      <button className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40" disabled={!task.dueDate} onClick={() => onAddToCalendar(task)}><CalendarDays size={13} /> Google Calendar</button>
    </article>
  );
}

function BucketColumn({
  bucket,
  expanded,
  onToggleExpanded,
  onToggleTask,
  onEdit,
  onAddToCalendar
}: {
  bucket: PlanBucket;
  expanded: boolean;
  onToggleExpanded: (bucketId: BucketId) => void;
  onToggleTask: (id: string) => void;
  onEdit: (task: ExtractedTask) => void;
  onAddToCalendar: (task: ExtractedTask) => void;
}) {
  const hiddenCount = Math.max(0, bucket.tasks.length - collapsedTaskLimit);
  const visibleTasks = expanded ? bucket.tasks : bucket.tasks.slice(0, collapsedTaskLimit);

  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 p-3" key={bucket.id}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black">{bucket.title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{bucket.tasks.length}</span>
      </div>
      <div className={`${expanded ? "h-[52rem] overflow-y-auto pr-1" : ""} space-y-2 transition-all`}>
        {bucket.tasks.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">{bucket.id === "review" ? "Tasks without due dates land here." : "Clear for now."}</p>
        ) : (
          visibleTasks.map((task) => <TaskCard key={task.id} task={task} onToggle={onToggleTask} onEdit={onEdit} onAddToCalendar={onAddToCalendar} />)
        )}
      </div>
      {hiddenCount > 0 && (
        <button className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={() => onToggleExpanded(bucket.id)}>
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalTask, setModalTask] = useState<ExtractedTask | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [hiddenCourses, setHiddenCourses] = useState<string[]>([]);
  const [expandedBuckets, setExpandedBuckets] = useState<BucketId[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const state = loadBoardState();
    setTasks(refreshPriorities(state.tasks));
    setSources(state.sources);
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) saveBoardState(tasks, sources);
  }, [hydrated, sources, tasks]);
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (hash !== "panic-board" && hash !== "board") return;

    window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
    });
  }, [hydrated]);

  const activeSourceNames = useMemo(() => new Set(sources.filter((source) => source.enabled).map((source) => source.sourceName)), [sources]);
  const activeTasks = useMemo(
    () => tasks.filter((task) => !hiddenCourses.includes(task.courseName) && (task.sourceName === "Manual" || sources.length === 0 || activeSourceNames.has(task.sourceName))),
    [activeSourceNames, hiddenCourses, sources.length, tasks]
  );
  const courseNames = useMemo(() => Array.from(new Set(tasks.map((task) => task.courseName))).sort(), [tasks]);
  const buckets = useMemo(() => buildPlanBuckets(refreshPriorities(activeTasks)), [activeTasks]);
  const nextTask = useMemo(() => activeTasks.filter((task) => !task.completed).sort((a, b) => b.priorityScore - a.priorityScore)[0], [activeTasks]);
  const stats = useMemo(() => {
    const todayTomorrow = activeTasks.filter((task) => {
      const diff = task.dueDate ? Math.floor((new Date(task.dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000) : 99;
      return diff >= 0 && diff <= 1 && !task.completed;
    }).length;
    const overdue = activeTasks.filter((task) => isOverdue(task)).length;
    const byCourse = new Map<string, number>();
    for (const task of activeTasks.filter((item) => !item.completed)) byCourse.set(task.courseName, (byCourse.get(task.courseName) ?? 0) + task.priorityScore);
    const riskEntry = Array.from(byCourse.entries()).sort((a, b) => b[1] - a[1])[0];
    const risk = riskEntry?.[0] ?? "No class yet";
    const panicScore = Math.min(100, Math.round(todayTomorrow * 18 + overdue * 24 + Math.min(40, (riskEntry?.[1] ?? 0) / 5)));
    return { todayTomorrow, overdue, risk, panicScore };
  }, [activeTasks]);

  function updateTasks(next: ExtractedTask[]) {
    setTasks(refreshPriorities(next));
  }

  function addSources(nextSources: SourceItem[]) {
    const existingSignatures = new Set(sources.map((source) => source.signature));
    const existingNames = new Set(sources.map((source) => source.sourceName.toLowerCase()));
    const accepted: SourceItem[] = [];
    const skippedNames: string[] = [];

    for (const source of nextSources) {
      const nameKey = source.sourceName.toLowerCase();
      if (existingNames.has(nameKey)) {
        skippedNames.push(`${source.sourceName} is already added.`);
        continue;
      }
      if (existingSignatures.has(source.signature) || accepted.some((item) => item.signature === source.signature)) {
        skippedNames.push(`${source.sourceName} has the same content as a source already added.`);
        continue;
      }
      existingNames.add(nameKey);
      existingSignatures.add(source.signature);
      accepted.push(source);
    }

    if (accepted.length) setSources((current) => [...current, ...accepted]);
    return { accepted, skippedNames };
  }

  function removeSource(source: SourceItem) {
    setSources((current) => current.filter((item) => item.id !== source.id));
    updateTasks(tasks.filter((task) => task.sourceName !== source.sourceName));
  }

  function deleteCourse(courseName: string) {
    setHiddenCourses((current) => current.filter((name) => name !== courseName));
    updateTasks(tasks.filter((task) => task.courseName !== courseName));
  }

  function clearAll() {
    setSources([]);
    setHiddenCourses([]);
    setExpandedBuckets([]);
    updateTasks([]);
    setMessage("Cleared the board.");
  }

  function clearCompleted() {
    const completedCount = tasks.filter((task) => task.completed).length;
    if (completedCount === 0) {
      setMessage("No completed tasks to clear yet.");
      return;
    }
    updateTasks(tasks.filter((task) => !task.completed));
    setMessage(`Cleared ${completedCount} completed task${completedCount === 1 ? "" : "s"}.`);
  }

  function toggleBucketExpanded(bucketId: BucketId) {
    setExpandedBuckets((current) => (current.includes(bucketId) ? current.filter((id) => id !== bucketId) : [...current, bucketId]));
  }

  function markSourcesExtracted(extractedSources: SourceItem[]) {
    const extractedIds = new Set(extractedSources.map((source) => source.id));
    const timestamp = new Date().toISOString();
    setSources((current) => current.map((source) => (extractedIds.has(source.id) ? { ...source, extractedAt: timestamp } : source)));
  }

  async function handleFiles(files: FileList | File[]) {
    setLoading(true);
    setMessage("Reading PDF text...");
    try {
      const results = await Promise.allSettled(Array.from(files).map(async (file) => makeSource(file.name, await extractPdfText(file), "pdf")));
      const extracted = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
      const failed = results.filter((result) => result.status === "rejected").length;
      if (extracted.length === 0) throw new Error("I could not read that PDF. If it is scanned or locked, paste the syllabus text instead.");
      const { accepted, skippedNames } = addSources(extracted);
      setMessage(
        accepted.length
          ? `${accepted.length} PDF source${accepted.length === 1 ? "" : "s"} ready${failed ? `, ${failed} unreadable` : ""}${skippedNames.length ? `. ${skippedNames.join(" ")}` : ""}`
          : skippedNames.join(" ") || "Those PDFs were already added."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF extraction failed. Paste the syllabus text instead and PanicBoard can still build the plan.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUrl() {
    if (!url.trim()) {
      setMessage("Paste a course page URL first, or paste the page text below.");
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("bad protocol");
    } catch {
      setMessage("Enter a full URL starting with http:// or https://.");
      return;
    }
    setLoading(true);
    setMessage("Trying to read that course page...");
    try {
      const response = await fetch("/api/fetch-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await readApiJson<{ text: string }>(response, "That course page could not be read. Paste the visible page text below instead.");
      const source = makeSource(`${parsedUrl.hostname}${parsedUrl.pathname === "/" ? "" : parsedUrl.pathname}`, data.text, "url");
      const { accepted, skippedNames } = addSources([source]);
      setMessage(accepted.length ? "Course page text is ready. Build the board when you are ready." : skippedNames[0] || "This website has already been added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That course page was blocked. Paste the visible page text below instead.");
    } finally {
      setLoading(false);
    }
  }

  async function extractSourcesToBoard(allSources: SourceItem[], replace = false) {
    if (allSources.length === 0) {
      setMessage("Add a PDF, URL, pasted text, or run the demo first.");
      return;
    }
    setLoading(true);
    setMessage(`Starting extraction: 0/${allSources.length} sources processed...`);
    try {
      let accumulatedTasks = replace ? [] : tasks;
      let builtCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      if (replace) updateTasks([]);

      for (const [index, source] of allSources.entries()) {
        setMessage(`Processing ${index + 1}/${allSources.length} sources...`);
        try {
          const response = await fetch("/api/extract", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...source, currentDate: new Date().toISOString() })
          });
          const data = await readApiJson<ExtractApiResponse>(response, "Extraction timed out or returned an invalid response. Try building this source by itself, or paste a shorter assignment/calendar section.");

          if (data.tasks.length === 0) {
            skippedCount += 1;
            setSources((current) => current.filter((item) => item.id !== source.id));
            setMessage(`Processed ${index + 1}/${allSources.length}. No deadlines found in that source.`);
            continue;
          }

          const next = data.tasks.map((task) =>
            normalizeExtractedTask(canonicalizeApiTaskCourse(task, data.courseName, accumulatedTasks), source.sourceName, canonicalCourseName(data.courseName, accumulatedTasks))
          );
          const deduped = uniqueTasks(accumulatedTasks, next);
          if (deduped.length > 0) {
            accumulatedTasks = [...accumulatedTasks, ...deduped];
            builtCount += deduped.length;
            updateTasks(accumulatedTasks);
          }
          markSourcesExtracted([source]);
          setMessage(`Processed ${index + 1}/${allSources.length}. Added ${builtCount} task${builtCount === 1 ? "" : "s"} so far.`);
        } catch {
          failedCount += 1;
          setMessage(`Processed ${index + 1}/${allSources.length}. One source timed out; continuing with the rest.`);
        }
      }

      setMessage(
        builtCount
          ? `Done: ${allSources.length}/${allSources.length} sources processed. Added ${builtCount} task${builtCount === 1 ? "" : "s"}.${skippedCount ? ` ${skippedCount} source${skippedCount === 1 ? "" : "s"} had no deadlines.` : ""}${failedCount ? ` ${failedCount} source${failedCount === 1 ? "" : "s"} timed out; try those by themselves.` : ""}`
          : failedCount
            ? `No tasks added. ${failedCount}/${allSources.length} source${failedCount === 1 ? "" : "s"} timed out. Try one source at a time or paste a shorter section.`
            : "No deadlines or class obligations found. That source was not added to the board."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Extraction failed. You can still paste text or add tasks manually.");
    } finally {
      setLoading(false);
    }
  }

  async function buildBoard() {
    let allSources = sources.filter((source) => source.enabled && !source.extractedAt);
    if (rawText.trim()) {
      const pastedSource = makeSource(pastedSourceName(rawText), rawText, "text");
      const alreadyAdded = sources.some((source) => source.signature === pastedSource.signature || source.sourceName === pastedSource.sourceName);
      allSources = alreadyAdded ? allSources : [...allSources, pastedSource];
      if (!alreadyAdded) addSources([pastedSource]);
      else setMessage("This pasted text is already added.");
    }
    if (allSources.length === 0) {
      setMessage("Everything added is already built. Add a new source or delete/re-add one to extract again.");
      return;
    }
    await extractSourcesToBoard(allSources);
  }

  async function runDemo() {
    setRawText(sampleSyllabusText);
    const demoSource = makeSource("Sample syllabus chaos", sampleSyllabusText, "sample");
    const cseSource = makeSource(cse452CalendarUrl, cse452CalendarSampleText, "url");
    setUrl(cse452CalendarUrl);
    setSources([demoSource, cseSource]);
    await extractSourcesToBoard([demoSource, cseSource], true);
  }

  function addManualTask() {
    const task = normalizeExtractedTask({ title: "New task", courseName: "Course", dueDate: null, dueDateText: null, taskType: "assignment", estimatedEffort: "medium", confidence: 0.6, suggestedFirstStep: "Write the first concrete next step.", subtasks: [] }, "Manual", null);
    updateTasks([task, ...tasks]);
    setModalTask(task);
  }

  function addToGoogleCalendar(task: ExtractedTask) {
    if (!task.dueDate) {
      setMessage("Add a due date before sending this task to Google Calendar.");
      return;
    }
    const url = googleCalendarUrl(task);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <header className="grid gap-4 lg:grid-cols-[1fr_0.9fr] lg:items-stretch">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-5 sm:p-6">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase text-teal-700"><AlertCircle size={14} /> PanicBoard</div>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">Last-minute deadline?</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Students already have the deadlines. PanicBoard finds the urgent ones, flags uncertain dates, and gives the next 25-minute action.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="rounded-md bg-teal-700 px-4 py-3 font-black text-white hover:bg-teal-800 disabled:opacity-60" disabled={loading} onClick={runDemo}>{loading ? <Loader2 className="mr-2 inline animate-spin" size={16} /> : <Sparkles className="mr-2 inline" size={16} />} Run 30-second demo</button>
            <button className="rounded-md border bg-white px-4 py-3 font-bold hover:bg-slate-50" onClick={() => document.getElementById("sources")?.scrollIntoView({ behavior: "smooth" })}>Add my syllabus</button>
          </div>
        </div>
        <section className="rounded-lg border border-slate-200 bg-white/80 p-5 sm:p-6">
          <p className="text-sm font-black uppercase text-slate-500">What should I do next?</p>
          {nextTask ? (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
                <span className={`rounded border px-2 py-1 ${badgeClass(priorityLabel(nextTask))}`}>{priorityText(nextTask)} priority</span>
                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700">Due {formatDate(nextTask.dueDate)}</span>
              </div>
              <h2 className="mt-3 text-2xl font-black leading-tight">{nextTask.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{nextTask.courseName}</p>
              <div className="mt-4 rounded-md bg-teal-50 p-4">
                <p className="text-xs font-black uppercase text-teal-800">25-minute first action</p>
                <p className="mt-1 font-bold leading-6 text-slate-900">{nextTask.suggestedFirstStep}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-white/70 p-4">
              <p className="font-bold text-slate-800">No planning fog yet.</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Run the demo to see the board instantly, or add a real syllabus below.</p>
            </div>
          )}
        </section>
      </header>

      <section id="add-sources" className="grid gap-4 rounded-lg border border-slate-200 bg-white/80 p-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFiles(event.dataTransfer.files); }}>
          <UploadCloud className="text-teal-700" />
          <h2 className="mt-3 text-xl font-black">Upload PDFs</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Drop one or more syllabus PDFs here. If a PDF is scanned, paste the text instead.</p>
          <input ref={fileInput} type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => event.target.files && void handleFiles(event.target.files)} />
          <button className="mt-4 rounded-md bg-slate-950 px-4 py-2 font-bold text-white" onClick={() => fileInput.current?.click()}><FileText className="mr-2 inline" size={16} /> Upload PDF</button>
          {sources.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-black uppercase text-slate-500">Sources</p>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {sources.map((source) => (
                  <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2" key={source.id}>
                    <input
                      aria-label={`Use ${source.sourceName}`}
                      checked={source.enabled}
                      className="h-4 w-4 accent-teal-700"
                      type="checkbox"
                      onChange={() => setSources((current) => current.map((item) => item.id === source.id ? { ...item, enabled: !item.enabled } : item))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{source.sourceName}</p>
                      <p className="text-xs uppercase text-slate-500">{source.kind} · {source.extractedAt ? "built" : "pending"}</p>
                    </div>
                    <button className="rounded border border-red-100 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50" onClick={() => removeSource(source)}>Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-3">
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-md border bg-white px-3 py-2" placeholder="Paste a course website URL" value={url} onChange={(event) => setUrl(event.target.value)} />
            <button className="rounded-md border bg-white px-3 py-2 font-bold hover:bg-slate-50" onClick={fetchUrl}>Fetch</button>
          </div>
          <textarea className="min-h-44 rounded-md border bg-white px-3 py-3" placeholder="Or paste raw syllabus / LMS text here..." value={rawText} onChange={(event) => setRawText(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border bg-white px-4 py-2 font-bold hover:bg-slate-50" onClick={() => setRawText(sampleSyllabusText)}>Preview sample text</button>
            <button className="rounded-md bg-teal-700 px-4 py-2 font-black text-white hover:bg-teal-800 disabled:opacity-60" disabled={loading} onClick={buildBoard}>{loading ? <Loader2 className="mr-2 inline animate-spin" size={16} /> : <ClipboardList className="mr-2 inline" size={16} />} Build PanicBoard</button>
          </div>
          {loading && <div className="grid gap-2 rounded-md bg-white/70 p-3"><span className="h-3 w-4/5 animate-pulse rounded bg-slate-200" /><span className="h-3 w-3/5 animate-pulse rounded bg-slate-200" /></div>}
          {message && <p className="rounded-md bg-white/80 px-3 py-2 text-sm font-bold text-slate-700">{message}</p>}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4"><p className="text-sm font-black text-slate-500">Panic score</p><p className="text-3xl font-black">{stats.panicScore}%</p></div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4"><p className="text-sm font-black text-slate-500">Due today/tomorrow</p><p className="text-3xl font-black">{stats.todayTomorrow}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4"><p className="text-sm font-black text-slate-500">Overdue</p><p className="text-3xl font-black text-red-700">{stats.overdue}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4"><p className="text-sm font-black text-slate-500">Highest-risk class</p><p className="truncate text-3xl font-black">{stats.risk}</p></div>
      </section>

      <div id="board" className="flex scroll-mt-24 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="panic-board" className="scroll-mt-24 text-2xl font-black">Your PanicBoard</h2>
          <p className="text-sm text-slate-600">A short work plan, sorted by urgency and uncertainty.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border bg-white px-3 py-2 font-bold hover:bg-slate-50" onClick={addManualTask}><Plus size={16} className="mr-1 inline" /> Add task</button>
          <button className="rounded-md border bg-white px-3 py-2 font-bold hover:bg-slate-50" onClick={clearCompleted}><Check size={16} className="mr-1 inline" /> Clear done</button>
          <button className="rounded-md border bg-white px-3 py-2 font-bold hover:bg-slate-50" onClick={clearAll}><RotateCcw size={16} className="mr-1 inline" /> Clear all</button>
        </div>
      </div>

      {courseNames.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white/70 p-3">
          <p className="mb-2 text-xs font-black uppercase text-slate-500">Classes on board</p>
          <div className="flex flex-wrap gap-2">
            {courseNames.map((courseName) => {
              const hidden = hiddenCourses.includes(courseName);
              return (
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1" key={courseName}>
                  <button className={`text-sm font-bold ${hidden ? "text-slate-400 line-through" : "text-slate-800"}`} onClick={() => setHiddenCourses((current) => hidden ? current.filter((name) => name !== courseName) : [...current, courseName])}>
                    {courseName}
                  </button>
                  <button className="rounded px-1.5 py-0.5 text-xs font-black text-red-700 hover:bg-red-50" onClick={() => deleteCourse(courseName)}>Delete</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-6 text-center">
          <h3 className="text-xl font-black">Start with messy course info.</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">PanicBoard turns syllabus paragraphs, LMS pages, and assignment lists into a board you can act on. The fastest proof is the one-click demo.</p>
          <button className="mt-4 rounded-md bg-teal-700 px-4 py-3 font-black text-white hover:bg-teal-800" onClick={runDemo}>Run 30-second demo</button>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {buckets.map((bucket) => (
          <BucketColumn
            bucket={bucket}
            expanded={expandedBuckets.includes(bucket.id)}
            key={bucket.id}
            onEdit={setModalTask}
            onAddToCalendar={addToGoogleCalendar}
            onToggleExpanded={toggleBucketExpanded}
            onToggleTask={(id) => updateTasks(tasks.map((item) => item.id === id ? { ...item, completed: !item.completed } : item))}
          />
        ))}
      </section>

      {modalTask && <TaskModal task={modalTask} onClose={() => setModalTask(null)} onSave={(task) => { updateTasks(tasks.map((item) => item.id === task.id ? task : item)); setModalTask(null); }} onDelete={(id) => updateTasks(tasks.filter((task) => task.id !== id))} />}
    </main>
  );
}
