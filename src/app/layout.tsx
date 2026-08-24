import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "EARTH 2026 · 지구과학 실전 모의고사",
  description: "교실에서 바로 진행하는 지구과학 실전 모의고사",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141414",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${sans.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://cvfivbtvchypbeciulef.supabase.co" />
        <link rel="dns-prefetch" href="https://cvfivbtvchypbeciulef.supabase.co" />
      </head>
      <body className={`${sans.className} min-h-full bg-void text-white`}>{children}</body>
    </html>
  );
}
