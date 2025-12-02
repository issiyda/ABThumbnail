"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarRange,
  Clock3,
  Download,
  ImageDown,
  RefreshCw,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Label from "../../components/ui/Label";
import { useLocalStorage } from "../../hooks/useLocalStorage";

type Mode = "daily" | "weekly";

interface Range {
  start: string;
  end: string;
  label: string;
  days: number;
}

interface Summary {
  headline: string;
  summary: string;
  highlights: string[];
  lessons: string[];
  actions: string[];
  keywords: string[];
  imagePrompt?: string;
}

interface PreviewLog {
  id: string;
  title: string;
  time: string;
  preview: string;
}

interface ApiResponse {
  mode: Mode;
  range: Range;
  logCount: number;
  summary: Summary;
  imagePrompt: string;
  image?: string;
  logs?: PreviewLog[];
}

export default function LimitlessDigestPage() {
  const [geminiKey, setGeminiKey] = useLocalStorage<string>(
    "gemini-api-key",
    ""
  );
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [lastMode, setLastMode] = useState<Mode>("daily");
  const [logs, setLogs] = useState<PreviewLog[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const hasImage = useMemo(() => !!result?.image, [result]);

  const fetchLogs = async (mode: Mode) => {
    setStatus("Limitless からログを取得中...");
    setError(null);
    setIsFetchingLogs(true);
    setResult(null);
    setLogs([]);
    setSelectedIds([]);
    setLastMode(mode);

    try {
      const res = await fetch("/api/limitless", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          previewOnly: true,
        }),
      });
      const data = (await res.json()) as ApiResponse & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "API error");
      }
      const fetchedLogs = data.logs || [];
      setLogs(fetchedLogs);
      setSelectedIds(fetchedLogs.map((log) => log.id));
    } catch (apiError) {
      setError(
        apiError instanceof Error ? apiError.message : "ログ取得に失敗しました。"
      );
    } finally {
      setStatus(null);
      setIsFetchingLogs(false);
    }
  };

  const runGeneration = async () => {
    if (selectedIds.length === 0) {
      setError("要約に使うログを1件以上選択してください。");
      return;
    }
    setStatus("選択されたログで要約と画像を生成中...");
    setError(null);
    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/limitless", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: lastMode,
          geminiApiKey: geminiKey,
          nanoApiKey: geminiKey,
          selectedIds,
        }),
      });

      const data = (await res.json()) as ApiResponse & {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(data?.message || data?.error || "API error");
      }

      setResult(data);
    } catch (apiError) {
      setError(
        apiError instanceof Error ? apiError.message : "生成に失敗しました。"
      );
    } finally {
      setStatus(null);
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!result?.image) return;
    const suffix = result.range?.label?.replace(/[^\d]+/g, "-") || "summary";
    const link = document.createElement("a");
    link.href = result.image;
    link.download = `limitless-${lastMode}-${suffix}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            Limitless
          </p>
          <h1 className="text-3xl font-bold text-text">
            ログから学びを自動要約 & 画像化
          </h1>
          <p className="text-sm text-muted">
            Limitless のライフログを拾い、Gemini で学び中心の要約を作成。
            NanoBanana（Gemini画像生成）で「教える用」のまとめ画像を描きます。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-soft">
          <Sparkles size={16} />
          昨日 / 先週をワンクリックで教材化
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr,1fr]">
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <BookOpen size={16} />
            Limitless 要約ジョブ
          </div>
          <div className="space-y-3">
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
                ・Limitless の API キーはサーバー側の .env に設定してください。
              </p>
              <p className="text-xs text-muted">
                ・Gemini キーはローカル保存のみ。未入力の場合は簡易要約＆モック画像を使用します。
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Button
                onClick={() => fetchLogs("daily")}
                disabled={isFetchingLogs}
                loading={isFetchingLogs && lastMode === "daily"}
                icon={<Clock3 size={16} />}
              >
                昨日のログを読み込む
              </Button>
              <Button
                variant="outline"
                onClick={() => fetchLogs("weekly")}
                disabled={isFetchingLogs}
                loading={isFetchingLogs && lastMode === "weekly"}
                icon={<CalendarRange size={16} />}
              >
                先週1週間のログを読み込む
              </Button>
            </div>

            {status && (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">
                <RefreshCw size={16} className="animate-spin" />
                {status}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <ImageDown size={16} />
            生成済みまとめ画像
          </div>
          {hasImage ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-xl border border-border/80 bg-white/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result?.image}
                  alt="Summary visual"
                  className="w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  {result?.range?.label} / {result?.mode} /{" "}
                  {result?.logCount ?? 0} logs
                </div>
                <Button
                  variant="outline"
                  icon={<Download size={16} />}
                  onClick={handleDownload}
                >
                  画像をダウンロード
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              まだ生成されていません。ボタンから「昨日」または「先週」を生成してください。
            </p>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <BookOpen size={16} />
              ログ選択（要約に含めるものだけチェック）
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <Button
                variant="outline"
                className="h-9 px-3"
                onClick={() => setSelectedIds(logs.map((l) => l.id))}
                disabled={logs.length === 0}
              >
                すべて選択
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-3"
                onClick={() => setSelectedIds([])}
                disabled={logs.length === 0}
              >
                解除
              </Button>
            </div>
          </div>

          {logs.length === 0 ? (
            <p className="text-sm text-muted">
              まず「昨日のログを読み込む」または「先週1週間のログを読み込む」を押してください。
              不要なログを外してから要約を作成します。
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const checked = selectedIds.includes(log.id);
                return (
                  <label
                    key={log.id}
                    className="flex cursor-pointer gap-3 rounded-xl border border-border/70 bg-white/70 px-3 py-2 transition hover:border-primary/60"
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={checked}
                      onChange={() => {
                        setSelectedIds((prev) =>
                          checked
                            ? prev.filter((id) => id !== log.id)
                            : [...prev, log.id]
                        );
                      }}
                    />
                    <div className="mt-1">
                      {checked ? (
                        <CheckSquare className="text-primary" size={18} />
                      ) : (
                        <Square className="text-muted" size={18} />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text">
                          {log.title}
                        </p>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {log.time}
                        </span>
                      </div>
                      <p className="text-xs text-muted">{log.preview}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runGeneration}
              disabled={logs.length === 0 || isGenerating}
              loading={isGenerating}
              icon={<Sparkles size={16} />}
            >
              選択したログで要約 & 画像生成
            </Button>
            <p className="text-xs text-muted">
              選択数: {selectedIds.length} / {logs.length}
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr,1fr]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Sparkles size={16} />
              要約リザルト
            </div>
            {result?.range && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {result.range.label}（{result.mode === "daily" ? "1日" : "週次"}
                ） / {result.logCount} logs
              </span>
            )}
          </div>

          {result ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  Headline
                </p>
                <p className="text-xl font-bold text-text">
                  {result.summary.headline}
                </p>
                <p className="text-sm text-muted">{result.summary.summary}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-border/70 bg-white/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    Highlights
                  </p>
                  {result.summary.highlights.length > 0 ? (
                    <ul className="space-y-1 text-sm text-text">
                      {result.summary.highlights.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-primary">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">なし</p>
                  )}
                </div>
                <div className="space-y-2 rounded-xl border border-border/70 bg-white/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    Lessons
                  </p>
                  {result.summary.lessons.length > 0 ? (
                    <ul className="space-y-1 text-sm text-text">
                      {result.summary.lessons.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-primary">◆</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">なし</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 rounded-xl border border-border/70 bg-white/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    Next Actions
                  </p>
                  {result.summary.actions.length > 0 ? (
                    <ul className="space-y-1 text-sm text-text">
                      {result.summary.actions.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-primary">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">
                      次に試すことはまだ抽出されていません。
                    </p>
                  )}
                </div>
                <div className="space-y-1 rounded-xl border border-border/70 bg-white/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    Keywords
                  </p>
                  {result.summary.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {result.summary.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">キーワード未抽出</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              ここに要約結果が表示されます。生成後、ハイライト / 学び / 行動案を確認できます。
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <BookOpen size={16} />
            画像プロンプト（Nanobanana / Gemini 画像生成用）
          </div>
          {result ? (
            <>
              <div className="rounded-xl border border-border/70 bg-white/70 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">
                  Prompt
                </p>
                <p className="whitespace-pre-wrap text-sm text-text">
                  {result.imagePrompt}
                </p>
              </div>
              <p className="text-xs text-muted">
                プロンプトには「画像上のテキストは日本語で表示する」指示を含めています。
                色は #3181FC ベースの学習用インフォグラフィックを想定しています。
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              生成後に、NanoBanana / Gemini 画像生成に使ったプロンプトを確認できます。
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
