import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin";

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    // cron finalize-round 로직 재사용
    const { GET } = await import("@/app/api/cron/finalize-round/route");
    return GET(request);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
