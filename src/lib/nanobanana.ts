import { generateImageWithGemini } from "./gemini";

const FALLBACK_COLORS = ["#0EA5E9", "#3181FC", "#111827", "#7C3AED", "#F97316"];

interface GenerateImageOptions {
  aspectRatio?: string;
  imageSize?: string;
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
  return window.btoa(binary);
}

function makeMockImage(prompt: string, reference?: string) {
  const color =
    FALLBACK_COLORS[Math.floor(Math.random() * FALLBACK_COLORS.length)];
  const accent =
    FALLBACK_COLORS[Math.floor(Math.random() * FALLBACK_COLORS.length)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="608" viewBox="0 0 1080 608">
    <defs>
      <linearGradient id="grad" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="608" fill="url(#grad)"/>
    <rect x="30" y="30" width="1020" height="548" rx="24" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.55)" stroke-width="3"/>
    <text x="60" y="160" font-family="Space Grotesk, sans-serif" font-size="52" font-weight="800" fill="#FFFFFF">
      ${prompt.slice(0, 26)}...
    </text>
    <text x="60" y="230" font-family="Space Grotesk, sans-serif" font-size="26" font-weight="500" fill="#E0E7FF">
      ${reference ? "Ref used" : "No reference"} · mock render
    </text>
    <circle cx="940" cy="120" r="64" fill="rgba(255,255,255,0.3)" stroke="#fff" stroke-width="4"/>
    <text x="900" y="136" font-size="34" font-family="Space Grotesk, sans-serif" fill="#0F172A">NB</text>
  </svg>`;

  return `data:image/svg+xml;base64,${encodeSvg(svg)}`;
}

/**
 * 画像を生成します（Gemini APIを使用）
 * @param prompt - 画像生成用のプロンプト
 * @param referenceImageBase64 - オプション: リファレンス画像（base64形式）
 * @param apiKey - Gemini APIキー（NanoBanana APIキーの代わりにGemini APIキーを使用）
 * @param colorReferenceImage - オプション: 色味の参考画像（base64形式）
 * @param faceReferenceImage - オプション: 顔写真の参考画像（base64形式）
 * @param layoutReferenceImage - オプション: レイアウトの参考画像（base64形式）
 * @returns 生成された画像のbase64データURI
 */
export async function generateImage(
  prompt: string,
  referenceImageBase64?: string,
  apiKey?: string,
  colorReferenceImage?: string,
  faceReferenceImage?: string,
  layoutReferenceImage?: string,
  options?: GenerateImageOptions
): Promise<string> {
  const key = apiKey?.trim();
  if (!key) {
    console.info("Gemini: no apiKey provided, using mock image.");
    return makeMockImage(prompt, referenceImageBase64);
  }

  try {
    // Gemini APIの画像生成機能を使用
    // YouTubeサムネイル用なので16:9のアスペクト比を使用
    const imageUrl = await generateImageWithGemini(
      prompt,
      key,
      referenceImageBase64,
      "gemini-3-pro-image-preview", // 高速なモデルを使用
      options?.aspectRatio ?? "16:9", // アスペクト比（LPなどで上書き可能）
      options?.imageSize ?? "1K", // 画像サイズ
      colorReferenceImage,
      faceReferenceImage,
      layoutReferenceImage
    );
    return imageUrl;
  } catch (error) {
    console.warn("Gemini image generation fallback", error);
    // エラーの詳細をログに出力
    if (error instanceof Error) {
      console.error("Error details:", error.message, error.stack);
    }
    return makeMockImage(prompt, referenceImageBase64);
  }
}
