import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "NanoBanana Thumbnail Studio",
  description:
    "Generate, iterate, and A/B test thumbnail ideas locally with NanoBanana and Gemini.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background text-text">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 bg-white/80">{children}</main>
        </div>
      </body>
    </html>
  );
}
