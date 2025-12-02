import type { MangaTemplate } from "../types";

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
      const color = block.color || "rgba(255,255,255,0.82)";
      const radius = block.radius ?? 18;
      return `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" rx="${radius}" fill="${color}" stroke="rgba(15,23,42,0.2)" stroke-width="3" />`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.9" />
        <stop offset="100%" stop-color="${secondary}" stop-opacity="0.95" />
      </linearGradient>
    </defs>
    <rect width="768" height="1024" fill="url(#grad)" />
    <rect x="22" y="22" width="724" height="980" rx="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.55)" stroke-width="3" />
    ${shapes}
    <text x="40" y="70" font-family="Space Grotesk, 'Noto Sans JP', sans-serif" font-size="26" font-weight="800" fill="#0F172A" opacity="0.92">${label}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${encodeSvg(svg)}`;
}

export const MANGA_TEMPLATES: MangaTemplate[] = [
  {
    id: "hero-single",
    name: "1コマ主人公強調",
    description:
      "画面を1枚で使い、主人公の感情を大きく抜き出すインパクト型。セリフは1つに絞る。",
    structure:
      "Full-bleed single panel, oversized protagonist close-up, dramatic lighting, one speech bubble near face.",
    recommendedUse: "導入やクライマックスで強烈な感情を見せたいとき",
    referenceImage: buildPreview("#7C3AED", "#F97316", [
      { x: 70, y: 120, width: 628, height: 780, radius: 36 },
      { x: 420, y: 180, width: 180, height: 120, color: "rgba(255,255,255,0.65)" },
    ], "HERO"),
  },
  {
    id: "duo-contrast",
    name: "2コマ対比",
    description:
      "左右2分割でビフォーアフターや葛藤を描く。中央に対比を示す要素を置く。",
    structure:
      "Split panel, left and right halves, contrasting lighting/colors, speech bubbles on each side, small label at center seam.",
    recommendedUse: "挫折と成功、過去と現在を並べて感情の落差を作るとき",
    referenceImage: buildPreview("#0EA5E9", "#06B6D4", [
      { x: 60, y: 120, width: 300, height: 780, color: "rgba(255,255,255,0.3)", radius: 28 },
      { x: 360, y: 120, width: 300, height: 780, color: "rgba(255,255,255,0.18)", radius: 28 },
      { x: 320, y: 480, width: 120, height: 70, color: "rgba(15,23,42,0.08)", radius: 18 },
    ], "DUO"),
  },
  {
    id: "quad-progress",
    name: "4コマ展開",
    description:
      "起承転結を4分割で見せるベーシックなストーリーテンプレート。",
    structure:
      "Four-panel grid, equal squares with thin gutters, small narration labels at top of each cell, consistent character pose progression.",
    recommendedUse: "テンポよく起承転結を並べたいとき",
    referenceImage: buildPreview("#F59E0B", "#F97316", [
      { x: 60, y: 120, width: 280, height: 320, color: "rgba(255,255,255,0.22)" },
      { x: 360, y: 120, width: 280, height: 320, color: "rgba(255,255,255,0.22)" },
      { x: 60, y: 470, width: 280, height: 320, color: "rgba(255,255,255,0.22)" },
      { x: 360, y: 470, width: 280, height: 320, color: "rgba(255,255,255,0.22)" },
    ], "4-PANEL"),
  },
  {
    id: "dialogue-focus",
    name: "セリフ強調",
    description:
      "セリフやナレーションを大きく載せ、感情トーンを言葉で引っ張る型。吹き出しが主役。",
    structure:
      "Single wide panel with oversized speech bubbles, character cropped on one side, space for bold Japanese lettering.",
    recommendedUse: "決意や嘆きなど、言葉の熱量を前面に出したいとき",
    referenceImage: buildPreview("#111827", "#334155", [
      { x: 80, y: 180, width: 240, height: 620, color: "rgba(255,255,255,0.22)" },
      { x: 340, y: 220, width: 320, height: 200, color: "rgba(255,255,255,0.72)", radius: 40 },
      { x: 340, y: 460, width: 320, height: 200, color: "rgba(255,255,255,0.72)", radius: 40 },
    ], "DIALOGUE"),
  },
  {
    id: "background-mood",
    name: "背景情景",
    description:
      "背景で時代や場所を見せ、キャラクターは小さめ。ナレーション多めで雰囲気を作る。",
    structure:
      "Cinematic background focus, small characters in foreground silhouette, floating narration box at top and bottom.",
    recommendedUse: "時代背景や舞台転換を伝えたいシーン",
    referenceImage: buildPreview("#0EA5E9", "#7C3AED", [
      { x: 60, y: 160, width: 648, height: 520, color: "rgba(255,255,255,0.16)", radius: 30 },
      { x: 120, y: 140, width: 520, height: 90, color: "rgba(255,255,255,0.8)", radius: 18 },
      { x: 120, y: 700, width: 520, height: 90, color: "rgba(255,255,255,0.8)", radius: 18 },
    ], "MOOD"),
  },
];
