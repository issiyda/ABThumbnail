'use client';

import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      setStoredValue(JSON.parse(raw));
    } catch {
      // fallback to string value
      setStoredValue(raw as unknown as T);
    }
  }, [key]);

  const setValue = (value: T) => {
    setStoredValue(value);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore persistence errors to keep UI responsive
    }
  };

  return [storedValue, setValue] as const;
}
