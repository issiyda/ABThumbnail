"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PanelTop,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Label from "../../components/ui/Label";
import Textarea from "../../components/ui/Textarea";
import { MANGA_TEMPLATES } from "../../constants/manga-templates";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { generateMangaStory } from "../../lib/gemini";
import { generateImage } from "../../lib/nanobanana";
import type {
  MangaPanelPlan,
  MangaPanelResult,
  MangaStoryPlan,
  MangaTemplate,
} from "../../types";

type Step = "input" | "planning" | "ready" | "generating" | "preview";

function buildPanelPrompt(
  plan: MangaStoryPlan,
  panel: MangaPanelPlan,
  index: number,
  total: number,
  template: MangaTemplate | undefined,
  previousImage?: string,
  extraStyle?: string
) {
  const chunks = [
    `Manga LP panel ${index + 1} of ${total} (${panel.narrativePhase})`,
    plan.title && `Story: ${plan.title}`,
    plan.theme && `Theme: ${plan.theme}`,
    `Protagonist: ${plan.characters.protagonist}`,
    `Art style: ${plan.characters.style}${extraStyle ? `, ${extraStyle}` : ""}`,
    template
      ? `Follow layout template "${template.name}" (${template.structure})`
      : null,
    `Scene description: ${panel.description}`,
    `Dialogue (Japanese speech bubble): ${panel.dialogue}`,
    `Narration (Japanese on-page text): ${panel.narration}`,
    `Emotional tone: ${panel.tone}`,
    panel.visualKeywords.length
      ? `Style keywords: ${panel.visualKeywords.join(", ")}`
      : null,
    previousImage &&
      "Align characters, outfit, and colors with the previous panel reference.",
    "Vertical framing for scrolling LP manga, keep gutters clean and allow room for speech bubbles.",
    "Include speech bubbles with Japanese text, keep characters consistent through the sequence.",
    "IMPORTANT: All text content displayed within the generated image must be in Japanese.",
  ];
  return chunks.filter(Boolean).join(" | ");
}

function findTemplate(templateId: string, templates: MangaTemplate[]) {
  return templates.find((item) => item.id === templateId) || templates[0];
}

export default function MangaBuilderPage() {
  const [storyInput, setStoryInput] = useState("");
  const [artStyle, setArtStyle] = useState("劇画風・高コントラスト");
  const [geminiKey, setGeminiKey] = useLocalStorage<string>(
    "gemini-api-key",
    ""
  );
  const [plan, setPlan] = useState<MangaStoryPlan | null>(null);
  const [panels, setPanels] = useState<MangaPanelResult[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("input");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(
    MANGA_TEMPLATES.map((tpl) => tpl.id)
  );

  const activeTemplates = useMemo(() => {
    const chosen = MANGA_TEMPLATES.filter((tpl) =>
      selectedTemplateIds.includes(tpl.id)
    );
    return chosen.length > 0 ? chosen : MANGA_TEMPLATES;
  }, [selectedTemplateIds]);

  const totalPanels = panels.length;
  const donePanels = panels.filter((panel) => panel.status === "done").length;
  const progress = totalPanels
    ? Math.round((donePanels / totalPanels) * 100)
    : 0;

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const exists = prev.includes(id);
      if (exists && prev.length === 1) return prev; // keep at least one template
      if (exists) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  };

  const handleGeneratePlan = async (): Promise<MangaStoryPlan | null> => {
    if (!storyInput.trim()) return null;
    setError(null);
    setStatus("Gemini でコマ構成とセリフを設計中...");
    setStep("planning");

    try {
      const promptInput = `ストーリー設定: ${storyInput.trim()}\n希望の画風: ${artStyle}`;
      const storyPlan = await generateMangaStory(
        promptInput,
        activeTemplates,
        geminiKey
      );
      const preparedPanels: MangaPanelResult[] = storyPlan.panels.map(
        (panel) => ({
          ...panel,
          status: "pending",
        })
      );
      setPlan(storyPlan);
      setPanels(preparedPanels);
      setStep("ready");
      setStatus("構成ができました。内容を微調整して画像生成できます。");
      return storyPlan;
    } catch (planError) {
      console.error(planError);
      setError(
        planError instanceof Error
          ? planError.message
          : "ストーリー構成の生成に失敗しました。"
      );
      setStatus(null);
      setStep("input");
      return null;
    }
  };

  const runImageGeneration = async (
    storyPlan: MangaStoryPlan,
    panelList: MangaPanelResult[]
  ) => {
    if (!panelList.length) return;
    setError(null);
    setStep("generating");
    setStatus("NanoBanana で 1 枚目を生成中...");

    let previousImage: string | undefined;
    for (let i = 0; i < panelList.length; i += 1) {
      const panel = panelList[i];
      const template = findTemplate(panel.templateId, activeTemplates);
      const prompt = buildPanelPrompt(
        storyPlan,
        panel,
        i,
        panelList.length,
        template,
        previousImage,
        artStyle
      );

      setPanels((prev) =>
        prev.map((item) =>
          item.id === panel.id
            ? { ...item, status: "generating", error: undefined }
            : item
        )
      );
      setStatus(
        `NanoBanana で ${i + 1}/${panelList.length} 枚目をレンダリング中...`
      );

      try {
        const imageUrl = await generateImage(
          prompt,
          previousImage,
          geminiKey,
          undefined,
          undefined,
          template?.referenceImage,
          { aspectRatio: "3:4", imageSize: "1K" }
        );
        previousImage = imageUrl;
        setPanels((prev) =>
          prev.map((item) =>
            item.id === panel.id
              ? { ...item, status: "done", imageUrl, promptUsed: prompt }
              : item
          )
        );
      } catch (panelError) {
        console.error(panelError);
        setPanels((prev) =>
          prev.map((item) =>
            item.id === panel.id
              ? {
                  ...item,
                  status: "error",
                  error:
                    panelError instanceof Error
                      ? panelError.message
                      : "画像生成に失敗しました。",
                  promptUsed: prompt,
                }
              : item
          )
        );
      }
    }

    setStep("preview");
    setStatus(null);
  };

  const handleGenerateAll = async () => {
    const storyPlan = plan ?? (await handleGeneratePlan());
    if (!storyPlan) return;
    const preparedPanels =
      panels.length > 0
        ? panels.map((panel) => ({
            ...panel,
            status: "pending",
            imageUrl: undefined,
            promptUsed: undefined,
            error: undefined,
          }))
        : storyPlan.panels.map((panel) => ({
            ...panel,
            status: "pending",
          }));
    setPanels(preparedPanels);
    await runImageGeneration(storyPlan, preparedPanels);
  };

  const handlePanelFieldChange = (
    id: string,
    field: keyof MangaPanelPlan,
    value: string
  ) => {
    setPanels((prev) =>
      prev.map((panel) =>
        panel.id === id ? { ...panel, [field]: value } : panel
      )
    );
  };

  const handleRegenerate = async (panelId: string) => {
    if (!plan) return;
    const targetIndex = panels.findIndex((panel) => panel.id === panelId);
    if (targetIndex === -1) return;
    const target = panels[targetIndex];
    const template = findTemplate(target.templateId, activeTemplates);
    const previousImage =
      targetIndex > 0 ? panels[targetIndex - 1]?.imageUrl : undefined;
    const prompt = buildPanelPrompt(
      plan,
      target,
      targetIndex,
      panels.length,
      template,
      previousImage,
      artStyle
    );

    setPanels((prev) =>
      prev.map((panel) =>
        panel.id === panelId
          ? { ...panel, status: "generating", error: undefined }
          : panel
      )
    );
    setStatus(`「${target.id}」を再生成中...`);
    try {
      const imageUrl = await generateImage(
        prompt,
        previousImage,
        geminiKey,
        undefined,
        undefined,
        template?.referenceImage,
        { aspectRatio: "3:4", imageSize: "1K" }
      );
      setPanels((prev) =>
        prev.map((panel) =>
          panel.id === panelId
            ? { ...panel, status: "done", imageUrl, promptUsed: prompt }
            : panel
        )
      );
    } catch (panelError) {
      console.error(panelError);
      setPanels((prev) =>
        prev.map((panel) =>
          panel.id === panelId
            ? {
                ...panel,
                status: "error",
                error:
                  panelError instanceof Error
                    ? panelError.message
                    : "画像生成に失敗しました。",
                promptUsed: prompt,
              }
            : panel
        )
      );
    } finally {
      setStatus(null);
      setStep("preview");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            Manga LP Studio
          </p>
          <h1 className="text-3xl font-bold text-text">感情ゆさぶるLPマンガ生成</h1>
          <p className="text-sm text-muted">
            ストーリー設定を入れると、Gemini が起承転結のコマ割りをJSONで出力し、
            NanoBanana がテンプレ画像と直前のコマを参照しながら順番にレンダリングします。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-soft">
          <PanelTop size={16} />
          1ページ完結フロー
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Sparkles size={16} />
              Gemini API Key（ローカル保存）
            </div>
            <Label htmlFor="manga-gemini-key">Gemini API Key</Label>
            <Input
              id="manga-gemini-key"
              type="password"
              placeholder="AIza..."
              value={geminiKey}
              onChange={(event) => setGeminiKey(event.target.value)}
            />
            <p className="text-xs text-muted">
              未入力でもモック画像で動作します。キーはブラウザにのみ保存されます。
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Brief
                </p>
                <h2 className="text-xl font-bold text-text">ストーリー設定</h2>
              </div>
              <span className="text-xs text-muted">
                主人公・時代背景・分野などを書くと精度UP
              </span>
            </div>
            <Label htmlFor="manga-brief">どんな漫画にしますか？</Label>
            <Textarea
              id="manga-brief"
              rows={8}
              placeholder="例：昭和初期。貧乏な町工場の青年が新しい技術に出会い、一度は成功するも戦火ですべてを失う。そこから仲間と再起して世界を驚かせる……"
              value={storyInput}
              onChange={(event) => setStoryInput(event.target.value)}
            />
            <div className="space-y-2">
              <Label htmlFor="manga-style">画風 / 雰囲気</Label>
              <Input
                id="manga-style"
                value={artStyle}
                onChange={(event) => setArtStyle(event.target.value)}
                placeholder="劇画風、モダン、アメコミ、など"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted">
              <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-text">
                1. テーマを書く
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-text">
                2. 構成を確認
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-text">
                3. 画像生成
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                icon={<Wand2 size={16} />}
                onClick={handleGeneratePlan}
                disabled={!storyInput.trim() || step === "planning"}
                loading={step === "planning"}
              >
                構成だけ先に作る
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<PlayCircle size={16} />}
                onClick={handleGenerateAll}
                disabled={!storyInput.trim()}
              >
                構成から漫画を作成
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600">
                <AlertCircle className="inline-block" size={16} /> {error}
              </p>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Templates
                </p>
                <h2 className="text-xl font-bold text-text">
                  使うコマ割りを選択
                </h2>
              </div>
              <span className="text-xs text-muted">
                最低1つは選択された状態を保持します
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {MANGA_TEMPLATES.map((template) => {
                const active = selectedTemplateIds.includes(template.id);
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => toggleTemplate(template.id)}
                    className={clsx(
                      "group flex flex-col overflow-hidden rounded-xl border text-left transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-white hover:-translate-y-0.5 hover:shadow-sm"
                    )}
                  >
                    <img
                      src={template.referenceImage}
                      alt={template.name}
                      className="h-40 w-full object-cover"
                    />
                    <div className="space-y-1 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-text">
                          {template.name}
                        </p>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            active
                              ? "bg-primary text-white"
                              : "bg-gray-100 text-muted"
                          )}
                        >
                          {active ? "使用" : "OFF"}
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-2">
                        {template.description}
                      </p>
                      <p className="text-[11px] text-muted">
                        {template.recommendedUse}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Progress
                </p>
                <h3 className="text-lg font-bold text-text">
                  フローの進行状況
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={clsx(
                    "rounded-full px-3 py-1 font-semibold",
                    step === "preview"
                      ? "bg-emerald-50 text-emerald-700"
                      : step === "generating"
                        ? "bg-primary/10 text-primary"
                        : "bg-blue-50 text-blue-700"
                  )}
                >
                  {step === "input" && "入力待ち"}
                  {step === "planning" && "構成作成中"}
                  {step === "ready" && "構成確認OK"}
                  {step === "generating" && "画像生成中"}
                  {step === "preview" && "プレビュー"}
                </span>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {[
                { label: "Brief", active: step !== "input" || !!plan },
                { label: "構成", active: step !== "input" && !!plan },
                {
                  label: "生成",
                  active: step === "generating" || step === "preview",
                },
                { label: "完了", active: step === "preview" },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                    item.active
                      ? "border-primary/40 bg-primary/5 text-text"
                      : "border-border bg-white text-muted"
                  )}
                >
                  {item.active ? (
                    <CheckCircle2 className="text-primary" size={16} />
                  ) : (
                    <Loader2 className="text-muted" size={16} />
                  )}
                  <span>
                    {index + 1}. {item.label}
                  </span>
                </div>
              ))}
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

          {plan && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">
                    Outline
                  </p>
                  <h3 className="text-lg font-bold text-text">構成サマリー</h3>
                </div>
                <span className="text-xs text-muted">
                  ダイアログを修正してから生成できます
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-white/80 p-3">
                  <p className="text-xs text-muted">タイトル</p>
                  <p className="text-base font-semibold text-text">
                    {plan.title}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-white/80 p-3">
                  <p className="text-xs text-muted">テーマ</p>
                  <p className="text-base font-semibold text-text">
                    {plan.theme}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-white/80 p-3">
                  <p className="text-xs text-muted">主人公</p>
                  <p className="text-sm font-semibold text-text">
                    {plan.characters.protagonist}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-white/80 p-3">
                  <p className="text-xs text-muted">画風</p>
                  <p className="text-sm font-semibold text-text">
                    {plan.characters.style}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {panels.map((panel, index) => {
                  const template = findTemplate(panel.templateId, activeTemplates);
                  return (
                    <div
                      key={panel.id}
                      className="rounded-2xl border border-border/70 bg-white/80 p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-text">
                            #{index + 1} {panel.narrativePhase.toUpperCase()}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-muted">
                            {template?.name}
                          </span>
                        </div>
                        <span
                          className={clsx(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            panel.status === "done"
                              ? "bg-emerald-50 text-emerald-700"
                              : panel.status === "generating"
                                ? "bg-primary/10 text-primary"
                                : panel.status === "error"
                                  ? "bg-red-50 text-red-600"
                                  : "bg-slate-100 text-muted"
                          )}
                        >
                          {panel.status === "done" && "完了"}
                          {panel.status === "pending" && "未生成"}
                          {panel.status === "generating" && "生成中"}
                          {panel.status === "error" && "失敗"}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted">
                            描写する内容
                          </Label>
                          <Textarea
                            rows={3}
                            value={panel.description}
                            onChange={(event) =>
                              handlePanelFieldChange(
                                panel.id,
                                "description",
                                event.target.value
                              )
                            }
                            disabled={step === "generating"}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted">
                            セリフ（吹き出し）
                          </Label>
                          <Input
                            value={panel.dialogue}
                            onChange={(event) =>
                              handlePanelFieldChange(
                                panel.id,
                                "dialogue",
                                event.target.value
                              )
                            }
                            disabled={step === "generating"}
                          />
                          <Label className="text-xs text-muted">
                            ナレーション
                          </Label>
                          <Input
                            value={panel.narration}
                            onChange={(event) =>
                              handlePanelFieldChange(
                                panel.id,
                                "narration",
                                event.target.value
                              )
                            }
                            disabled={step === "generating"}
                          />
                          <Label className="text-xs text-muted">トーン</Label>
                          <Input
                            value={panel.tone}
                            onChange={(event) =>
                              handlePanelFieldChange(
                                panel.id,
                                "tone",
                                event.target.value
                              )
                            }
                            disabled={step === "generating"}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          icon={<RefreshCw size={14} />}
                          disabled={panel.status === "generating"}
                          onClick={() => handleRegenerate(panel.id)}
                        >
                          このコマだけ再生成
                        </Button>
                        {panel.promptUsed && (
                          <details className="text-[11px] text-muted">
                            <summary className="cursor-pointer select-none">
                              生成に使ったプロンプト
                            </summary>
                            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 px-2 py-1">
                              {panel.promptUsed}
                            </pre>
                          </details>
                        )}
                        {panel.error && (
                          <span className="text-xs text-red-600">
                            <AlertCircle className="inline-block" size={14} />{" "}
                            {panel.error}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  icon={<PlayCircle size={16} />}
                  loading={step === "generating"}
                  disabled={step === "generating"}
                  onClick={handleGenerateAll}
                >
                  この構成で画像生成
                </Button>
                <span className="text-xs text-muted">
                  直前のコマ画像とテンプレ画像を渡して、一貫性を保ちながら順番に生成します。
                </span>
              </div>
            </Card>
          )}

          {panels.some((panel) => panel.imageUrl) && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">
                    Preview
                  </p>
                  <h3 className="text-lg font-bold text-text">
                    生成中 / 完了したコマ
                  </h3>
                </div>
                <div className="text-xs text-muted">
                  {donePanels}/{totalPanels} 枚完了
                </div>
              </div>
              <div className="space-y-3">
                {panels.map((panel, index) => (
                  <div
                    key={panel.id}
                    className={clsx(
                      "overflow-hidden rounded-2xl border bg-white/70",
                      panel.status === "generating" && "ring-2 ring-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-border/70 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-text">
                          #{index + 1}
                        </span>
                        <span className="font-semibold text-text">
                          {panel.dialogue.slice(0, 40) || panel.description}
                        </span>
                      </div>
                      <span
                        className={clsx(
                          "rounded-full px-3 py-1 text-[11px] font-semibold",
                          panel.status === "done"
                            ? "bg-emerald-50 text-emerald-700"
                            : panel.status === "generating"
                              ? "bg-primary/10 text-primary"
                              : panel.status === "error"
                                ? "bg-red-50 text-red-600"
                                : "bg-slate-100 text-muted"
                        )}
                      >
                        {panel.status === "done" && "完了"}
                        {panel.status === "pending" && "待機中"}
                        {panel.status === "generating" && "生成中"}
                        {panel.status === "error" && "失敗"}
                      </span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1.2fr,1fr]">
                      <div className="relative min-h-[240px] bg-slate-50">
                        {panel.imageUrl ? (
                          <img
                            src={panel.imageUrl}
                            alt={panel.description}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-sm text-muted">
                            {panel.status === "generating" ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="animate-spin text-primary" />
                                レンダリング中...
                              </div>
                            ) : (
                              "まだ画像がありません"
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 border-t border-border/70 bg-slate-50/40 p-3 text-xs md:border-l md:border-t-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted">
                          シーン詳細
                        </p>
                        <p className="font-semibold text-text">
                          {panel.description}
                        </p>
                        <p className="text-muted">セリフ: {panel.dialogue}</p>
                        <p className="text-muted">
                          ナレーション: {panel.narration}
                        </p>
                        <p className="text-muted">トーン: {panel.tone}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
