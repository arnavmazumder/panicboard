import type { ExtractedTask } from "./types";

function formatGoogleDate(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

export function googleCalendarUrl(task: ExtractedTask) {
  if (!task.dueDate) return null;
  const due = new Date(task.dueDate);
  const nextDay = new Date(due);
  nextDay.setDate(nextDay.getDate() + 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${task.courseName}: ${task.title}`,
    dates: `${formatGoogleDate(due)}/${formatGoogleDate(nextDay)}`,
    details: `Source: ${task.sourceName}\nStart here: ${task.suggestedFirstStep}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
