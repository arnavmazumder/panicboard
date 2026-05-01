import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanBuckets, normalizeExtractedTask, scoreTask } from "../lib/planning.ts";
import type { ExtractApiTask } from "../lib/types.ts";

const currentDate = new Date("2026-04-30T12:00:00Z");

function task(overrides: Partial<ExtractApiTask>) {
  return normalizeExtractedTask(
    {
      title: "Default task",
      courseName: "BIO 142",
      dueDate: "2026-05-02T12:00:00Z",
      dueDateText: "May 2",
      taskType: "assignment",
      estimatedEffort: "medium",
      confidence: 0.8,
      suggestedFirstStep: "Open the assignment.",
      subtasks: [],
      ...overrides
    },
    "test",
    "BIO 142",
    currentDate
  );
}

test("priority scoring favors exams and near deadlines", () => {
  const readingScore = scoreTask({ dueDate: "2026-05-08T12:00:00Z", taskType: "reading", estimatedEffort: "low", confidence: 0.8 }, currentDate);
  const examScore = scoreTask({ dueDate: "2026-05-01T12:00:00Z", taskType: "exam", estimatedEffort: "high", confidence: 0.9 }, currentDate);
  assert.ok(examScore > readingScore);
});

test("bucketing sends today/tomorrow to Today and unknown dates to No Date", () => {
  const buckets = buildPlanBuckets(
    [
      task({ title: "Tomorrow quiz", dueDate: "2026-05-01T12:00:00Z", taskType: "quiz" }),
      task({ title: "Next week homework", dueDate: "2026-05-05T12:00:00Z" }),
      task({ title: "TBA final", dueDate: null, dueDateText: "TBA", taskType: "exam", confidence: 0.35 })
    ],
    currentDate
  );
  assert.equal(buckets.find((bucket) => bucket.id === "today")?.tasks[0].title, "Tomorrow quiz");
  assert.equal(buckets.find((bucket) => bucket.id === "week")?.tasks[0].title, "Next week homework");
  assert.equal(buckets.find((bucket) => bucket.id === "review")?.tasks[0].title, "TBA final");
});
