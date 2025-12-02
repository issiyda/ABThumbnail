"use client";

import { useEffect, useState } from "react";
import { BarChart2, History, RefreshCw } from "lucide-react";
import GeneratorForm from "../components/GeneratorForm";
import ResultGallery from "../components/ResultGallery";
import Card from "../components/ui/Card";
import { THUMBNAIL_TEMPLATES } from "../constants/templates";
import { fetchGenerationHistory, saveGenerationHistory } from "../lib/history";
import { evaluateImage, generatePrompt } from "../lib/gemini";
import { generateImage } from "../lib/nanobanana";
import type {
  GenerationHistoryItem,
  GenerationRequest,
  GeneratedImage,
} from "../types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function CreatePage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [variantA, setVariantA] = useState<string | undefined>();
  const [variantB, setVariantB] = useState<string | undefined>();

  useEffect(() => {
    fetchGenerationHistory().then(setHistory);
  }, []);

  const handleGenerate = async (
    payload: GenerationRequest,
    keys: { nanobanana: string; gemini: string }
  ) => {
    const template = THUMBNAIL_TEMPLATES.find(
      (item) => item.id === payload.templateId
    );
    if (!template) return;

    setIsLoading(true);
    setStatus("Gemini でプロンプトを設計中...");

    try {
      const normalizedTitle = payload.text.trim() || "thumbnail";
      const basePrompt = await generatePrompt(
        {
          templateId: template.id,
          templateName: template.name,
          templateStructure: template.structure,
          text: payload.text,
          vibe: payload.vibe,
          hasReference: !!payload.referenceImage,
          hasColorReference: !!payload.colorReferenceImage,
          hasFaceReference: !!payload.faceReferenceImage,
          hasLayoutReference: !!payload.layoutReferenceImage,
        },
        keys.gemini
      );

      const results: GeneratedImage[] = [];

      for (let i = 0; i < payload.count; i += 1) {
        setStatus(`Gemini で ${i + 1}/${payload.count} 枚目を生成中...`);
        const prompt = `${basePrompt} | focus: ${
          template.promptFocus
        } | variation ${i + 1}`;
        const url = await generateImage(
          prompt,
          payload.referenceImage,
          keys.gemini,
          payload.colorReferenceImage,
          payload.faceReferenceImage,
          payload.layoutReferenceImage
        );
        const evaluation = payload.useEvaluation
          ? await evaluateImage(url, keys.gemini)
          : undefined;
        results.push({
          id: uid(),
          url,
          title: normalizedTitle,
          prompt,
          evaluation,
          createdAt: Date.now(),
        });
      }

      setImages(results);
      setVariantA(results[0]?.id);
      setVariantB(results[1]?.id);
      setStatus(null);

      const historyItem: GenerationHistoryItem = {
        id: uid(),
        payload,
        outputs: results,
        createdAt: Date.now(),
      };
      saveGenerationHistory(historyItem);
      setHistory((prev) => [historyItem, ...prev].slice(0, 20));
    } catch (error) {
      console.error(error);
      setStatus("生成中にエラーが発生しました。設定を確認してください。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVariantSelect = (id: string, variant: "A" | "B") => {
    if (variant === "A") setVariantA(id);
    if (variant === "B") setVariantB(id);
  };

  const findImageById = (id?: string) =>
    id ? images.find((image) => image.id === id) : undefined;

  const toSafeFileName = (title: string, suffix?: string) => {
    const safe = title
      .replace(/[\s/\\?%*:|"<>]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
    return suffix ? `${safe || "thumbnail"}-${suffix}` : safe || "thumbnail";
  };

  const getExtensionFromMime = (mime: string) => {
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("svg")) return "svg";
    return "png";
  };

  const handleDownload = async (image: GeneratedImage) => {
    const index = images.findIndex((item) => item.id === image.id);
    const suffix = index >= 0 ? `v${index + 1}` : undefined;
    const fileBase = toSafeFileName(image.title || "thumbnail", suffix);
    try {
      const response = await fetch(image.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      const ext = getExtensionFromMime(blob.type || "image/png");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${fileBase}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Failed to download thumbnail", error);
    }
  };

  const selectedA = findImageById(variantA);
  const selectedB = findImageById(variantB);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Lab</p>
          <h1 className="text-3xl font-bold text-text">
            Thumbnail Generator & A/B Lab
          </h1>
          <p className="text-sm text-muted">
            Gemini がプロンプトを整え、Gemini の画像生成機能で即座に生成。AI
            によるスコアで改善サイクルを回します。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-soft">
          <BarChart2 size={16} />
          ローカル AB テスト
        </div>
      </div>

      <GeneratorForm onGenerate={handleGenerate} isLoading={isLoading} />

      {status && (
        <Card className="mt-4 flex items-center gap-3 text-sm text-muted">
          <RefreshCw className="animate-spin text-primary" size={16} />
          {status}
        </Card>
      )}

      <div className="mt-6 space-y-6">
        <ResultGallery
          images={images}
          variantA={variantA}
          variantB={variantB}
          onSelectVariant={handleVariantSelect}
          onDownload={handleDownload}
        />

        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  AB Test
                </p>
                <h3 className="text-lg font-bold text-text">
                  選択中の A/B プレビュー
                </h3>
              </div>
              <p className="text-xs text-muted">
                ギャラリーで Variant を選ぶとここに固定表示されます。
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-white/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted">Variant A</p>
                  {selectedA && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                      選択中
                    </span>
                  )}
                </div>
                {selectedA ? (
                  <>
                    <div className="overflow-hidden rounded-lg border border-border/80 bg-black/5">
                      <img
                        src={selectedA.url}
                        alt={selectedA.title}
                        className="h-56 w-full object-cover"
                      />
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="font-bold text-text">{selectedA.title}</p>
                      <p className="max-h-12 overflow-hidden text-muted">
                        {selectedA.prompt}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    ギャラリーで Variant A を選ぶとここに表示されます。
                  </p>
                )}
              </div>

              <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-white/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted">Variant B</p>
                  {selectedB && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                      選択中
                    </span>
                  )}
                </div>
                {selectedB ? (
                  <>
                    <div className="overflow-hidden rounded-lg border border-border/80 bg-black/5">
                      <img
                        src={selectedB.url}
                        alt={selectedB.title}
                        className="h-56 w-full object-cover"
                      />
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="font-bold text-text">{selectedB.title}</p>
                      <p className="max-h-12 overflow-hidden text-muted">
                        {selectedB.prompt}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    ギャラリーで Variant B を選ぶとここに表示されます。
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <History size={16} />
              生成履歴（最新 5 件）
            </div>
            <div className="space-y-2">
              {history.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-white/70 p-3 text-xs"
                >
                  <p className="font-semibold text-text">
                    {item.payload.text.slice(0, 50)}
                  </p>
                  <p className="text-muted">
                    {item.payload.count}枚 | テンプレート #
                    {item.payload.templateId} | {item.payload.vibe}
                  </p>
                  <p className="text-muted">
                    {new Date(item.createdAt).toLocaleString("ja-JP")}
                  </p>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-xs text-muted">まだ履歴がありません。</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
