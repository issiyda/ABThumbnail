"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  ImageDown,
  ListChecks,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Label from "../../components/ui/Label";
import Textarea from "../../components/ui/Textarea";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { SLIDE_TEMPLATES } from "../../constants/slideTemplates";
import { generateSlidePlan } from "../../lib/gemini";
import { generateImage } from "../../lib/nanobanana";
import type { SlidePlanItem, SlideTemplate } from "../../types";

type SlideStatus = "pending" | "generating" | "done" | "error";

interface SlideRun {
  plan: SlidePlanItem;
  template: SlideTemplate;
  status: SlideStatus;
  prompt: string;
  imageUrl?: string;
  error?: string;
}

function StatusPill({ status }: { status: SlideStatus }) {
  const styles: Record<SlideStatus, string> = {
    pending: "bg-slate-100 text-muted",
    generating: "bg-amber-100 text-amber-700",
    done: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };
  const label: Record<SlideStatus, string> = {
    pending: "設計済み",
    generating: "生成中",
    done: "完了",
    error: "失敗",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}>
      {label[status]}
    </span>
  );
}

function buildSlidePrompt(
  slide: SlidePlanItem,
  template: SlideTemplate,
  previousImage?: string,
  index?: number,
  total?: number
) {
  const cues = [
    `Slide ${index !== undefined ? index + 1 : ""}${total ? `/${total}` : ""}: ${template.name} layout (${template.structure})`,
    slide.title && `Headline (JP): ${slide.title}`,
    slide.emphasis && `Emphasize: ${slide.emphasis}`,
    slide.body?.length ? `Body lines: ${slide.body.join(" | ")}` : undefined,
    slide.cta && `CTA: ${slide.cta}`,
    slide.tone && `Tone: ${slide.tone}`,
    slide.notes && `Visual notes (JP): ${slide.notes}`,
    slide.carryOver && `Consistency note: ${slide.carryOver}`,
    slide.keywords?.length ? `Style keywords: ${slide.keywords.join(", ")}` : undefined,
    previousImage
      ? "Match palette, typography, and characters to the previous slide reference image for continuity."
      : "Establish the base palette and hero look on this first slide.",
    "Use the provided template reference ONLY for layout/structure, not for colors.",
    "16:9 presentation slide, clean margins, modern Japanese typography, no watermark, export-ready.",
    "All on-screen text must be in Japanese (brand names may stay in English).",
  ];

  return cues.filter(Boolean).join(" | ");
}

export default function SlideBuilderPage() {
  const [geminiKey, setGeminiKey] = useLocalStorage<string>(
    "gemini-api-key",
    ""
  );
  const [outline, setOutline] = useState("");
  const [targetSlides, setTargetSlides] = useState(6);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "planning" | "rendering" | "done">(
    "idle"
  );
  const [slides, setSlides] = useState<SlideRun[]>([]);
  const [completedSlides, setCompletedSlides] = useState(0);
  const [plan, setPlan] = useState<SlidePlanItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const templatesById = useMemo(() => {
    return SLIDE_TEMPLATES.reduce<Record<string, SlideTemplate>>((acc, tpl) => {
      acc[tpl.id] = tpl;
      return acc;
    }, {});
  }, []);

  const totalSteps = Math.max(2, (slides.length || Math.max(targetSlides, 1)) + 1);
  const completedSteps = phase === "idle" ? 0 : 1 + completedSlides;
  const progress = Math.min(100, Math.round((completedSteps / totalSteps) * 100));

  const nextAction = useMemo(() => {
    if (!outline.trim()) return "プレゼン内容を貼り付けてください";
    if (!geminiKey.trim())
      return "Gemini APIキー未入力: モック画像での実行になります";
    if (isRunning) return "生成が完了するまでお待ちください";
    if (phase === "done") return "もう一度実行する場合は内容を編集して再度開始";
    return "「プラン→画像生成」を押してスライドを組み立てます";
  }, [outline, geminiKey, isRunning, phase]);

  const handleDownload = async (slide: SlideRun, index: number) => {
    if (!slide.imageUrl) return;
    const title = slide.plan.title || `slide-${index + 1}`;
    const safe = title
      .replace(/[\s/\\?%*:|"<>]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);
    try {
      const response = await fetch(slide.imageUrl);
      if (!response.ok) throw new Error("画像の取得に失敗しました");
      const blob = await response.blob();
      const ext = blob.type.includes("png")
        ? "png"
        : blob.type.includes("jpeg")
          ? "jpg"
          : "png";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safe || "slide"}-${index + 1}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error(downloadError);
      setError("ダウンロードに失敗しました");
    }
  };

  const runGeneration = async () => {
    if (!outline.trim()) {
      setError("プレゼン内容を貼り付けてください。");
      return;
    }
    setIsRunning(true);
    setError(null);
    setStatus("Gemini でスライドの JSON 設計を作成中...");
    setPhase("planning");
    setSlides([]);
    setPlan([]);
    setCompletedSlides(0);

    try {
      const slidePlan = await generateSlidePlan(
        outline,
        SLIDE_TEMPLATES,
        targetSlides,
        geminiKey
      );
      setPlan(slidePlan);
      const initialSlides: SlideRun[] = slidePlan.map((item) => ({
        plan: item,
        template: templatesById[item.templateId] || SLIDE_TEMPLATES[0],
        status: "pending",
        prompt: "",
      }));
      setSlides(initialSlides);
      setPhase("rendering");

      let previousImage: string | undefined;
      for (let i = 0; i < initialSlides.length; i += 1) {
        const slide = initialSlides[i];
        const prompt = buildSlidePrompt(
          slide.plan,
          slide.template,
          previousImage,
          i,
          initialSlides.length
        );

        setSlides((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "generating", prompt } : item
          )
        );
        setStatus(`NanoBanana で ${i + 1}/${initialSlides.length} 枚目を生成中...`);

        try {
          const imageUrl = await generateImage(
            prompt,
            previousImage,
            geminiKey,
            previousImage,
            undefined,
            slide.template.referenceImage,
            { aspectRatio: "16:9", imageSize: "1K" }
          );

          previousImage = imageUrl;
          setSlides((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, status: "done", imageUrl, prompt }
                : item
            )
          );
          setCompletedSlides((count) => count + 1);
        } catch (slideError) {
          const message =
            slideError instanceof Error
              ? slideError.message
              : "スライド生成に失敗しました";
          setSlides((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, status: "error", error: message, prompt }
                : item
            )
          );
          setError(message);
          setCompletedSlides((count) => count + 1);
        }
      }

      setPhase("done");
      setStatus("全スライドの生成が完了しました。");
    } catch (planError) {
      setError(
        planError instanceof Error
          ? planError.message
          : "スライド設計に失敗しました"
      );
      setPhase("idle");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Slides</p>
          <h1 className="text-3xl font-bold text-text">Gemini × NanoBanana スライド生成</h1>
          <p className="text-sm text-muted">
            プレゼン内容を貼り付けるだけ。Gemini が JSON でスライド設計し、型の参考画像と直前のスライドを
            NanoBanana に渡して 1 枚ずつ描画します。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-soft">
          <Sparkles size={16} />
          プラン設計→連続生成を自動化
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">
                Setup
              </p>
              <h2 className="text-xl font-bold text-text">入力とキー設定</h2>
            </div>
            <StatusPill
              status={
                phase === "done" ? "done" : phase === "idle" ? "pending" : "generating"
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                placeholder="AIza..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted">
                未入力ならローカルモック画像で動作します。Gemini 3 を使う場合はキーを入れてください。
              </p>
            </div>
            <div>
              <Label htmlFor="target-count">生成するスライド枚数</Label>
              <div className="flex items-center gap-3">
                <input
                  id="target-count"
                  type="range"
                  min={3}
                  max={10}
                  value={targetSlides}
                  onChange={(e) => setTargetSlides(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-10 text-right text-sm font-semibold text-text">
                  {targetSlides}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Gemini に希望枚数を伝えます（±1 枚で提案されることがあります）。
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="outline">プレゼンの中身（そのまま貼り付け）</Label>
            <Textarea
              id="outline"
              rows={10}
              placeholder="目的・背景・各章のポイント・伝えたいメッセージを貼り付けてください。Gemini が JSON のスライド配列に分割します。"
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-dashed border-border bg-slate-50 px-3 py-3 text-sm text-muted">
            <div className="flex items-center gap-2 text-text">
              <ListChecks size={14} />
              次のアクション
            </div>
            <p className="mt-1 text-sm font-semibold text-text">{nextAction}</p>
            <p className="text-xs text-muted">
              1. JSON プラン生成 → 2. 型画像 + 直前スライドを参照しながら 1 枚ずつ生成します。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              icon={<Sparkles size={16} />}
              onClick={runGeneration}
              disabled={isRunning}
              loading={isRunning}
            >
              プラン → 画像を一括生成
            </Button>
            {status && (
              <div className="flex items-center gap-2 text-sm text-muted">
                {isRunning ? (
                  <RefreshCw className="animate-spin text-primary" size={16} />
                ) : (
                  <CheckCircle2 className="text-green-600" size={16} />
                )}
                {status}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>進行状況</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <ImageDown size={16} />
            参照するスライド型（レイアウトのみ使用）
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {SLIDE_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-xl border border-border bg-white/70 p-3 shadow-sm"
              >
                <img
                  src={tpl.referenceImage}
                  alt={tpl.name}
                  className="mb-2 h-28 w-full rounded-lg border border-border/80 object-cover"
                />
                <p className="text-sm font-bold text-text">{tpl.name}</p>
                <p className="text-xs text-primary">ID: {tpl.id}</p>
                <p className="text-xs text-muted">{tpl.useCase}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            生成時はここにある型画像を「構成のみ」に使い、色味は直前のスライドに合わせます。
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Clock3 size={16} />
            スライド設計（Gemini 出力）
          </div>
          {plan.length === 0 ? (
            <p className="text-sm text-muted">
              まだプランがありません。プレゼン内容を貼り付けて「プラン → 画像を一括生成」を押してください。
            </p>
          ) : (
            <div className="space-y-3">
              {plan.map((item, index) => {
                const slideState = slides[index];
                const template = templatesById[item.templateId] || SLIDE_TEMPLATES[0];
                return (
                  <div
                    key={item.id || index}
                    className="rounded-xl border border-border bg-white/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-text">
                          #{index + 1} {item.title}
                        </p>
                        <p className="text-xs text-muted">
                          Template: {template.name} ({template.id})
                        </p>
                      </div>
                      <StatusPill status={slideState?.status || "pending"} />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-[1.2fr,1fr]">
                      <div className="space-y-1 text-sm text-muted">
                        {item.body?.length ? (
                          <ul className="list-disc space-y-1 pl-4">
                            {item.body.map((line, idx) => (
                              <li key={`${item.id}-body-${idx}`}>{line}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>本文がありません。</p>
                        )}
                        {item.emphasis && (
                          <p className="text-xs font-semibold text-text">
                            強調: {item.emphasis}
                          </p>
                        )}
                        {item.cta && (
                          <p className="text-xs font-semibold text-text">
                            CTA: {item.cta}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-muted">
                        {item.notes && <p>ノート: {item.notes}</p>}
                        {item.carryOver && <p>連続性: {item.carryOver}</p>}
                        {item.tone && <p>トーン: {item.tone}</p>}
                        {item.keywords?.length && (
                          <p>Keywords: {item.keywords.join(", ")}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <RefreshCw size={16} />
            フローの見える化
          </div>
          <div className="rounded-xl border border-dashed border-border bg-slate-50 p-3 text-sm text-muted">
            <p className="font-semibold text-text">進行ログ</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>
                <span className="font-semibold text-text">① 設計:</span> Gemini 3 で JSON
                プランを生成
              </li>
              <li>
                <span className="font-semibold text-text">② 連続生成:</span> 型画像
                (レイアウト) + 直前スライドを NanoBanana に渡して描画
              </li>
              <li>
                <span className="font-semibold text-text">③ 完了/保存:</span> 完了した画像は右下の保存ボタンでダウンロード
              </li>
            </ul>
            <p className="mt-2 text-xs">
              プログレスバーは「設計 1 ステップ + スライド枚数」で算出。どこまで進んだか常に見える化しています。
            </p>
          </div>
          {status && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white/70 px-3 py-2 text-sm text-muted">
              {isRunning ? (
                <RefreshCw className="animate-spin text-primary" size={16} />
              ) : (
                <CheckCircle2 className="text-green-600" size={16} />
              )}
              {status}
            </div>
          )}
          {!status && (
            <p className="text-sm text-muted">
              準備ができたら「プラン → 画像を一括生成」を押してください。状態はここに表示されます。
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted">
          <Sparkles size={16} />
          生成されたスライド
        </div>

        {slides.length === 0 ? (
          <p className="text-sm text-muted">
            まだ生成結果がありません。上部のフォームから実行してください。
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {slides.map((slide, index) => (
              <div
                key={slide.plan.id || index}
                className="flex h-full flex-col gap-3 rounded-xl border border-border bg-white/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-text">
                      #{index + 1} {slide.plan.title}
                    </p>
                    <p className="text-xs text-muted">{slide.template.name}</p>
                  </div>
                  <StatusPill status={slide.status} />
                </div>

                <div className="aspect-video overflow-hidden rounded-lg border border-border/80 bg-slate-50">
                  {slide.imageUrl ? (
                    <img
                      src={slide.imageUrl}
                      alt={slide.plan.title}
                      className="h-full w-full object-cover"
                    />
                  ) : slide.status === "generating" ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
                      <RefreshCw className="animate-spin text-primary" size={16} />
                      生成中...
                    </div>
                  ) : slide.status === "error" ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-red-600">
                      <AlertCircle size={16} /> 失敗しました
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
                      <Clock3 size={16} /> 待機中
                    </div>
                  )}
                </div>

                <p className="max-h-16 overflow-hidden text-[11px] leading-relaxed text-muted">
                  Prompt: {slide.prompt}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    icon={<Download size={14} />}
                    onClick={() => handleDownload(slide, index)}
                    disabled={!slide.imageUrl}
                  >
                    保存
                  </Button>
                  {slide.error && (
                    <span className="text-xs text-red-600">{slide.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
