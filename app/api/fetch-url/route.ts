import { NextResponse } from "next/server";

export const runtime = "nodejs";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url) return NextResponse.json({ error: "Enter a course page URL." }, { status: 400 });
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return NextResponse.json({ error: "Use an http or https URL." }, { status: 400 });

    const response = await fetch(parsed.toString(), {
      headers: { "user-agent": "PanicBoard syllabus extractor" },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return NextResponse.json({ error: "That page could not be loaded. Paste the page text instead." }, { status: 502 });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return NextResponse.json({ error: "That URL is not a readable course page. Paste the text instead." }, { status: 415 });
    }
    const raw = await response.text();
    const text = contentType.includes("text/html") ? htmlToText(raw) : raw;
    if (text.length < 80) return NextResponse.json({ error: "The page did not contain enough readable text. Paste the course text instead." }, { status: 422 });
    return NextResponse.json({ text: text.slice(0, 60_000), sourceName: parsed.hostname });
  } catch {
    return NextResponse.json({ error: "The course page was blocked or inaccessible. Paste the page text instead." }, { status: 502 });
  }
}
