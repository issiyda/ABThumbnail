"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  ExternalLink,
  History,
  ImageDown,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Label from "../../components/ui/Label";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { generateLpPlan } from "../../lib/gemini";
import { generateImage } from "../../lib/nanobanana";
import {
  fetchLpGenerationHistory,
  saveLpGenerationHistory,
} from "../../lib/history";
import { LP_BOOTCAMP_TEMPLATE } from "../../constants/lp-template";
import type {
  LpPlan,
  LpSectionPlan,
  LpGenerationHistoryItem,
} from "../../types";

type SectionStatus = "pending" | "generating" | "done" | "error";

interface SectionResult extends LpSectionPlan {
  status: SectionStatus;
  imageUrl?: string;
  promptUsed: string;
  patternId: string;
  patternLabel: string;
  error?: string;
}

const VERTICAL_RATIO = "9:16";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface SectionPromptContext {
  hasColorReference?: boolean;
  hasFaceReference?: boolean;
  hasPreviousSectionImage?: boolean;
}

interface PatternSet {
  id: string;
  label: string;
  status: SectionStatus;
  sections: SectionResult[];
  createdAt: number;
}

function buildSectionPrompt(
  section: LpSectionPlan,
  plan: LpPlan | null,
  rawText: string,
  context: SectionPromptContext = {}
) {
  const chunks = [
    `Section: ${section.title}`,
    section.prompt,
    section.visualStyle && `Visual style: ${section.visualStyle}`,
    section.goal && `Goal: ${section.goal}`,
    plan?.theme && `Brand theme: ${plan.theme}`,
    plan?.tone && `Tone: ${plan.tone}`,
    section.copy && `Key copy (JP): ${section.copy}`,
    section.cta && `CTA: ${section.cta}`,
    "Design a full landing page slice from top padding to bottom divider, vertical 9:16 frame, layered UI mockups, premium typography, gradients, soft shadows",
    "Show entire section composition ready to be stacked with others",
    "IMPORTANT: All text content displayed within the generated image must be in Japanese. This includes titles, labels, captions, CTA buttons, and any other text elements. Only tool names or technical terms that are commonly used in English (like 'YouTube', 'Instagram', etc.) may remain in English if necessary.",
  ];
  if (context.hasColorReference) {
    chunks.push(
      "Respect the uploaded color palette reference for tones and gradients."
    );
  }
  if (context.hasFaceReference) {
    chunks.push(
      "Keep spokesperson/face icon consistent with uploaded reference."
    );
  }
  if (context.hasPreviousSectionImage) {
    chunks.push(
      "Ensure seamless visual continuity with the previous section reference image."
    );
  }
  if (rawText) {
    chunks.push(`Reference brief (JP): ${rawText.slice(0, 240)}`);
  }
  return chunks.filter(Boolean).join(" | ");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = (event) =>
      reject(
        event instanceof ErrorEvent
          ? event.error || new Error("画像の読み込みに失敗しました。")
          : new Error("画像の読み込みに失敗しました。")
      );
    image.src = src;
  });
}

export default function LandingPageBuilder() {
  const [lpText, setLpText] = useState(LP_BOOTCAMP_TEMPLATE);
  const [geminiKey, setGeminiKey] = useLocalStorage<string>(
    "gemini-api-key",
    ""
  );
  const [plan, setPlan] = useState<LpPlan | null>(null);
  const [patternSets, setPatternSets] = useState<PatternSet[]>([]);
  const [selectedPatternBySection, setSelectedPatternBySection] = useState<
    Record<string, string>
  >({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [combinedImage, setCombinedImage] = useState<string | null>(null);
  const [combineError, setCombineError] = useState<string | null>(null);
  const [isCombining, setIsCombining] = useState(false);
  const [colorReferenceImage, setColorReferenceImage] = useState<
    string | undefined
  >();
  const [faceReferenceImage, setFaceReferenceImage] = useState<
    string | undefined
  >();

  const colorFileRef = useRef<HTMLInputElement | null>(null);
  const faceFileRef = useRef<HTMLInputElement | null>(null);
  const [lpHistory, setLpHistory] = useState<LpGenerationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generationMode, setGenerationMode] = useState<"auto" | "plan-only">(
    "auto"
  );
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  useEffect(() => {
    fetchLpGenerationHistory().then(setLpHistory);
  }, []);

  const handleImageUpload = (
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string | undefined) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const completedSectionSlots = useMemo(
    () =>
      patternSets.reduce(
        (sum, set) =>
          sum +
          set.sections.filter((section) => section.status === "done").length,
        0
      ),
    [patternSets]
  );

  const totalSectionSlots = useMemo(() => {
    if (!plan || !patternSets.length) return 0;
    return patternSets.length * plan.sections.length;
  }, [patternSets, plan]);

  const progress = useMemo(() => {
    if (!totalSectionSlots) return 0;
    return Math.round((completedSectionSlots / totalSectionSlots) * 100);
  }, [completedSectionSlots, totalSectionSlots]);

  const completedPatterns = useMemo(
    () => patternSets.filter((set) => set.status === "done").length,
    [patternSets]
  );

  const handleGeneratePlan = async (): Promise<LpPlan | null> => {
    if (!lpText.trim()) return null;
    setError(null);
    setPlan(null);
    setPatternSets([]);
    setSelectedPatternBySection({});
    setCombinedImage(null);
    setCombineError(null);
    setIsLoading(true);
    setStatus("Gemini で LP の構成を解析中...");

    try {
      const lpPlan = await generateLpPlan(lpText.trim(), geminiKey);
      setPlan(lpPlan);
      setStatus(null);
      return lpPlan;
    } catch (planError) {
      console.error(planError);
      setError(
        planError instanceof Error
          ? planError.message
          : "LP構成の生成に失敗しました。"
      );
      return null;
    } finally {
      setIsLoading(false);
      setStatus(null);
    }
  };

  const generatePatternSet = async (
    patternSet: PatternSet,
    saveToHistory?: boolean
  ) => {
    if (!plan) return;
    let previousImage: string | undefined;
    const completedSections: SectionResult[] = [];

    setPatternSets((prev) =>
      prev.map((set) =>
        set.id === patternSet.id ? { ...set, status: "generating" } : set
      )
    );

    for (const section of plan.sections) {
      const sectionPrompt = buildSectionPrompt(section, plan, lpText, {
        hasColorReference: !!colorReferenceImage,
        hasFaceReference: !!faceReferenceImage,
        hasPreviousSectionImage: !!previousImage,
      });
      setPatternSets((prev) =>
        prev.map((set) =>
          set.id === patternSet.id
            ? {
                ...set,
                status: "generating",
                sections: set.sections.map((item) =>
                  item.id === section.id
                    ? {
                        ...item,
                        status: "generating",
                        promptUsed: sectionPrompt,
                        error: undefined,
                      }
                    : item
                ),
              }
            : set
        )
      );
      setStatus(
        `NanoBanana で ${patternSet.label} / 「${section.title}」をレンダリング中...`
      );

      try {
        const imageUrl = await generateImage(
          sectionPrompt,
          previousImage,
          geminiKey,
          colorReferenceImage,
          faceReferenceImage,
          undefined,
          {
            aspectRatio: VERTICAL_RATIO,
            imageSize: "1K",
          }
        );
        const completedSection: SectionResult = {
          ...section,
          status: "done",
          imageUrl,
          promptUsed: sectionPrompt,
          patternId: patternSet.id,
          patternLabel: patternSet.label,
        };
        setPatternSets((prev) =>
          prev.map((set) =>
            set.id === patternSet.id
              ? {
                  ...set,
                  sections: set.sections.map((item) =>
                    item.id === section.id ? completedSection : item
                  ),
                }
              : set
          )
        );
        completedSections.push(completedSection);
        previousImage = imageUrl;
      } catch (sectionError) {
        console.error(sectionError);
        const errorSection: SectionResult = {
          ...section,
          status: "error",
          promptUsed: sectionPrompt,
          patternId: patternSet.id,
          patternLabel: patternSet.label,
          error:
            sectionError instanceof Error
              ? sectionError.message
              : "画像生成に失敗しました。",
        };
        setPatternSets((prev) =>
          prev.map((set) =>
            set.id === patternSet.id
              ? {
                  ...set,
                  sections: set.sections.map((item) =>
                    item.id === section.id ? errorSection : item
                  ),
                }
              : set
          )
        );
        completedSections.push(errorSection);
      }
    }

    setPatternSets((prev) =>
      prev.map((set) => {
        if (set.id !== patternSet.id) return set;
        const hasError = set.sections.some(
          (section) => section.status === "error"
        );
        return { ...set, status: hasError ? "error" : "done" };
      })
    );

    setSelectedPatternBySection((prev) => {
      if (!plan) return prev;
      const updated = { ...prev };
      plan.sections.forEach((section) => {
        const candidate = completedSections.find(
          (item) => item.id === section.id && item.imageUrl
        );
        if (!updated[section.id] && candidate) {
          updated[section.id] = patternSet.id;
        }
      });
      return updated;
    });

    // 履歴を保存（最初のパターンのみ）
    if (saveToHistory && plan && completedSections.length > 0) {
      const historyItem: LpGenerationHistoryItem = {
        id: uid(),
        payload: {
          lpText: lpText.trim(),
          colorReferenceImage,
          faceReferenceImage,
        },
        plan: plan,
        sections: completedSections.map((section) => ({
          id: section.id,
          title: section.title,
          goal: section.goal,
          visualStyle: section.visualStyle,
          prompt: section.prompt,
          copy: section.copy,
          cta: section.cta,
          imageUrl: section.imageUrl,
          promptUsed: section.promptUsed,
        })),
        createdAt: Date.now(),
      };
      saveLpGenerationHistory(historyItem);
      setLpHistory((prev) => [historyItem, ...prev].slice(0, 20));
    }
  };

  const handleGeneratePatterns = async (count: number) => {
    if (!plan || plan.sections.length === 0) return;
    setIsGeneratingImages(true);
    setError(null);
    setCombinedImage(null);
    setCombineError(null);
    setStatus("画像生成を開始します...");

    const baseIndex = patternSets.length + 1;
    const newSets: PatternSet[] = Array.from({ length: count }).map(
      (_, index) => {
        const label = `パターン ${baseIndex + index}`;
        const id = uid();
        return {
          id,
          label,
          status: "pending",
          createdAt: Date.now(),
          sections: plan.sections.map((section) => ({
            ...section,
            status: "pending",
            promptUsed: "",
            patternId: id,
            patternLabel: label,
          })),
        };
      }
    );

    setPatternSets((prev) => [...prev, ...newSets]);

    try {
      for (let i = 0; i < newSets.length; i++) {
        const set = newSets[i];
        const shouldSaveHistory = patternSets.length === 0 && i === 0;
        await generatePatternSet(set, shouldSaveHistory);
      }
    } catch (imageError) {
      console.error(imageError);
      setError(
        imageError instanceof Error
          ? imageError.message
          : "画像生成に失敗しました。"
      );
    } finally {
      setIsGeneratingImages(false);
      setStatus(null);
    }
  };

  const selectedSections = useMemo(() => {
    if (!plan) return [];
    return plan.sections.map((section) => {
      const preferredPatternId =
        selectedPatternBySection[section.id] || patternSets[0]?.id || "";
      const selectedSet = patternSets.find(
        (set) => set.id === preferredPatternId
      );
      const candidate =
        selectedSet?.sections.find(
          (item) => item.id === section.id && item.imageUrl
        ) ||
        patternSets
          .map((set) =>
            set.sections.find((item) => item.id === section.id && item.imageUrl)
          )
          .find(Boolean);
      if (candidate) return candidate;
      return {
        ...section,
        status: "pending",
        imageUrl: undefined,
        promptUsed: "",
        patternId: preferredPatternId || "unselected",
        patternLabel:
          selectedSet?.label || patternSets[0]?.label || "未選択パターン",
      };
    });
  }, [patternSets, plan, selectedPatternBySection]);

  const handleAdoptPatternSet = (patternId: string) => {
    const pattern = patternSets.find((set) => set.id === patternId);
    if (!pattern) return;
    setSelectedPatternBySection((prev) => {
      const next = { ...prev };
      pattern.sections.forEach((section) => {
        if (section.imageUrl) {
          next[section.id] = patternId;
        }
      });
      return next;
    });
  };

  const handleAdoptSectionVariant = (sectionId: string, patternId: string) => {
    const pattern = patternSets.find((set) => set.id === patternId);
    const candidate = pattern?.sections.find(
      (section) => section.id === sectionId && section.imageUrl
    );
    if (!candidate) return;
    setSelectedPatternBySection((prev) => ({
      ...prev,
      [sectionId]: patternId,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lpText.trim()) return;

    if (generationMode === "plan-only") {
      // LP本文のみ生成
      await handleGeneratePlan();
    } else {
      // 自動生成（LP本文生成 → 画像生成）
      const generatedPlan = await handleGeneratePlan();
      if (generatedPlan && generatedPlan.sections.length > 0) {
        // planが生成されたら画像生成を実行
        await handleGeneratePatterns(1);
      }
    }
  };

  const handleSelectHistory = (historyItem: LpGenerationHistoryItem) => {
    setLpText(historyItem.payload.lpText);
    setColorReferenceImage(historyItem.payload.colorReferenceImage);
    setFaceReferenceImage(historyItem.payload.faceReferenceImage);
    setShowHistory(false);
    setPlan(null);
    setPatternSets([]);
    setSelectedPatternBySection({});
    setCombinedImage(null);
    setCombineError(null);
  };

  const handleCombineSections = async () => {
    const readySections = selectedSections.filter(
      (section) => section.imageUrl
    );
    if (!readySections.length) return;
    setIsCombining(true);
    setCombineError(null);
    setCombinedImage(null);
    try {
      const images = await Promise.all(
        readySections.map((section) => loadImage(section.imageUrl!))
      );
      const targetWidth = Math.max(
        ...images.map((image) => image.naturalWidth || 1080),
        1080
      );
      const totalHeight = images.reduce((sum, image) => {
        const width =
          image.naturalWidth && image.naturalWidth > 0
            ? image.naturalWidth
            : targetWidth;
        const height =
          image.naturalHeight && image.naturalHeight > 0
            ? image.naturalHeight
            : targetWidth * (VERTICAL_RATIO === "9:16" ? 16 / 9 : 1);
        const ratio = targetWidth / width;
        return sum + Math.round(height * ratio);
      }, 0);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas が利用できません。");
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let cursorY = 0;
      images.forEach((image) => {
        const width =
          image.naturalWidth && image.naturalWidth > 0
            ? image.naturalWidth
            : targetWidth;
        const height =
          image.naturalHeight && image.naturalHeight > 0
            ? image.naturalHeight
            : targetWidth * (VERTICAL_RATIO === "9:16" ? 16 / 9 : 1);
        const ratio = targetWidth / width;
        const drawHeight = Math.round(height * ratio);
        ctx.drawImage(image, 0, cursorY, targetWidth, drawHeight);
        cursorY += drawHeight;
      });

      const merged = canvas.toDataURL("image/png", 1);
      setCombinedImage(merged);
    } catch (combineErr) {
      console.error(combineErr);
      setCombineError(
        combineErr instanceof Error
          ? combineErr.message
          : "結合画像の生成に失敗しました。"
      );
    } finally {
      setIsCombining(false);
    }
  };

  const handleDownloadCombined = () => {
    if (!combinedImage) return;
    const link = document.createElement("a");
    link.href = combinedImage;
    link.download = `lp-${Date.now()}.png`;
    link.click();
  };

  const handleOpenPreviewPage = () => {
    const readySections = selectedSections.filter(
      (section) => section.imageUrl
    );
    if (!readySections.length) return;
    const win = window.open("", "_blank", "noopener");
    if (!win) return;
    const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${plan?.theme || "LP Preview"}</title>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #0f172a;
        font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
        color: #0f172a;
      }
      .wrap {
        min-height: 100vh;
        padding: 48px 0;
        display: flex;
        justify-content: center;
      }
      .phone {
        width: min(520px, calc(100vw - 32px));
        background: #f8fafc;
        border-radius: 36px;
        padding: 24px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      }
      .phone img {
        width: 100%;
        display: block;
        border-radius: 24px;
        margin-bottom: 24px;
        box-shadow: 0 10px 35px rgba(15, 23, 42, 0.12);
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="phone">
        ${readySections
          .map(
            (section) =>
              `<img src="${section.imageUrl}" alt="${section.title || "section"}" />`
          )
          .join("")}
      </div>
    </div>
  </body>
</html>`;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">LP Lab</p>
        <h1 className="text-3xl font-bold text-text">LP作成スタジオ</h1>
        <p className="text-sm text-muted">
          LP本文を貼り付けるだけで、Gemini 3.0 が各セクションを構造化し
          NanoBanana で縦長のセクション画像を順番に生成します。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted">
                <History size={16} />
                過去のLPから再生成
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? "閉じる" : "履歴を見る"}
              </Button>
            </div>
            {showHistory && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lpHistory.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">
                    まだ履歴がありません。
                  </p>
                ) : (
                  lpHistory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-white/70 p-3 text-xs cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => handleSelectHistory(item)}
                    >
                      <p className="font-semibold text-text mb-1 line-clamp-2">
                        {item.payload.lpText.slice(0, 60)}
                        {item.payload.lpText.length > 60 ? "..." : ""}
                      </p>
                      <p className="text-muted mb-1">
                        {item.plan.sections.length}セクション |{" "}
                        {item.plan.theme}
                      </p>
                      <p className="text-muted text-[10px]">
                        {new Date(item.createdAt).toLocaleString("ja-JP")}
                      </p>
                      {item.payload.colorReferenceImage && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px]">
                          色味参考あり
                        </span>
                      )}
                      {item.payload.faceReferenceImage && (
                        <span className="inline-block mt-1 ml-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px]">
                          顔参考あり
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Sparkles size={16} />
              Gemini API Key（ローカル保存）
            </div>
            <Label htmlFor="lp-gemini-key">Gemini API Key</Label>
            <Input
              id="lp-gemini-key"
              type="password"
              placeholder="AIza..."
              value={geminiKey}
              onChange={(event) => setGeminiKey(event.target.value)}
            />
            <p className="text-xs text-muted">
              未入力の場合はローカルの簡易ロジックとモック画像で動作します。
            </p>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Reference
                </p>
                <h2 className="text-xl font-bold text-text">
                  参考画像（任意）
                </h2>
              </div>
              <span className="text-xs text-muted">
                カラーや人物を固定したい場合に利用
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-text">
                  色味の参考
                </Label>
                {colorReferenceImage && (
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setColorReferenceImage(undefined)}
                  >
                    クリア
                  </button>
                )}
              </div>
              <div
                className="relative grid h-32 place-items-center rounded-2xl border-2 border-dashed border-primary/30 bg-blue-50/40 text-center text-sm text-muted cursor-pointer overflow-hidden"
                onClick={() => colorFileRef.current?.click()}
              >
                {colorReferenceImage ? (
                  <img
                    src={colorReferenceImage}
                    alt="色味の参考"
                    className="h-32 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <ImageDown className="text-primary" />
                    <p className="font-semibold text-text">
                      ドラッグ＆ドロップ
                    </p>
                    <p className="text-xs">PNG / JPG</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={colorFileRef}
                  className="hidden"
                  onChange={(event) =>
                    handleImageUpload(event, setColorReferenceImage)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-text">
                  代表の顔 / アイコン
                </Label>
                {faceReferenceImage && (
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setFaceReferenceImage(undefined)}
                  >
                    クリア
                  </button>
                )}
              </div>
              <div
                className="relative grid h-32 place-items-center rounded-2xl border-2 border-dashed border-primary/30 bg-blue-50/40 text-center text-sm text-muted cursor-pointer overflow-hidden"
                onClick={() => faceFileRef.current?.click()}
              >
                {faceReferenceImage ? (
                  <img
                    src={faceReferenceImage}
                    alt="顔写真の参考"
                    className="h-32 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <ImageDown className="text-primary" />
                    <p className="font-semibold text-text">
                      ドラッグ＆ドロップ
                    </p>
                    <p className="text-xs">PNG / JPG</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={faceFileRef}
                  className="hidden"
                  onChange={(event) =>
                    handleImageUpload(event, setFaceReferenceImage)
                  }
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Brief
                </p>
                <h2 className="text-xl font-bold text-text">LP本文</h2>
              </div>
              <span className="text-xs text-muted">
                複数セクションを自動抽出
              </span>
            </div>
            <Label htmlFor="lp-brief">コピー / 概要を貼り付け</Label>
            <Textarea
              id="lp-brief"
              rows={10}
              placeholder="例）ヒーローコピー、課題、解決策、機能説明、実績、CTA などを順番に書いたテキストを貼り付けてください。"
              value={lpText}
              onChange={(event) => setLpText(event.target.value)}
            />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-text">
                  生成モード
                </Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="generation-mode"
                      value="auto"
                      checked={generationMode === "auto"}
                      onChange={(e) =>
                        setGenerationMode(
                          e.target.value as "auto" | "plan-only"
                        )
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm text-text">
                      自動生成（LP本文生成後、すぐに画像生成）
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="generation-mode"
                      value="plan-only"
                      checked={generationMode === "plan-only"}
                      onChange={(e) =>
                        setGenerationMode(
                          e.target.value as "auto" | "plan-only"
                        )
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm text-text">
                      LP本文のみ生成（後で画像生成）
                    </span>
                  </label>
                </div>
                <p className="text-xs text-muted">
                  {generationMode === "auto"
                    ? "LP本文を生成した後、自動的に画像生成を開始します。"
                    : "LP本文を生成した後、編集してから画像生成ボタンで画像を生成できます。"}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="submit"
                  icon={<Sparkles size={16} />}
                  loading={isLoading}
                  disabled={isLoading || !lpText.trim()}
                >
                  {generationMode === "auto"
                    ? "LPを構成して画像生成"
                    : "LP本文を生成"}
                </Button>
              </div>
            </div>
          </Card>

          {plan && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">
                    Outline
                  </p>
                  <h3 className="text-lg font-bold text-text">構成サマリー</h3>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted">テーマ</p>
                <p className="text-base font-semibold text-text">
                  {plan.theme}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">トーン</p>
                <p className="text-sm text-text">{plan.tone}</p>
              </div>
              <div>
                <p className="text-xs text-muted">カラーパレット</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {plan.palette.map((color) => (
                    <span
                      key={color}
                      className="flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs text-text"
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                      />
                      {color}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {plan.sections.map((section) => (
                  <div
                    key={section.id}
                    className="rounded-xl border border-border/70 bg-white/70 p-3 text-sm"
                  >
                    <p className="font-semibold text-text">{section.title}</p>
                    <p className="text-xs text-muted">{section.goal}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-blue-50/40 p-3">
                <p className="text-sm font-semibold text-text">
                  追加パターンをまとめて生成
                </p>
                <p className="text-xs text-muted">
                  1パターン、3パターン、5パターンずつ追加生成できます。既に生成済みでも追加可能です。
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    icon={<Sparkles size={16} />}
                    loading={isGeneratingImages}
                    disabled={isGeneratingImages}
                    onClick={() => handleGeneratePatterns(1)}
                  >
                    1パターン生成/追加
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isGeneratingImages}
                    onClick={() => handleGeneratePatterns(3)}
                  >
                    ＋3パターン追加
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isGeneratingImages}
                    onClick={() => handleGeneratePatterns(5)}
                  >
                    ＋5パターン追加
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </form>

        <div className="space-y-4">
          {(status || patternSets.length > 0) && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">
                    Progress
                  </p>
                  <h3 className="text-lg font-bold text-text">
                    セクション生成の進捗
                  </h3>
                </div>
                <div className="text-right text-xs text-muted">
                  <p className="font-semibold text-text">
                    {completedSectionSlots}/{totalSectionSlots || "-"} 枚
                  </p>
                  <p>
                    完了パターン {completedPatterns}/{patternSets.length || "-"}
                  </p>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-blue-50">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {status && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <RefreshCw className="animate-spin text-primary" size={16} />
                  {status}
                </div>
              )}
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50 text-sm text-red-700">
              {error}
            </Card>
          )}

          {plan && (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">
                    Patterns
                  </p>
                  <h3 className="text-lg font-bold text-text">
                    パターンの生成と選択
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    icon={<Sparkles size={16} />}
                    loading={isGeneratingImages}
                    disabled={isGeneratingImages}
                    onClick={() => handleGeneratePatterns(1)}
                  >
                    1パターン生成/追加
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isGeneratingImages}
                    onClick={() => handleGeneratePatterns(3)}
                  >
                    ＋3パターン追加
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isGeneratingImages}
                    onClick={() => handleGeneratePatterns(5)}
                  >
                    ＋5パターン追加
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted">
                生成済みのLPをベースに、1/3/5パターンずつまとめて追加生成できます。完了したパターンは一括採用も可能です。
              </p>
              <div className="space-y-3">
                {patternSets.length === 0 ? (
                  <p className="text-xs text-muted">
                    まだパターンがありません。左側でLP本文を生成してからパターン生成ボタンを押してください。
                  </p>
                ) : (
                  patternSets.map((pattern) => {
                    const doneCount = pattern.sections.filter(
                      (section) => section.status === "done"
                    ).length;
                    const totalCount =
                      plan.sections.length || pattern.sections.length;
                    return (
                      <div
                        key={pattern.id}
                        className="rounded-xl border border-border/70 bg-white/80 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-text">
                              {pattern.label}
                            </p>
                            <p className="text-[11px] text-muted">
                              {doneCount}/{totalCount} 枚完了 ・{" "}
                              {new Date(pattern.createdAt).toLocaleString(
                                "ja-JP"
                              )}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              pattern.status === "done"
                                ? "bg-emerald-50 text-emerald-600"
                                : pattern.status === "error"
                                  ? "bg-red-50 text-red-600"
                                  : pattern.status === "generating"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {pattern.status === "done" && "完了"}
                            {pattern.status === "pending" && "待機中"}
                            {pattern.status === "generating" && "生成中"}
                            {pattern.status === "error" && "失敗"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!pattern.sections.some((s) => s.imageUrl)}
                            onClick={() => handleAdoptPatternSet(pattern.id)}
                          >
                            このパターンを全採用
                          </Button>
                          <span className="text-[11px] text-muted">
                            生成済みの画像からセクション単位で差し替えられます。
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          )}

          {plan && patternSets.length > 0 && (
            <Card className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Sections
                </p>
                <h3 className="text-lg font-bold text-text">
                  セクションごとの画像パターン
                </h3>
                <p className="text-xs text-muted">
                  それぞれのセクションで、生成済みパターンの中から採用する1枚を選んでください。
                </p>
              </div>
              <div className="space-y-4">
                {plan.sections.map((sectionPlan) => {
                  const variants = patternSets
                    .map((set) =>
                      set.sections.find(
                        (section) => section.id === sectionPlan.id
                      )
                    )
                    .filter(Boolean) as SectionResult[];
                  const selectedPattern =
                    selectedPatternBySection[sectionPlan.id];
                  return (
                    <div
                      key={sectionPlan.id}
                      className="rounded-2xl border border-border/70 bg-white/80 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-text">
                            {sectionPlan.title}
                          </p>
                          <p className="text-xs text-muted">
                            {sectionPlan.goal}
                          </p>
                        </div>
                        {selectedPattern && (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            採用中:{" "}
                            {patternSets.find(
                              (set) => set.id === selectedPattern
                            )?.label || "未選択"}
                          </span>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {variants.map((variant) => {
                          const isSelected =
                            selectedPattern === variant.patternId &&
                            !!variant.imageUrl;
                          return (
                            <div
                              key={`${variant.patternId}-${variant.id}`}
                              className={`rounded-xl border p-3 ${
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : "border-border/70 bg-white"
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between text-xs">
                                <span className="font-semibold text-text">
                                  {variant.patternLabel}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    variant.status === "done"
                                      ? "bg-emerald-50 text-emerald-600"
                                      : variant.status === "error"
                                        ? "bg-red-50 text-red-600"
                                        : variant.status === "generating"
                                          ? "bg-primary/10 text-primary"
                                          : "bg-blue-50 text-blue-600"
                                  }`}
                                >
                                  {variant.status === "done" && "完了"}
                                  {variant.status === "pending" && "待機中"}
                                  {variant.status === "generating" && "生成中"}
                                  {variant.status === "error" && "失敗"}
                                </span>
                              </div>
                              <div className="overflow-hidden rounded-lg border border-border/60 bg-black/5">
                                {variant.imageUrl ? (
                                  <img
                                    src={variant.imageUrl}
                                    alt={variant.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="grid h-48 place-items-center text-xs text-muted">
                                    画像生成中または未生成です
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                                <span>
                                  {variant.patternLabel} / {variant.title}
                                </span>
                                {variant.imageUrl && isSelected && (
                                  <span className="font-semibold text-primary">
                                    採用中
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!variant.imageUrl || isSelected}
                                  onClick={() =>
                                    handleAdoptSectionVariant(
                                      variant.id,
                                      variant.patternId
                                    )
                                  }
                                >
                                  {isSelected ? "採用中" : "この案を採用"}
                                </Button>
                                {variant.promptUsed && (
                                  <details className="text-[11px] text-muted">
                                    <summary className="cursor-pointer select-none">
                                      プロンプト
                                    </summary>
                                    <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 px-2 py-1">
                                      {variant.promptUsed}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {selectedSections.some((section) => section.imageUrl) && (
            <Card className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Preview
                </p>
                <h3 className="text-lg font-bold text-text">
                  採用中のLPプレビュー
                </h3>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  icon={<Sparkles size={16} />}
                  loading={isCombining}
                  disabled={isCombining}
                  onClick={handleCombineSections}
                >
                  選択したセクションで結合
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  icon={<Download size={16} />}
                  disabled={!combinedImage}
                  onClick={handleDownloadCombined}
                >
                  結合画像をDL
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  icon={<ExternalLink size={16} />}
                  onClick={handleOpenPreviewPage}
                >
                  新しいタブでページ化
                </Button>
              </div>
              {combineError && (
                <p className="text-xs text-red-600">{combineError}</p>
              )}
              <div className="rounded-[32px] border border-border bg-slate-50 p-4">
                <div className="flex flex-col gap-4">
                  {selectedSections
                    .filter((section) => section.imageUrl)
                    .map((section) => (
                      <img
                        key={`${section.patternId}-${section.id}`}
                        src={section.imageUrl}
                        alt={section.title}
                        className="w-full rounded-2xl border border-border/60 object-cover"
                      />
                    ))}
                </div>
              </div>
              {combinedImage && (
                <div className="rounded-2xl border border-border/70 bg-white/80 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted">
                    結合済みプレビュー
                  </p>
                  <img
                    src={combinedImage}
                    alt="Combined LP preview"
                    className="w-full rounded-xl border border-border/60 object-cover"
                  />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
