import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import TranslatorProvider from "@/components/TranslatorProvider";
import VoiceButton from "@/components/VoiceButton";
import Navbar from "@/components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <TranslatorProvider>
            <Navbar />
            <main id="main-content">{children}</main>
            <VoiceButton />
          </TranslatorProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}