export type TemplateId = number;

export interface ThumbnailTemplate {
  id: TemplateId;
  name: string;
  structure: string;
  suitableFor: string;
  promptFocus: string;
}

export const THUMBNAIL_TEMPLATES: ThumbnailTemplate[] = [
  {
    id: 1,
    name: "ワンワード強調テキスト型",
    structure:
      "画面中央にインパクトのある一語を巨大配置。上下左右に小さめの説明テキスト。人物は小さく端に。",
    suitableFor: "情報系・時事ネタ・強い感情表現",
    promptFocus:
      "Huge single word text in center, high contrast, minimal subtext, small person in corner",
  },
  {
    id: 2,
    name: "フルテキスト説明型",
    structure:
      "2〜4行の太字テキストで画面を埋める。キーワードのみ極大化。背景は単色かグラデーション。",
    suitableFor: "ノウハウ系・顔出しなしの情報発信",
    promptFocus:
      "Full screen bold typography, gradient background, no human subject required, heavy text weight",
  },
  {
    id: 3,
    name: "数字付き「◯選」・箇条書きリスト型",
    structure: "タイトル＋数字バッジ。箇条書きリストやチェックボックスを配置。",
    suitableFor: "Tipsまとめ・チェックリスト系",
    promptFocus:
      "List layout, numbered badges, checklist icons, clean organization",
  },
  {
    id: 4,
    name: "左右比較2択型（VS型）",
    structure: "左右で背景色を分割。中央にVSテキスト。対比構造。",
    suitableFor: "比較検討・意思決定コンテンツ",
    promptFocus:
      "Split screen composition, two distinct background colors, VS text in center, contrasting elements",
  },
  {
    id: 5,
    name: "複数比較テーブル型（3〜4択型）",
    structure: "3〜4列のボックス横並び。下段に質問テキスト。",
    suitableFor: "サービス・商品・投資対象比較",
    promptFocus:
      "Comparison table layout, 3-4 columns, grid structure, clear separation",
  },
  {
    id: 6,
    name: "Before / After 型",
    structure: "左にBefore、右にAfter、中央に矢印。変化を強調。",
    suitableFor: "ビフォーアフター事例・変身企画",
    promptFocus:
      "Split screen, arrow in center pointing right, dull left side vs bright right side",
  },
  {
    id: 7,
    name: "成長ストーリー（0→100）型",
    structure: "左から右に伸びる巨大な矢印やグラフ。大きな数字。",
    suitableFor: "実績報告・ノウハウ共有",
    promptFocus:
      "Upward trending graph, large arrow overlay, growth visualization, dynamic angle",
  },
  {
    id: 8,
    name: "シーン・ステップ時系列型",
    structure: "枠を4つ程度並べてプロセスを表現（STEP1→2→3→4）。",
    suitableFor: "プロセス解説・ロードマップ",
    promptFocus:
      "Sequential layout, 4 panels or steps, chronological flow visual cues",
  },
  {
    id: 9,
    name: "大数字カウンター型",
    structure: "画面の30〜50％を占める巨大な数字。周囲に短い説明。",
    suitableFor: "数字インパクト重視・ランキング",
    promptFocus:
      "Massive number typography, dominant center element, eye-catching digits",
  },
  {
    id: 10,
    name: "人物中央＋テキスト囲み型",
    structure: "中央に人物シルエット/写真。上下または左右にタイトル。",
    suitableFor: "経験談・Vlog・インフルエンサー",
    promptFocus:
      "Central portrait composition, text framing the subject, clean background",
  },
  {
    id: 11,
    name: "人物左＋右テキスト縦長型",
    structure: "左に人物（バストアップ）。右側に縦書き/縦長のキーワード。",
    suitableFor: "専門性・権威性出し",
    promptFocus:
      "Subject on left, vertical typography on right, professional look",
  },
  {
    id: 12,
    name: "人物右＋左テキスト縦長型（ミラー型）",
    structure: "人物は右、テキストは左（No.11の反転）。",
    suitableFor: "専門性・権威性出し（バランス調整用）",
    promptFocus:
      "Subject on right, vertical typography on left, professional look",
  },
  {
    id: 13,
    name: "複数人物＋属性ラベル型",
    structure: "3〜4人の人物を横並び。下に属性ラベル。",
    suitableFor: "ターゲット別解説・自分ごと化",
    promptFocus:
      "Multiple subjects aligned horizontally, labels underneath each, diverse characters",
  },
  {
    id: 14,
    name: "対談・インタビュー型",
    structure: "左右に人物2人を配置。中央に「対談」ラベル。",
    suitableFor: "ゲスト回・特別企画",
    promptFocus:
      "Two subjects facing each other, interview setting, split focus",
  },
  {
    id: 15,
    name: "サービス・デバイスロゴ強調型",
    structure: "ロゴやデバイスアイコンを大きく配置。周囲にテキスト。",
    suitableFor: "ツール攻略・設定解説",
    promptFocus:
      "Central logo or device icon, tech focused, modern sleek background",
  },
  {
    id: 16,
    name: "ランキング円形エンブレム型",
    structure: "中央に円形バッジ（TOP10等）。周囲にキーワードを散らす。",
    suitableFor: "ランキング・ベスト選",
    promptFocus:
      "Central circular emblem/badge, scattered keywords background, medal style",
  },
  {
    id: 17,
    name: "書籍・マンガ・名著リスト型",
    structure: "本やマンガの書影枠を3〜5冊並べる。",
    suitableFor: "書評・教材紹介",
    promptFocus:
      "Bookshelf or floating book covers layout, 3-5 items, academic or comic style",
  },
  {
    id: 18,
    name: "SNS / アカウント紹介・実績型",
    structure: "SNS画面風UIやロゴを表示。実績数字を添える。",
    suitableFor: "運用ノウハウ・実績公開",
    promptFocus:
      "Social media UI mockups, analytics dashboard elements, smartphone frame",
  },
  {
    id: 19,
    name: "イベント / セミナー / ライブ告知型",
    structure: "上部にタイトル、下部に日時・場所詳細。ポスター風レイアウト。",
    suitableFor: "告知・LP的動画",
    promptFocus:
      "Event poster layout, clear header and footer sections, informational hierarchy",
  },
  {
    id: 20,
    name: "ノウハウ講義・講座タイトル型",
    structure: "講座名を大きく配置。英語サブタイトルなどの装飾。",
    suitableFor: "有料級講義・シリーズもの",
    promptFocus:
      "Academic or premium course title card, elegant typography, university vibe",
  },
  {
    id: 21,
    name: "アイデアカードグリッド・マトリクス型",
    structure: "小さなカードやボックスを格子状に配置。見出しを入れる。",
    suitableFor: "ネタ出し・企画まとめ",
    promptFocus:
      "Grid layout, sticky notes or card elements, brainstorming aesthetic",
  },
];
