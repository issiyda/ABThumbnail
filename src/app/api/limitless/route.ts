import { NextResponse } from "next/server";
import { generateImage } from "../../../lib/nanobanana";

type Mode = "daily" | "weekly";

interface LimitlessContentBlock {
  type?: string;
  content?: string;
  speakerName?: string;
}

interface LimitlessLog {
  id?: string;
  title?: string;
  startedAt?: string;
  createdAt?: string;
  markdown?: string;
  text?: string;
  contents?: LimitlessContentBlock[];
}

interface TimeRange {
  start: string;
  end: string;
  label: string;
  days: number;
}

interface SummaryResult {
  headline: string;
  summary: string;
  highlights: string[];
  lessons: string[];
  actions: string[];
  keywords: string[];
  imagePrompt?: string;
}

interface NormalizedLog {
  id: string;
  title: string;
  time: string;
  preview: string;
}

const LIMITLESS_ENDPOINT = "https://api.limitless.ai/v1/lifelogs";
const TIMEZONE = "Asia/Tokyo";
const MODEL = "gemini-3-pro-preview";
const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

function toJst(date: Date) {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + 9 * 60 * 60000);
}

function parseJstDate(input?: string) {
  if (!input) return undefined;
  // 12:00 固定でパースし、日付のズレを防ぐ
  const parsed = new Date(`${input}T12:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return toJst(parsed);
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildRange(mode: Mode, date?: string): TimeRange {
  const nowJst = toJst(new Date());
  const targetJst =
    parseJstDate(date) ||
    new Date(nowJst.getTime() - 24 * 60 * 60 * 1000); // default: yesterday JST

  const end = targetJst;
  const start = new Date(
    targetJst.getTime() - (mode === "weekly" ? 6 : 0) * 24 * 60 * 60 * 1000
  );

  const startLabel = formatDate(start);
  const endLabel = formatDate(end);

  return {
    start: `${startLabel} 00:00:00`,
    end: `${endLabel} 23:59:59`,
    label: mode === "weekly" ? `${startLabel}〜${endLabel}` : endLabel,
    days: mode === "weekly" ? 7 : 1,
  };
}

function renderBlock(block: LimitlessContentBlock) {
  if (!block) return "";
  const content = (block.content || "").trim();
  if (!content) return "";
  if (block.type === "heading1") return `# ${content}`;
  if (block.type === "heading2") return `## ${content}`;
  if (block.type === "heading3") return `### ${content}`;
  if (block.type === "blockquote") {
    const prefix = block.speakerName ? `- ${block.speakerName}: ` : "> ";
    return `${prefix}${content}`;
  }
  if (block.type === "list_item") return `- ${content}`;
  return content;
}

function logToText(log: LimitlessLog) {
  const parts: string[] = [];
  const title = log.title?.trim() || "Untitled";
  const time = log.startedAt || log.createdAt || "Unknown time";
  parts.push(`### ${title}`);
  parts.push(`time: ${time}`);

  if (log.markdown) {
    parts.push(log.markdown.trim());
  } else if (log.contents?.length) {
    parts.push(
      log.contents
        .map((block) => renderBlock(block))
        .filter(Boolean)
        .join("\n")
    );
  } else if (log.text) {
    parts.push(log.text.trim());
  }

  return parts.filter(Boolean).join("\n");
}

async function fetchLimitlessLogs(range: TimeRange): Promise<LimitlessLog[]> {
  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LIMITLESS_API_KEY is not set. Add it to your .env.local to enable log fetching."
    );
  }

  const url = `${LIMITLESS_ENDPOINT}?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}&timezone=${encodeURIComponent(TIMEZONE)}&includeMarkdown=true&includeHeadings=false&includeContents=true&limit=400`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Limitless request failed: ${res.status} ${res.statusText} ${text.slice(0, 500)}`
    );
  }

  try {
    const json = JSON.parse(text);
    const logs = json?.data?.lifelogs || json?.lifelogs || [];
    if (!Array.isArray(logs)) return [];
    return logs as LimitlessLog[];
  } catch (error) {
    console.warn("Failed to parse Limitless response", error);
    return [];
  }
}

function buildLogDigest(logs: LimitlessLog[], range: TimeRange) {
  const rendered = logs.map((log) => logToText(log)).filter(Boolean);
  const digest = rendered.join("\n\n---\n\n");
  const truncated = digest.slice(0, 20000);
  return `## Limitless logs (${range.label} JST)\n\n${truncated}`;
}

function normalizeLogs(logs: LimitlessLog[]): NormalizedLog[] {
  return logs.map((log, idx) => {
    const id =
      log.id ||
      `${log.startedAt || log.createdAt || "log"}-${(log.title || "t").slice(0, 24)}-${idx}`;
    const previewText = logToText(log).replace(/\s+/g, " ").slice(0, 420);
    const time = log.startedAt || log.createdAt || "Unknown time";
    const title = log.title?.trim() || `Log ${idx + 1}`;
    return {
      id,
      title,
      time,
      preview: previewText,
    };
  });
}

function extractJsonBlock(text?: string | null) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "").trim();
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) return cleaned;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 1);
  }
  return null;
}

async function summarizeWithGemini(
  logs: LimitlessLog[],
  range: TimeRange,
  mode: Mode,
  apiKey?: string
): Promise<SummaryResult> {
  const fallback = buildFallbackSummary(logs, range, mode);
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!key) return fallback;

  const digest = buildLogDigest(logs, range);
  if (!digest.trim()) return fallback;

  const prompt = `
あなたは知識整理と学習支援に特化した編集者です。
以下の Limitless ログから、${range.label} の${mode === "daily" ? "1日" : "1週間"}を振り返り、学びにフォーカスした要約を作成してください。

必ず以下のJSON形式のみで出力してください（マークダウン禁止）:
{
  "headline": "学びが伝わる日本語のタイトル",
  "summary": "全体像を80-140字で要約",
  "highlights": ["主要な出来事やトピックを3-6件、日本語"],
  "lessons": ["学習・気づき・再現性のあるノウハウを3-6件、日本語"],
  "actions": ["次に試す/改善することを2-4件、日本語"],
  "keywords": ["検索用キーワードを3-8個、単語で"],
  "image_prompt": "上記をもとに日本語テキスト入りの学習用インフォグラフィックを作るための英語プロンプト。構図やアイコン、色（#3181FC基調）、日本語テキスト指定を明記。"
}

重視すること:
- 学び・再現性・気づきに絞り、日常雑談は除外
- 重複はまとめ、具体的な名詞を優先
- すべてのテキストは日本語。image_prompt内での生成指示は英語で書き、画像内に表示する文字が日本語になるよう明記

===== LOGS =====
${digest}
`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.warn(
      "Gemini summary request failed",
      response.status,
      await response.text()
    );
    return fallback;
  }

  const data = (await response.json()) as any;
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.toString() || "";
  const jsonString = extractJsonBlock(text);
  if (!jsonString) return fallback;

  try {
    const parsed = JSON.parse(jsonString);
    return {
      headline: parsed.headline || fallback.headline,
      summary: parsed.summary || fallback.summary,
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.filter(Boolean)
        : fallback.highlights,
      lessons: Array.isArray(parsed.lessons)
        ? parsed.lessons.filter(Boolean)
        : fallback.lessons,
      actions: Array.isArray(parsed.actions)
        ? parsed.actions.filter(Boolean)
        : fallback.actions,
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter(Boolean)
        : fallback.keywords,
      imagePrompt: parsed.image_prompt || fallback.imagePrompt,
    };
  } catch (error) {
    console.warn("Failed to parse Gemini summary JSON", error, jsonString);
    return fallback;
  }
}

function buildFallbackSummary(
  logs: LimitlessLog[],
  range: TimeRange,
  mode: Mode
): SummaryResult {
  const topics = logs
    .map((log) => log.title || log.text || log.markdown || "")
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 6);

  const headline =
    topics.length > 0
      ? `${range.label}の${mode === "daily" ? "学びハイライト" : "週次学びハイライト"}`
      : `${range.label}の${mode === "daily" ? "ログなし" : "週次ログなし"}`;

  const lessons =
    topics.length > 0
      ? topics.map((t, idx) => `${idx + 1}. ${t.slice(0, 120)}`)
      : ["学習ログが取得できませんでした。"];

  const imagePrompt = [
    "Design a Japanese learning infographic card focused on key lessons.",
    `Date label: ${range.label} (JST)`,
    `Highlights: ${lessons.join(" / ")}`,
    "Style: clean infographic, bold Japanese typography, icons per bullet, blue and white palette (#3181FC base), soft gradients.",
    "Ensure all on-image text is in Japanese and easy to read.",
  ].join(" | ");

  return {
    headline,
    summary:
      topics.length > 0
        ? `${topics.slice(0, 3).join(" / ")}...`
        : "Limitless ログが取得できませんでした。",
    highlights: topics.slice(0, 4),
    lessons,
    actions: [],
    keywords: [],
    imagePrompt,
  };
}

function buildImagePrompt(
  summary: SummaryResult,
  range: TimeRange,
  mode: Mode
) {
  const base = summary.imagePrompt
    ? summary.imagePrompt.trim()
    : [
        "Learning infographic, Japanese text only, clean grid layout, bold headline, 4-5 concise bullet chips, icons for each bullet",
        "Color: #3181FC primary with white background, subtle glassmorphism and soft shadow cards",
        "Aspect ratio 16:9, high resolution, crisp typography, minimal clutter",
        `Headline in Japanese: ${summary.headline}`,
        `Insert date label ${range.label} (${mode === "daily" ? "1日のまとめ" : "週次まとめ"})`,
        "Readable font weight, prioritize clarity over decoration",
      ].join(" | ");

  const lessons =
    summary.lessons.length > 0
      ? summary.lessons.slice(0, 5).join(" / ")
      : summary.highlights.slice(0, 5).join(" / ");

  return [
    base,
    lessons && `Key bullets: ${lessons}`,
    "IMPORTANT: All text content displayed within the generated image must be in Japanese. This includes titles, labels, captions, CTA buttons, and any other text elements.",
  ]
    .filter(Boolean)
    .join(" | ");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode: Mode =
      body?.mode === "weekly" || body?.mode === "daily" ? body.mode : "daily";
    const range = buildRange(mode, body?.date);
    const geminiApiKey =
      typeof body?.geminiApiKey === "string" ? body.geminiApiKey : undefined;
    const nanoApiKey =
      typeof body?.nanoApiKey === "string" ? body.nanoApiKey : undefined;
    const previewOnly = Boolean(body?.previewOnly);
    const selectedIds: string[] = Array.isArray(body?.selectedIds)
      ? body.selectedIds.map((v: unknown) => String(v))
      : [];

    const logs = await fetchLimitlessLogs(range);
    const normalizedLogs = normalizeLogs(logs);

    if (previewOnly) {
      return NextResponse.json(
        {
          mode,
          range,
          logCount: logs.length,
          logs: normalizedLogs,
        },
        { status: 200 }
      );
    }

    const filteredLogs =
      selectedIds.length > 0
        ? logs.filter((_, idx) => {
            const normalized = normalizedLogs[idx];
            return normalized && selectedIds.includes(normalized.id);
          })
        : logs;

    if (filteredLogs.length === 0) {
      return NextResponse.json(
        {
          error: "No logs selected",
          message: "選択されたログがありません。ログを選んで再実行してください。",
        },
        { status: 400 }
      );
    }

    const summary = await summarizeWithGemini(
      filteredLogs,
      range,
      mode,
      geminiApiKey
    );
    const imagePrompt = buildImagePrompt(summary, range, mode);

    const image = await generateImage(
      imagePrompt,
      undefined,
      nanoApiKey || geminiApiKey,
      undefined,
      undefined,
      undefined,
      { aspectRatio: "16:9", imageSize: "1K" }
    );

    return NextResponse.json(
      {
        mode,
        range,
        logCount: logs.length,
        summary,
        imagePrompt,
        image,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Limitless summary API error", error);
    return NextResponse.json(
      {
        error: "Failed to create summary",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
