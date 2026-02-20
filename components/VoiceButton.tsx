"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useState, useEffect } from "react";

export default function VoiceButton() {
  const { lang } = useLanguage();
  const [speaking, setSpeaking] = useState(false);

  // Load voices once (important for Chrome)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const handleSpeak = () => {
    if (typeof window === "undefined") return;

    const main = document.getElementById("main-content");
    const text = main?.innerText || "";

    if (!text) return;

    // stop any current speech
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);

    // language
    utter.lang = lang === "hi" ? "hi-IN" : "en-IN";
    utter.rate = 0.95;
    utter.pitch = 1;

    // pick best voice
    const voices = window.speechSynthesis.getVoices();

    if (lang === "hi") {
      const hindiVoice = voices.find(v => v.lang.includes("hi"));
      if (hindiVoice) utter.voice = hindiVoice;
    } else {
      const englishVoice = voices.find(v => v.lang.includes("en"));
      if (englishVoice) utter.voice = englishVoice;
    }

    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex gap-2">
      <button
        onClick={handleSpeak}
        className="bg-yellow-400 hover:bg-yellow-500 text-black px-5 py-3 rounded-full shadow-lg font-medium"
      >
        🔊 {speaking ? "Reading..." : "Read"}
      </button>

      {speaking && (
        <button
          onClick={handleStop}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-full shadow-lg"
        >
          Stop
        </button>
      )}
    </div>
  );
}