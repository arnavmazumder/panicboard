import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ExtractApiResponse } from "@/lib/types";

export const runtime = "nodejs";

const schemaInstruction = `Return only valid JSON with this shape:
{
  "courseName": string | null,
  "tasks": [
    {
      "title": string,
      "courseName": string | null,
      "dueDate": string | null,
      "dueDateText": string | null,
      "taskType": "assignment" | "exam" | "quiz" | "reading" | "project" | "discussion" | "other",
      "estimatedEffort": "low" | "medium" | "high",
      "confidence": number,
      "suggestedFirstStep": string,
      "subtasks": string[]
    }
  ],
  "warnings": string[]
}`;

const jsonSchema = {
  name: "panicboard_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["courseName", "tasks", "warnings"],
    properties: {
      courseName: { type: ["string", "null"] },
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "courseName",
            "dueDate",
            "dueDateText",
            "taskType",
            "estimatedEffort",
            "confidence",
            "suggestedFirstStep",
            "subtasks"
          ],
          properties: {
            title: { type: "string" },
            courseName: { type: ["string", "null"] },
            dueDate: {
              type: ["string", "null"],
              description: "YYYY-MM-DD only when explicit or directly computable from currentDate; otherwise null."
            },
            dueDateText: { type: ["string", "null"] },
            taskType: {
              type: "string",
              enum: ["assignment", "exam", "quiz", "reading", "project", "discussion", "other"]
            },
            estimatedEffort: { type: "string", enum: ["low", "medium", "high"] },
            confidence: { type: "number" },
            suggestedFirstStep: { type: "string" },
            subtasks: { type: "array", items: { type: "string" } }
          }
        }
      },
      warnings: { type: "array", items: { type: "string" } }
    }
  }
} as const;

const deadlinePattern =
  /\b(due|deadline|exam|quiz|midterm|final|project|homework|hw\b|assignment|reading|discussion|presentation|submit|lab|paper|proposal|reflection|checkpoint|credit|opens|closes|tba|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i;

function compactCourseText(rawText: string) {
  const lines = rawText
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (lines.length === 0) return rawText.slice(0, 12_000);

  const kept = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    if (!deadlinePattern.test(lines[index])) continue;
    kept.add(index);
    if (index > 0 && /course|syllabus|schedule|calendar|class|cs|cse|bio|chem|hist|psy/i.test(lines[index - 1])) kept.add(index - 1);
  }

  const compacted = (kept.size ? Array.from(kept).sort((a, b) => a - b).map((index) => lines[index]) : lines.slice(0, 40)).slice(0, 28).join("\n");
  return compacted.slice(0, 8_000);
}

function clampResponse(response: ExtractApiResponse): ExtractApiResponse {
  return {
    courseName: response.courseName ?? null,
    warnings: Array.isArray(response.warnings) ? response.warnings : [],
    tasks: Array.isArray(response.tasks)
      ? response.tasks.slice(0, 60).map((task) => ({
          title: String(task.title || "Untitled task").slice(0, 160),
          courseName: task.courseName ? String(task.courseName).slice(0, 80) : null,
          dueDate: typeof task.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : null,
          dueDateText: task.dueDateText ? String(task.dueDateText).slice(0, 80) : null,
          taskType: ["assignment", "exam", "quiz", "reading", "project", "discussion", "other"].includes(task.taskType) ? task.taskType : "other",
          estimatedEffort: ["low", "medium", "high"].includes(task.estimatedEffort) ? task.estimatedEffort : "medium",
          confidence: Math.max(0, Math.min(1, Number(task.confidence) || 0.5)),
          suggestedFirstStep: String(task.suggestedFirstStep || "Review the source and confirm the requirement.").slice(0, 180),
          subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(String).slice(0, 6) : []
        }))
      : []
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sourceName?: string; rawText?: string; currentDate?: string };
    const sourceName = body.sourceName?.trim() || "";
    const rawText = body.rawText?.trim() || "";
    const currentDate = parseCurrentDate(body.currentDate);

    if (!sourceName) return NextResponse.json({ error: "sourceName is required." }, { status: 400 });
    if (!rawText) return NextResponse.json({ error: "Paste or upload course text first." }, { status: 400 });
    if (rawText.length > 80_000) return NextResponse.json({ error: "That source is too large. Try a syllabus section or assignment page under 80k characters." }, { status: 413 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server." }, { status: 503 });
    }

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create(
        {
          model: `gpt-4o-${"mini"}`,
          response_format: { type: "json_schema", json_schema: jsonSchema },
          temperature: 0.1,
          max_tokens: 1800,
          messages: [
            {
              role: "system",
              content:
                "You are extracting student deadlines from syllabus/course text. Return only valid JSON matching the schema. Extract at most 25 important due dates, deadlines, exams, quizzes, midterms, finals, projects, homework/HW, readings, discussions, and class obligations. Preserve uncertainty. Do not invent dates. Use YYYY-MM-DD only when a date is explicit or directly computable from currentDate. If a date is vague, include dueDateText, set dueDate null, and use confidence below 0.6. For courseName, prefer the stable course identifier if present, such as CSE 452, BIO 142, CHEM 201, or HIST 88. If the text clearly contains multiple different courses, keep each task's real courseName. If the text is not a syllabus, course calendar, LMS page, assignment list, or class schedule with actionable student obligations, return courseName null, tasks [], and a warning that no student deadlines or obligations were found."
            },
            {
              role: "user",
              content: `Current date: ${currentDate ? currentDate.toISOString().slice(0, 10) : "not provided"}
Source name: ${sourceName}
${schemaInstruction}

Course text:
${compactCourseText(rawText)}`
            }
          ]
        },
        { timeout: 24_000, maxRetries: 0 }
      );
      const content = completion.choices[0]?.message.content || "{}";
      return NextResponse.json(clampResponse(JSON.parse(content) as ExtractApiResponse));
    } catch (error) {
      console.error("OpenAI extraction failed:", error);
      return NextResponse.json({ error: "OpenAI extraction failed. Check your API key, model, and network connection, then try again." }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Could not process that source." }, { status: 400 });
  }
}

function parseCurrentDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
