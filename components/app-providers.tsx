"use client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import type { ReactNode } from "react";

// ↓ 이 줄로 교체
const manifestUrl = "https://stake-and-wake.vercel.app/tonconnect-manifest.json";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}
