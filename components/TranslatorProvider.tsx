"use client";

import { createContext, useContext, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

const TContext = createContext<(text: string) => string>((t) => t);

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

  async function translate(text: string) {
    if (dict[text]) return;

    const res = await fetch("/api/translate", {
      method: "POST",
      body: JSON.stringify({ texts: [text] }),
    });

    const data = await res.json();

    setDict((prev) => ({
      ...prev,
      [text]: data.results[0],
    }));
  }

  const t = (text: string) => {
    if (lang === "en") return text;

    if (!dict[text]) {
      translate(text);
      return text;
    }

    return dict[text];
  };

  return <TContext.Provider value={t}>{children}</TContext.Provider>;
}