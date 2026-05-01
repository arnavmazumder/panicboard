export type TaskType = "assignment" | "exam" | "quiz" | "reading" | "project" | "discussion" | "other";
export type EstimatedEffort = "low" | "medium" | "high";
export type BucketId = "today" | "week" | "later" | "review";
export type SourceKind = "pdf" | "url" | "text" | "sample";

export interface BoardSource {
  id: string;
  sourceName: string;
  rawText: string;
  kind: SourceKind;
  enabled: boolean;
  signature: string;
  extractedAt: string | null;
}

export interface Course {
  id: string;
  name: string;
  sourceNames: string[];
  createdAt: string;
}

export interface ExtractedTask {
  id: string;
  title: string;
  courseName: string;
  sourceName: string;
  dueDate: string | null;
  dueDateText: string | null;
  taskType: TaskType;
  estimatedEffort: EstimatedEffort;
  priorityScore: number;
  confidence: number;
  suggestedFirstStep: string;
  subtasks: string[];
  completed: boolean;
  createdAt: string;
}

export interface Deadline extends ExtractedTask {
  taskType: "assignment" | "discussion" | "other";
}

export interface Exam extends ExtractedTask {
  taskType: "exam" | "quiz";
}

export interface Reading extends ExtractedTask {
  taskType: "reading";
}

export interface Project extends ExtractedTask {
  taskType: "project";
}

export interface PlanBucket {
  id: BucketId;
  title: string;
  tasks: ExtractedTask[];
}

export interface PanicBoardState {
  tasks: ExtractedTask[];
  courses: Course[];
  sources: BoardSource[];
  updatedAt: string;
}

export interface ExtractApiTask {
  title: string;
  courseName: string | null;
  dueDate: string | null;
  dueDateText: string | null;
  taskType: TaskType;
  estimatedEffort: EstimatedEffort;
  confidence: number;
  suggestedFirstStep: string;
  subtasks: string[];
}

export interface ExtractApiResponse {
  courseName: string | null;
  tasks: ExtractApiTask[];
  warnings: string[];
}
