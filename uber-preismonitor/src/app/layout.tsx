import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uber Alkhaled – Preisüberwachung Düsseldorf",
  description: "Live-Überwachung von Uber-Fahrpreisen in Düsseldorf",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#09090b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className="min-h-dvh bg-bg font-sans text-zinc-50">{children}</body>
    </html>
  );
}
