import type { TemplateId } from "../constants/templates";

export type ColorVibe =
  | "おまかせ"
  | "ビビッド"
  | "パステル"
  | "ダーク"
  | "高級感"
  | string;

export interface PromptRequest {
  templateId: TemplateId;
  templateName: string;
  templateStructure: string;
  text: string;
  vibe: ColorVibe;
  hasReference: boolean;
  hasColorReference?: boolean;
  hasFaceReference?: boolean;
  hasLayoutReference?: boolean;
}

export interface GenerationRequest {
  templateId: TemplateId;
  text: string;
  vibe: ColorVibe;
  count: number;
  useEvaluation: boolean;
  referenceImage?: string;
  colorReferenceImage?: string; // 色味や色味の参考
  faceReferenceImage?: string; // ユーザーの顔写真の参考
  layoutReferenceImage?: string; // 顔写真やアイコンの参考、レイアウトの参考
}

export interface EvaluationResult {
  score: number;
  advice: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  title: string;
  prompt: string;
  evaluation?: EvaluationResult;
  createdAt: number;
}

export interface GenerationHistoryItem {
  id: string;
  payload: GenerationRequest;
  outputs: GeneratedImage[];
  createdAt: number;
}

export interface LpSectionPlan {
  id: string;
  title: string;
  goal: string;
  visualStyle: string;
  prompt: string;
  copy: string;
  cta?: string;
}

export interface SlideTemplate {
  id: string;
  name: string;
  structure: string;
  useCase: string;
  referenceImage: string;
}

export interface SlidePlanItem {
  id: string;
  templateId: string;
  title: string;
  body: string[];
  notes?: string;
  tone?: string;
  emphasis?: string;
  cta?: string;
  carryOver?: string;
  keywords?: string[];
}

export interface LpPlan {
  theme: string;
  tone: string;
  palette: string[];
  sections: LpSectionPlan[];
}

export interface LpGenerationRequest {
  lpText: string;
  colorReferenceImage?: string;
  faceReferenceImage?: string;
}

export interface LpGenerationHistoryItem {
  id: string;
  payload: LpGenerationRequest;
  plan: LpPlan;
  sections: LpSectionResult[];
  createdAt: number;
}

export interface LpSectionResult {
  id: string;
  title: string;
  goal: string;
  visualStyle: string;
  prompt: string;
  copy: string;
  cta?: string;
  imageUrl?: string;
  promptUsed: string;
}

export interface MangaTemplate {
  id: string;
  name: string;
  description: string;
  structure: string;
  referenceImage: string;
  recommendedUse: string;
}

export interface MangaPanelPlan {
  id: string;
  templateId: string;
  narrativePhase: "intro" | "rise" | "fall" | "climax" | "resolution";
  description: string;
  dialogue: string;
  narration: string;
  tone: string;
  visualKeywords: string[];
}

export interface MangaPanelResult extends MangaPanelPlan {
  status: "pending" | "generating" | "done" | "error";
  imageUrl?: string;
  promptUsed?: string;
  error?: string;
}

export interface MangaStoryPlan {
  title: string;
  theme: string;
  characters: {
    protagonist: string;
    style: string;
  };
  panels: MangaPanelPlan[];
}
