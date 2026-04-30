import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import Script from "next/script";  // ← 추가

export const metadata: Metadata = {
  title: "Stake & Wake",
  description: "Telegram Mini App for staking TON on waking up early."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* ← 추가 */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
