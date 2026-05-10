import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import Script from "next/script";
import * as telegramAnalytics from "@telegram-apps/analytics";

telegramAnalytics.init({
  token: process.env.NEXT_PUBLIC_ANALYTICS_TOKEN ?? "",
  appName: "stake_and_wake",
});

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
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
