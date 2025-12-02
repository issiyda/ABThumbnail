'use client';

import { get, set } from "idb-keyval";
import type { GenerationHistoryItem, LpGenerationHistoryItem } from "../types";

const HISTORY_KEY = "nanobanana-thumbnail-history";
const LP_HISTORY_KEY = "nanobanana-lp-history";
const HISTORY_LIMIT = 20;

export async function saveGenerationHistory(item: GenerationHistoryItem) {
  if (typeof window === "undefined") return;
  try {
    const current: GenerationHistoryItem[] = (await get(HISTORY_KEY)) || [];
    const next = [item, ...current].slice(0, HISTORY_LIMIT);
    await set(HISTORY_KEY, next);
  } catch (error) {
    console.warn("Failed to persist history to IndexedDB", error);
  }
}

export async function fetchGenerationHistory(): Promise<GenerationHistoryItem[]> {
  if (typeof window === "undefined") return [];
  try {
    const current: GenerationHistoryItem[] = (await get(HISTORY_KEY)) || [];
    return current;
  } catch (error) {
    console.warn("Failed to read history from IndexedDB", error);
    return [];
  }
}

export async function saveLpGenerationHistory(item: LpGenerationHistoryItem) {
  if (typeof window === "undefined") return;
  try {
    const current: LpGenerationHistoryItem[] = (await get(LP_HISTORY_KEY)) || [];
    const next = [item, ...current].slice(0, HISTORY_LIMIT);
    await set(LP_HISTORY_KEY, next);
  } catch (error) {
    console.warn("Failed to persist LP history to IndexedDB", error);
  }
}

export async function fetchLpGenerationHistory(): Promise<LpGenerationHistoryItem[]> {
  if (typeof window === "undefined") return [];
  try {
    const current: LpGenerationHistoryItem[] = (await get(LP_HISTORY_KEY)) || [];
    return current;
  } catch (error) {
    console.warn("Failed to read LP history from IndexedDB", error);
    return [];
  }
}
