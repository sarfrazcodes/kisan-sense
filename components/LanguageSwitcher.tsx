"use client";

import { useLanguage } from "@/lib/LanguageContext";

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1 rounded-md text-sm ${
          lang === "en"
            ? "bg-green-700 text-white"
            : "bg-gray-200 text-gray-700"
        }`}
      >
        English
      </button>

      <button
        onClick={() => setLang("hi")}
        className={`px-3 py-1 rounded-md text-sm ${
          lang === "hi"
            ? "bg-green-700 text-white"
            : "bg-gray-200 text-gray-700"
        }`}
      >
        हिंदी
      </button>
    </div>
  );
}