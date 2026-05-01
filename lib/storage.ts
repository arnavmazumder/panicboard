import type { BoardSource, ExtractedTask, PanicBoardState } from "./types";

const STORAGE_KEY = "panicboard:v1";

export function loadBoardState(): PanicBoardState {
  if (typeof window === "undefined") return { tasks: [], courses: [], sources: [], updatedAt: new Date().toISOString() };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: [], courses: [], sources: [], updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw) as PanicBoardState;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch {
    return { tasks: [], courses: [], sources: [], updatedAt: new Date().toISOString() };
  }
}

export function saveBoardState(tasks: ExtractedTask[], sources: BoardSource[]) {
  if (typeof window === "undefined") return;
  const courseMap = new Map<string, string[]>();
  for (const task of tasks) {
    const sources = courseMap.get(task.courseName) ?? [];
    if (!sources.includes(task.sourceName)) sources.push(task.sourceName);
    courseMap.set(task.courseName, sources);
  }
  const state: PanicBoardState = {
    tasks,
    sources,
    courses: Array.from(courseMap.entries()).map(([name, sourceNames]) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      sourceNames,
      createdAt: new Date().toISOString()
    })),
    updatedAt: new Date().toISOString()
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
