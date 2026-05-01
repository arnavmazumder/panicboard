import type { BucketId, EstimatedEffort, ExtractApiTask, ExtractedTask, PlanBucket, TaskType } from "./types";

const MS_PER_DAY = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntil(dueDate: string | null, currentDate = new Date()): number | null {
  if (!dueDate) return null;
  const parsed = parseDueDate(dueDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((startOfDay(parsed).getTime() - startOfDay(currentDate).getTime()) / MS_PER_DAY);
}

function parseDueDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day), 12);
  }
  return new Date(value);
}

export function isOverdue(task: Pick<ExtractedTask, "dueDate" | "completed">, currentDate = new Date()): boolean {
  const diff = daysUntil(task.dueDate, currentDate);
  return !task.completed && diff !== null && diff < 0;
}

export function scoreTask(
  input: Pick<ExtractApiTask | ExtractedTask, "dueDate" | "taskType" | "estimatedEffort" | "confidence">,
  currentDate = new Date()
): number {
  const diff = daysUntil(input.dueDate, currentDate);
  let score = 16;

  if (diff === null) score += 20;
  else if (diff < 0) score += 58;
  else if (diff === 0) score += 55;
  else if (diff === 1) score += 46;
  else if (diff <= 3) score += 36;
  else if (diff <= 7) score += 24;
  else if (diff <= 14) score += 10;

  const typeWeights: Record<TaskType, number> = {
    exam: 18,
    project: 16,
    quiz: 12,
    assignment: 10,
    discussion: 7,
    reading: 3,
    other: 5
  };
  const effortWeights: Record<EstimatedEffort, number> = {
    high: 14,
    medium: 8,
    low: 3
  };

  score += typeWeights[input.taskType] ?? 5;
  score += effortWeights[input.estimatedEffort] ?? 5;
  score += Math.round((input.confidence - 0.5) * 8);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function bucketTask(task: ExtractedTask, currentDate = new Date()): BucketId {
  const diff = daysUntil(task.dueDate, currentDate);
  if (diff === null) return "review";
  if (diff <= 1 || task.priorityScore >= 78) return "today";
  if (diff <= 7) return "week";
  return "later";
}

export function buildPlanBuckets(tasks: ExtractedTask[], currentDate = new Date()): PlanBucket[] {
  const buckets: PlanBucket[] = [
    { id: "today", title: "Today", tasks: [] },
    { id: "week", title: "This Week", tasks: [] },
    { id: "later", title: "Later", tasks: [] },
    { id: "review", title: "No Date", tasks: [] }
  ];

  for (const task of tasks) {
    buckets.find((bucket) => bucket.id === bucketTask(task, currentDate))?.tasks.push(task);
  }

  for (const bucket of buckets) {
    bucket.tasks.sort((a, b) => Number(a.completed) - Number(b.completed) || b.priorityScore - a.priorityScore);
  }

  return buckets.filter((bucket) => bucket.id !== "review" || bucket.tasks.length > 0);
}

export function normalizeExtractedTask(
  task: ExtractApiTask,
  sourceName: string,
  extractedCourseName: string | null,
  currentDate = new Date()
): ExtractedTask {
  const dueDate = task.dueDate && !Number.isNaN(parseDueDate(task.dueDate).getTime()) ? parseDueDate(task.dueDate).toISOString() : null;
  const normalized = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: task.title?.trim() || "Untitled task",
    courseName: task.courseName?.trim() || extractedCourseName?.trim() || "Course",
    sourceName,
    dueDate,
    dueDateText: task.dueDateText?.trim() || null,
    taskType: task.taskType || "other",
    estimatedEffort: task.estimatedEffort || "medium",
    priorityScore: 0,
    confidence: Math.max(0, Math.min(1, Number(task.confidence) || 0.4)),
    suggestedFirstStep: task.suggestedFirstStep?.trim() || "Open the source and confirm the requirement.",
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.filter(Boolean).slice(0, 6) : [],
    completed: false,
    createdAt: new Date().toISOString()
  } satisfies ExtractedTask;

  normalized.priorityScore = scoreTask(normalized, currentDate);
  return normalized;
}

export function refreshPriorities(tasks: ExtractedTask[], currentDate = new Date()): ExtractedTask[] {
  return tasks.map((task) => ({ ...task, priorityScore: scoreTask(task, currentDate) }));
}
