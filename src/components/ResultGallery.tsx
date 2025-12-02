"use client";

import { Crown, Download, FlaskConical, Star } from "lucide-react";
import clsx from "clsx";
import type { GeneratedImage } from "../types";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface ResultGalleryProps {
  images: GeneratedImage[];
  variantA?: string;
  variantB?: string;
  onSelectVariant: (id: string, variant: "A" | "B") => void;
  onDownload: (image: GeneratedImage) => void;
}

export default function ResultGallery({
  images,
  variantA,
  variantB,
  onSelectVariant,
  onDownload,
}: ResultGalleryProps) {
  if (!images.length) {
    return (
      <Card className="text-center text-muted">
        生成結果がここに表示されます。プロンプトを入力して生成を開始してください。
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {images.map((image) => {
        const isA = image.id === variantA;
        const isB = image.id === variantB;
        return (
          <Card
            key={image.id}
            className={clsx(
              "space-y-3 border border-transparent transition-all",
              (isA || isB) && "border-primary/70 shadow-soft"
            )}
          >
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={image.url}
                alt="Generated thumbnail"
                className="h-52 w-full object-cover"
              />
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-primary">
                <FlaskConical size={14} />
                {new Date(image.createdAt).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {image.evaluation && (
                <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                  CTR Score: {image.evaluation.score}/10
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-muted">Title</p>
                <p className="max-h-12 overflow-hidden text-sm font-bold text-text">
                  {image.title || "タイトル未設定"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                icon={<Download size={14} />}
                onClick={() => onDownload(image)}
              >
                ダウンロード
              </Button>
            </div>

            {image.evaluation && (
              <div className="rounded-lg bg-blue-50/60 p-3 text-xs text-text">
                <p className="mb-1 flex items-center gap-1 font-semibold">
                  <Star size={14} className="text-primary" />
                  改善アドバイス
                </p>
                <p className="text-muted">{image.evaluation.advice}</p>
              </div>
            )}

            <div className="rounded-lg bg-white/70 p-3">
              <p className="text-[12px] font-semibold text-muted">Prompt</p>
              <p className="max-h-20 overflow-y-auto break-words text-sm text-text/80">
                {image.prompt}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isA ? "primary" : "outline"}
                icon={<Crown size={14} />}
                onClick={() => onSelectVariant(image.id, "A")}
              >
                Variant A
              </Button>
              <Button
                type="button"
                variant={isB ? "primary" : "outline"}
                icon={<Crown size={14} />}
                onClick={() => onSelectVariant(image.id, "B")}
              >
                Variant B
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
