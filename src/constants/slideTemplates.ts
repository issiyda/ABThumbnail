import type { SlideTemplate } from "../types";

interface BlockSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  radius?: number;
}

function encodeSvg(svg: string) {
  if (typeof window === "undefined") {
    return Buffer.from(svg, "utf-8").toString("base64");
  }
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function buildPreview(
  accent: string,
  secondary: string,
  blocks: BlockSpec[],
  label: string
) {
  const shapes = blocks
    .map((block) => {
      const color = block.color || "rgba(255,255,255,0.78)";
      const radius = block.radius ?? 14;
      return `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" rx="${radius}" fill="${color}" stroke="rgba(255,255,255,0.35)" stroke-width="3" />`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.9" />
        <stop offset="100%" stop-color="${secondary}" stop-opacity="0.95" />
      </linearGradient>
    </defs>
    <rect width="960" height="540" fill="url(#grad)" />
    <rect x="22" y="22" width="916" height="496" rx="32" fill="rgba(15,23,42,0.06)" stroke="rgba(255,255,255,0.55)" stroke-width="3" />
    ${shapes}
    <text x="40" y="70" font-family="Space Grotesk, 'Noto Sans JP', sans-serif" font-size="24" font-weight="800" fill="#0F172A" opacity="0.92">${label}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${encodeSvg(svg)}`;
}

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: "intro",
    name: "イントロ / タイトルスライド",
    structure:
      "左上にタイトルとサブタイトル、右側に背景イメージやキービジュアルを大きく配置するオープニング構成。",
    useCase: "セミナー名やテーマを最初に印象付ける導入スライド",
    referenceImage: buildPreview("#3181FC", "#7C3AED", [
      { x: 54, y: 110, width: 360, height: 160 },
      { x: 54, y: 290, width: 360, height: 80, color: "rgba(255,255,255,0.55)" },
      { x: 450, y: 100, width: 430, height: 320, color: "rgba(255,255,255,0.22)", radius: 32 },
    ], "INTRO"),
  },
  {
    id: "single-visual",
    name: "1ビジュアル + 説明",
    structure:
      "左に大きな画像、右に見出しと3〜4行の説明を縦積みで配置するシンプル構成。",
    useCase: "キービジュアルを見せつつ要点を短く伝えるページ",
    referenceImage: buildPreview("#0EA5E9", "#06B6D4", [
      { x: 60, y: 110, width: 420, height: 300, color: "rgba(255,255,255,0.2)", radius: 26 },
      { x: 520, y: 120, width: 330, height: 90 },
      { x: 520, y: 230, width: 330, height: 70 },
      { x: 520, y: 320, width: 330, height: 70 },
    ], "VISUAL + TEXT"),
  },
  {
    id: "quad-grid",
    name: "4面ギャラリー",
    structure:
      "2x2 グリッドで4枚の画像を均等に配置し、短いキャプションを添える構成。",
    useCase: "事例や比較画像をまとめて見せたいとき",
    referenceImage: buildPreview("#F97316", "#FBBF24", [
      { x: 70, y: 120, width: 300, height: 180, color: "rgba(255,255,255,0.22)" },
      { x: 370, y: 120, width: 300, height: 180, color: "rgba(255,255,255,0.22)" },
      { x: 70, y: 310, width: 300, height: 180, color: "rgba(255,255,255,0.22)" },
      { x: 370, y: 310, width: 300, height: 180, color: "rgba(255,255,255,0.22)" },
      { x: 700, y: 150, width: 200, height: 110, color: "rgba(255,255,255,0.65)" },
      { x: 700, y: 280, width: 200, height: 110, color: "rgba(255,255,255,0.65)" },
    ], "4-UP GRID"),
  },
  {
    id: "text-emphasis",
    name: "文字強調 / フルテキスト",
    structure:
      "画面の大部分を大きなテキストで埋め、下部に短い補足やCTAを配置する強調型。",
    useCase: "キーメッセージを一気に伝えたいときの強調スライド",
    referenceImage: buildPreview("#111827", "#334155", [
      { x: 70, y: 120, width: 640, height: 200, color: "rgba(255,255,255,0.85)" },
      { x: 70, y: 340, width: 420, height: 90, color: "rgba(255,255,255,0.65)" },
      { x: 520, y: 340, width: 190, height: 90, color: "rgba(15,23,42,0.4)" },
    ], "TEXT HEAVY"),
  },
  {
    id: "timeline",
    name: "ステップ / 時系列",
    structure:
      "左から右へ3〜4ステップを並べ、矢印や番号で進行を示すタイムライン構成。",
    useCase: "プロセスやロードマップ、導入手順の説明",
    referenceImage: buildPreview("#22C55E", "#4ADE80", [
      { x: 80, y: 220, width: 180, height: 120 },
      { x: 280, y: 220, width: 180, height: 120 },
      { x: 480, y: 220, width: 180, height: 120 },
      { x: 680, y: 220, width: 180, height: 120 },
      { x: 140, y: 200, width: 620, height: 12, color: "rgba(15,23,42,0.35)", radius: 6 },
    ], "TIMELINE"),
  },
];
