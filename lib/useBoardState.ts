"use client";

import { useEffect, useMemo, useState } from "react";
import { refreshPriorities } from "./planning";
import { loadBoardState, saveBoardState } from "./storage";
import type { BoardSource, ExtractedTask } from "./types";

export function useBoardState() {
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [sources, setSources] = useState<BoardSource[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const state = loadBoardState();
    setTasks(refreshPriorities(state.tasks));
    setSources(state.sources);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveBoardState(tasks, sources);
  }, [hydrated, sources, tasks]);

  const courses = useMemo(() => {
    const map = new Map<string, ExtractedTask[]>();
    for (const task of tasks) {
      const courseTasks = map.get(task.courseName) ?? [];
      courseTasks.push(task);
      map.set(task.courseName, courseTasks);
    }
    return Array.from(map.entries())
      .map(([name, courseTasks]) => ({ name, tasks: courseTasks }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  function updateTasks(next: ExtractedTask[]) {
    setTasks(refreshPriorities(next));
  }

  function toggleSource(sourceId: string) {
    setSources((current) => current.map((source) => (source.id === sourceId ? { ...source, enabled: !source.enabled } : source)));
  }

  function deleteSource(sourceId: string) {
    const source = sources.find((item) => item.id === sourceId);
    if (!source) return;
    setSources((current) => current.filter((item) => item.id !== sourceId));
    updateTasks(tasks.filter((task) => task.sourceName !== source.sourceName));
  }

  function deleteCourse(courseName: string) {
    updateTasks(tasks.filter((task) => task.courseName !== courseName));
  }

  return {
    courses,
    deleteCourse,
    deleteSource,
    hydrated,
    setSources,
    setTasks: updateTasks,
    sources,
    tasks,
    toggleSource
  };
}
