"use client";

import Script from "next/script";

export function AnalyticsInit() {
  return (
    <Script
      src="https://tganalytics.xyz/index.js"
      strategy="afterInteractive"
      onLoad={() => {
        (window as any).telegramAnalytics?.init({
          token: process.env.NEXT_PUBLIC_ANALYTICS_TOKEN ?? "",
          appName: "stake_and_wake",
        });
      }}
    />
  );
}
