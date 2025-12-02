"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { ImageDown, KeyRound, Sparkles } from "lucide-react";
import { THUMBNAIL_TEMPLATES } from "../constants/templates";
import type { GenerationRequest } from "../types";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Input from "./ui/Input";
import Label from "./ui/Label";
import Select from "./ui/Select";
import Textarea from "./ui/Textarea";
import { useLocalStorage } from "../hooks/useLocalStorage";

const vibeOptions = ["おまかせ", "ビビッド", "パステル", "ダーク", "高級感"];

interface GeneratorFormProps {
  onGenerate: (
    payload: GenerationRequest,
    keys: { nanobanana: string; gemini: string }
  ) => void;
  isLoading: boolean;
}

export default function GeneratorForm({
  onGenerate,
  isLoading,
}: GeneratorFormProps) {
  const [nanoKey, setNanoKey] = useLocalStorage<string>(
    "nanobanana-api-key",
    ""
  );
  const [geminiKey, setGeminiKey] = useLocalStorage<string>(
    "gemini-api-key",
    ""
  );
  const [templateId, setTemplateId] = useState<number>(1);
  const [text, setText] = useState("");
  const [vibe, setVibe] = useState("おまかせ");
  const [count, setCount] = useState(4);
  const [useEvaluation, setUseEvaluation] = useState(true);
  const [referenceImage, setReferenceImage] = useState<string | undefined>();
  const [colorReferenceImage, setColorReferenceImage] = useState<
    string | undefined
  >();
  const [faceReferenceImage, setFaceReferenceImage] = useState<
    string | undefined
  >();
  const [layoutReferenceImage, setLayoutReferenceImage] = useState<
    string | undefined
  >();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const colorFileInputRef = useRef<HTMLInputElement | null>(null);
  const faceFileInputRef = useRef<HTMLInputElement | null>(null);
  const layoutFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleColorFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setColorReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFaceFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFaceReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLayoutFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLayoutReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    const payload: GenerationRequest = {
      templateId,
      text: text.trim(),
      vibe,
      count,
      useEvaluation,
      referenceImage,
      colorReferenceImage,
      faceReferenceImage,
      layoutReferenceImage,
    };
    onGenerate(payload, { nanobanana: geminiKey, gemini: geminiKey });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted">
          <KeyRound size={16} />
          API キー（ローカル保存・どこにも送信しません）
        </div>
        <p className="mb-3 text-xs text-muted">
          ・Gemini:
          プロンプト最適化、画像生成、AI評価に使用。未入力なら簡易ロジックで代替します。
        </p>
        <div className="grid gap-3 md:grid-cols-1">
          <div>
            <Label htmlFor="gemini-key">
              Gemini API Key（プロンプト最適化・画像生成・評価用）
            </Label>
            <Input
              id="gemini-key"
              type="password"
              placeholder="AIza..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              未入力: ローカルロジックでプロンプト/評価を実行 / 入力: Gemini API
              で高品質に生成・評価
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              Template
            </p>
            <h2 className="text-xl font-bold text-text">サムネ設計</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={14} />
            Gemini でプロンプト最適化
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label htmlFor="template">型（21種類）</Label>
              <Select
                id="template"
                value={templateId}
                onChange={(e) => setTemplateId(Number(e.target.value))}
              >
                {THUMBNAIL_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.id}. {template.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="text">メインテキスト / キーワード</Label>
              <Textarea
                id="text"
                rows={3}
                placeholder="例）失敗しない副業の始め方 / 月3万円の作り方"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div>
                <Label htmlFor="count">生成枚数 (1-10)</Label>
                <input
                  id="count"
                  type="range"
                  min={1}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="text-right text-sm font-bold text-primary">
                {count} 枚
              </div>
            </div>

            <div>
              <Label htmlFor="vibe">カラーテイスト</Label>
              <Select
                id="vibe"
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
              >
                {vibeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>人物 / アイコン画像</Label>
              {referenceImage && (
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => setReferenceImage(undefined)}
                >
                  クリア
                </button>
              )}
            </div>

            <div
              className="relative grid h-40 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-blue-50/40 text-center text-sm text-muted cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {referenceImage ? (
                <img
                  src={referenceImage}
                  alt="Reference"
                  className="h-full w-full rounded-xl object-cover"
                  style={{ maxHeight: "160px", maxWidth: "100%" }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ImageDown className="text-primary" />
                  <p className="font-semibold text-text">
                    画像をドラッグ＆ドロップ
                  </p>
                  <p>PNG / JPG</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted">
                参考画像（オプション）
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">色味の参考</Label>
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
                  className="relative grid h-24 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-primary/30 bg-blue-50/30 text-center text-xs text-muted cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => colorFileInputRef.current?.click()}
                >
                  {colorReferenceImage ? (
                    <img
                      src={colorReferenceImage}
                      alt="Color Reference"
                      className="h-full w-full rounded-lg object-cover"
                      style={{ maxHeight: "96px", maxWidth: "100%" }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImageDown className="text-primary" size={14} />
                      <p className="text-[10px]">色味参考</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={colorFileInputRef}
                    onChange={handleColorFileChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">顔写真の参考</Label>
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
                  className="relative grid h-24 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-primary/30 bg-blue-50/30 text-center text-xs text-muted cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => faceFileInputRef.current?.click()}
                >
                  {faceReferenceImage ? (
                    <img
                      src={faceReferenceImage}
                      alt="Face Reference"
                      className="h-full w-full rounded-lg object-cover"
                      style={{ maxHeight: "96px", maxWidth: "100%" }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImageDown className="text-primary" size={14} />
                      <p className="text-[10px]">顔写真参考</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={faceFileInputRef}
                    onChange={handleFaceFileChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">レイアウトの参考</Label>
                  {layoutReferenceImage && (
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => setLayoutReferenceImage(undefined)}
                    >
                      クリア
                    </button>
                  )}
                </div>
                <div
                  className="relative grid h-24 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-primary/30 bg-blue-50/30 text-center text-xs text-muted cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => layoutFileInputRef.current?.click()}
                >
                  {layoutReferenceImage ? (
                    <img
                      src={layoutReferenceImage}
                      alt="Layout Reference"
                      className="h-full w-full rounded-lg object-cover"
                      style={{ maxHeight: "96px", maxWidth: "100%" }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImageDown className="text-primary" size={14} />
                      <p className="text-[10px]">レイアウト参考</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={layoutFileInputRef}
                    onChange={handleLayoutFileChange}
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <input
                type="checkbox"
                checked={useEvaluation}
                onChange={(e) => setUseEvaluation(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              生成後に Gemini Vision で AI 評価を実行する
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            icon={<Sparkles size={16} />}
            loading={isLoading}
            disabled={isLoading || !text.trim()}
          >
            サムネイルを生成
          </Button>
        </div>
      </Card>
    </form>
  );
}
