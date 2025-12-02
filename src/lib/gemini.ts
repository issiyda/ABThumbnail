import { GoogleGenAI } from "@google/genai";
import type {
  EvaluationResult,
  PromptRequest,
  LpPlan,
  LpSectionPlan,
  MangaPanelPlan,
  MangaStoryPlan,
  MangaTemplate,
  SlidePlanItem,
  SlideTemplate,
} from "../types";

const SYSTEM_PROMPT = `You are an expert AI Prompt Engineer for the "NanoBanana" image generation model.
Your task is to convert the user's request into a highly optimized English prompt for generating a YouTube thumbnail.

Instructions:
1. Follow the provided template structure strictly.
2. Add strong visual keywords (8k, ultra sharp, cinematic lighting, trending on artstation).
3. If reference image exists, mention to align composition with it.
4. IMPORTANT: All text content displayed within the generated image must be in Japanese. This includes titles, labels, captions, and any other text elements. Only tool names or technical terms that are commonly used in English (like "YouTube", "Instagram", etc.) may remain in English if necessary.
5. Output ONLY the final prompt string.`;

const GEMINI_TEXT_MODEL = "gemini-3-pro-preview";
const GEMINI_VISION_MODEL = "gemini-3-pro-preview";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const LP_PLAN_PROMPT = `You are a bilingual (Japanese + English) conversion-focused landing page planner.
Analyze the provided LP brief and output ONLY valid JSON (no markdown fences) that follows this schema:
{
  "theme": "overall visual direction in Japanese",
  "tone": "copy tone and mood in Japanese",
  "palette": ["up to five color hex codes or color names"],
  "sections": [
    {
      "id": "kebab-case identifier",
      "title": "section title in Japanese",
      "goal": "section goal in Japanese",
      "visualStyle": "description in English for composition/layout",
      "prompt": "English visual prompt for NanoBanana/Gemini image generation",
      "copy": "key copy or hook in Japanese",
      "cta": "call to action label in Japanese (optional, empty string ok)"
    }
  ]
}
  Constraints:
  - Return 10-15 sections to fully cover the detailed structure of the provided brief.
  - First section must be a hero, last one a CTA/closing.
  - The prompt should mention layout elements (UI mockups, typography, etc.) and 9:16 vertical scrolling frame.
- IMPORTANT: In the "prompt" field, explicitly instruct that all text content displayed within the generated image must be in Japanese. This includes titles, labels, captions, CTA buttons, and any other text elements. Only tool names or technical terms that are commonly used in English (like "YouTube", "Instagram", etc.) may remain in English if necessary.
- Use concise UTF-8 text, no markdown, no explanations.`;

const SLIDE_PLAN_PROMPT = `You are a presentation slide planner for a NanoBanana (Gemini image) workflow.
Convert the pasted outline into ONLY a JSON array (no markdown fences) following this schema:
[
  {
    "id": 1,
    "templateId": "intro",
    "title": "Japanese headline",
    "body": ["Japanese bullet or line", "another line"],
    "notes": "Japanese description of what to depict",
    "tone": "Japanese tone keywords",
    "emphasis": "Japanese text to enlarge",
    "cta": "Japanese CTA label or empty string",
    "carryOver": "Japanese note describing characters/colors to keep consistent in the next slide",
    "keywords": ["English visual keywords for style/lighting"]
  }
]
Rules:
- Use only the provided templateId options.
- Keep bullet body to 2-4 lines, concise, Japanese.
- Respect TARGET_SLIDE_COUNT (±1) and keep narrative order: opening -> core points -> examples/proof -> closing/CTA.
- First slide should anchor the motif (character/color/icon) and mention it in carryOver for downstream consistency.
- No markdown, no extra text outside the JSON array.`;

const MANGA_STORY_PROMPT = `You are a manga landing page planner who breaks a provided brief into panel-level instructions.
Return ONLY a JSON object (no markdown fences) that follows this schema:
{
  "title": "series or story title in Japanese",
  "theme": "overall theme in Japanese",
  "characters": {
    "protagonist": "main character description in Japanese",
    "style": "art style or visual look in Japanese"
  },
  "panels": [
    {
      "id": "kebab or numeric id",
      "templateId": "one of the provided template ids",
      "narrativePhase": "intro|rise|fall|climax|resolution",
      "description": "what to draw in this panel (Japanese)",
      "dialogue": "speech bubble text in Japanese",
      "narration": "narration in Japanese",
      "tone": "emotional tone such as 希望/絶望/決意/安堵",
      "visualKeywords": ["English style/lighting keywords"]
    }
  ]
}
Story constraints:
- Emotion should swing like a roller coaster: desperate poverty or struggle -> breakthrough discovery -> first success -> setback/failure -> recovery with scars -> final hopeful momentum.
- Keep protagonist appearance and color motif consistent across panels; mention carry-over cues in narration if needed.
- Prioritize Japanese text for dialogue/narration; English only for style keywords.`;

async function callGemini<T>(
  model: string,
  payload: unknown,
  apiKey?: string
): Promise<T> {
  const key = apiKey?.trim();
  if (!key) throw new Error("Gemini apiKey missing");

  const endpoint = `${GEMINI_BASE}/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Gemini request failed: ${response.status} ${response.statusText} ${text}`
    );
  }

  return response.json() as Promise<T>;
}

async function toInlineData(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const [meta, data] = imageUrl.split(",");
    const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
    return { mimeType: mime, data };
  }

  // Fetch remote image and convert to base64 for the Vision API
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image for evaluation: ${res.statusText}`);
  }
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");

  return { mimeType: blob.type || "image/png", data: base64 };
}

export async function generatePrompt(
  request: PromptRequest,
  apiKey?: string
): Promise<string> {
  const referenceInfo = [];
  if (request.hasReference) {
    referenceInfo.push("Main reference image provided");
  }
  if (request.hasColorReference) {
    referenceInfo.push("Color reference image provided");
  }
  if (request.hasFaceReference) {
    referenceInfo.push("Face reference image provided");
  }
  if (request.hasLayoutReference) {
    referenceInfo.push("Layout reference image provided");
  }

  const fallback = [
    `Template: ${request.templateName}`,
    `Structure: ${request.templateStructure}`,
    `User text: ${request.text}`,
    `Color/Vibe: ${request.vibe || "free"}`,
    referenceInfo.length > 0
      ? `Reference images: ${referenceInfo.join(", ")}`
      : "No reference images provided.",
    "add: 8k, high resolution, cinematic light, bold typography, trending on artstation",
    "IMPORTANT: All text content displayed within the generated image must be in Japanese. This includes titles, labels, captions, and any other text elements. Only tool names or technical terms that are commonly used in English (like 'YouTube', 'Instagram', etc.) may remain in English if necessary.",
  ].join(" | ");

  const referenceText =
    referenceInfo.length > 0
      ? referenceInfo.join(", ")
      : "No reference images provided";

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}

Template Type: ${request.templateName} - ${request.templateStructure}
User Text: ${request.text}
Color/Vibe: ${request.vibe || "free"}
Reference Images: ${referenceText}`,
          },
        ],
      },
    ],
  };

  try {
    const data = await callGemini<{ candidates?: any[] }>(
      GEMINI_TEXT_MODEL,
      payload,
      apiKey
    );
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallback;
    return text;
  } catch (error) {
    console.warn("Gemini prompt generation fallback", error);
    return fallback;
  }
}

export async function evaluateImage(
  imageUrl: string,
  apiKey?: string
): Promise<EvaluationResult> {
  const quickHeuristics: EvaluationResult = {
    score: Math.round(6 + Math.random() * 4),
    advice: "Boost contrast on keywords, keep face brighter, tighten spacing.",
  };

  if (!apiKey) return quickHeuristics;

  try {
    const inlineData = await toInlineData(imageUrl);

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Give a click-through prediction score (1-10) and one-sentence improvement advice for this thumbnail.",
            },
            {
              inlineData,
            },
          ],
        },
      ],
    };

    const data = await callGemini<{ candidates?: any[] }>(
      GEMINI_VISION_MODEL,
      payload,
      apiKey
    );
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      `${quickHeuristics.score}/10 - ${quickHeuristics.advice}`;
    const match = text.match(
      /(\d+(?:\.\d+)?)\s*\/\s*10|score\s*(\d+(?:\.\d+)?)/i
    );
    const score = match
      ? Math.min(10, Math.max(1, parseFloat(match[1] || match[2])))
      : quickHeuristics.score;

    return { score, advice: text };
  } catch (error) {
    console.warn("Gemini evaluation fallback", error);
    return quickHeuristics;
  }
}

/**
 * base64画像データをinlineData形式に変換するヘルパー関数
 */
function toInlineDataFromBase64(imageBase64: string) {
  const base64Data = imageBase64.includes(",")
    ? imageBase64.split(",")[1]
    : imageBase64;
  const mimeType = imageBase64.match(/data:([^;]+)/)?.[1] || "image/png";
  return {
    inlineData: {
      mimeType,
      data: base64Data,
    },
  };
}

/**
 * Gemini APIを使用して画像を生成します（Nano Banana）
 * @param prompt - 画像生成用のプロンプト
 * @param apiKey - Gemini APIキー
 * @param referenceImageBase64 - オプション: リファレンス画像（base64形式）
 * @param model - 使用するモデル（デフォルト: "gemini-2.5-flash-image"）
 * @param aspectRatio - オプション: アスペクト比（例: "1:1", "16:9", "9:16"）
 * @param imageSize - オプション: 画像サイズ（例: "1K", "2K", "4K"）
 * @param colorReferenceImage - オプション: 色味の参考画像（base64形式）
 * @param faceReferenceImage - オプション: 顔写真の参考画像（base64形式）
 * @param layoutReferenceImage - オプション: レイアウトの参考画像（base64形式）
 * @returns 生成された画像のbase64データURI
 */
export async function generateImageWithGemini(
  prompt: string,
  apiKey?: string,
  referenceImageBase64?: string,
  model:
    | "gemini-2.5-flash-image"
    | "gemini-3-pro-image-preview" = "gemini-2.5-flash-image",
  aspectRatio?: string,
  imageSize?: string,
  colorReferenceImage?: string,
  faceReferenceImage?: string,
  layoutReferenceImage?: string
): Promise<string> {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error("Gemini apiKey missing");
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: key,
    });

    // contentsの構築
    // 複数の参考画像がある場合は配列で、ない場合は文字列のみ
    let contents: string | any[];
    const referenceImages: any[] = [];

    // 各参考画像を追加
    if (referenceImageBase64) {
      referenceImages.push(toInlineDataFromBase64(referenceImageBase64));
    }
    if (colorReferenceImage) {
      referenceImages.push(toInlineDataFromBase64(colorReferenceImage));
    }
    if (faceReferenceImage) {
      referenceImages.push(toInlineDataFromBase64(faceReferenceImage));
    }
    if (layoutReferenceImage) {
      referenceImages.push(toInlineDataFromBase64(layoutReferenceImage));
    }

    if (referenceImages.length > 0) {
      // 参考画像がある場合は、画像とプロンプトを組み合わせた配列を作成
      // プロンプトに参考画像の説明を追加
      let enhancedPrompt = prompt;
      if (colorReferenceImage) {
        enhancedPrompt +=
          " | Use the color palette and color scheme from the color reference image.";
      }
      if (faceReferenceImage) {
        enhancedPrompt +=
          " | Use the facial features and style from the face reference image.";
      }
      if (layoutReferenceImage) {
        enhancedPrompt +=
          " | Follow the layout and composition structure from the layout reference image.";
      }
      // 日本語出力の指示が含まれていない場合は追加
      if (
        !enhancedPrompt.includes(
          "All text content displayed within the generated image must be in Japanese"
        )
      ) {
        enhancedPrompt +=
          " | IMPORTANT: All text content displayed within the generated image must be in Japanese. This includes titles, labels, captions, CTA buttons, and any other text elements. Only tool names or technical terms that are commonly used in English (like 'YouTube', 'Instagram', etc.) may remain in English if necessary.";
      }

      contents = [...referenceImages, enhancedPrompt];
    } else {
      // 参考画像がない場合も、プロンプトに日本語出力の指示が含まれていない場合は追加
      let finalPrompt = prompt;
      if (
        !finalPrompt.includes(
          "All text content displayed within the generated image must be in Japanese"
        )
      ) {
        finalPrompt +=
          " | IMPORTANT: All text content displayed within the generated image must be in Japanese. This includes titles, labels, captions, CTA buttons, and any other text elements. Only tool names or technical terms that are commonly used in English (like 'YouTube', 'Instagram', etc.) may remain in English if necessary.";
      }
      contents = finalPrompt;
    }

    // configパラメータの構築
    const config: any = {
      responseModalities: ["TEXT", "IMAGE"],
    };

    // imageConfigを追加（aspectRatioまたはimageSizeが指定されている場合）
    if (aspectRatio || imageSize) {
      config.imageConfig = {};
      if (aspectRatio) {
        config.imageConfig.aspectRatio = aspectRatio;
      }
      if (imageSize) {
        config.imageConfig.imageSize = imageSize;
      }
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    // レスポンスから画像データを取得
    // response.candidates[0].content.partsの構造で処理
    if (
      response.candidates &&
      Array.isArray(response.candidates) &&
      response.candidates.length > 0 &&
      response.candidates[0]?.content?.parts
    ) {
      const parts = response.candidates[0].content.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.text) {
            // テキストレスポンスがある場合（エラーメッセージなど）
            console.warn("Gemini image generation returned text:", part.text);
          } else if (part.inlineData) {
            // 画像データを取得
            const mimeType = part.inlineData.mimeType || "image/png";
            const base64Data = part.inlineData.data;
            return `data:${mimeType};base64,${base64Data}`;
          }
        }
      }
    }

    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Gemini image generation error", error);
    throw error;
  }
}

function toSlug(value: string, fallback: string) {
  if (!value) return fallback;
  const slug = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function extractJsonBlock(text?: string | null) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "```").trim();
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    return cleaned;
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 1);
  }
  return null;
}

function createFallbackPlan(rawInput: string): LpPlan {
  const lines = rawInput
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headline = lines[0] || "新しいプロダクト";
  const detail = lines.slice(1).join(" ").slice(0, 140) || headline;
  const basePrompt =
    "High fidelity landing page section mockup, layered cards, neumorphic shadows, glassmorphic highlights, premium typography, 9:16 vertical canvas, cinematic gradient background, responsive web UI";
  const japaneseTextInstruction =
    "IMPORTANT: All text content displayed within the generated image must be in Japanese. This includes titles, labels, captions, CTA buttons, and any other text elements. Only tool names or technical terms that are commonly used in English (like 'YouTube', 'Instagram', etc.) may remain in English if necessary.";

  const sections: LpSectionPlan[] = [
    {
      id: "hero",
      title: "ヒーローセクション",
      goal: "ファーストビューで価値とCTAを明確に伝える",
      visualStyle:
        "Floating device mockups, strong hero typography, gradient sky, subtle grid, top navigation",
      prompt: `${basePrompt} | HERO layout for ${headline} | show oversized headline text, CTA pill buttons, product screenshot frames, ambient light | ${japaneseTextInstruction}`,
      copy: headline,
      cta: "今すぐ始める",
    },
    {
      id: "problem",
      title: "課題提起",
      goal: "ターゲットが抱える課題・痛みを整理し共感を得る",
      visualStyle:
        "Split cards highlighting pain points, muted background, highlighted warning tags",
      prompt: `${basePrompt} | PROBLEM section for ${headline} | stack cards describing pains, use contrasting warning colors, include caption icons | ${japaneseTextInstruction}`,
      copy: detail || `${headline} が解決する課題`,
    },
    {
      id: "solution",
      title: "ソリューション & 価値訴求",
      goal: "サービスの仕組みとベネフィットを段階的に説明する",
      visualStyle:
        "Step-by-step flow with arrows, glowing highlight behind main panel, clean white cards",
      prompt: `${basePrompt} | SOLUTION section for ${headline} | illustrate 3-step workflow with arrows, include UI overlays and benefit callouts | ${japaneseTextInstruction}`,
      copy: "3ステップで成果を実現",
    },
    {
      id: "proof",
      title: "証拠 / 社会的証明",
      goal: "導入実績や声を示し信頼を強化する",
      visualStyle:
        "Testimonial cards, avatar chips, rating stars, press logos, soft shadows",
      prompt: `${basePrompt} | SOCIAL PROOF section for ${headline} | grid of testimonials, avatars, 5-star badges, featured logos | ${japaneseTextInstruction}`,
      copy: "導入企業・ユーザーの声",
    },
    {
      id: "cta",
      title: "クローズ / CTA",
      goal: "最後の後押しとコンバージョン行動を促す",
      visualStyle:
        "Bold centered CTA card, contrasting gradient background, floating sparkles",
      prompt: `${basePrompt} | CTA section for ${headline} | centered big CTA card, countdown badge, supportive text, background gradient | ${japaneseTextInstruction}`,
      copy: "今すぐ無料で試す",
      cta: "無料で試す",
    },
  ];

  return {
    theme: `${headline} LP`,
    tone: "信頼感があり前向きなトーン",
    palette: ["#0EA5E9", "#F97316", "#0F172A", "#FDE68A"],
    sections,
  };
}

function normalizeLpPlan(candidate: any, fallback: LpPlan): LpPlan {
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  const palette =
    Array.isArray(candidate.palette) && candidate.palette.length > 0
      ? candidate.palette
          .map((color: unknown) => String(color || "").trim())
          .filter(Boolean)
          .slice(0, 5)
      : fallback.palette;

  const sectionsSource: any[] = Array.isArray(candidate.sections)
    ? candidate.sections
    : [];

  const sections: LpSectionPlan[] =
    sectionsSource.length > 0
      ? sectionsSource.map((section, index) => {
          const fallbackSection =
            fallback.sections[index] ||
            fallback.sections[fallback.sections.length - 1];
          const idSource =
            section?.id ||
            section?.slug ||
            section?.title ||
            `section-${index}`;
          return {
            id: toSlug(idSource, `section-${index + 1}`),
            title:
              typeof section?.title === "string" && section.title.trim()
                ? section.title.trim()
                : fallbackSection.title,
            goal:
              typeof section?.goal === "string" && section.goal.trim()
                ? section.goal.trim()
                : typeof section?.purpose === "string" && section.purpose.trim()
                  ? section.purpose.trim()
                  : fallbackSection.goal,
            visualStyle:
              typeof section?.visualStyle === "string" &&
              section.visualStyle.trim()
                ? section.visualStyle.trim()
                : typeof section?.style === "string" && section.style.trim()
                  ? section.style.trim()
                  : fallbackSection.visualStyle,
            prompt:
              typeof section?.prompt === "string" && section.prompt.trim()
                ? section.prompt.trim()
                : typeof section?.visualPrompt === "string" &&
                    section.visualPrompt.trim()
                  ? section.visualPrompt.trim()
                  : fallbackSection.prompt,
            copy:
              typeof section?.copy === "string" && section.copy.trim()
                ? section.copy.trim()
                : typeof section?.headline === "string" &&
                    section.headline.trim()
                  ? section.headline.trim()
                  : fallbackSection.copy,
            cta:
              typeof section?.cta === "string" && section.cta.trim()
                ? section.cta.trim()
                : fallbackSection.cta,
          };
        })
      : fallback.sections;

  return {
    theme:
      typeof candidate.theme === "string" && candidate.theme.trim()
        ? candidate.theme.trim()
        : fallback.theme,
    tone:
      typeof candidate.tone === "string" && candidate.tone.trim()
        ? candidate.tone.trim()
        : fallback.tone,
    palette,
    sections,
  };
}

export async function generateLpPlan(
  lpText: string,
  apiKey?: string
): Promise<LpPlan> {
  const fallback = createFallbackPlan(lpText);
  const key = apiKey?.trim();
  if (!key) {
    return fallback;
  }

  const brief = lpText.trim().slice(0, 6000) || "LP brief not provided.";

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${LP_PLAN_PROMPT}

LP BRIEF (Japanese allowed):
"""${brief}"""`,
          },
        ],
      },
    ],
  };

  try {
    const data = await callGemini<{ candidates?: any[] }>(
      GEMINI_TEXT_MODEL,
      payload,
      key
    );
    const text =
      data?.candidates
        ?.flatMap(
          (candidate: any) =>
            candidate?.content?.parts?.map((part: any) => part.text) || []
        )
        .filter(Boolean)
        .join("\n") || "";
    const jsonString = extractJsonBlock(text);
    if (!jsonString) {
      return fallback;
    }
    const parsed = JSON.parse(jsonString);
    return normalizeLpPlan(parsed, fallback);
  } catch (error) {
    console.warn("Gemini LP plan fallback", error);
    return fallback;
  }
}

function normalizeMangaPanel(
  candidate: any,
  templates: MangaTemplate[],
  index: number
): MangaPanelPlan {
  const templateIds = new Set(templates.map((tpl) => tpl.id));
  const fallbackTemplateId = templates[index % templates.length]?.id || "hero-single";
  const phaseOptions = ["intro", "rise", "fall", "climax", "resolution"] as const;
  const phase =
    phaseOptions.find((item) => item === candidate?.narrativePhase) ||
    phaseOptions[index] ||
    "intro";

  const toLines = (value: unknown) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : String(item)))
        .filter(Boolean)
        .slice(0, 6);
    }
    if (typeof value === "string") {
      return value
        .split(/[,、\n]/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 6);
    }
    return [] as string[];
  };

  return {
    id: toSlug(candidate?.id, `panel-${index + 1}`),
    templateId: templateIds.has(candidate?.templateId)
      ? candidate.templateId
      : fallbackTemplateId,
    narrativePhase: phase,
    description:
      typeof candidate?.description === "string" && candidate.description.trim()
        ? candidate.description.trim()
        : "感情を大きく描写するシーン。",
    dialogue:
      typeof candidate?.dialogue === "string" && candidate.dialogue.trim()
        ? candidate.dialogue.trim()
        : "「ここから逆転する！」",
    narration:
      typeof candidate?.narration === "string" && candidate.narration.trim()
        ? candidate.narration.trim()
        : "運命が少しだけ動き始めた。",
    tone:
      typeof candidate?.tone === "string" && candidate.tone.trim()
        ? candidate.tone.trim()
        : "決意",
    visualKeywords: toLines(candidate?.visualKeywords).length
      ? toLines(candidate.visualKeywords)
      : ["dramatic lighting", "inked style", "high contrast"],
  };
}

function createFallbackMangaStory(
  rawInput: string,
  templates: MangaTemplate[]
): MangaStoryPlan {
  const headline = rawInput.split(/\n+/)[0]?.trim() || "逆転ストーリー";
  const templatePool: Array<Pick<MangaTemplate, "id">> =
    templates.length > 0
      ? templates
      : [
          { id: "hero-single" },
          { id: "duo-contrast" },
          { id: "quad-progress" },
          { id: "dialogue-focus" },
          { id: "background-mood" },
        ];
  const phases: Array<{
    phase: MangaPanelPlan["narrativePhase"];
    desc: string;
    tone: string;
    dialogue: string;
  }> = [
    {
      phase: "intro",
      desc: "極貧で苦しむ主人公が小さな希望を探す。",
      tone: "絶望",
      dialogue: "「もう後がない…」",
    },
    {
      phase: "rise",
      desc: "ある思想や出会いで光を掴み必死に挑戦を始める。",
      tone: "希望",
      dialogue: "「これが突破口になるかもしれない！」",
    },
    {
      phase: "climax",
      desc: "一度成功し、世界が一変するが慢心や外部要因で崩れ始める。",
      tone: "高揚",
      dialogue: "「やっとここまで来た…！」",
    },
    {
      phase: "fall",
      desc: "大きな挫折。仲間も去り、孤独に沈む。",
      tone: "絶望",
      dialogue: "「全部失ったのか…？」",
    },
    {
      phase: "resolution",
      desc: "傷を抱えたままもう一度立ち上がり、自分らしい成功を掴む。",
      tone: "再起",
      dialogue: "「次は嘘のない自分で勝つ」",
    },
  ];

  const panels: MangaPanelPlan[] = phases.map((phase, index) => ({
    id: `panel-${index + 1}`,
    templateId: templatePool[index % templatePool.length].id,
    narrativePhase: phase.phase,
    description: `${phase.desc} (${headline})`,
    dialogue: phase.dialogue,
    narration: phase.desc,
    tone: phase.tone,
    visualKeywords: ["cinematic shading", "emotive close up", "consistent character"],
  }));

  return {
    title: `${headline}の物語`,
    theme: "貧困からの逆転劇",
    characters: {
      protagonist: "貧しさから這い上がる主人公",
      style: "劇画風で力強いタッチ",
    },
    panels,
  };
}

function normalizeMangaStoryPlan(
  candidate: any,
  fallback: MangaStoryPlan,
  templates: MangaTemplate[]
): MangaStoryPlan {
  if (!candidate || typeof candidate !== "object") return fallback;

  const panelsSource: any[] = Array.isArray(candidate.panels) ? candidate.panels : [];
  const panels =
    panelsSource.length > 0
      ? panelsSource.map((panel, index) =>
          normalizeMangaPanel(panel, templates, index)
        )
      : fallback.panels;

  return {
    title:
      typeof candidate.title === "string" && candidate.title.trim()
        ? candidate.title.trim()
        : fallback.title,
    theme:
      typeof candidate.theme === "string" && candidate.theme.trim()
        ? candidate.theme.trim()
        : fallback.theme,
    characters: {
      protagonist:
        typeof candidate?.characters?.protagonist === "string" &&
        candidate.characters.protagonist.trim()
          ? candidate.characters.protagonist.trim()
          : fallback.characters.protagonist,
      style:
        typeof candidate?.characters?.style === "string" &&
        candidate.characters.style.trim()
          ? candidate.characters.style.trim()
          : fallback.characters.style,
    },
    panels,
  };
}

export async function generateMangaStory(
  userInput: string,
  templates: MangaTemplate[],
  apiKey?: string
): Promise<MangaStoryPlan> {
  const brief = userInput.trim();
  const fallback = createFallbackMangaStory(brief, templates);
  const key = apiKey?.trim();
  if (!key) return fallback;

  const templateGuide =
    templates.length > 0
      ? templates
          .map((tpl) => `- ${tpl.id}: ${tpl.name} | ${tpl.structure}`)
          .join("\n")
      : "- hero-single | single dramatic panel\n- duo-contrast | split panel";

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${MANGA_STORY_PROMPT}

AVAILABLE TEMPLATES:
${templateGuide}

USER BRIEF (JP allowed):
"""${brief.slice(0, 4000) || "ストーリー設定が未入力です。"}"""

Remember: JSON only.`,
          },
        ],
      },
    ],
  };

  try {
    const data = await callGemini<{ candidates?: any[] }>(
      GEMINI_TEXT_MODEL,
      payload,
      key
    );
    const text =
      data?.candidates
        ?.flatMap(
          (candidate: any) =>
            candidate?.content?.parts?.map((part: any) => part.text) || []
        )
        .filter(Boolean)
        .join("\n") || "";
    const jsonString =
      extractJsonBlock(text) || (text.trim().startsWith("{") ? text.trim() : null);
    if (!jsonString) return fallback;
    const parsed = JSON.parse(jsonString);
    return normalizeMangaStoryPlan(parsed, fallback, templates);
  } catch (error) {
    console.warn("Gemini manga story fallback", error);
    return fallback;
  }
}

function normalizeSlidePlanCandidate(
  candidate: any,
  templates: SlideTemplate[],
  index: number
): SlidePlanItem {
  const templateIds = new Set(templates.map((tpl) => tpl.id));
  const fallbackTemplateId = templates[0]?.id || "intro";
  const templateIdSource = candidate?.templateId || candidate?.template || candidate?.layout;
  const templateId = templateIds.has(templateIdSource)
    ? templateIdSource
    : fallbackTemplateId;

  const toLines = (value: unknown) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : String(item)))
        .filter(Boolean)
        .slice(0, 5);
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\n|、|。/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    return [] as string[];
  };

  return {
    id: candidate?.id?.toString() || `slide-${index + 1}`,
    templateId,
    title:
      typeof candidate?.title === "string" && candidate.title.trim()
        ? candidate.title.trim()
        : `スライド ${index + 1}`,
    body: toLines(candidate?.body),
    notes:
      typeof candidate?.notes === "string" && candidate.notes.trim()
        ? candidate.notes.trim()
        : undefined,
    tone:
      typeof candidate?.tone === "string" && candidate.tone.trim()
        ? candidate.tone.trim()
        : undefined,
    emphasis:
      typeof candidate?.emphasis === "string" && candidate.emphasis.trim()
        ? candidate.emphasis.trim()
        : undefined,
    cta:
      typeof candidate?.cta === "string" && candidate.cta.trim()
        ? candidate.cta.trim()
        : undefined,
    carryOver:
      typeof candidate?.carryOver === "string" && candidate.carryOver.trim()
        ? candidate.carryOver.trim()
        : undefined,
    keywords: Array.isArray(candidate?.keywords)
      ? candidate.keywords
          .map((kw: unknown) => (typeof kw === "string" ? kw.trim() : String(kw)))
          .filter(Boolean)
          .slice(0, 6)
      : undefined,
  };
}

function createFallbackSlidePlan(
  outline: string,
  templates: SlideTemplate[],
  targetSlides = 6
): SlidePlanItem[] {
  const count = Math.min(Math.max(targetSlides || 4, 3), 10);
  const sentences = outline
    .split(/\n+|。/)
    .map((line) => line.trim())
    .filter(Boolean);
  const chunkSize = Math.max(1, Math.ceil(sentences.length / count));

  const slides: SlidePlanItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const chunk = sentences.slice(i * chunkSize, (i + 1) * chunkSize);
    const template = templates[i] || templates[templates.length - 1];
    slides.push({
      id: `fallback-${i + 1}`,
      templateId: template?.id || "intro",
      title: chunk[0] || `スライド ${i + 1}`,
      body: chunk.slice(1, 5),
      notes: i === 0 ? "ブランドやテーマカラーを決める冒頭スライド" : undefined,
      tone: "落ち着いたトーン",
      emphasis: chunk[0],
      carryOver:
        i === 0
          ? "最初のスライドで決めた色味・人物・アイコンを次のスライドでも踏襲"
          : undefined,
    });
  }

  if (slides.length > 0) {
    slides[slides.length - 1].cta = "次のアクションを明示";
  }

  return slides;
}

export async function generateSlidePlan(
  outline: string,
  templates: SlideTemplate[],
  targetSlides = 6,
  apiKey?: string
): Promise<SlidePlanItem[]> {
  const safeOutline = outline?.trim() || "";
  const fallback = createFallbackSlidePlan(safeOutline, templates, targetSlides);
  const key = apiKey?.trim();
  if (!key) return fallback;

  const templateGuide = templates
    .map((tpl) => `- ${tpl.id}: ${tpl.name} | ${tpl.structure}`)
    .join("\n");

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SLIDE_PLAN_PROMPT}

TEMPLATE OPTIONS:
${templateGuide}

TARGET_SLIDE_COUNT: ${targetSlides}

SOURCE TEXT (JP allowed, keep concise):
"""${safeOutline.slice(0, 6000)}"""`,
          },
        ],
      },
    ],
  };

  try {
    const data = await callGemini<{ candidates?: any[] }>(
      GEMINI_TEXT_MODEL,
      payload,
      key
    );
    const text =
      data?.candidates
        ?.flatMap(
          (candidate: any) => candidate?.content?.parts?.map((part: any) => part.text) || []
        )
        .filter(Boolean)
        .join("\n") || "";

    const jsonString =
      extractJsonBlock(text) || (text.trim().startsWith("[") ? text.trim() : null);
    if (!jsonString) return fallback;

    let parsed: any[];
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn("Gemini slide plan JSON parse failed", parseError);
      return fallback;
    }

    if (!Array.isArray(parsed)) return fallback;

    const normalized = parsed.map((item, index) =>
      normalizeSlidePlanCandidate(item, templates, index)
    );

    return normalized.length > 0 ? normalized : fallback;
  } catch (error) {
    console.warn("Gemini slide plan fallback", error);
    return fallback;
  }
}
