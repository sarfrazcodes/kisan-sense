"use client";

import { createContext, useContext, useState, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";

const TContext = createContext<(text: string) => Promise<string>>(
  async (t) => t
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

  async function translate(text: string): Promise<string> {
    // Already cached
    if (dict[text]) return dict[text];

    // Already in flight — reuse the same promise
    if (inFlight.current[text]) return inFlight.current[text];

    const promise = (async () => {
      // Retry up to 3 times with increasing delay
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

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

      // All retries failed — silently return original English text
      setDict((prev) => ({ ...prev, [text]: text }));
      return text;
    })();

    inFlight.current[text] = promise;
    promise.finally(() => {
      delete inFlight.current[text];
    });

    return promise;
  }

  // t() is now async — always returns a Promise<string>
  // For English, resolves instantly — no network call ever made
  const t = async (text: string): Promise<string> => {
    if (!text) return text;
    if (lang === "en") return text;
    return translate(text);
  };

  return <TContext.Provider value={t}>{children}</TContext.Provider>;
}
