"use client";

import { createContext, useContext, useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/LanguageContext";

interface TranslationFunction {
  (text: string): string;
  async(text: string): Promise<string>;
}

const TContext = createContext<TranslationFunction>(
  ((text: string) => text) as TranslationFunction
);

export function useT() {
  return useContext(TContext);
}

export default function TranslatorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang } = useLanguage();
  const [dict, setDict] = useState<Record<string, string>>({});

  // Track in-flight requests so we never fire the same translation twice
  const inFlight = useRef<Record<string, Promise<string>>>({});
  const pendingTranslations = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Batch translate all pending texts
    if (pendingTranslations.current.size > 0 && lang !== "en") {
      const textsToTranslate = Array.from(pendingTranslations.current);
      pendingTranslations.current.clear();

      const batchPromise = (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: textsToTranslate }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (res.ok) {
            const data = await res.json();
            const results = data.results || [];
            const newDict: Record<string, string> = {};
            textsToTranslate.forEach((text, idx) => {
              newDict[text] = results[idx] || text;
            });
            setDict((prev) => ({ ...prev, ...newDict }));
          }
        } catch (err) {
          console.error("Translation batch failed:", err);
          // Fallback: add untranslated texts to dict as-is
          const newDict: Record<string, string> = {};
          textsToTranslate.forEach((text) => {
            newDict[text] = text;
          });
          setDict((prev) => ({ ...prev, ...newDict }));
        }
      })();
    }
  }, [lang, dict]);

  // Synchronous translation - returns cached or original text immediately
  const tSync = (text: string): string => {
    if (!text) return text;
    if (lang === "en") return text;
    
    // Return cached translation if available
    if (dict[text]) return dict[text];
    
    // Mark for background translation
    if (!pendingTranslations.current.has(text)) {
      pendingTranslations.current.add(text);
      // Trigger effect in next render
      setDict((prev) => prev);
    }
    
    return text; // Return original text while translation is pending
  };

  // Asynchronous translation - useful for when you need guaranteed translation
  const tAsync = async (text: string): Promise<string> => {
    if (!text) return text;
    if (lang === "en") return text;
    
    // Check cache first
    if (dict[text]) return dict[text];
    
    // Check if already in flight
    if (text in inFlight.current) return inFlight.current[text];

    const promise = (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: [text] }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          const translated = data.results?.[0] || text;

          setDict((prev) => ({ ...prev, [text]: translated }));
          return translated;
        } catch (err) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }
        }
      }

      // All retries failed
      setDict((prev) => ({ ...prev, [text]: text }));
      return text;
    })();

    inFlight.current[text] = promise;
    promise.finally(() => {
      delete inFlight.current[text];
    });

    return promise;
  };

  // Create a function that supports both sync and async usage
  const t = tSync as TranslationFunction;
  t.async = tAsync;

  return <TContext.Provider value={t}>{children}</TContext.Provider>;
}
